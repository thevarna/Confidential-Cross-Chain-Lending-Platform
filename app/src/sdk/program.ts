/**
 * TypeScript client for the Confidential Lending Solana program.
 *
 * Provides:
 * - PDA derivation helpers
 * - Instruction builders (serialize data + assemble account metas)
 * - Account deserialization (parse Loan & Config from raw bytes)
 */

import {
  Connection,
  PublicKey,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  LENDING_PROGRAM_ID,
  ENCRYPT_PROGRAM_ID,
  DWALLET_PROGRAM_ID,
  CONFIG_SEED,
  LOAN_SEED,
  ESCROW_SEED,
  ENCRYPT_CPI_SEED,
  IKA_CPI_SEED,
  IX_INITIALIZE,
  IX_CREATE_LOAN,
  IX_FUND_LOAN,
  IX_REPAY_LOAN,
  IX_LIQUIDATE_LOAN,
  IX_CANCEL_LOAN,
  IX_PAUSE,
  IX_UNPAUSE,
  IX_UPDATE_CONFIG,
  STATUS_LABELS,
  LOAN_ACCOUNT_SIZE,
} from "./constants";

const programId = new PublicKey(LENDING_PROGRAM_ID);

// ─────────────────────────────────────────────────────────────────────────────
// PDA Derivation
// ─────────────────────────────────────────────────────────────────────────────

export function findConfigPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([CONFIG_SEED], programId);
}

export function findLoanPDA(loanId: Buffer): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([LOAN_SEED, loanId], programId);
}

export function findEscrowPDA(loanId: Buffer): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([ESCROW_SEED, loanId], programId);
}

export function findEncryptCpiAuthority(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([ENCRYPT_CPI_SEED], programId);
}

export function findIkaCpiAuthority(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([IKA_CPI_SEED], programId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Account Deserialization
// ─────────────────────────────────────────────────────────────────────────────

export interface ConfigAccount {
  discriminator: number;
  admin: PublicKey;
  paused: boolean;
  loanCurrencyMint: PublicKey;
  maxLtvBps: bigint;
  minDuration: bigint;
  maxDuration: bigint;
  bump: number;
}

export function parseConfig(data: Buffer): ConfigAccount {
  return {
    discriminator: data[0],
    admin: new PublicKey(data.subarray(1, 33)),
    paused: data[33] !== 0,
    loanCurrencyMint: new PublicKey(data.subarray(34, 66)),
    maxLtvBps: data.readBigUInt64LE(66),
    minDuration: data.readBigInt64LE(74),
    maxDuration: data.readBigInt64LE(82),
    bump: data[90],
  };
}

export interface LoanAccount {
  discriminator: number;
  loanId: Buffer;
  borrower: PublicKey;
  lender: PublicKey;
  collateralMint: PublicKey;
  collateralAmount: bigint;
  loanAmount: bigint;
  interestRateBps: bigint;
  durationSeconds: bigint;
  dueDate: bigint;
  status: number;
  statusLabel: string;
  encryptedRepaymentCt: PublicKey;
  encryptedLtvCt: PublicKey;
  dwalletPubkey: PublicKey;
  settlementApproval: PublicKey;
  createdAt: bigint;
  fundedAt: bigint;
  repaidAt: bigint;
  bump: number;
}

export function parseLoan(data: Buffer): LoanAccount {
  const status = data[153];
  return {
    discriminator: data[0],
    loanId: data.subarray(1, 17),
    borrower: new PublicKey(data.subarray(17, 49)),
    lender: new PublicKey(data.subarray(49, 81)),
    collateralMint: new PublicKey(data.subarray(81, 113)),
    collateralAmount: data.readBigUInt64LE(113),
    loanAmount: data.readBigUInt64LE(121),
    interestRateBps: data.readBigUInt64LE(129),
    durationSeconds: data.readBigInt64LE(137),
    dueDate: data.readBigInt64LE(145),
    status,
    statusLabel: STATUS_LABELS[status] ?? "Unknown",
    encryptedRepaymentCt: new PublicKey(data.subarray(154, 186)),
    encryptedLtvCt: new PublicKey(data.subarray(186, 218)),
    dwalletPubkey: new PublicKey(data.subarray(218, 250)),
    settlementApproval: new PublicKey(data.subarray(250, 282)),
    createdAt: data.readBigInt64LE(282),
    fundedAt: data.readBigInt64LE(290),
    repaidAt: data.readBigInt64LE(298),
    bump: data[306],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Instruction Builders
// ─────────────────────────────────────────────────────────────────────────────

/** Build the Initialize instruction. */
export function buildInitializeIx(
  admin: PublicKey,
  loanCurrencyMint: PublicKey,
  maxLtvBps: bigint,
  minDuration: bigint,
  maxDuration: bigint
): TransactionInstruction {
  const [configPda] = findConfigPDA();

  const data = Buffer.alloc(57);
  data[0] = IX_INITIALIZE;
  loanCurrencyMint.toBuffer().copy(data, 1);
  data.writeBigUInt64LE(maxLtvBps, 33);
  data.writeBigInt64LE(minDuration, 41);
  data.writeBigInt64LE(maxDuration, 49);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: configPda, isSigner: false, isWritable: true },
      { pubkey: admin, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/** Build the FundLoan instruction. */
export function buildFundLoanIx(
  lender: PublicKey,
  lenderToken: PublicKey,
  escrowToken: PublicKey,
  loanId: Buffer
): TransactionInstruction {
  const [configPda] = findConfigPDA();
  const [loanPda] = findLoanPDA(loanId);

  const data = Buffer.alloc(17);
  data[0] = IX_FUND_LOAN;
  loanId.copy(data, 1);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: loanPda, isSigner: false, isWritable: true },
      { pubkey: configPda, isSigner: false, isWritable: false },
      { pubkey: lender, isSigner: true, isWritable: false },
      { pubkey: lenderToken, isSigner: false, isWritable: true },
      { pubkey: escrowToken, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/** Build the CancelLoan instruction. */
export function buildCancelLoanIx(
  borrower: PublicKey,
  loanId: Buffer
): TransactionInstruction {
  const [loanPda] = findLoanPDA(loanId);

  const data = Buffer.alloc(17);
  data[0] = IX_CANCEL_LOAN;
  loanId.copy(data, 1);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: loanPda, isSigner: false, isWritable: true },
      { pubkey: borrower, isSigner: true, isWritable: false },
    ],
    data,
  });
}

/** Build the LiquidateLoan instruction. */
export function buildLiquidateLoanIx(
  liquidator: PublicKey,
  escrowToken: PublicKey,
  lenderToken: PublicKey,
  loanId: Buffer
): TransactionInstruction {
  const [configPda] = findConfigPDA();
  const [loanPda] = findLoanPDA(loanId);
  const [escrowAuth] = findEscrowPDA(loanId);

  const data = Buffer.alloc(17);
  data[0] = IX_LIQUIDATE_LOAN;
  loanId.copy(data, 1);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: loanPda, isSigner: false, isWritable: true },
      { pubkey: configPda, isSigner: false, isWritable: false },
      { pubkey: liquidator, isSigner: true, isWritable: false },
      { pubkey: escrowToken, isSigner: false, isWritable: true },
      { pubkey: lenderToken, isSigner: false, isWritable: true },
      { pubkey: escrowAuth, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/** Build the Pause instruction. */
export function buildPauseIx(admin: PublicKey): TransactionInstruction {
  const [configPda] = findConfigPDA();
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: configPda, isSigner: false, isWritable: true },
      { pubkey: admin, isSigner: true, isWritable: false },
    ],
    data: Buffer.from([IX_PAUSE]),
  });
}

/** Build the Unpause instruction. */
export function buildUnpauseIx(admin: PublicKey): TransactionInstruction {
  const [configPda] = findConfigPDA();
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: configPda, isSigner: false, isWritable: true },
      { pubkey: admin, isSigner: true, isWritable: false },
    ],
    data: Buffer.from([IX_UNPAUSE]),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Fetch and parse the Config account. */
export async function fetchConfig(connection: Connection): Promise<ConfigAccount | null> {
  const [configPda] = findConfigPDA();
  const info = await connection.getAccountInfo(configPda);
  if (!info) return null;
  return parseConfig(Buffer.from(info.data));
}

/** Fetch and parse a Loan account by loan ID. */
export async function fetchLoan(
  connection: Connection,
  loanId: Buffer
): Promise<LoanAccount | null> {
  const [loanPda] = findLoanPDA(loanId);
  const info = await connection.getAccountInfo(loanPda);
  if (!info) return null;
  return parseLoan(Buffer.from(info.data));
}

/** Fetch all Loan accounts for the program. */
export async function fetchAllLoans(connection: Connection): Promise<LoanAccount[]> {
  const accounts = await connection.getProgramAccounts(programId, {
    filters: [
      { dataSize: LOAN_ACCOUNT_SIZE },
      { memcmp: { offset: 0, bytes: "2" } }, // LOAN_DISCRIMINATOR = 2 (base58 "2")
    ],
  });

  return accounts.map((a) => parseLoan(Buffer.from(a.account.data)));
}
