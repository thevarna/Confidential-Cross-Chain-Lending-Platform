"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Shield, Zap, Globe, ArrowRight, Lock, Landmark } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { truncateKey, formatTokenAmount, formatBps, formatDuration } from "@/lib/utils";
import { DWalletPanel } from "@/components/DWalletPanel";
import { LoanRequestForm } from "@/components/LoanRequestForm";
import { LoanList } from "@/components/LoanList";
import { PreAlphaBanner } from "@/components/PreAlphaBanner";
import { SponsorExplainer } from "@/components/SponsorExplainer";
import { EventLog } from "@/components/EventLog";

export default function DashboardPage() {
  const { publicKey, connected } = useWallet();

  return (
    <div className="page-container">
      {/* ── Header ── */}
      <header className="header">
        <div className="header-title">
          <Lock size={24} style={{ color: "#10b981" }} />
          <div>
            <h1>Confidential Lending</h1>
            <span className="header-subtitle">
              Encrypt FHE × Ika dWallet — Privacy-preserving cross-chain loans
            </span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span className="sponsor-tag sponsor-encrypt">⚡ Encrypt</span>
          <span className="sponsor-tag sponsor-ika">🌐 Ika</span>
          <WalletMultiButton />
        </div>
      </header>

      {/* ── Pre-Alpha Banner ── */}
      <PreAlphaBanner />

      {!connected ? (
        /* ── Hero / Connect Wallet ── */
        <div className="animate-fade-in-up" style={{ textAlign: "center", padding: "80px 0" }}>
          <div style={{
            width: 80, height: 80, margin: "0 auto 24px",
            background: "var(--gradient-brand)", borderRadius: "var(--radius-xl)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 40px rgba(16, 185, 129, 0.3)",
          }}>
            <Landmark size={36} color="#fff" />
          </div>
          <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 12 }}>
            Confidential Cross-Chain Lending
          </h2>
          <p style={{ color: "var(--text-secondary)", maxWidth: 560, margin: "0 auto 32px", fontSize: 16 }}>
            Borrow and lend with encrypted terms powered by Fully Homomorphic Encryption.
            Settle across chains with dWallet MPC signing — no bridges required.
          </p>

          <div className="grid-3" style={{ maxWidth: 700, margin: "0 auto 40px" }}>
            <div className="glass-card" style={{ padding: 20, textAlign: "center" }}>
              <Shield size={28} style={{ color: "var(--encrypt-color)", marginBottom: 8 }} />
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Encrypted Terms</h3>
              <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                Loan amounts and LTV computed under FHE
              </p>
            </div>
            <div className="glass-card" style={{ padding: 20, textAlign: "center" }}>
              <Globe size={28} style={{ color: "var(--ika-color)", marginBottom: 8 }} />
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Cross-Chain Settlement</h3>
              <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                dWallet signatures authorize bridgeless settlement
              </p>
            </div>
            <div className="glass-card" style={{ padding: 20, textAlign: "center" }}>
              <Zap size={28} style={{ color: "#10b981", marginBottom: 8 }} />
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Solana Native</h3>
              <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                Pinocchio program for maximum CU efficiency
              </p>
            </div>
          </div>

          <WalletMultiButton />
        </div>
      ) : (
        /* ── Connected Dashboard ── */
        <div className="animate-fade-in-up">
          {/* ── Stats Row ── */}
          <div className="grid-4" style={{ marginBottom: 24 }}>
            <StatsCard label="Your Wallet" value={truncateKey(publicKey!.toBase58(), 6)} />
            <StatsCard label="Network" value="Devnet" sub="Pre-Alpha" />
            <StatsCard label="dWallet" value="—" sub="Connect below" />
            <StatsCard label="Active Loans" value="0" sub="Create your first" />
          </div>

          {/* ── Sponsor Explainer ── */}
          <SponsorExplainer />

          {/* ── Main Content Grid ── */}
          <div className="grid-2" style={{ marginTop: 24, alignItems: "start" }}>
            {/* Left Column: dWallet + Loan Form */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <DWalletPanel />
              <LoanRequestForm />
            </div>

            {/* Right Column: Loan List + Events */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <LoanList />
              <EventLog />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Stats Card Component ── */
function StatsCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="glass-card stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ fontSize: 20 }}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}
