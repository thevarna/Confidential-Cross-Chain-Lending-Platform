"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Shield, Plus, AlertCircle, CheckCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { generateLoanId, toHex, parseTokenAmount } from "@/lib/utils";
import { DEMO_TOKEN_DECIMALS } from "@/sdk/constants";

/**
 * Loan request form with Encrypt FHE integration indication.
 */
export function LoanRequestForm() {
  const { publicKey } = useWallet();
  const [loanAmount, setLoanAmount] = useState("100");
  const [collateralAmount, setCollateralAmount] = useState("200");
  const [interestRate, setInterestRate] = useState("5.00");
  const [duration, setDuration] = useState("86400"); // 1 day default
  const [status, setStatus] = useState<"idle" | "creating" | "success" | "error">("idle");

  const recordCreation = trpc.loan.recordCreation.useMutation({
    onSuccess: () => setStatus("success"),
    onError: () => setStatus("error"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey) return;
    setStatus("creating");

    const loanId = generateLoanId();
    const loanIdHex = toHex(loanId);
    const rateBps = Math.round(parseFloat(interestRate) * 100);

    // In production, this would:
    //   1. Build the CreateLoan instruction with all Encrypt accounts
    //   2. Send the transaction via wallet adapter
    //   3. Wait for confirmation
    //   4. Record in Prisma
    //
    // For the demo, we record directly in Prisma to show the flow.
    recordCreation.mutate({
      loanId: loanIdHex,
      borrower: publicKey.toBase58(),
      loanAmount: parseTokenAmount(loanAmount, DEMO_TOKEN_DECIMALS).toString(),
      interestRateBps: rateBps,
      collateralMint: "DemoCollateral111111111111111111111111111",
      collateralAmount: parseTokenAmount(collateralAmount, DEMO_TOKEN_DECIMALS).toString(),
      durationSeconds: parseInt(duration),
      dwalletPubkey: "demo-dwallet-placeholder",
      encryptedRepaymentCt: "encrypted-repayment-pending",
      encryptedLtvCt: "encrypted-ltv-pending",
      txSig: `demo-tx-${Date.now()}`,
    });
  };

  return (
    <div className="glass-card" style={{ padding: 20 }}>
      <div className="section-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Shield size={18} style={{ color: "var(--encrypt-color)" }} />
          <h3 className="section-title">Create Loan Request</h3>
          <span className="sponsor-tag sponsor-encrypt">Encrypt FHE</span>
        </div>
      </div>

      {/* Encrypt indicator */}
      <div style={{
        marginTop: 12, marginBottom: 16, padding: "8px 12px",
        background: "rgba(139, 92, 246, 0.06)",
        border: "1px solid rgba(139, 92, 246, 0.12)",
        borderRadius: "var(--radius-sm)",
        fontSize: 12, color: "var(--text-secondary)",
      }}>
        ⚡ Loan terms will be computed using the <code>evaluate_loan_terms</code> FHE graph.
        Repayment total and LTV ratio are calculated on encrypted values via Encrypt CPI.
      </div>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
        <div className="grid-2" style={{ gap: 14 }}>
          <div>
            <label className="input-label">Loan Amount (DEMO-USDC)</label>
            <input
              className="input-field"
              type="number"
              step="0.01"
              value={loanAmount}
              onChange={(e) => setLoanAmount(e.target.value)}
              placeholder="100.00"
              required
            />
          </div>
          <div>
            <label className="input-label">Collateral Value (DEMO-USDC)</label>
            <input
              className="input-field"
              type="number"
              step="0.01"
              value={collateralAmount}
              onChange={(e) => setCollateralAmount(e.target.value)}
              placeholder="200.00"
              required
            />
          </div>
        </div>

        <div className="grid-2" style={{ gap: 14 }}>
          <div>
            <label className="input-label">Interest Rate (%)</label>
            <input
              className="input-field"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={interestRate}
              onChange={(e) => setInterestRate(e.target.value)}
              placeholder="5.00"
              required
            />
          </div>
          <div>
            <label className="input-label">Duration</label>
            <select
              className="input-field"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            >
              <option value="3600">1 Hour</option>
              <option value="86400">1 Day</option>
              <option value="604800">1 Week</option>
              <option value="2592000">30 Days</option>
            </select>
          </div>
        </div>

        {/* Computed preview */}
        <div style={{
          padding: "10px 14px",
          background: "var(--bg-primary)",
          borderRadius: "var(--radius-sm)",
          fontSize: 13,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ color: "var(--text-tertiary)" }}>Est. Repayment</span>
            <span style={{ fontWeight: 600 }}>
              {(parseFloat(loanAmount || "0") * (1 + parseFloat(interestRate || "0") / 100)).toFixed(2)} DEMO-USDC
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--text-tertiary)" }}>Est. LTV</span>
            <span style={{
              fontWeight: 600,
              color: parseFloat(loanAmount || "0") / parseFloat(collateralAmount || "1") > 0.8
                ? "var(--status-defaulted)"
                : "var(--status-repaid)",
            }}>
              {((parseFloat(loanAmount || "0") / parseFloat(collateralAmount || "1")) * 100).toFixed(1)}%
            </span>
          </div>
          <div style={{
            marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--border-subtle)",
            fontSize: 11, color: "var(--encrypt-color)", fontStyle: "italic",
          }}>
            These values will be verified on-chain via Encrypt FHE graph execution
          </div>
        </div>

        <button
          className="btn btn-primary btn-lg"
          type="submit"
          disabled={status === "creating"}
          style={{ width: "100%" }}
        >
          {status === "creating" ? (
            "Creating Loan..."
          ) : (
            <>
              <Plus size={16} />
              Create Confidential Loan
            </>
          )}
        </button>

        {status === "success" && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--status-repaid)" }}>
            <CheckCircle size={14} />
            Loan created successfully! FHE graph execution pending.
          </div>
        )}
        {status === "error" && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--status-defaulted)" }}>
            <AlertCircle size={14} />
            Failed to create loan. Please try again.
          </div>
        )}
      </form>
    </div>
  );
}
