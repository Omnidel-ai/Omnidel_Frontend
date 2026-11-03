import type { ReactNode } from "react";
import { MobileIcon, type MobileIconName } from "./Icon";
import { PersonAvatar } from "./PersonAvatar";

export interface DockItem {
  key: string;
  label: string;
  /** A glyph… */
  icon?: MobileIconName;
  /** …or a face. Contractor's Profile tab is the reader's own initials. */
  avatarName?: string;
  /** Lit for this tab and everything under it — a task is still inside Work. */
  active?: boolean;
  /** Render as a link. Without it the item is a button calling `onSelect`. */
  href?: string;
  onSelect?: () => void;
}

export interface BottomDockProps {
  /** Four destinations: two either side of the mic. */
  items: DockItem[];
  /** The centre control — normally a `<MicButton size={58} />`. */
  mic: ReactNode;
  /** Text under the mic (light tone only) — "Talk now", "End", "Retry". */
  micLabel?: string;
  /**
   * `light` — Kaarigar, PR #207: cream glass capsule, green-wash plate, mic raised in a ring.
   * `dark`  — Contractor: green floor with a scoop for the mic, cream plate under the current tab.
   */
  tone?: "light" | "dark";
  /** Live caption above the bar: what the person said, or what the agent is saying. */
  caption?: string;
  captionFrom?: "user" | "agent";
  /** A short status line above the bar ("Listening…"). */
  status?: string;
  /** A problem said once, in red, above the bar. The caller times it out. */
  alert?: string;
  /** Pinned to the bottom of the viewport. Off for previews. */
  fixed?: boolean;
  ariaLabel: string;
}

/**
 * The one fixed thing on every screen: four destinations and the microphone.
 *
 * This was built twice. Contractor has `MicDock` (Review, Projects, mic,
 * Teams, Profile). Kaarigar has `WorkAppFrame`'s nav with `MahAcharyaDockMic`
 * (Home, Work, mic, Stories, Profile). The structure is the same: a five-column
 * grid, the mic in the wider middle column, the current tab on a plate holding
 * both icon and label. Only the paint differed, so the paint is the `tone` prop.
 */
export function BottomDock({ items, mic, micLabel, tone = "light", caption, captionFrom = "agent", status, alert, fixed = true, ariaLabel }: BottomDockProps) {
  const half = Math.ceil(items.length / 2);
  const left = items.slice(0, half);
  const right = items.slice(half);

  return (
    <div className={`am-dock am-dock--${tone}${fixed ? " am-dock--fixed" : ""}`}>
      <span aria-live="polite" className="am-sr-only">{caption}</span>
      {caption && <p aria-hidden className="am-dock__bubble" data-from={captionFrom}>{caption}</p>}
      {status && <p className="am-dock__status">{status}</p>}
      {alert && <p role="alert" className="am-dock__bubble am-dock__bubble--alert">{alert}</p>}

      <div className="am-dock__bar">
        {tone === "dark" && <DarkFloor />}
        <nav aria-label={ariaLabel} className="am-dock__nav">
          {left.map((item) => <DockTab key={item.key} item={item} />)}
          <span className="am-dock__centre">
            <span className="am-dock__ring">{mic}</span>
            {tone === "light" && micLabel && <span className="am-dock__mic-label" aria-hidden>{micLabel}</span>}
          </span>
          {right.map((item) => <DockTab key={item.key} item={item} />)}
        </nav>
      </div>
    </div>
  );
}

function DockTab({ item }: { item: DockItem }) {
  const body = (
    <span className="am-dock__plate">
      {item.icon ? (
        <MobileIcon name={item.icon} size={24} filled={item.active} strokeWidth={item.active ? 2 : 1.65} />
      ) : (
        <PersonAvatar name={item.avatarName} size={26} ring className="am-dock__avatar" />
      )}
      <span className="am-dock__label">{item.label}</span>
    </span>
  );
  const common = {
    className: "am-dock__item am-press",
    "aria-label": item.label,
    "aria-current": item.active ? ("page" as const) : undefined,
  };
  return item.href ? (
    <a {...common} href={item.href} onClick={item.onSelect}>{body}</a>
  ) : (
    <button {...common} type="button" onClick={item.onSelect}>{body}</button>
  );
}

/**
 * Contractor's floor: one SVG path, not a box with a hole punched in it. The
 * top edge curves down into the scoop and back out, so the cut belongs to the
 * shape. It is a 74-unit capsule (r37), with the scoop centred on 179 and 40
 * units deep. That geometry comes from OmniPulse's `mic-dock.tsx`.
 */
function DarkFloor() {
  return (
    <svg viewBox="0 0 358 76" preserveAspectRatio="none" aria-hidden className="am-dock__floor">
      <path
        d="M 38 1 L 132 1 C 147 1 148 40 179 40 C 210 40 211 1 226 1 L 320 1 C 340.4 1 357 17.6 357 38 C 357 58.4 340.4 75 320 75 L 38 75 C 17.6 75 1 58.4 1 38 C 1 17.6 17.6 1 38 1 Z"
        fill="var(--green-deep)"
        stroke="var(--green-deep)"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
