"use client";

import { NotificationBell } from "@/components/omnidel/notification-bell";
import { UrgentBell } from "@/components/omnidel/urgent-bell";
import { SearchTrigger } from "@/components/omnidel/search/SearchTrigger";
import { DASHBOARD_TOPBAR_H } from "@/lib/client/dashboard-layout";
import { ProfileMenu, type ProfileTeam } from "@/components/omnidel/profile-menu";
import { useTr } from "@/lib/client/language";

export function Topbar({ userName, role, phone, userTeams = [], onMenuClick }: {
  userName: string;
  role?: string;
  phone?: string;
  userTeams?: ProfileTeam[];
  onMenuClick?: () => void;
}) {
  const tr = useTr();
  return (
    <header style={{
      height: DASHBOARD_TOPBAR_H, display: "flex", alignItems: "center",
      // The hamburger (mobile only) sits at the start; the name + bell are pushed
      // to the right (bell last = right edge) via order/marginLeft below. Without
      // the hamburger the row stays right-aligned exactly as before (desktop).
      justifyContent: onMenuClick ? "flex-start" : "flex-end",
      padding: onMenuClick ? "0 16px" : "0 32px", borderBottom: "1px solid var(--rule)",
      background: "var(--page)",
      flexShrink: 0,
      zIndex: 10,
      gap: 16,
    }}>
      {onMenuClick && (
        <button
          type="button"
          onClick={onMenuClick}
          aria-label={tr("Open navigation menu")}
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 36, height: 36, padding: 0, flexShrink: 0,
            background: "transparent", border: "1px solid var(--rule)",
            borderRadius: "var(--r-sm)", color: "var(--ink)", cursor: "pointer",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      )}

      {/* Global search — left of urgent/notification bells (flag-gated).
          On mobile pass compact so the chip can't overflow the topbar. */}
      <div style={{
        display: "flex", alignItems: "center", minWidth: 0,
        // Mobile: the hamburger sits first, so push the profile to the right
        // and let it shrink. Desktop is right-aligned by the header already.
        ...(onMenuClick ? { order: 1, marginLeft: "auto", flexShrink: 1 } : null),
      }}>
        <ProfileMenu userName={userName} role={role ?? ""} phone={phone} teams={userTeams} />
      </div>
    </header>
  );
}
