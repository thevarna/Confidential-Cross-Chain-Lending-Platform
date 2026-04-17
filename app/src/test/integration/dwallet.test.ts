import { describe, it, expect, beforeAll } from "vitest";
import { api } from "../setup";
import { prisma } from "@/server/trpc";
import crypto from "crypto";

describe("dWallet TRPC Router Integration", () => {
  const TEST_DWALLET_PDA = "TestPDA1111111111111111111111111111111111111";
  const TEST_OWNER = "Owner1111111111111111111111111111111111111";

  beforeAll(async () => {
    // Clean up test data if needed
    await prisma.dWallet.deleteMany({ where: { dwalletPda: TEST_DWALLET_PDA } });
  });

  it("should create a new dWallet record", async () => {
    const res = await api.dwallet.create({
      owner: TEST_OWNER,
      dwalletPda: TEST_DWALLET_PDA,
      publicKey: "mock_public_key_hex",
      authority: TEST_OWNER,
      curve: "secp256k1",
    });

    expect(res).toBeDefined();
    expect(res.dwalletPda).toBe(TEST_DWALLET_PDA);
    expect(res.state).toBe("Active");

    const dbRecord = await prisma.dWallet.findFirst({ where: { dwalletPda: TEST_DWALLET_PDA } });
    expect(dbRecord).toBeDefined();
    expect(dbRecord?.owner).toBe(TEST_OWNER);
  });

  it("should retrieve dWallets by owner", async () => {
    const wallets = await api.dwallet.getByOwner({ owner: TEST_OWNER });
    expect(wallets).toBeInstanceOf(Array);
    expect(wallets.length).toBeGreaterThan(0);
    expect(wallets[0].owner).toBe(TEST_OWNER);
  });

  it("should update authority", async () => {
    const wallets = await api.dwallet.getByOwner({ owner: TEST_OWNER });
    const id = wallets[0].id;
    
    const NEW_AUTHORITY = "NewAuth11111111111111111111111111111111111";

    const updated = await api.dwallet.updateAuthority({
      id,
      newAuthority: NEW_AUTHORITY,
    });

    expect(updated.authority).toBe(NEW_AUTHORITY);
    expect(updated.state).toBe("AuthorityTransferred");
  });
});
