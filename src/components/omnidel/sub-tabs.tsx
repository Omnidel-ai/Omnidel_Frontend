"use client";

import { useTr } from "@/lib/client/language";

export function SubTabs({ tabs, active, onChange, variant = "segmented" }: {
  tabs: string[];
  active: string;
  onChange: (tab: string) => void;
  /** "segmented" (default) is the original bordered strip — no existing caller
   * changes behavior. "pill" is an opt-in rounded pill-group look. */
  variant?: "segmented" | "pill";
}) {
  // Tab strings are BOTH the label and the state/URL key (callers compare
  // `active === "All Leads"` and map them to ?cycle= params). So translate at
  // render only -- never in the arrays themselves, or every comparison breaks.
  const tr = useTr();
  if (variant === "pill") {
    return (
      <div
        style={{
          display: "inline-flex",
          gap: 2,
          maxWidth: "100%",
          overflowX: "auto",
          background: "var(--surface-sunk)",
          borderRadius: 999,
          padding: 4,
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab === active;
          return (
            <button
              key={tab}
              onClick={() => onChange(tab)}
              style={{
                padding: "7px 16px",
                fontSize: 13,
                fontWeight: 500,
                fontFamily: "var(--sans)",
                background: isActive ? "var(--green-deep)" : "transparent",
                color: isActive ? "var(--surface)" : "var(--ink-mute)",
                border: "none",
                borderRadius: 999,
                cursor: "pointer",
                transition: "background .15s, color .15s",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {tr(tab)}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    // maxWidth + overflowX lets a long tab strip scroll horizontally on narrow
    // screens rather than overflowing the page; on desktop it never overflows.
    <div style={{ display: "flex", gap: 0, maxWidth: "100%", overflowX: "auto" }}>
      {tabs.map((tab) => {
        const isActive = tab === active;
        return (
          <button
            key={tab}
            onClick={() => onChange(tab)}
            style={{
              padding: "8px 16px", fontSize: 13, fontWeight: 500,
              fontFamily: "var(--sans)",
              background: isActive ? "var(--green-deep)" : "transparent",
              color: isActive ? "var(--surface)" : "var(--ink-soft)",
              border: "1px solid var(--rule-strong)",
              borderRight: "none",
              cursor: "pointer",
              transition: "background .15s, color .15s",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {tr(tab)}
          </button>
        );
      })}
      {/* Close the last border */}
      <div style={{ borderRight: "1px solid var(--rule-strong)" }} />
    </div>
  );
}
