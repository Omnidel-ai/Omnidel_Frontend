import type { CSSProperties, ReactNode } from "react";
import { MobileIcon } from "./Icon";

export type MobileLook = "kaarigar" | "contractor";

export interface MobileScreenProps {
  /**
   * Which app's type and radii the screen wears. The palette is the same.
   * `kaarigar` (PR #207's `.journey-app`): sans everywhere, rounder corners.
   * `contractor` (OmniPulse): serif titles, mono uppercase labels, tighter corners.
   */
  look?: MobileLook;
  children: ReactNode;
  /** A `<BottomDock />`. When present the column reserves room under the last row. */
  dock?: ReactNode;
  style?: CSSProperties;
}

/**
 * The phone frame both apps put every top-level screen in. It is a page-colour
 * ground, a centred column (560px max, 16px gutters), and space at the bottom
 * so the docked mic never covers the last row. Contractor's `AppChrome` and
 * Kaarigar's `WorkAppFrame` / `.journey-app` both did exactly this.
 */
export function MobileScreen({ look = "kaarigar", children, dock, style }: MobileScreenProps) {
  return (
    <div className="am-screen" data-am-look={look} data-dock={dock ? "" : undefined} style={style}>
      <div className="am-screen__column">{children}</div>
      {dock}
    </div>
  );
}

export interface ScreenHeaderProps {
  title: string;
  /** Shows a back control on the left. */
  onBack?: () => void;
  backLabel?: string;
  /** Trailing actions — icon buttons, an avatar. One primary action at most. */
  actions?: ReactNode;
  /** Pin to the top with a rule and a blurred ground (Contractor's header). */
  sticky?: boolean;
}

/**
 * Title row of a screen. Covers Contractor's `PageHeader` (a sticky serif title
 * with a rule) plus `BackRow` (back on the left, one action on the right), and
 * Kaarigar's `.journey-work-toolbar` (title with avatar and refresh) plus the
 * Profile toolbar. In every case it is a title, maybe a way back, and a few
 * actions on the right.
 */
export function ScreenHeader({ title, onBack, backLabel = "Back", actions, sticky = false }: ScreenHeaderProps) {
  return (
    <header className={`am-header${sticky ? " am-header--sticky" : ""}`}>
      <div className="am-header__lead">
        {onBack && (
          <button type="button" className="am-back am-press" onClick={onBack} aria-label={backLabel}>
            <MobileIcon name="chevron-left" size={20} />
            {!title && backLabel}
          </button>
        )}
        {title && <h1 className="am-header__title">{title}</h1>}
      </div>
      {actions && <div className="am-header__actions">{actions}</div>}
    </header>
  );
}

export interface IconButtonProps {
  /** Accessible name — required, since there is no text. */
  label: string;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  /** Spinning, `aria-busy` — for refresh. */
  busy?: boolean;
  /** `framed` (default) is the 44px bordered disc; `ghost` has no frame. */
  variant?: "framed" | "ghost";
}

/**
 * The 44px round control. Kaarigar uses it for refresh, the settings gear and
 * the round "see progress" link. Contractor uses it for the ghost icon buttons
 * in its headers and sheets.
 */
export function IconButton({ label, children, onClick, disabled, busy, variant = "framed" }: IconButtonProps) {
  return (
    <button
      type="button"
      className={`am-iconbtn am-press${variant === "ghost" ? " am-iconbtn--ghost" : ""}`}
      aria-label={label}
      title={label}
      aria-busy={busy || undefined}
      disabled={disabled || busy}
      onClick={onClick}
    >
      <span className={busy ? "am-spin" : undefined} style={{ display: "inline-grid" }}>{children}</span>
    </button>
  );
}
