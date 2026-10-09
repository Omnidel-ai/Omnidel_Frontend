"use client";

/**
 * Openers on an empty chat.
 *
 * A blank box and a blinking cursor is the worst thing to hand a karigar who
 * cannot easily type and has never been told what an Acharya is FOR. The
 * reference put four subjects under the greeting; these are the four things a
 * karigar actually opens this chat to ask — today's work, how to do it, how the
 * session works, and what photo to send at the end.
 *
 * The LABEL is short enough to read at a glance; the PROMPT it sends is a
 * proper question, because the model answers the sentence, not the chip.
 *
 * They disappear the moment the conversation has anything in it. A suggestion
 * that survives the first reply stops being a starting point and becomes
 * furniture in the way of the thread.
 */

import type { CSSProperties, ReactNode } from "react";
import type { t } from "@/lib/i18n/strings";

type Labels = ReturnType<typeof t>;

interface Props {
  labels: Labels;
  onPick: (prompt: string) => void;
  disabled?: boolean;
}

function chips(s: Labels): Array<{ key: string; label: string; prompt: string; icon: ReactNode }> {
  return [
    { key: "work", label: s.chatQuickTodayWork, prompt: s.chatQuickTodayWorkPrompt, icon: <WorkIcon /> },
    { key: "how", label: s.chatQuickHowToDo, prompt: s.chatQuickHowToDoPrompt, icon: <HowIcon /> },
    { key: "timer", label: s.chatQuickSession, prompt: s.chatQuickSessionPrompt, icon: <TimerIcon /> },
    { key: "proof", label: s.chatQuickProof, prompt: s.chatQuickProofPrompt, icon: <CameraIcon /> },
  ];
}

export default function QuickPrompts({ labels, onPick, disabled = false }: Props) {
  return (
    <div style={wrapStyle}>
      {chips(labels).map((chip, i) => (
        <button
          key={chip.key}
          type="button"
          disabled={disabled}
          onClick={() => onPick(chip.prompt)}
          className="press"
          // The chip is a shortcut for typing the question, so the accessible
          // name is the question — not the two words printed on it.
          aria-label={chip.prompt}
          title={chip.prompt}
          style={{ ...chipStyle, ...toneFor(i) }}
        >
          <span style={{ display: "inline-flex", flexShrink: 0 }} aria-hidden>{chip.icon}</span>
          {chip.label}
        </button>
      ))}
    </div>
  );
}

/**
 * The four tones this app already uses for its lanes and fields, so the row
 * reads as a set rather than four identical pills — the same job the coloured
 * subjects do in the reference, in colours that are ours.
 */
function toneFor(i: number): CSSProperties {
  const tones: CSSProperties[] = [
    { borderColor: "color-mix(in srgb, var(--green-deep) 30%, transparent)", background: "color-mix(in srgb, var(--green-wash) 62%, var(--surface))", color: "var(--green-deep)" },
    { borderColor: "color-mix(in srgb, var(--ochre) 32%, transparent)", background: "color-mix(in srgb, var(--ochre-wash) 46%, var(--surface))", color: "var(--ochre)" },
    { borderColor: "color-mix(in srgb, var(--slate) 28%, transparent)", background: "color-mix(in srgb, var(--slate-wash) 60%, var(--surface))", color: "var(--slate)" },
    { borderColor: "color-mix(in srgb, var(--terracotta) 28%, transparent)", background: "color-mix(in srgb, var(--terra-wash) 44%, var(--surface))", color: "var(--terracotta)" },
  ];
  return tones[i % tones.length];
}

const wrapStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 7,
  margin: "9px 0 0",
};

const chipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  minHeight: 36,
  padding: "7px 12px",
  borderRadius: 999,
  borderWidth: 1,
  borderStyle: "solid",
  fontFamily: "var(--sans)",
  fontSize: 12.5,
  fontWeight: 600,
  lineHeight: 1.2,
  cursor: "pointer",
  textAlign: "left",
};

function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ display: "block" }}>
      {children}
    </svg>
  );
}

function WorkIcon() {
  return <Glyph><rect x="4" y="5" width="16" height="16" rx="3" /><path d="M9 5V3h6v2M8 11h8M8 16h5" /></Glyph>;
}

function HowIcon() {
  return <Glyph><circle cx="12" cy="12" r="9" /><path d="M9.3 9.2a2.8 2.8 0 1 1 3.4 3.5v1.4" /><path d="M12 17.4h.01" /></Glyph>;
}

function TimerIcon() {
  return <Glyph><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2" /><path d="M9 2h6" /></Glyph>;
}

function CameraIcon() {
  return <Glyph><path d="M3 8.5h3.5L8 6h8l1.5 2.5H21V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" /><circle cx="12" cy="13.5" r="3.2" /></Glyph>;
}
