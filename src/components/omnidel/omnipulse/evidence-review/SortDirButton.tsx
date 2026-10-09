"use client";

export type SortDir = "desc" | "asc";

function SortIcon({ dir }: { dir: SortDir }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      style={{ display: "block" }}
    >
      <path
        d="M5 2.5v11M5 2.5L2.5 5M5 2.5L7.5 5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={dir === "desc" ? 1 : 0.35}
      />
      <path
        d="M11 13.5V2.5M11 13.5L8.5 11M11 13.5L13.5 11"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={dir === "asc" ? 1 : 0.35}
      />
    </svg>
  );
}

export function SortDirButton({
  dir,
  onToggle,
  latestLabel = "Latest first — click for oldest first",
  oldestLabel = "Oldest first — click for latest first",
}: {
  dir: SortDir;
  onToggle: () => void;
  latestLabel?: string;
  oldestLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={dir === "desc" ? latestLabel : oldestLabel}
      aria-label={dir === "desc" ? "Sort oldest first" : "Sort latest first"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        padding: 0,
        border: "1px solid var(--rule)",
        borderRadius: "var(--r-sm)",
        background: "var(--surface)",
        color: "var(--ink-soft)",
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      <SortIcon dir={dir} />
    </button>
  );
}
