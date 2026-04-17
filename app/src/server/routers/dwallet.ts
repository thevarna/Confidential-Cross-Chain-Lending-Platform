/**
 * dWallet tRPC router — Ika integration procedures.
 */

import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import {
  readMessageApproval,
  pollForSignature,
  ApprovalStatus,
} from "@/sdk/ika-client";
import { PublicKey } from "@solana/web3.js";

export const dwalletRouter = router({
  /** Create a new dWallet record after DKG completes. */
  create: publicProcedure
    .input(
      z.object({
        owner: z.string(),
        dwalletPda: z.string(),
        publicKey: z.string(),
        authority: z.string(),
        curve: z.string(),
        attestation: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const dwallet = await ctx.prisma.dWallet.create({
        data: {
          owner: input.owner,
          dwalletPda: input.dwalletPda,
          publicKey: input.publicKey,
          authority: input.authority,
          curve: input.curve,
          state: "Active",
          attestation: input.attestation,
        },
      });
      return dwallet;
    }),

  /** Get dWallets owned by a specific wallet. */
  getByOwner: publicProcedure
    .input(z.object({ owner: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.dWallet.findMany({
        where: { owner: input.owner },
        orderBy: { createdAt: "desc" },
      });
    }),

  /** Update dWallet state after authority transfer. */
  updateAuthority: publicProcedure
    .input(
      z.object({
        id: z.string(),
        newAuthority: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.dWallet.update({
        where: { id: input.id },
        data: {
          authority: input.newAuthority,
          state: "AuthorityTransferred",
        },
      });
    }),

  /** Check the status of a MessageApproval (signature request). */
  getSignatureStatus: publicProcedure
    .input(z.object({ approvalPda: z.string() }))
    .query(async ({ ctx, input }) => {
      const pda = new PublicKey(input.approvalPda);
      const approval = await readMessageApproval(ctx.connection, pda);

      if (!approval) return { found: false, status: "not_found" as const };

      return {
        found: true,
        status: approval.status === ApprovalStatus.Signed ? "signed" as const : "pending" as const,
        signatureHex: approval.signature
          ? Buffer.from(approval.signature).toString("hex")
          : null,
      };
    }),

  /** Poll for a completed signature (long-poll). */
  waitForSignature: publicProcedure
    .input(
      z.object({
        approvalPda: z.string(),
        timeoutMs: z.number().default(30_000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const pda = new PublicKey(input.approvalPda);
      const signature = await pollForSignature(
        ctx.connection,
        pda,
        input.timeoutMs
      );

      if (!signature) return { success: false, signature: null };

      return {
        success: true,
        signature: Buffer.from(signature).toString("hex"),
      };
    }),
});
