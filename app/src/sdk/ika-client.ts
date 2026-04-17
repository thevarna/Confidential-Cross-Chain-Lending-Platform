/**
 * Ika dWallet TypeScript client wrapper.
 *
 * Thin wrapper around the Ika gRPC service for dWallet operations:
 * - DKG (create dWallet)
 * - Presign allocation
 * - Message approval PDA derivation
 * - Signature polling
 *
 * Since the Ika TypeScript client package is not publicly available,
 * this module builds the gRPC requests manually using Solana web3.js
 * for on-chain interactions and direct RPC calls for off-chain operations.
 *
 * @see https://solana-pre-alpha.ika.xyz/
 */

import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { keccak_256 } from "@noble/hashes/sha3";
import { DWALLET_PROGRAM_ID, IKA_GRPC_ENDPOINT } from "./constants";

const dwalletProgramId = new PublicKey(DWALLET_PROGRAM_ID);

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Supported elliptic curves for dWallet DKG. */
export enum DWalletCurve {
  Secp256k1 = 0,
  Secp256r1 = 1,
  Curve25519 = 2,
  Ristretto = 3,
}

/** Signature schemes for message signing. */
export enum DWalletSignatureScheme {
  EcdsaSecp256k1Keccak256 = 0,
  EcdsaSecp256k1Sha256 = 1,
  EcdsaSecp256r1Sha256 = 2,
  Ed25519 = 3,
  SchnorrkelSubstrate = 4,
  EcdsaSecp256k1Bitcoin = 5,
  Ed25519Blake2b = 6,
}

/** MessageApproval account status. */
export enum ApprovalStatus {
  Pending = 0,
  Signed = 1,
}

/** Parsed MessageApproval account data. */
export interface MessageApproval {
  status: ApprovalStatus;
  signatureLen: number;
  signature: Uint8Array | null;
}

/** dWallet creation result. */
export interface DWalletInfo {
  dwalletPda: PublicKey;
  publicKey: Uint8Array;
  authority: PublicKey;
  curve: DWalletCurve;
}

// ─────────────────────────────────────────────────────────────────────────────
// PDA Derivation
// ─────────────────────────────────────────────────────────────────────────────

/** Derive the DWalletCoordinator PDA. */
export function findCoordinatorPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("dwallet_coordinator")],
    dwalletProgramId
  );
}

/** Derive a MessageApproval PDA for a given signing request. */
export function findMessageApprovalPDA(
  dwalletRootPubkey: Uint8Array,
  curve: number,
  signatureScheme: number,
  messageDigest: Uint8Array,
  messageMetadataDigest: Uint8Array
): [PublicKey, number] {
  const curveBytes = Buffer.alloc(2);
  curveBytes.writeUInt16LE(curve);
  const schemeBytes = Buffer.alloc(2);
  schemeBytes.writeUInt16LE(signatureScheme);

  const seeds: Buffer[] = [
    Buffer.from("message_approval"),
    curveBytes,
    Buffer.from(dwalletRootPubkey),
    schemeBytes,
    Buffer.from(messageDigest),
  ];

  // Only include metadata digest if non-zero
  const isNonZero = messageMetadataDigest.some((b) => b !== 0);
  if (isNonZero) {
    seeds.push(Buffer.from(messageMetadataDigest));
  }

  return PublicKey.findProgramAddressSync(seeds, dwalletProgramId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Message Digest
// ─────────────────────────────────────────────────────────────────────────────

/** Compute the keccak256 message digest for a settlement message. */
export function computeSettlementDigest(settlementData: {
  loanId: string;
  borrower: string;
  lender: string;
  amount: bigint;
  timestamp: number;
}): Uint8Array {
  const message = JSON.stringify({
    ...settlementData,
    amount: settlementData.amount.toString(),
    type: "LOAN_REPAYMENT_SETTLEMENT",
    protocol: "confidential-lending",
  });
  return keccak_256(new TextEncoder().encode(message));
}

// ─────────────────────────────────────────────────────────────────────────────
// On-Chain Read
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Read a MessageApproval account to check if the signature is ready.
 *
 * Layout (from Ika docs):
 *   [0..172]   header fields
 *   [172]      status (0=Pending, 1=Signed)
 *   [173..175] signature_len (u16 LE)
 *   [175..]    signature bytes
 */
export async function readMessageApproval(
  connection: Connection,
  approvalPda: PublicKey
): Promise<MessageApproval | null> {
  const info = await connection.getAccountInfo(approvalPda);
  if (!info) return null;

  const data = info.data;
  const status = data[172] as ApprovalStatus;
  const signatureLen = data[173] | (data[174] << 8);
  const signature =
    status === ApprovalStatus.Signed && signatureLen > 0
      ? data.slice(175, 175 + signatureLen)
      : null;

  return { status, signatureLen, signature };
}

/**
 * Poll for a completed signature on a MessageApproval PDA.
 * Returns the signature bytes once available, or null on timeout.
 */
export async function pollForSignature(
  connection: Connection,
  approvalPda: PublicKey,
  timeoutMs: number = 60_000,
  intervalMs: number = 2_000
): Promise<Uint8Array | null> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const approval = await readMessageApproval(connection, approvalPda);
    if (approval?.status === ApprovalStatus.Signed && approval.signature) {
      return approval.signature;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  return null;
}
