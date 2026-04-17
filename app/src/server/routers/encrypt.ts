/**
 * Encrypt tRPC router — FHE integration procedures.
 */

import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import {
  readCiphertext,
  pollCiphertextVerified,
  readDecryptionResult,
  CiphertextStatus,
} from "@/sdk/encrypt-client";
import { PublicKey } from "@solana/web3.js";

export const encryptRouter = router({
  /** Read a ciphertext account's status and metadata. */
  readCiphertext: publicProcedure
    .input(z.object({ ciphertextPubkey: z.string() }))
    .query(async ({ ctx, input }) => {
      const pubkey = new PublicKey(input.ciphertextPubkey);
      const ct = await readCiphertext(ctx.connection, pubkey);
      if (!ct) return null;

      return {
        digestHex: Buffer.from(ct.ciphertextDigest).toString("hex"),
        authorized: ct.authorized.toBase58(),
        networkKey: ct.networkEncryptionKey.toBase58(),
        fheType: ct.fheType,
        status: ct.status === CiphertextStatus.Verified ? "verified" : "pending",
      };
    }),

  /** Wait for a ciphertext to reach Verified status. */
  waitForVerification: publicProcedure
    .input(
      z.object({
        ciphertextPubkey: z.string(),
        timeoutMs: z.number().default(60_000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const pubkey = new PublicKey(input.ciphertextPubkey);
      const ct = await pollCiphertextVerified(
        ctx.connection,
        pubkey,
        input.timeoutMs
      );

      if (!ct) return { verified: false };
      return {
        verified: true,
        digestHex: Buffer.from(ct.ciphertextDigest).toString("hex"),
      };
    }),

  /** Read a completed decryption result. */
  readDecryption: publicProcedure
    .input(z.object({ decryptionRequestPubkey: z.string() }))
    .query(async ({ ctx, input }) => {
      const pubkey = new PublicKey(input.decryptionRequestPubkey);
      const result = await readDecryptionResult(ctx.connection, pubkey);
      if (!result) return null;

      return {
        value: result.value.toString(),
        rawHex: Buffer.from(result.rawBytes).toString("hex"),
      };
    }),
});
