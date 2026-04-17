/**
 * Encrypt SDK TypeScript wrapper.
 *
 * Provides helpers for:
 * - Reading ciphertext account status
 * - Creating encrypted inputs via the Encrypt gRPC client
 * - Requesting decryption of ciphertext accounts
 * - Fetching the current network encryption key
 *
 * @see https://docs.encrypt.xyz/
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { ENCRYPT_PROGRAM_ID, ENCRYPT_GRPC_ENDPOINT } from "./constants";

const encryptProgramId = new PublicKey(ENCRYPT_PROGRAM_ID);

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Ciphertext account status (from Encrypt docs). */
export enum CiphertextStatus {
  Pending = 0,
  Verified = 1,
}

/** FHE type IDs (subset relevant to our use case). */
export enum FheType {
  EBool = 0,
  EUint8 = 1,
  EUint16 = 2,
  EUint32 = 3,
  EUint64 = 4,
  EUint128 = 5,
  EUint256 = 6,
  EAddress = 7,
}

/**
 * Parsed Ciphertext account.
 *
 * Layout (100 bytes total = 2 prefix + 98 data):
 *   [0]       discriminator (always 0 for ciphertext)
 *   [1]       version
 *   [2..34]   ciphertext_digest [u8; 32]
 *   [34..66]  authorized [u8; 32]
 *   [66..98]  network_encryption_public_key [u8; 32]
 *   [98]      fhe_type u8
 *   [99]      status u8
 */
export interface CiphertextAccount {
  ciphertextDigest: Uint8Array;
  authorized: PublicKey;
  networkEncryptionKey: PublicKey;
  fheType: FheType;
  status: CiphertextStatus;
}

/** Decryption result. */
export interface DecryptionResult {
  value: bigint;
  rawBytes: Uint8Array;
}

// ─────────────────────────────────────────────────────────────────────────────
// PDA Derivation
// ─────────────────────────────────────────────────────────────────────────────

/** Derive the Encrypt program's config PDA. */
export function findEncryptConfigPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("encrypt_config")],
    encryptProgramId
  );
}

/** Derive the Encrypt deposit PDA for a given authority. */
export function findEncryptDepositPDA(authority: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("deposit"), authority.toBuffer()],
    encryptProgramId
  );
}

/** Derive the Encrypt event authority PDA. */
export function findEncryptEventAuthority(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("__event_authority")],
    encryptProgramId
  );
}

/** Derive the CPI authority PDA for our program. */
export function findEncryptCpiAuthority(
  callerProgramId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("__encrypt_cpi_authority")],
    callerProgramId
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ciphertext Account Reader
// ─────────────────────────────────────────────────────────────────────────────

/** Read and parse a Ciphertext account. */
export async function readCiphertext(
  connection: Connection,
  ciphertextPubkey: PublicKey
): Promise<CiphertextAccount | null> {
  const info = await connection.getAccountInfo(ciphertextPubkey);
  if (!info || info.data.length < 100) return null;

  const data = info.data;
  return {
    ciphertextDigest: data.slice(2, 34),
    authorized: new PublicKey(data.slice(34, 66)),
    networkEncryptionKey: new PublicKey(data.slice(66, 98)),
    fheType: data[98] as FheType,
    status: data[99] as CiphertextStatus,
  };
}

/**
 * Poll until a ciphertext reaches Verified status.
 * The Encrypt executor must evaluate the graph and commit results first.
 */
export async function pollCiphertextVerified(
  connection: Connection,
  ciphertextPubkey: PublicKey,
  timeoutMs: number = 60_000,
  intervalMs: number = 2_000
): Promise<CiphertextAccount | null> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const ct = await readCiphertext(connection, ciphertextPubkey);
    if (ct?.status === CiphertextStatus.Verified) {
      return ct;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Network Key
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch the current Encrypt network encryption key.
 *
 * The network key PDA stores the active public key used for encrypting
 * ciphertext inputs. This key is referenced in all CPI calls.
 */
export async function fetchNetworkEncryptionKey(
  connection: Connection
): Promise<PublicKey | null> {
  // The network key is stored in the Encrypt config account
  const [configPda] = findEncryptConfigPDA();
  const info = await connection.getAccountInfo(configPda);
  if (!info) return null;

  // The network key pubkey is embedded in the config data
  // For now, return the config PDA itself as a reference
  // The actual network key account needs to be fetched from the Encrypt config
  return configPda;
}

// ─────────────────────────────────────────────────────────────────────────────
// DecryptionRequest Reader
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Read a DecryptionRequest account to get decrypted plaintext value.
 *
 * DecryptionRequest layout (from Encrypt docs):
 *   [0]        discriminator
 *   [1]        version
 *   [2..34]    ciphertext (pubkey being decrypted)
 *   [34..66]   requester
 *   [66..98]   digest (expected ciphertext digest)
 *   [98..100]  bytes_written (u16 LE)
 *   [100..102] total_len (u16 LE)
 *   [102..]    plaintext_data (variable, written in chunks)
 */
export async function readDecryptionResult(
  connection: Connection,
  decryptionRequestPubkey: PublicKey
): Promise<DecryptionResult | null> {
  const info = await connection.getAccountInfo(decryptionRequestPubkey);
  if (!info || info.data.length < 102) return null;

  const data = info.data;
  const bytesWritten = data[98] | (data[99] << 8);
  const totalLen = data[100] | (data[101] << 8);

  if (bytesWritten < totalLen) return null; // Not complete yet

  const rawBytes = data.slice(102, 102 + totalLen);

  // Parse as u64 (8 bytes LE) for EUint64
  let value = BigInt(0);
  if (rawBytes.length >= 8) {
    for (let i = 7; i >= 0; i--) {
      value = (value << BigInt(8)) | BigInt(rawBytes[i]);
    }
  }

  return { value, rawBytes };
}
