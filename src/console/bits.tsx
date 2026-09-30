import type { ReactNode } from "react";
import { Badge } from "../components";
import { STATUS_DOT, STATUS_TONE, type InstanceStatus } from "./types";

/** Serif title, an optional line under it, and the rule that closes the head. */
export function ConsoleHeader({ title, lede, children }: { title: string; lede?: string; children?: ReactNode }) {
  return (
    <header className="console-head">
      {children}
      <h2 className="console-head__title">{title}</h2>
      {lede && <p className="console-head__lede">{lede}</p>}
    </header>
  );
}

export function StatusBadge({ status }: { status: InstanceStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]} dot={STATUS_DOT[status]}>
      {status}
    </Badge>
  );
}

export function LockGlyph({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="1.5" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
