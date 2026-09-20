import { useState, type ReactNode } from "react";
import { useIsMobile } from "../hooks/useIsMobile";
import { Sidebar } from "./Sidebar/Sidebar";
import { Topbar } from "./Topbar/Topbar";
import { StatusBar } from "./StatusBar/StatusBar";
import { AskMache } from "./AskMache/AskMache";
import type { DemoData } from "../data/types";

export interface ShellLayoutProps {
  data: DemoData;
  /** Current route. The shell highlights it; the caller renders for it. */
  activeHref: string;
  onNavigate: (href: string) => void;
  children: ReactNode;
  /** Topbar search value, lifted so a page can react to it. */
  search?: string;
  onSearchChange?: (value: string) => void;
}

/**
 * The application frame: sidebar, topbar, scrolling content, status bar and
 * the assistant.
 *
 * Only the content column scrolls. The topbar sits outside the scrollport so
 * its bottom border lines up with the sidebar's logo row, and the status bar
 * stays pinned under the content instead of riding up with it.
 *
 * Every label, route, badge and status value comes from `data` — swap the JSON
 * and the same shell renders a different application.
 */
export function ShellLayout({
  data,
  activeHref,
  onNavigate,
  children,
  search: searchProp,
  onSearchChange,
}: ShellLayoutProps) {
  const isMobile = useIsMobile();
  const [navOpen, setNavOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState("");
  const [notifications, setNotifications] = useState(data.notifications);
  const [language, setLanguage] = useState(data.user.activeLanguage);
  const [signedOut, setSignedOut] = useState(false);

  const search = searchProp ?? localSearch;
  const setSearch = onSearchChange ?? setLocalSearch;

  return (
    <div style={{ display: "flex", height: "100dvh", maxHeight: "100dvh", overflow: "hidden" }}>
      <Sidebar
        brand={data.brand}
        items={data.nav}
        activeHref={activeHref}
        onNavigate={onNavigate}
        isMobile={isMobile}
        mobileOpen={navOpen}
        onMobileOpenChange={setNavOpen}
        footer={[
          { label: "What's new", icon: "megaphone", onClick: () => undefined, dot: true },
        ]}
      />

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <Topbar
          user={{ ...data.user, activeLanguage: language }}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search this workspace…"
          notifications={notifications}
          onNotificationRead={(id) =>
            setNotifications((ns) => ns.map((n) => (n.id === id ? { ...n, unread: false } : n)))
          }
          onNotificationsReadAll={() =>
            setNotifications((ns) => ns.map((n) => ({ ...n, unread: false })))
          }
          onLanguageChange={setLanguage}
          onSignOut={() => setSignedOut(true)}
          onMenuClick={() => setNavOpen(true)}
        />

        <div className="themed-scroll-y" style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
          <main
            style={{
              padding: isMobile ? "var(--gutter) 16px 96px" : "var(--gutter) 32px 30px",
            }}
          >
            {signedOut && (
              <div className="form-error-banner" role="status">
                Signed out — in the demo this only shows this line. Reload to reset.
              </div>
            )}
            {children}
          </main>
        </div>

        <StatusBar
          items={[
            ...data.status,
            {
              key: "lang",
              label: "Lang",
              value: (data.user.languages.find((l) => l.code === language)?.label ?? language),
              tone: "neutral",
            },
          ]}
          trailing={<span style={{ fontFamily: "var(--mono)" }}>{data.brand.environment}</span>}
        />
      </div>

      <AskMache assistant={data.assistant} />
    </div>
  );
}
