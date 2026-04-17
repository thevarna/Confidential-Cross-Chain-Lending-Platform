/**
 * Constants for the Confidential Cross-Chain Lending Platform.
 *
 * All sponsor program IDs, endpoints, and PDA seeds in one place.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Program IDs
// ─────────────────────────────────────────────────────────────────────────────

/** Encrypt pre-alpha program (FHE computation) */
export const ENCRYPT_PROGRAM_ID = "4ebfzWdKnrnGseuQpezXdG8yCdHqwQ1SSBHD3bWArND8";

/** Ika dWallet pre-alpha program (cross-chain signing) */
export const DWALLET_PROGRAM_ID = "87W54kGYFQ1rgWqMeu4XTPHWXWmXSQCcjm8vCTfiq1oY";

/** Our lending program (set after deployment) */
export const LENDING_PROGRAM_ID =
  process.env.NEXT_PUBLIC_LENDING_PROGRAM_ID ?? "11111111111111111111111111111111";

// ─────────────────────────────────────────────────────────────────────────────
// gRPC Endpoints
// ─────────────────────────────────────────────────────────────────────────────

/** Encrypt executor gRPC endpoint */
export const ENCRYPT_GRPC_ENDPOINT =
  process.env.ENCRYPT_GRPC_ENDPOINT ?? "https://pre-alpha-dev-1.encrypt.ika-network.net:443";

/** Ika dWallet network gRPC endpoint */
export const IKA_GRPC_ENDPOINT =
  process.env.IKA_GRPC_ENDPOINT ?? "https://pre-alpha-dev-1.ika.ika-network.net:443";

// ─────────────────────────────────────────────────────────────────────────────
// Solana
// ─────────────────────────────────────────────────────────────────────────────

/** Solana RPC endpoint */
export const SOLANA_RPC_URL =
  process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

/** Solana network name */
export const SOLANA_NETWORK =
  (process.env.NEXT_PUBLIC_SOLANA_NETWORK as "devnet" | "mainnet-beta") ?? "devnet";

// ─────────────────────────────────────────────────────────────────────────────
// PDA Seeds (must match on-chain program)
// ─────────────────────────────────────────────────────────────────────────────

/** Config PDA seed */
export const CONFIG_SEED = Buffer.from("config");

/** Loan PDA seed prefix */
export const LOAN_SEED = Buffer.from("loan");

/** Escrow PDA seed prefix */
export const ESCROW_SEED = Buffer.from("escrow");

/** Demo mint PDA seed */
export const DEMO_MINT_SEED = Buffer.from("demo_mint");

/** Encrypt CPI authority seed */
export const ENCRYPT_CPI_SEED = Buffer.from("__encrypt_cpi_authority");

/** Ika CPI authority seed */
export const IKA_CPI_SEED = Buffer.from("__ika_cpi_authority");

// ─────────────────────────────────────────────────────────────────────────────
// Instruction Discriminators
// ─────────────────────────────────────────────────────────────────────────────

export const IX_INITIALIZE = 0;
export const IX_CREATE_LOAN = 1;
export const IX_FUND_LOAN = 2;
export const IX_REPAY_LOAN = 3;
export const IX_LIQUIDATE_LOAN = 4;
export const IX_CANCEL_LOAN = 5;
export const IX_UPDATE_CONFIG = 6;
export const IX_PAUSE = 7;
export const IX_UNPAUSE = 8;

// ─────────────────────────────────────────────────────────────────────────────
// Loan Status Codes (match on-chain state.rs)
// ─────────────────────────────────────────────────────────────────────────────

export const STATUS_LABELS: Record<number, string> = {
  0: "Requested",
  1: "Funded",
  2: "Repaid",
  3: "Defaulted",
  4: "Cancelled",
};

// ─────────────────────────────────────────────────────────────────────────────
// Account Sizes
// ─────────────────────────────────────────────────────────────────────────────

export const CONFIG_ACCOUNT_SIZE = 91;
export const LOAN_ACCOUNT_SIZE = 307;

// ─────────────────────────────────────────────────────────────────────────────
// Demo Limits
// ─────────────────────────────────────────────────────────────────────────────

/** Maximum loan amount in demo (100,000 DEMO-USDC) */
export const MAX_DEMO_LOAN_AMOUNT = 100_000_000_000; // 100k with 6 decimals

/** Demo token decimals */
export const DEMO_TOKEN_DECIMALS = 6;
