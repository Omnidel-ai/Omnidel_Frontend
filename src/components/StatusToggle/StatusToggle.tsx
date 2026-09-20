export interface StatusToggleProps {
  /** Current state. The parent owns it — this control never toggles itself. */
  active: boolean;
  /** Called with the *next* intended state. */
  onToggle: (next: boolean) => void;
  disabled?: boolean;
  /** Muted, non-interactive while a write is in flight. */
  busy?: boolean;
  /** Accessible name. Defaults to "Active" / "Inactive". */
  label?: string;
}

/**
 * Pill switch for an active/inactive row.
 *
 * `role="switch"` + `aria-checked`, so a screen reader announces a toggle
 * rather than a button. States: on · off · busy · disabled.
 */
export function StatusToggle({
  active,
  onToggle,
  disabled = false,
  busy = false,
  label,
}: StatusToggleProps) {
  const isDisabled = disabled || busy;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={label ?? (active ? "Active" : "Inactive")}
      disabled={isDisabled}
      onClick={() => {
        if (isDisabled) return;
        onToggle(!active);
      }}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        width: 34,
        height: 18,
        borderRadius: 9,
        border: "none",
        padding: 0,
        background: isDisabled
          ? "var(--rule-strong)"
          : active
            ? "var(--green-deep)"
            : "var(--ink-mute)",
        cursor: isDisabled ? "not-allowed" : "pointer",
        flexShrink: 0,
        transition: "background 0.2s",
        opacity: busy ? 0.6 : 1,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 3,
          left: active ? 18 : 3,
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: "var(--surface)",
          transition: "left 0.18s",
        }}
      />
    </button>
  );
}
