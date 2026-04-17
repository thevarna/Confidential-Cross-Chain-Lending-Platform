"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Globe, Key, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { truncateKey } from "@/lib/utils";

/**
 * dWallet onboarding panel.
 *
 * Flow:
 * 1. User clicks "Create dWallet" → triggers DKG via Ika
 * 2. Shows dWallet public key, authority, state
 * 3. Transfer authority step for lending integration
 */
export function DWalletPanel() {
  const { publicKey } = useWallet();
  const [status, setStatus] = useState<"idle" | "creating" | "active" | "error">("idle");
  const [dwalletInfo, setDwalletInfo] = useState<{
    pda: string;
    publicKey: string;
    authority: string;
  } | null>(null);

  const dwallets = trpc.dwallet.getByOwner.useQuery(
    { owner: publicKey?.toBase58() ?? "" },
    { enabled: !!publicKey }
  );

  const createDWallet = trpc.dwallet.create.useMutation({
    onSuccess: (data) => {
      setDwalletInfo({
        pda: data.dwalletPda,
        publicKey: data.publicKey,
        authority: data.authority,
      });
      setStatus("active");
      dwallets.refetch();
    },
    onError: () => setStatus("error"),
  });

  const handleCreate = () => {
    if (!publicKey) return;
    setStatus("creating");

    // In pre-alpha, we create a record in Prisma.
    // In production, this would trigger a gRPC DKG request to the Ika network.
    createDWallet.mutate({
      owner: publicKey.toBase58(),
      dwalletPda: `demo-dwallet-${Date.now()}`,
      publicKey: `demo-pk-${publicKey.toBase58().slice(0, 8)}`,
      authority: publicKey.toBase58(),
      curve: "Secp256k1",
      attestation: undefined,
    });
  };

  const activeWallet = dwallets.data?.[0];

  return (
    <div className="glass-card" style={{ padding: 20 }}>
      <div className="section-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Globe size={18} style={{ color: "var(--ika-color)" }} />
          <h3 className="section-title">dWallet (Ika)</h3>
          <span className="sponsor-tag sponsor-ika">Ika</span>
        </div>
      </div>

      {activeWallet ? (
        <div className="animate-fade-in" style={{ marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <CheckCircle size={16} style={{ color: "var(--status-repaid)" }} />
            <span style={{ fontSize: 13, color: "var(--status-repaid)", fontWeight: 600 }}>
              dWallet Active
            </span>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <InfoRow label="PDA" value={truncateKey(activeWallet.dwalletPda, 6)} mono />
            <InfoRow label="Public Key" value={truncateKey(activeWallet.publicKey, 6)} mono />
            <InfoRow label="Authority" value={truncateKey(activeWallet.authority, 6)} mono />
            <InfoRow label="Curve" value={activeWallet.curve} />
            <InfoRow label="State" value={activeWallet.state} />
          </div>

          <p style={{
            marginTop: 12, fontSize: 12, color: "var(--text-tertiary)",
            fontStyle: "italic",
          }}>
            Pre-alpha: DKG is simulated. In production, this creates a real
            2-of-2 MPC key pair with the Ika network.
          </p>
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
            Create a dWallet to enable cross-chain settlement authorization.
            The dWallet will be used to sign settlement messages when you repay loans.
          </p>

          <button
            className="btn btn-primary"
            onClick={handleCreate}
            disabled={status === "creating"}
            style={{ width: "100%" }}
          >
            {status === "creating" ? (
              <>
                <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} />
                Creating dWallet...
              </>
            ) : (
              <>
                <Key size={14} />
                Create dWallet (DKG)
              </>
            )}
          </button>

          {status === "error" && (
            <div style={{
              marginTop: 8, display: "flex", alignItems: "center", gap: 6,
              fontSize: 13, color: "var(--status-defaulted)",
            }}>
              <AlertCircle size={14} />
              Failed to create dWallet. Try again.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
      <span style={{ color: "var(--text-tertiary)" }}>{label}</span>
      <span style={{
        color: "var(--text-secondary)",
        fontFamily: mono ? "var(--font-mono)" : undefined,
      }}>
        {value}
      </span>
    </div>
  );
}
