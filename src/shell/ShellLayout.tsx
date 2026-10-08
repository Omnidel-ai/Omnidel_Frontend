import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useIsMobile } from "../hooks/useIsMobile";
import { Sidebar } from "./Sidebar/Sidebar";
import { Topbar } from "./Topbar/Topbar";
import { StatusBar } from "./StatusBar/StatusBar";
import { AskMache } from "./AskMache/AskMache";
import { TASK_TIMER_W, TaskTimerChip, TaskTimerPanel, useTaskTimer, type TaskTimerData } from "../tasktimer";
import type { DemoData } from "../data/types";

const NO_TIMER: TaskTimerData = { tasks: [], extraMinutesPerAttempt: 0 };

export interface ShellLayoutProps {
  data: DemoData;
  /** Current route. The shell highlights it; the caller renders for it. */
  activeHref: string;
  onNavigate: (href: string) => void;
  children: ReactNode;
  /** Topbar search value, lifted so a page can react to it. */
  search?: string;
  onSearchChange?: (value: string) => void;
  /** Tasks the person can time. Omit and neither the chip nor the panel exists. */
  taskTimer?: TaskTimerData;
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
  taskTimer,
}: ShellLayoutProps) {
  const isMobile = useIsMobile();
  const [navOpen, setNavOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState("");
  const [notifications, setNotifications] = useState(data.notifications);
  const [language, setLanguage] = useState(data.user.activeLanguage);
  const [signedOut, setSignedOut] = useState(false);

  const timer = useTaskTimer(taskTimer ?? NO_TIMER);
  const panelOpen = timer.open && timer.view !== null;
  // An expired session owes an update — Escape does not walk away from it.
  const canDismiss = timer.view?.capture !== "expired";

  useEffect(() => {
    if (!panelOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && canDismiss && !e.defaultPrevented) timer.actions.close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelOpen, canDismiss, timer.actions]);

  const search = searchProp ?? localSearch;
  const setSearch = onSearchChange ?? setLocalSearch;

  return (
    <div
      style={
        {
          display: "flex",
          height: "100dvh",
          maxHeight: "100dvh",
          overflow: "hidden",
          // Fixed-position chrome (the assistant pill) reads this to ride left with the page.
          "--shell-dock-right": panelOpen && !isMobile ? `${TASK_TIMER_W}px` : "0px",
        } as CSSProperties
      }
    >
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
          urgent={data.urgent}
          onUrgentOpen={(t) => {
            // A timeable task opens in the panel; anything else would deep-link to its board.
            if (taskTimer?.tasks.some((x) => x.id === t.id)) timer.actions.open(t.id);
          }}
          extra={
            timer.chip && (
              <TaskTimerChip
                view={timer.chip}
                open={panelOpen && timer.view?.task.id === timer.chip.task.id}
                compact={isMobile}
                onClick={() =>
                  panelOpen && timer.view?.task.id === timer.chip?.task.id
                    ? timer.actions.close()
                    : timer.actions.open(timer.chip!.task.id)
                }
              />
            )
          }
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

      {taskTimer && (
        // A flex sibling, not an overlay: animating its width squeezes the page
        // left on open and lets it spread back on close. Phones get a sheet.
        <div
          className={isMobile ? "tt-dock tt-dock--sheet" : "tt-dock"}
          data-open={panelOpen}
          aria-hidden={!panelOpen}
          inert={!panelOpen}
          style={isMobile ? undefined : { width: panelOpen ? TASK_TIMER_W : 0 }}
        >
          <div className="tt-dock__inner" style={{ width: isMobile ? "100%" : TASK_TIMER_W }}>
            {timer.view && (
              <TaskTimerPanel
                view={timer.view}
                onClose={timer.actions.close}
                onStart={() => timer.actions.start(timer.view!.task.id)}
                onResume={timer.actions.resume}
                onCapture={timer.actions.capture}
                onCancelCapture={timer.actions.cancelCapture}
                onSubmitCapture={timer.actions.submitCapture}
                onRequestTime={timer.actions.requestTime}
                onViewTask={timer.actions.view}
              />
            )}
          </div>
        </div>
      )}

      <AskMache assistant={data.assistant} />
    </div>
  );
}
