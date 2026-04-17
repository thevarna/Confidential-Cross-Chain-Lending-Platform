"use client";

/** Animated status badge with pulsing dot. */
export function StatusBadge({ status }: { status: string }) {
  const className = `status-badge status-${status.toLowerCase()}`;
  return <span className={className}>{status}</span>;
}
