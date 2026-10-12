"use client";

import { useState, type CSSProperties } from "react";
import type { Trace, TraceStep } from "@/lib/client/mahacharya-parse";
import { useTr } from "@/lib/client/language";

/**
 * Collapsible "thinking + tool calls" log for one assistant turn. Collapsed by
 * default; expands to ordered reasoning + tool cards. Final answer stays in the
 * bubble. Renders nothing when there is no trace.
 */
export function TraceDisclosure({ trace }: { trace: Trace | null }) {
  const [open, setOpen] = useState(false);
  if (!trace || trace.steps.length === 0) return null;

  const toolCount = trace.steps.filter((s) => s.kind === "tool").length;
  const summary =
    toolCount > 0
      ? `Thought · ${toolCount} tool call${toolCount === 1 ? "" : "s"}`
      : "Thought before replying";

  return (
    <div style={wrapStyle}>
      <button
        type="button"
        style={toggleStyle}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span style={{ ...caretStyle, transform: open ? "rotate(90deg)" : "none" }} />
        {summary}
      </button>
      {open && (
        <div style={stepsStyle}>
          {trace.steps.map((step, i) => (
            <TraceStepRow key={i} step={step} />
          ))}
        </div>
      )}
    </div>
  );
}

function TraceStepRow({ step }: { step: TraceStep }) {
  const tr = useTr();
  if (step.kind === "thinking") {
    return <div style={thinkingStyle}>{step.text}</div>;
  }
  return (
    <div style={toolCardStyle}>
      <div style={toolHeadStyle}>
        <span
          style={{ ...dotStyle, background: step.ok ? "var(--green-deep)" : "var(--crit)" }}
        />
        <span style={toolNameStyle}>{step.name}</span>
      </div>
      {step.args != null && step.args !== "" && (
        <div style={detailStyle}>{tr("args:")} {preview(step.args)}</div>
      )}
      {step.ok ? (
        step.result != null && <div style={detailStyle}>→ {preview(step.result)}</div>
      ) : (
        <div style={{ ...detailStyle, color: "var(--crit)" }}>
          {tr("error:")} {step.error ?? "failed"}
        </div>
      )}
    </div>
  );
}

function preview(v: unknown, max = 300): string {
  let s: string;
  try {
    s = typeof v === "string" ? v : JSON.stringify(v);
  } catch {
    s = String(v);
  }
  if (!s) return "";
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

const wrapStyle: CSSProperties = { margin: "2px 0 8px", fontFamily: "var(--sans)" };

const toggleStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "2px 0",
  fontSize: 12,
  color: "var(--ink-mute)",
  fontFamily: "var(--sans)",
};

const caretStyle: CSSProperties = {
  display: "inline-block",
  width: 0,
  height: 0,
  borderTop: "4px solid transparent",
  borderBottom: "4px solid transparent",
  borderLeft: "5px solid var(--ink-mute)",
  marginRight: 7,
  transition: "transform 120ms ease",
};

const stepsStyle: CSSProperties = {
  marginTop: 6,
  paddingLeft: 10,
  borderLeft: "1px solid var(--ink-faint)",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const thinkingStyle: CSSProperties = {
  fontSize: 12.5,
  lineHeight: 1.5,
  color: "var(--ink-soft)",
  fontStyle: "italic",
  whiteSpace: "pre-wrap",
};

const toolCardStyle: CSSProperties = {
  background: "var(--surface-sunk)",
  borderRadius: 8,
  padding: "6px 8px",
  display: "flex",
  flexDirection: "column",
  gap: 3,
};

const toolHeadStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 6 };

const dotStyle: CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: "50%",
  flex: "0 0 auto",
};

const toolNameStyle: CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 12,
  color: "var(--ink)",
};

const detailStyle: CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 11,
  lineHeight: 1.45,
  color: "var(--ink-mute)",
  wordBreak: "break-word",
  whiteSpace: "pre-wrap",
};
