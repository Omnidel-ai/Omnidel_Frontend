"use client";

import type { EvidenceTextEntry } from "./types";
import { kindBadgeStyle, kindLabel } from "./format";
import { useTr } from "@/lib/client/language";

export function SubmissionTextBlock({
  entries,
  fallback,
}: {
  entries?: EvidenceTextEntry[] | null;
  fallback?: string | null;
}) {
  const tr = useTr();
  const list = (entries || []).filter((e) => e.text?.trim());
  if (list.length > 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {list.map((entry, i) => (
          <div
            key={`${entry.kind}-${entry.created_on || i}`}
            style={{ display: "flex", flexDirection: "column", gap: 6 }}
          >
            <span
              className="tag"
              style={{
                alignSelf: "flex-start",
                marginBottom: 0,
                ...kindBadgeStyle(entry.kind, entry.update_context),
              }}
            >
              {entry.label || kindLabel(entry.kind, entry.update_context)}
            </span>
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.55 }}>
              {entry.text.trim()}
            </div>
          </div>
        ))}
      </div>
    );
  }
  const plain = fallback?.trim();
  if (plain) {
    return <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{plain}</div>;
  }
  return <span style={{ color: "var(--ink-mute)" }}>{tr("No text submitted")}</span>;
}
