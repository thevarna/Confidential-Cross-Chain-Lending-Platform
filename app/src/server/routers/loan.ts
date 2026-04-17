/**
 * Loan tRPC router — CRUD for lending operations.
 */

import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { fetchConfig, fetchLoan, fetchAllLoans, parseLoan } from "@/sdk/program";
import { LOAN_ACCOUNT_SIZE, STATUS_LABELS } from "@/sdk/constants";
import { PublicKey } from "@solana/web3.js";

export const loanRouter = router({
  /** List all loans, optionally filtered by status or borrower. */
  list: publicProcedure
    .input(
      z
        .object({
          status: z.string().optional(),
          borrower: z.string().optional(),
          limit: z.number().min(1).max(100).default(50),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};
      if (input?.status) where.status = input.status;
      if (input?.borrower) where.borrower = input.borrower;

      const loans = await ctx.prisma.loan.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: input?.limit ?? 50,
        include: { events: { orderBy: { createdAt: "desc" }, take: 5 } },
      });

      return loans.map((l) => ({
        ...l,
        loanAmount: l.loanAmount.toString(),
        collateralAmount: l.collateralAmount.toString(),
      }));
    }),

  /** Get a single loan by ID. */
  get: publicProcedure
    .input(z.object({ loanId: z.string() }))
    .query(async ({ ctx, input }) => {
      const loan = await ctx.prisma.loan.findUnique({
        where: { id: input.loanId },
        include: { events: { orderBy: { createdAt: "desc" } } },
      });
      if (!loan) return null;
      return {
        ...loan,
        loanAmount: loan.loanAmount.toString(),
        collateralAmount: loan.collateralAmount.toString(),
      };
    }),

  /** Sync on-chain loan state into Prisma. */
  syncFromChain: publicProcedure
    .input(z.object({ loanId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const loanIdBuffer = Buffer.from(input.loanId, "hex");
      const onChainLoan = await fetchLoan(ctx.connection, loanIdBuffer);
      if (!onChainLoan) return { synced: false, reason: "not_found_on_chain" };

      const statusLabel = STATUS_LABELS[onChainLoan.status] ?? "Unknown";

      await ctx.prisma.loan.upsert({
        where: { id: input.loanId },
        create: {
          id: input.loanId,
          borrower: onChainLoan.borrower.toBase58(),
          lender: onChainLoan.lender.toBase58() !== "11111111111111111111111111111111"
            ? onChainLoan.lender.toBase58()
            : null,
          status: statusLabel,
          loanAmount: onChainLoan.loanAmount,
          interestRateBps: Number(onChainLoan.interestRateBps),
          collateralMint: onChainLoan.collateralMint.toBase58(),
          collateralAmount: onChainLoan.collateralAmount,
          durationSeconds: Number(onChainLoan.durationSeconds),
          dueDate: onChainLoan.dueDate > 0n
            ? new Date(Number(onChainLoan.dueDate) * 1000)
            : null,
          encryptedRepaymentCt: onChainLoan.encryptedRepaymentCt.toBase58(),
          encryptedLtvCt: onChainLoan.encryptedLtvCt.toBase58(),
          dwalletPubkey: onChainLoan.dwalletPubkey.toBase58(),
          settlementApproval: onChainLoan.settlementApproval.toBase58(),
          createTxSig: "synced",
        },
        update: {
          status: statusLabel,
          lender: onChainLoan.lender.toBase58() !== "11111111111111111111111111111111"
            ? onChainLoan.lender.toBase58()
            : null,
          dueDate: onChainLoan.dueDate > 0n
            ? new Date(Number(onChainLoan.dueDate) * 1000)
            : null,
          settlementApproval: onChainLoan.settlementApproval.toBase58(),
        },
      });

      return { synced: true, status: statusLabel };
    }),

  /** Record a new loan creation in Prisma (called after successful tx). */
  recordCreation: publicProcedure
    .input(
      z.object({
        loanId: z.string(),
        borrower: z.string(),
        loanAmount: z.string(),
        interestRateBps: z.number(),
        collateralMint: z.string(),
        collateralAmount: z.string(),
        durationSeconds: z.number(),
        dwalletPubkey: z.string().optional(),
        encryptedRepaymentCt: z.string().optional(),
        encryptedLtvCt: z.string().optional(),
        txSig: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const loan = await ctx.prisma.loan.create({
        data: {
          id: input.loanId,
          borrower: input.borrower,
          status: "Requested",
          loanAmount: BigInt(input.loanAmount),
          interestRateBps: input.interestRateBps,
          collateralMint: input.collateralMint,
          collateralAmount: BigInt(input.collateralAmount),
          durationSeconds: input.durationSeconds,
          dwalletPubkey: input.dwalletPubkey,
          encryptedRepaymentCt: input.encryptedRepaymentCt,
          encryptedLtvCt: input.encryptedLtvCt,
          createTxSig: input.txSig,
          events: {
            create: {
              type: "LoanCreated",
              txSig: input.txSig,
              data: JSON.stringify({
                loanAmount: input.loanAmount,
                interestRateBps: input.interestRateBps,
              }),
            },
          },
        },
      });

      return { id: loan.id, status: loan.status };
    }),

  /** Record a loan event (fund, repay, default, cancel). */
  recordEvent: publicProcedure
    .input(
      z.object({
        loanId: z.string(),
        type: z.enum(["LoanFunded", "LoanRepaid", "LoanDefaulted", "LoanCancelled"]),
        txSig: z.string(),
        data: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const statusMap: Record<string, string> = {
        LoanFunded: "Funded",
        LoanRepaid: "Repaid",
        LoanDefaulted: "Defaulted",
        LoanCancelled: "Cancelled",
      };

      await ctx.prisma.$transaction([
        ctx.prisma.loanEvent.create({
          data: {
            loanId: input.loanId,
            type: input.type,
            txSig: input.txSig,
            data: input.data,
          },
        }),
        ctx.prisma.loan.update({
          where: { id: input.loanId },
          data: {
            status: statusMap[input.type],
            ...(input.type === "LoanFunded" ? { fundTxSig: input.txSig, fundedAt: new Date() } : {}),
            ...(input.type === "LoanRepaid" ? { repayTxSig: input.txSig, repaidAt: new Date() } : {}),
          },
        }),
      ]);

      return { success: true };
    }),
});
