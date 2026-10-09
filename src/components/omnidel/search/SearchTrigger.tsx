"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { useCommandK, isMacLikePlatform } from "@/hooks/useCommandK";
import { useTr } from "@/lib/client/language";

/** Feature flag — off → topbar unchanged (no trigger / no shortcut). */
export function isGlobalSearchEnabled(): boolean {
  return process.env.NEXT_PUBLIC_GLOBAL_SEARCH === "1";
}

// cmdk is browser-only; load the palette on the client so SSR never touches it
// (avoids webpack moduleId / SSR recoveries after dep installs or HMR churn).
const CommandPalette = dynamic(
  () => import("./CommandPalette").then((m) => m.CommandPalette),
  { ssr: false },
);

export function SearchTrigger({ compact = false }: { compact?: boolean }) {
  const tr = useTr();
  const [open, setOpen] = useState(false);
  const enabled = isGlobalSearchEnabled();
  const openPalette = useCallback(() => setOpen(true), []);
  useCommandK(openPalette, enabled);

  if (!enabled) return null;

  const hint = isMacLikePlatform() ? "⌘K" : "Ctrl K";

  // Mobile topbar is already packed (hamburger + bells + "Viewing as …").
  // The desktop search chip's minWidth:180 overflows and overlaps neighboring
  // labels — use an icon-only control there. Desktop layout stays unchanged.
  if (compact) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={tr("Open global search")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            padding: 0,
            flexShrink: 0,
            background: "transparent",
            border: "1px solid var(--rule)",
            borderRadius: "var(--r-sm)",
            color: "var(--ink)",
            cursor: "pointer",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
        <CommandPalette open={open} onOpenChange={setOpen} />
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={tr("Open global search")}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          height: 32,
          padding: "0 10px 0 12px",
          marginRight: "auto",
          minWidth: 180,
          maxWidth: 280,
          flex: "1 1 180px",
          background: "var(--page)",
          border: "1px solid var(--rule)",
          borderRadius: "var(--r-sm)",
          color: "var(--ink-mute)",
          cursor: "pointer",
          fontSize: 13,
        }}
      >
        <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {tr("Search…")}
        </span>
        <kbd
          style={{
            fontSize: 11,
            color: "var(--ink-mute)",
            border: "1px solid var(--rule)",
            borderRadius: 4,
            padding: "1px 5px",
            fontFamily: "inherit",
          }}
        >
          {hint}
        </kbd>
      </button>
      <CommandPalette open={open} onOpenChange={setOpen} />
    </>
  );
}
