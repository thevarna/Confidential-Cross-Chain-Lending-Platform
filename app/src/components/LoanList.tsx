"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { Landmark, ExternalLink } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { truncateKey, formatBps, formatDuration, formatTokenAmount } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";
import { DEMO_TOKEN_DECIMALS } from "@/sdk/constants";

/** Loan list table showing all loans from Prisma. */
export function LoanList() {
  const { publicKey } = useWallet();
  const loans = trpc.loan.list.useQuery(undefined, {
    refetchInterval: 10_000,
  });

  return (
    <div className="glass-card" style={{ padding: 20 }}>
      <div className="section-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Landmark size={18} style={{ color: "#10b981" }} />
          <h3 className="section-title">Loan Book</h3>
        </div>
        <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
          {loans.data?.length ?? 0} loans
        </span>
      </div>

      {!loans.data || loans.data.length === 0 ? (
        <div style={{
          padding: "40px 20px", textAlign: "center",
          color: "var(--text-tertiary)", fontSize: 14,
        }}>
          <Landmark size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p>No loans yet. Create your first confidential loan to get started.</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Loan ID</th>
                <th>Amount</th>
                <th>Rate</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Borrower</th>
              </tr>
            </thead>
            <tbody>
              {loans.data.map((loan) => (
                <tr key={loan.id}>
                  <td className="mono">{truncateKey(loan.id, 4)}</td>
                  <td>
                    <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                      {formatTokenAmount(loan.loanAmount, DEMO_TOKEN_DECIMALS)}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)", marginLeft: 4 }}>
                      DEMO
                    </span>
                  </td>
                  <td>{formatBps(loan.interestRateBps)}</td>
                  <td>{formatDuration(loan.durationSeconds)}</td>
                  <td><StatusBadge status={loan.status} /></td>
                  <td className="mono">
                    {truncateKey(loan.borrower, 4)}
                    {loan.borrower === publicKey?.toBase58() && (
                      <span style={{
                        marginLeft: 6, fontSize: 10, padding: "1px 6px",
                        background: "rgba(16, 185, 129, 0.12)",
                        color: "var(--status-repaid)",
                        borderRadius: "var(--radius-full)",
                        fontWeight: 600,
                      }}>
                        YOU
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
