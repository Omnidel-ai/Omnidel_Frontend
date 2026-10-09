"use client";

import { useState, type CSSProperties } from "react";
import { useTr } from "@/lib/client/language";

// A pasted wall of text (logs, data dumps) shouldn't flood the chat. Collapse
// long messages to the first ~15 lines with a "Show more" toggle. Plain text
// only (no markdown) — matches the user-bubble render.
const MAX_LINES = 15;
const MAX_CHARS = 1400;

export function CollapsibleText({ text, style }: { text: string; style?: CSSProperties }) {
  const tr = useTr();
  const [open, setOpen] = useState(false);
  const lines = text.split("\n");
  const isLong = lines.length > MAX_LINES || text.length > MAX_CHARS;

  if (!isLong) return <span style={style}>{text}</span>;

  const shown = open
    ? text
    : `${lines.slice(0, MAX_LINES).join("\n").slice(0, MAX_CHARS).replace(/\s+$/, "")} …`;

  return (
    <span style={style}>
      {shown}
      <button
        type="button"
        style={toggleStyle}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? tr("Show less") : tr("Show more")}
      </button>
    </span>
  );
}

const toggleStyle: CSSProperties = {
  display: "block",
  marginTop: 5,
  padding: 0,
  background: "none",
  border: "none",
  fontFamily: "var(--sans)",
  fontSize: 12,
  fontWeight: 600,
  color: "inherit",
  opacity: 0.85,
  textDecoration: "underline",
  cursor: "pointer",
};
