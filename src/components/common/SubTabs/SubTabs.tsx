export interface SubTabsProps {
  /** Tab strings double as the state key — the caller compares them directly. */
  tabs: string[];
  active: string;
  onChange: (tab: string) => void;
  /** "segmented" is the bordered strip; "pill" is the rounded group. */
  variant?: "segmented" | "pill";
  /** Optional count badge per tab, keyed by tab string. */
  counts?: Record<string, number>;
  ariaLabel?: string;
}

/**
 * Horizontal tab strip — the most widely shared control in the app (8 scopes).
 *
 * It owns no routing and no data: the caller keeps the active tab in whatever
 * state it likes (URL param, component state) and re-renders.
 *
 * States: active · inactive · hover · overflow (scrolls sideways on narrow
 * screens rather than pushing the page wide).
 */
export function SubTabs({
  tabs,
  active,
  onChange,
  variant = "segmented",
  counts,
  ariaLabel = "Sections",
}: SubTabsProps) {
  if (variant === "pill") {
    return (
      <div
        role="tablist"
        aria-label={ariaLabel}
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
              type="button"
              role="tab"
              aria-selected={isActive}
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
              {tab}
              {counts?.[tab] != null && <Count value={counts[tab]} active={isActive} />}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      style={{ display: "flex", gap: 0, maxWidth: "100%", overflowX: "auto" }}
    >
      {tabs.map((tab) => {
        const isActive = tab === active;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab)}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 500,
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
            {tab}
            {counts?.[tab] != null && <Count value={counts[tab]} active={isActive} />}
          </button>
        );
      })}
      {/* Closes the last cell's border. */}
      <div style={{ borderRight: "1px solid var(--rule-strong)" }} />
    </div>
  );
}

function Count({ value, active }: { value: number; active: boolean }) {
  return (
    <span
      style={{
        marginLeft: 7,
        fontFamily: "var(--mono)",
        fontSize: 10,
        color: active ? "var(--green-wash)" : "var(--ink-mute)",
      }}
    >
      {value}
    </span>
  );
}
