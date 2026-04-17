"use client";

import { ScrollText } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { truncateKey } from "@/lib/utils";

/** Real-time event log showing recent loan events. */
export function EventLog() {
  // For now, show the most recent loans as events
  const loans = trpc.loan.list.useQuery({ limit: 10 }, {
    refetchInterval: 10_000,
  });

  const events = loans.data?.flatMap((loan) =>
    (loan.events ?? []).map((e) => ({
      id: e.id,
      type: e.type,
      loanId: truncateKey(e.loanId, 4),
      txSig: truncateKey(e.txSig, 6),
      time: new Date(e.createdAt).toLocaleTimeString(),
    }))
  ) ?? [];

  return (
    <div className="glass-card" style={{ padding: 20, maxHeight: 320, overflow: "hidden" }}>
      <div className="section-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ScrollText size={18} style={{ color: "var(--text-accent)" }} />
          <h3 className="section-title">Event Log</h3>
        </div>
      </div>

      {events.length === 0 ? (
        <div style={{ padding: "20px 0", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
          No events yet. Activity will appear here as you interact with loans.
        </div>
      ) : (
        <div style={{ overflowY: "auto", maxHeight: 240 }}>
          {events.map((event) => (
            <div
              key={event.id}
              className="animate-fade-in"
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 0", borderBottom: "1px solid var(--border-subtle)",
                fontSize: 13,
              }}
            >
              <EventDot type={event.type} />
              <span style={{ fontWeight: 600, minWidth: 110 }}>{event.type}</span>
              <span className="mono" style={{ color: "var(--text-tertiary)" }}>
                {event.loanId}
              </span>
              <span style={{ marginLeft: "auto", color: "var(--text-tertiary)", fontSize: 12 }}>
                {event.time}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EventDot({ type }: { type: string }) {
  const colors: Record<string, string> = {
    LoanCreated: "var(--status-requested)",
    LoanFunded: "var(--status-funded)",
    LoanRepaid: "var(--status-repaid)",
    LoanDefaulted: "var(--status-defaulted)",
    LoanCancelled: "var(--status-cancelled)",
  };

  return (
    <div style={{
      width: 8, height: 8, borderRadius: "50%",
      background: colors[type] ?? "var(--text-tertiary)",
      flexShrink: 0,
    }} />
  );
}
