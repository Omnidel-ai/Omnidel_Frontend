"use client";

import type { CSSProperties } from "react";
import type { ReleaseNote } from "@/lib/whats-new-schema";
import { useTr } from "@/lib/client/language";

type Props = {
  notes: ReleaseNote[];
  activeDate: string | null;
  onJump: (isoDate: string) => void;
};

function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, (m || 1) - 1, 1);
  return d.toLocaleDateString("en-IN", { month: "short", year: "numeric" }).toUpperCase();
}

function dayLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** Shared with Feed — section id for a release date. */
export function dateSectionId(isoDate: string): string {
  return `wn-date-${isoDate}`;
}

export function DateIndex({ notes, activeDate, onJump }: Props) {
  const tr = useTr();
  const byMonth = new Map<string, string[]>();
  const seenDays = new Set<string>();

  for (const n of notes) {
    if (seenDays.has(n.released_on)) continue;
    seenDays.add(n.released_on);
    const mk = monthKey(n.released_on);
    const list = byMonth.get(mk) ?? [];
    list.push(n.released_on);
    byMonth.set(mk, list);
  }

  if (byMonth.size === 0) {
    return (
      <p style={{ margin: 0, fontSize: 12, color: "var(--ink-mute)", fontFamily: "var(--sans)" }}>
        {tr("No dates")}
      </p>
    );
  }

  return (
    <nav aria-label={tr("Jump by date")}>
      <p style={navLabel}>{tr("On this page")}</p>
      {[...byMonth.entries()].map(([ym, days]) => (
        <div key={ym} style={{ marginBottom: 14 }}>
          <p style={monthStyle}>{monthLabel(ym)}</p>
          <ul style={listStyle}>
            {days.map((date) => {
              const active = date === activeDate;
              return (
                <li key={date}>
                  <button
                    type="button"
                    onClick={() => onJump(date)}
                    className="press"
                    aria-current={active ? "true" : undefined}
                    style={{
                      ...dayBtnStyle,
                      color: active ? "var(--green-deep)" : "var(--ink-mute)",
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    {dayLabel(date)}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

const navLabel: CSSProperties = {
  margin: "0 0 12px",
  fontFamily: "var(--mono)",
  fontSize: 10,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--ink-mute)",
};

const monthStyle: CSSProperties = {
  margin: "0 0 4px",
  fontFamily: "var(--mono)",
  fontSize: 10,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--ink-soft)",
};

const listStyle: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: 0,
};

const dayBtnStyle: CSSProperties = {
  background: "transparent",
  border: "none",
  padding: "4px 0",
  fontSize: 13,
  fontFamily: "var(--sans)",
  cursor: "pointer",
  textAlign: "left",
  width: "100%",
  transition: "color .15s",
};
