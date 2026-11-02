import type { ReactNode } from "react";

/**
 * One icon registry for both phone apps.
 *
 * Kaarigar drew its own inline sets: `JourneyIcon` (14 glyphs), plus separate
 * ones in `network-icons`, `QuickPrompts`, `IdentityCard` and `TaskQuizTab`.
 * Contractor used lucide everywhere except the dock, which has a hand-picked
 * set of Material Symbols because a selected tab has to turn SOLID, and lucide
 * ships no filled twins. This file collects every glyph either app puts on the
 * screens these components cover, under one name each.
 *
 * Most glyphs are 24-unit strokes. `inbox`, `projects` and `teams` are the
 * Contractor dock's Material pairs: pass `filled` to swap to the solid twin.
 * For any other name `filled` does nothing, because there is no twin to swap to.
 */

type Stroke = ReactNode;

const STROKE: Record<string, Stroke> = {
  // From Kaarigar's JourneyIcon, as drawn in PR #207.
  home: <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />,
  work: <><rect x="4" y="5" width="16" height="16" rx="3" /><path d="M9 5V3h6v2M8 11h8M8 16h5" /></>,
  progress: <path d="M5 20v-5m7 5V9m7 11V4M3 10l6-4 5 1 6-5" />,
  stories: <><rect x="4" y="3" width="16" height="18" rx="3" /><path d="m10 8 5 4-5 4Z" /></>,
  profile: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  review: <><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6Z" /><path d="m8 12 3 3 5-6" /></>,
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  mic: <><rect x="9" y="2" width="6" height="13" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M9 22h6" /></>,
  chat: <><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2v-9.5A9.5 9.5 0 0 1 11.5 3H13a8 8 0 0 1 8 8.5Z" /><path d="M7 9h9M7 14h6" /></>,
  learn: <path d="M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1Zm0 0v15" />,
  quiz: <><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M9 8a3 3 0 0 1 6 0c0 2-3 2-3 4m0 4h.01" /></>,
  type: <path d="m2 19 6-15 6 15M4 14h8m3 5 4-10 4 10m-6-4h4" />,
  language: <path d="M3 5h12M9 2v3m4 0c0 6-4 10-9 12m1-9c1 4 4 7 8 9m1 4 4-11 4 11m-6-4h5" />,

  // The lucide glyphs Contractor uses on the same kinds of screen.
  "chevron-left": <path d="m15 18-6-6 6-6" />,
  "chevron-right": <path d="m9 18 6-6-6-6" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  check: <path d="M20 6 9 17l-5-5" />,
  "check-circle": <><circle cx="12" cy="12" r="9" /><path d="m8.5 12.5 2.4 2.4 4.6-5" /></>,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>,
  logout: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
  refresh: <><path d="M20.5 12a8.5 8.5 0 1 1-2.49-6.01" /><path d="M20.5 4.2v4.6h-4.6" /></>,
  alert: <><path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z" /><path d="M12 9v4M12 17h.01" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></>,
  "mic-off": <><path d="m2 2 20 20M18.9 13.3A7 7 0 0 0 19 12v-2M5 10v2a7 7 0 0 0 12 5M15 9.3V5a3 3 0 0 0-5.7-1.3M9 9v3a3 3 0 0 0 5.1 2.1M12 19v3M9 22h6" /></>,
  retry: <><path d="M21 12a9 9 0 1 1-9-9c2.5 0 4.8 1 6.5 2.6L21 8" /><path d="M21 3v5h-5" /></>,
  paperclip: <path d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l8.6-8.6a4 4 0 0 1 5.6 5.7l-8.6 8.6a2 2 0 0 1-2.8-2.8l8.5-8.5" />,
  comment: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />,
  "id-card": <><rect x="2" y="5" width="20" height="14" rx="2" /><circle cx="8" cy="12" r="2.5" /><path d="M13.5 10H18M13.5 14H17" /></>,
  star: <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1Z" />,
  briefcase: <path d="M4 8.5h16v11H4zM8 8.5V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2.5M4 13h16M10 13v2h4v-2" />,
  board: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18M15 3v18" /></>,
  sort: <path d="m21 16-4 4-4-4M17 20V4M3 8l4-4 4 4M7 4v16" />,
};

/** Material Symbols, both weights of one drawing. Filled paths, 960-unit grid. */
const MATERIAL: Record<string, { outlined: string; filled: string }> = {
  inbox: {
    outlined:
      "M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-120H640q-30 38-71.5 59T480-240q-47 0-88.5-21T320-320H200v120Zm280-120q38 0 69-22t43-58h168v-360H200v360h168q12 36 43 58t69 22ZM200-200h560-560Z",
    filled:
      "M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm280-200q38 0 69-22t43-58h168v-360H200v360h168q12 36 43 58t69 22Z",
  },
  projects: {
    outlined:
      "M280-280h80v-400h-80v400Zm320-80h80v-320h-80v320ZM440-480h80v-200h-80v200ZM200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm0-560v560-560Z",
    filled:
      "M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm80-160h80v-400h-80v400Zm320-80h80v-320h-80v320ZM440-480h80v-200h-80v200Z",
  },
  teams: {
    outlined:
      "M0-240v-63q0-43 44-70t116-27q13 0 25 .5t23 2.5q-14 21-21 44t-7 48v65H0Zm240 0v-65q0-32 17.5-58.5T307-410q32-20 76.5-30t96.5-10q53 0 97.5 10t76.5 30q32 20 49 46.5t17 58.5v65H240Zm540 0v-65q0-26-6.5-49T754-397q11-2 22.5-2.5t23.5-.5q72 0 116 26.5t44 70.5v63H780Zm-455-80h311q-10-20-55.5-35T480-370q-55 0-100.5 15T325-320ZM160-440q-33 0-56.5-23.5T80-520q0-34 23.5-57t56.5-23q34 0 57 23t23 57q0 33-23 56.5T160-440Zm640 0q-33 0-56.5-23.5T720-520q0-34 23.5-57t56.5-23q34 0 57 23t23 57q0 33-23 56.5T800-440Zm-320-40q-50 0-85-35t-35-85q0-51 35-85.5t85-34.5q51 0 85.5 34.5T600-600q0 50-34.5 85T480-480Zm0-80q17 0 28.5-11.5T520-600q0-17-11.5-28.5T480-640q-17 0-28.5 11.5T440-600q0 17 11.5 28.5T480-560Zm1 240Zm-1-280Z",
    filled:
      "M0-240v-63q0-43 44-70t116-27q13 0 25 .5t23 2.5q-14 21-21 44t-7 48v65H0Zm240 0v-65q0-32 17.5-58.5T307-410q32-20 76.5-30t96.5-10q53 0 97.5 10t76.5 30q32 20 49 46.5t17 58.5v65H240Zm540 0v-65q0-26-6.5-49T754-397q11-2 22.5-2.5t23.5-.5q72 0 116 26.5t44 70.5v63H780ZM160-440q-33 0-56.5-23.5T80-520q0-34 23.5-57t56.5-23q34 0 57 23t23 57q0 33-23 56.5T160-440Zm640 0q-33 0-56.5-23.5T720-520q0-34 23.5-57t56.5-23q34 0 57 23t23 57q0 33-23 56.5T800-440Zm-320-40q-50 0-85-35t-35-85q0-51 35-85.5t85-34.5q51 0 85.5 34.5T600-600q0 50-34.5 85T480-480Z",
  },
};

export type MobileIconName =
  | "home" | "work" | "progress" | "stories" | "profile" | "clock" | "review" | "arrow"
  | "mic" | "chat" | "learn" | "quiz" | "type" | "language"
  | "chevron-left" | "chevron-right" | "chevron-down" | "check" | "check-circle" | "close"
  | "settings" | "logout" | "refresh" | "alert" | "info" | "mic-off" | "retry"
  | "paperclip" | "comment" | "id-card" | "star" | "briefcase" | "board" | "sort"
  | "inbox" | "projects" | "teams";

export const MOBILE_ICON_NAMES = [...Object.keys(STROKE), ...Object.keys(MATERIAL)] as MobileIconName[];

export interface MobileIconProps {
  name: MobileIconName;
  /** Square size in px. Defaults to 20. */
  size?: number;
  /** Solid twin, where one exists (`inbox`, `projects`, `teams`). */
  filled?: boolean;
  strokeWidth?: number;
  className?: string;
  /** Give it a label only when the icon stands alone and says something. */
  label?: string;
}

export function MobileIcon({ name, size = 20, filled = false, strokeWidth = 1.75, className, label }: MobileIconProps) {
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true as const };
  const material = MATERIAL[name];
  if (material) {
    return (
      <svg width={size} height={size} viewBox="0 -960 960 960" fill="currentColor" className={className} {...a11y}>
        <path d={filled ? material.filled : material.outlined} />
      </svg>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled && name === "star" ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...a11y}
    >
      {STROKE[name]}
    </svg>
  );
}
