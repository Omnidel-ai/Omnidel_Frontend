"use client";

import { dateSectionId } from "./date-index";
import { EntryCard } from "./entry-card";
import type { ReleaseNote } from "@/lib/whats-new-schema";
import { useEffect, type CSSProperties, type RefObject } from "react";

function formatSectionDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function groupByDate(notes: ReleaseNote[]): { date: string; notes: ReleaseNote[] }[] {
  const map = new Map<string, ReleaseNote[]>();
  for (const n of notes) {
    const list = map.get(n.released_on) ?? [];
    list.push(n);
    map.set(n.released_on, list);
  }
  return [...map.entries()].map(([date, groupNotes]) => ({ date, notes: groupNotes }));
}

export function Feed({
  notes,
  activeDate,
  onActiveDateChange,
  scrollRootRef,
  emptyTitle = "Nothing published yet",
  emptyHint = "When a release is approved, it will show up here.",
}: {
  notes: ReleaseNote[];
  activeDate: string | null;
  onActiveDateChange: (isoDate: string) => void;
  /** Feed-only scrollport (title chrome sits outside it). */
  scrollRootRef?: RefObject<HTMLElement | null>;
  emptyTitle?: string;
  emptyHint?: string;
}) {
  const groups = groupByDate(notes);

  useEffect(() => {
    if (notes.length === 0) return;

    const dates = [...new Set(notes.map((n) => n.released_on))];
    const scrollRoot = scrollRootRef?.current ?? null;
    const ratios = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const date = entry.target.getAttribute("data-wn-date");
          if (!date) continue;
          ratios.set(date, entry.isIntersecting ? entry.intersectionRatio : 0);
        }
        let bestDate: string | null = null;
        let bestRatio = 0;
        for (const date of dates) {
          const r = ratios.get(date) ?? 0;
          if (r > bestRatio) {
            bestRatio = r;
            bestDate = date;
          }
        }
        if (bestDate) onActiveDateChange(bestDate);
      },
      {
        root: scrollRoot,
        rootMargin: "0px 0px -55% 0px",
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
      },
    );

    for (const date of dates) {
      const el = document.getElementById(dateSectionId(date));
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [notes, onActiveDateChange, scrollRootRef]);

  if (notes.length === 0) {
    return (
      <div className="table-empty" style={emptyStyle}>
        {emptyTitle}
        <div style={emptyHintStyle}>{emptyHint}</div>
      </div>
    );
  }

  return (
    <div style={feedStyle}>
      {groups.map((group, gi) => (
        <section
          key={group.date}
          id={dateSectionId(group.date)}
          data-wn-date={group.date}
          style={{
            ...sectionStyle,
            borderBottom: gi === groups.length - 1 ? "none" : "1px solid var(--rule)",
            scrollMarginTop: 8,
          }}
          aria-labelledby={`${dateSectionId(group.date)}-heading`}
        >
          <h2
            id={`${dateSectionId(group.date)}-heading`}
            style={{
              ...sectionDateStyle,
              color: group.date === activeDate ? "var(--green-deep)" : "var(--ink)",
            }}
          >
            {formatSectionDate(group.date)}
          </h2>
          <div style={entriesStack}>
            {group.notes.map((n) => (
              <EntryCard key={n.id} note={n} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

const feedStyle: CSSProperties = {
  minWidth: 0,
};

const sectionStyle: CSSProperties = {
  padding: "8px 0 40px",
};

const sectionDateStyle: CSSProperties = {
  margin: "0 0 20px",
  fontFamily: "var(--serif)",
  fontSize: 28,
  fontWeight: 600,
  letterSpacing: "-0.02em",
  lineHeight: 1.2,
  transition: "color .15s",
};

const entriesStack: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 28,
};

const emptyStyle: CSSProperties = {
  padding: "56px 24px",
  textAlign: "center",
  fontFamily: "var(--serif)",
  fontSize: 18,
  color: "var(--ink-soft)",
};

const emptyHintStyle: CSSProperties = {
  marginTop: 10,
  fontFamily: "var(--sans)",
  fontSize: 14,
  color: "var(--ink-mute)",
  fontWeight: 400,
};
