"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AttentionCounts } from "./types";
import { useTr } from "@/lib/client/language";

/**
 * Header bell for the things that want a human decision.
 *
 * This was a full-width strip on the Dashboard tab. It ate a whole row to say
 * three short sentences, and it was invisible from the other four tabs — so a
 * manager on the KarmYog tab could not see that submissions were waiting. As a
 * header control it costs no layout and is present everywhere.
 *
 * The panel is `position: fixed`, not absolutely positioned inside the header.
 * The header is a flex row inside a container with its own stacking context, so
 * an absolute panel would be clipped or painted under the tab strip — the same
 * class of bug as the #342 error that rendered beneath a portalled scrim. Fixed
 * positioning is measured off the button and re-measured while open.
 */

export interface AttentionItem {
  text: string;
  tone: string;
  /** Tab to jump to, when this item is actionable somewhere specific. */
  tab?: string;
}

/**
 * Turn the counts into sentences. One place, so the header bell and any future
 * surface cannot drift into describing the same number two different ways.
 *
 * Order is by how much it matters: something silently broken first, then a
 * deadline missed, then a queue waiting on a person.
 */
export function buildAttentionItems(c: AttentionCounts | null): AttentionItem[] {
  if (!c) return [];
  const items: AttentionItem[] = [];

  if (c.zeroCost > 0) {
    items.push({
      text: `${c.zeroCost} ${c.zeroCost === 1 ? "evaluation" : "evaluations"} scored 0 at zero cost — the AI never ran, so the evidence could not be read. Not poor work.`,
      tone: "var(--crit)",
      tab: "KarmYog",
    });
  }
  if (c.overdue > 0) {
    items.push({
      text: `${c.overdue} ${c.overdue === 1 ? "task is" : "tasks are"} past their due date.`,
      tone: "var(--crit)",
    });
  }
  if (c.pendingReview > 0) {
    items.push({
      text: `${c.pendingReview} ${c.pendingReview === 1 ? "submission is" : "submissions are"} awaiting a manager review.`,
      tone: "var(--terracotta)",
      tab: "KarmYog",
    });
  }
  return items;
}

export function AttentionBell({
  items, windowLabel, onGoTo,
}: {
  items: AttentionItem[];
  windowLabel: string;
  onGoTo: (tab: string) => void;
}) {
  const tr = useTr();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  /**
   * The badge counts ISSUES, not the sum of the underlying numbers.
   *
   * Adding 3 overdue tasks to 5 pending submissions to 2 zero-cost evaluations
   * gives "10" of nothing in particular — three different units in one figure.
   * Three distinct things need attention, so the badge says 3.
   */
  const count = items.length;

  const place = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    setPos({ top: r.bottom + 8, right: Math.max(12, window.innerWidth - r.right) });
  }, []);

  useEffect(() => {
    if (!open) return;
    place();

    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    // Fixed positioning does not follow the anchor, so re-measure rather than
    // letting the panel drift away from the bell as the page scrolls.
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  // Nothing needs attention: render nothing at all rather than a dead bell with
  // a zero on it, which reads as "unread: 0" and invites a pointless click.
  if (count === 0) return null;

  const jump = (tab: string) => { setOpen(false); onGoTo(tab); };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`${count} ${count === 1 ? "thing needs" : "things need"} attention`}
        title={`${count} ${count === 1 ? "thing needs" : "things need"} attention`}
        style={{
          position: "relative",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 32, height: 32, flexShrink: 0,
          background: open ? "var(--crit-wash)" : "transparent",
          border: `1px solid ${open ? "var(--crit)" : "var(--rule-strong)"}`,
          borderRadius: "var(--r-sm)",
          cursor: "pointer", color: "var(--crit)", padding: 0,
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M12 3a5 5 0 0 0-5 5v3.5a3 3 0 0 1-.9 2.1L5 15h14l-1.1-1.4a3 3 0 0 1-.9-2.1V8a5 5 0 0 0-5-5Z" />
          <path d="M10 18a2 2 0 0 0 4 0" />
        </svg>
        <span
          aria-hidden
          style={{
            position: "absolute", top: -5, right: -5, minWidth: 15, height: 15,
            padding: "0 3px",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "var(--crit)", color: "var(--surface)",
            borderRadius: 8, fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700,
          }}
        >
          {count}
        </span>
      </button>

      {open && pos && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={tr("Needs attention")}
          style={{
            position: "fixed", top: pos.top, right: pos.right, zIndex: 60,
            width: "min(340px, calc(100vw - 24px))",
            background: "var(--surface)",
            border: "1px solid var(--rule-strong)",
            borderRadius: "var(--r-md)",
            boxShadow: "var(--shadow-md)",
            overflow: "hidden",
          }}
        >
          <div style={{
            padding: "9px 14px", borderBottom: "1px solid var(--rule)",
            display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8,
          }}>
            <h4 style={{
              margin: 0, fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.1em",
              textTransform: "uppercase", color: "var(--ink-mute)", fontWeight: 600,
            }}>
              {tr("Needs attention")}
            </h4>
            <span style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-mute)" }}>
              {windowLabel}
            </span>
          </div>

          <div className="themed-scroll-y" style={{ maxHeight: "min(60vh, 420px)", overflowY: "auto" }}>
            {items.map((a, i) => (
              <div
                key={i}
                style={{
                  display: "flex", gap: 10, alignItems: "flex-start",
                  padding: "10px 14px",
                  borderBottom: i < items.length - 1 ? "1px solid var(--rule)" : "none",
                }}
              >
                <span aria-hidden style={{ width: 3, alignSelf: "stretch", background: a.tone, borderRadius: 2, flexShrink: 0, minHeight: 20 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 12.5, lineHeight: 1.55 }}>{a.text}</span>
                  {a.tab && (
                    <div style={{ marginTop: 7 }}>
                      <button
                        type="button"
                        onClick={() => jump(a.tab!)}
                        style={{
                          fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.06em",
                          textTransform: "uppercase", color: "var(--ink-mute)",
                          background: "transparent", border: "1px solid var(--rule-strong)",
                          borderRadius: "var(--r-sm)", padding: "4px 8px", cursor: "pointer",
                        }}
                      >
                        {tr("Open")} {a.tab}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
