"use client";

import { useIsMobile } from "@/lib/client/use-is-mobile";

/**
 * Toolbar "+ Add <thing>" button for admin master tables.
 *
 * Phones get a 38px square icon so the button fits on the controls row beside
 * the search box and the filters instead of wrapping to its own line; desktop
 * keeps the labelled button, unchanged. Matches the icon/label pair already
 * used by the OmniMart Pipeline and OmniStudio toolbars.
 */
export function TableAddButton({ label, onClick, ariaLabel }: {
  /** Exact desktop text, e.g. "+ Add Lane". */
  label: string;
  onClick: () => void;
  /** Accessible name for the icon variant. Defaults to `label` without its
   *  leading "+ ". */
  ariaLabel?: string;
}) {
  const isMobile = useIsMobile();
  const name = ariaLabel ?? label.replace(/^\+\s*/, "");

  if (isMobile) {
    return (
      <button type="button" onClick={onClick} style={addIconBtnStyle} aria-label={name} title={name}>
        <PlusIcon />
      </button>
    );
  }

  return (
    <button type="button" onClick={onClick} style={addBtnStyle}>{label}</button>
  );
}

// Desktop labelled button — kept identical to the per-page `addBtnStyle` it
// replaces, so desktop renders exactly as before.
const addBtnStyle: React.CSSProperties = {
  padding: "8px 14px", fontSize: 12, fontWeight: 500, minWidth: 140,
  background: "var(--green-deep)", color: "var(--surface)",
  border: "1px solid var(--green-deep)", borderRadius: "var(--r-sm)",
  cursor: "pointer", fontFamily: "var(--sans)", textAlign: "center",
};

const addIconBtnStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: 38, height: 38, padding: 0, flexShrink: 0,
  background: "var(--green-deep)", color: "var(--surface)",
  border: "1px solid var(--green-deep)", borderRadius: "var(--r-sm)",
  cursor: "pointer",
};

function PlusIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
