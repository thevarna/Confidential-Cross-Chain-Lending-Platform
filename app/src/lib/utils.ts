/**
 * Shared utility functions.
 */

import { PublicKey } from "@solana/web3.js";
import { DEMO_TOKEN_DECIMALS } from "@/sdk/constants";

/** Format a token amount with decimals for display. */
export function formatTokenAmount(amount: bigint | string, decimals = DEMO_TOKEN_DECIMALS): string {
  const amt = typeof amount === "string" ? BigInt(amount) : amount;
  const divisor = BigInt(10 ** decimals);
  const whole = amt / divisor;
  const frac = amt % divisor;
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr}` : whole.toString();
}

/** Parse a human-readable amount to smallest unit. */
export function parseTokenAmount(amount: string, decimals = DEMO_TOKEN_DECIMALS): bigint {
  const [whole, frac = ""] = amount.split(".");
  const fracPadded = frac.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(whole + fracPadded);
}

/** Truncate a public key or hash for display. */
export function truncateKey(key: string, chars = 4): string {
  if (key.length <= chars * 2 + 3) return key;
  return `${key.slice(0, chars)}...${key.slice(-chars)}`;
}

/** Generate a random 16-byte loan ID. */
export function generateLoanId(): Buffer {
  return Buffer.from(globalThis.crypto.getRandomValues(new Uint8Array(16)));
}

/** Convert a Buffer to hex string. */
export function toHex(buf: Buffer | Uint8Array): string {
  return Buffer.from(buf).toString("hex");
}

/** Format a Unix timestamp as a locale date string. */
export function formatTimestamp(ts: bigint | number): string {
  const ms = typeof ts === "bigint" ? Number(ts) * 1000 : ts * 1000;
  if (ms === 0) return "—";
  return new Date(ms).toLocaleString();
}

/** Format basis points as percentage. */
export function formatBps(bps: number | bigint): string {
  const n = typeof bps === "bigint" ? Number(bps) : bps;
  return `${(n / 100).toFixed(2)}%`;
}

/** Format seconds as a human-readable duration. */
export function formatDuration(seconds: number | bigint): string {
  const s = typeof seconds === "bigint" ? Number(seconds) : seconds;
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/** Check if a PublicKey is the zero address. */
export function isZeroAddress(key: PublicKey): boolean {
  return key.toBase58() === "11111111111111111111111111111111";
}

/** Loan status color mapping for UI. */
export const STATUS_COLORS: Record<string, string> = {
  Requested: "var(--status-requested)",
  Funded: "var(--status-funded)",
  Repaid: "var(--status-repaid)",
  Defaulted: "var(--status-defaulted)",
  Cancelled: "var(--status-cancelled)",
};
