"use client";

import { AlertTriangle } from "lucide-react";

/** Persistent pre-alpha disclaimer banner. */
export function PreAlphaBanner() {
  return (
    <div className="pre-alpha-banner">
      <AlertTriangle size={16} className="icon" />
      <span>
        <strong>Pre-Alpha Demo</strong> — No real encryption (Encrypt) or MPC signing (Ika).
        All values are plaintext. Synthetic data only. Do not submit sensitive information.
      </span>
    </div>
  );
}
