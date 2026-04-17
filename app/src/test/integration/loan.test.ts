import { describe, it, expect, beforeAll } from "vitest";
import { api } from "../setup";
import { prisma } from "@/server/trpc";
import crypto from "crypto";

describe("Loan TRPC Router Integration", () => {
  const TEST_LOAN_ID = crypto.randomBytes(16).toString("hex");
  const TEST_BORROWER = "11111111111111111111111111111111"; // Dummy pubkey
  
  beforeAll(async () => {
    // Clean up test data if needed
    await prisma.loanEvent.deleteMany({ where: { loanId: TEST_LOAN_ID } });
    await prisma.loan.deleteMany({ where: { id: TEST_LOAN_ID } });
  });

  it("should record a new loan creation", async () => {
    const res = await api.loan.recordCreation({
      loanId: TEST_LOAN_ID,
      borrower: TEST_BORROWER,
      loanAmount: "1000",
      interestRateBps: 500,
      collateralMint: TEST_BORROWER,
      collateralAmount: "2000",
      durationSeconds: 3600,
      txSig: "test_sig_123",
    });

    expect(res.id).toBe(TEST_LOAN_ID);
    expect(res.status).toBe("Requested");

    const dbLoan = await prisma.loan.findUnique({ where: { id: TEST_LOAN_ID } });
    expect(dbLoan).toBeDefined();
    expect(dbLoan?.borrower).toBe(TEST_BORROWER);
    expect(dbLoan?.loanAmount.toString()).toBe("1000");
  });

  it("should retrieve a loan by ID", async () => {
    const loan = await api.loan.get({ loanId: TEST_LOAN_ID });
    expect(loan).toBeDefined();
    expect(loan?.id).toBe(TEST_LOAN_ID);
    expect(loan?.events).toHaveLength(1); // the creation event
  });

  it("should record a loan funded event and update status", async () => {
    await api.loan.recordEvent({
      loanId: TEST_LOAN_ID,
      type: "LoanFunded",
      txSig: "test_sig_fund",
    });

    const loan = await api.loan.get({ loanId: TEST_LOAN_ID });
    expect(loan?.status).toBe("Funded");
    expect(loan?.fundedAt).toBeDefined();
    
    // Check events
    expect(loan?.events.find((e) => e.type === "LoanFunded")).toBeDefined();
  });

  it("should list loans properly", async () => {
    const loans = await api.loan.list({ limit: 10 });
    expect(loans.length).toBeGreaterThan(0);
    const found = loans.find(l => l.id === TEST_LOAN_ID);
    expect(found).toBeDefined();
  });
});
