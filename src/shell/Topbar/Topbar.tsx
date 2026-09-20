import type { ReactNode } from "react";
import { SearchBar } from "../../components/SearchBar";
import { useIsMobile } from "../../hooks/useIsMobile";
import { Profile } from "../Profile/Profile";
import { NotificationBell } from "./NotificationBell";
import { SHELL_TOPBAR_H } from "../Sidebar/Sidebar";
import type { DemoNotification, DemoUser } from "../../data/types";

export interface TopbarProps {
  user: DemoUser;
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  notifications: DemoNotification[];
  onNotificationRead?: (id: string) => void;
  onNotificationsReadAll?: () => void;
  onLanguageChange?: (code: string) => void;
  onSignOut?: () => void;
  /** Rendered on phones only; opens the sidebar drawer. */
  onMenuClick?: () => void;
  /** Extra controls between the search and the bell. */
  extra?: ReactNode;
}

/**
 * Top chrome: drawer trigger (phones), global search, notifications, profile.
 *
 * Height matches the sidebar's logo row so the two bottom borders line up —
 * that alignment is the reason both read from `SHELL_TOPBAR_H` instead of
 * each declaring 64px.
 */
export function Topbar({
  user,
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  notifications,
  onNotificationRead,
  onNotificationsReadAll,
  onLanguageChange,
  onSignOut,
  onMenuClick,
  extra,
}: TopbarProps) {
  const isMobile = useIsMobile();

  return (
    <header
      style={{
        height: SHELL_TOPBAR_H,
        display: "flex",
        alignItems: "center",
        gap: isMobile ? 8 : 16,
        padding: isMobile ? "0 16px" : "0 32px",
        borderBottom: "1px solid var(--rule)",
        background: "var(--page)",
        flexShrink: 0,
        zIndex: 10,
      }}
    >
      {isMobile && onMenuClick && (
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
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
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      )}

      <div style={{ flex: "1 1 auto", minWidth: 0, maxWidth: 380 }}>
        <SearchBar
          value={search}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
          shortcut={isMobile ? undefined : "Ctrl K"}
          bindShortcut
          width="100%"
          compact={isMobile}
        />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: isMobile ? 8 : 12,
          marginLeft: "auto",
          minWidth: 0,
        }}
      >
        {extra}
        <NotificationBell
          items={notifications}
          onRead={onNotificationRead}
          onReadAll={onNotificationsReadAll}
        />
        <Profile
          user={user}
          onLanguageChange={onLanguageChange}
          onSignOut={onSignOut}
          compact={isMobile}
        />
      </div>
    </header>
  );
}
