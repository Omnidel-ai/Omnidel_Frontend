import { useEffect, useRef, type CSSProperties } from "react";

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Keyboard hint on the right, e.g. "⌘K". Rendered as a `<kbd>`. */
  shortcut?: string;
  /**
   * Binds Ctrl/Cmd+K to focus the field. Off by default — only one search bar
   * on a screen should claim the shortcut.
   */
  bindShortcut?: boolean;
  /** Fires on Enter. */
  onSubmit?: (value: string) => void;
  /** Icon-only trigger sizing for a packed mobile topbar. */
  compact?: boolean;
  /** Width in px, or a CSS length. Defaults to 280. */
  width?: number | string;
  ariaLabel?: string;
  autoFocus?: boolean;
}

/**
 * Search field with an optional keyboard shortcut and a clear button.
 *
 * It searches nothing by itself: the value is the caller's state and every
 * keystroke is reported. What the query means — rows, commands, people — stays
 * with whoever renders it.
 *
 * States: empty · typing (clear button appears) · focused · shortcut hint.
 */
export function SearchBar({
  value,
  onChange,
  placeholder = "Search…",
  shortcut,
  bindShortcut = false,
  onSubmit,
  compact = false,
  width = 280,
  ariaLabel,
  autoFocus,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!bindShortcut) return;
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bindShortcut]);

  const padRight = value ? 32 : shortcut ? 56 : 12;

  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", minWidth: 0, width }}>
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--ink-mute)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ position: "absolute", left: 10, pointerEvents: "none" }}
      >
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
      <input
        ref={inputRef}
        type="text"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onSubmit) onSubmit(value);
          if (e.key === "Escape" && value) onChange("");
        }}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        style={{
          width: "100%",
          padding: compact ? `6px ${padRight}px 6px 30px` : `8px ${padRight}px 8px 32px`,
          fontSize: 13,
          background: "var(--surface)",
          border: "1px solid var(--rule)",
          borderRadius: "var(--r-sm)",
          color: "var(--ink)",
          outline: "none",
          fontFamily: "var(--sans)",
          minWidth: 0,
        }}
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
          aria-label="Clear search"
          style={clearBtnStyle}
        >
          ×
        </button>
      ) : shortcut ? (
        <kbd style={kbdStyle}>{shortcut}</kbd>
      ) : null}
    </div>
  );
}

const clearBtnStyle: CSSProperties = {
  position: "absolute",
  right: 6,
  width: 20,
  height: 20,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  border: "none",
  borderRadius: "var(--r-sm)",
  color: "var(--ink-mute)",
  fontSize: 15,
  lineHeight: 1,
  cursor: "pointer",
};

const kbdStyle: CSSProperties = {
  position: "absolute",
  right: 8,
  fontSize: 11,
  color: "var(--ink-mute)",
  border: "1px solid var(--rule)",
  borderRadius: 4,
  padding: "1px 5px",
  fontFamily: "var(--sans)",
  pointerEvents: "none",
};
