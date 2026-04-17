"use client";

import { Shield, Globe, ArrowRight } from "lucide-react";

/**
 * Sponsor explainer panel for hackathon judges.
 * Shows exactly where Encrypt and Ika appear in the lending flow.
 */
export function SponsorExplainer() {
  return (
    <div className="glass-card" style={{ padding: 24 }}>
      <div className="section-header" style={{ marginBottom: 16 }}>
        <h3 className="section-title">How It Works — Sponsor Integration</h3>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {/* Encrypt Flow */}
        <div style={{
          flex: 1, minWidth: 280, padding: 16,
          background: "rgba(139, 92, 246, 0.06)",
          border: "1px solid rgba(139, 92, 246, 0.15)",
          borderRadius: "var(--radius-md)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Shield size={18} style={{ color: "var(--encrypt-color)" }} />
            <span style={{ fontWeight: 700, color: "var(--encrypt-color)", fontSize: 14 }}>
              Encrypt — FHE Computation
            </span>
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
            <Step n={1}>Borrower enters loan terms (amount, rate, collateral)</Step>
            <Step n={2}>On-chain program creates <code>EUint64</code> ciphertext accounts</Step>
            <Step n={3}><code>evaluate_loan_terms</code> graph runs via CPI to Encrypt</Step>
            <Step n={4}>FHE computes repayment total + LTV ratio on encrypted values</Step>
            <Step n={5}>Results stored on-chain as encrypted ciphertext accounts</Step>
          </div>
        </div>

        {/* Arrow */}
        <div style={{
          display: "flex", alignItems: "center",
          color: "var(--text-tertiary)",
        }}>
          <ArrowRight size={20} />
        </div>

        {/* Ika Flow */}
        <div style={{
          flex: 1, minWidth: 280, padding: 16,
          background: "rgba(6, 182, 212, 0.06)",
          border: "1px solid rgba(6, 182, 212, 0.15)",
          borderRadius: "var(--radius-md)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Globe size={18} style={{ color: "var(--ika-color)" }} />
            <span style={{ fontWeight: 700, color: "var(--ika-color)", fontSize: 14 }}>
              Ika — dWallet Settlement
            </span>
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
            <Step n={1}>Borrower creates a dWallet during onboarding (DKG)</Step>
            <Step n={2}>dWallet authority transferred to lending program CPI PDA</Step>
            <Step n={3}>On repayment, program calls <code>approve_message</code> via CPI</Step>
            <Step n={4}>Ika network signs settlement message (mock in pre-alpha)</Step>
            <Step n={5}>Signature enables bridgeless cross-chain settlement</Step>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
      <span style={{
        minWidth: 20, height: 20, borderRadius: "50%",
        background: "var(--bg-primary)", display: "flex",
        alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 700, color: "var(--text-accent)",
      }}>
        {n}
      </span>
      <span>{children}</span>
    </div>
  );
}
