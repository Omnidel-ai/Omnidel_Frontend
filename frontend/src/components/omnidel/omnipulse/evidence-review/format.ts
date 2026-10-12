import type { CSSProperties } from "react";
import {
  classifyUpdateEvidence,
  evidenceLabel,
  type EvidenceSemantic,
} from "@/lib/omnipulse/work-event-classify";

export function formatScoreOutOfTen(score: number | null | undefined): string {
  if (typeof score !== "number" || Number.isNaN(score)) return "—";
  return `${(score * 10).toFixed(1)}/10`;
}

export function formatDueDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

export function formatDuration(seconds: number | null | undefined): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m <= 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

export function semanticFromEntry(entry: {
  kind?: string | null;
  update_context?: string | null;
}): EvidenceSemantic {
  return classifyUpdateEvidence(entry.update_context, entry.kind);
}

export function kindLabel(
  kind: string | null | undefined,
  updateContext?: string | null,
): string {
  return evidenceLabel(classifyUpdateEvidence(updateContext, kind), kind);
}

export function kindBadgeStyle(
  kind: string | null | undefined,
  updateContext?: string | null,
): CSSProperties {
  const semantic = classifyUpdateEvidence(updateContext, kind);
  if (semantic === "break_started") {
    return { background: "var(--ochre-wash)", color: "var(--ochre)" };
  }
  if (semantic === "session_completed") {
    return { background: "var(--ok-wash)", color: "var(--ok)" };
  }
  if (semantic === "task_completed") {
    return { background: "var(--green-wash, var(--ok-wash))", color: "var(--green-deep)" };
  }
  return { background: "var(--surface)", color: "var(--ink-soft)" };
}

export function formatSubtaskSessions(sub: {
  session_count?: number;
  sessions_completed?: number;
} | null | undefined): string {
  if (!sub) return "—";
  const required = Math.max(1, Number(sub.session_count) || 1);
  const done = Math.min(required, Math.max(0, Number(sub.sessions_completed) || 0));
  return `${done}/${required} completed`;
}

export function formatSubtaskBreaks(sub: {
  break_allowance_per_segment?: number[];
} | null | undefined): string {
  if (!sub) return "—";
  const segs = Array.isArray(sub.break_allowance_per_segment)
    ? sub.break_allowance_per_segment.map((n) => Math.max(0, Number(n) || 0))
    : [];
  if (segs.length === 0) return "—";
  const total = segs.reduce((sum, n) => sum + n, 0);
  if (total <= 0) return "0 allowed";
  const uniform = segs.every((n) => n === segs[0]);
  if (!uniform) {
    return `${total} total (${segs.map((n, i) => `S${i + 1}: ${n}`).join(", ")})`;
  }
  return `${total} allowed`;
}

export {
  displayKarigarName,
  resolveKarigarLabel,
} from "@/lib/omnipulse/karigar-label";
