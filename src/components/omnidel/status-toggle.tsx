"use client";

import type React from "react";

type StatusToggleProps = {
  /** Current active state. */
  active: boolean;
  /**
   * Called when the user clicks the toggle with the *next* intended state.
   * The parent is responsible for performing the mutation and updating `active`.
   */
  onToggle: (next: boolean) => void;
  /** Disables the toggle (e.g. insufficient permissions). */
  disabled?: boolean;
  /** Shows a spinner-like muted state while an async toggle is in flight. */
  busy?: boolean;
  /**
   * Accessible label for the control. Defaults to "Active" / "Inactive"
   * matching the current state. Override for domain-specific language.
   */
  label?: string;
};

/**
 * Pill switch for active/inactive state on admin master table rows.
 *
 * Renders a `role="switch"` button with `aria-checked` so screen readers
 * announce it as a toggle, not a generic button. The thumb slides between
 * two positions; `--green-deep` on, `--ink-mute` off.
 *
 * Usage:
 *   <StatusToggle
 *     active={row.is_active}
 *     onToggle={(next) => handleToggle(row.id, next)}
 *     busy={togglingId === row.id}
 *   />
 */
export function StatusToggle({
  active,
  onToggle,
  disabled = false,
  busy = false,
  label,
}: StatusToggleProps) {
  const isDisabled = disabled || busy;
  const resolvedLabel = label ?? (active ? "Active" : "Inactive");

  function handleClick() {
    if (isDisabled) return;
    onToggle(!active);
  }

  const trackColor = active ? "var(--green-deep)" : "var(--ink-mute)";
  const thumbLeft = active ? 18 : 3;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={resolvedLabel}
      onClick={handleClick}
      disabled={isDisabled}
      className="status-toggle"
      style={{
        // Track
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        width: 34,
        height: 18,
        borderRadius: 9,
        border: "none",
        padding: 0,
        background: isDisabled ? "var(--rule-strong)" : trackColor,
        cursor: isDisabled ? "not-allowed" : "pointer",
        flexShrink: 0,
        transition: "background 0.2s",
        opacity: busy ? 0.6 : 1,
        outline: "none",
      } satisfies React.CSSProperties}
    >
      {/* Thumb */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 3,
          left: thumbLeft,
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: "var(--surface)",
          transition: "left 0.18s",
          flexShrink: 0,
        } satisfies React.CSSProperties}
      />
    </button>
  );
}
