"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/omnidel/sidebar";
import { Topbar } from "@/components/omnidel/topbar";
import type { ModuleNavData } from "@/lib/client/module-nav";
import { ModuleNavProvider } from "@/lib/client/module-nav";
import { useIsMobile } from "@/lib/client/use-is-mobile";
import type { SidebarWorkflowStage } from "@/app/(dashboard)/layout";

interface DashboardShellProps {
  children: React.ReactNode;
  userName: string;
  role: string;
  permissions: string[];
  phone?: string;
  userTeams?: { id: string; name: string }[];
  pipelineStages: SidebarWorkflowStage[];
  operationStages: SidebarWorkflowStage[];
  pendingWorkerSetupCount: number;
  /** Newest published What's New date (YYYY-MM-DD) for sidebar unread dot. */
  newestWhatsNewDate?: string | null;
}

export function DashboardShell({
  children,
  userName,
  role,
  permissions,
  phone,
  userTeams = [],
  pipelineStages,
  operationStages,
  pendingWorkerSetupCount,
  newestWhatsNewDate = null,
}: DashboardShellProps) {
  const [moduleNav, setModuleNav] = useState<ModuleNavData | null>(null);
  // Mobile: the sidebar becomes an off-canvas drawer toggled from the topbar
  // hamburger. Desktop (isMobile=false) keeps the in-flow sticky sidebar and
  // never receives a drawer trigger, so its layout is unchanged.
  const isMobile = useIsMobile();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/modules")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.labels) return;
        setModuleNav({
          labels: d.labels as Record<string, string>,
          sort_order: (d.sort_order || {}) as Record<string, number>,
          nav_labels: (d.nav_labels || {}) as Record<string, Record<string, string>>,
          nav_sort_order: (d.nav_sort_order || {}) as Record<string, Record<string, number>>,
        });
      })
      .catch(() => {
        /* sidebar and headers fall back to hardcoded defaults */
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <ModuleNavProvider data={moduleNav}>
      {/* Topbar sits OUTSIDE the scrollport so its bottom border lines up with
          the sidebar logo row. Only main content scrolls. */}
      <div style={{ display: "flex", height: "100dvh", maxHeight: "100dvh", overflow: "hidden" }}>
        <Sidebar
          userName={userName}
          role={role}
          permissions={permissions}
          phone={phone}
          pipelineStages={pipelineStages}
          operationStages={operationStages}
          pendingWorkerSetupCount={pendingWorkerSetupCount}
          moduleNav={moduleNav}
          isMobile={isMobile}
          mobileOpen={navOpen}
          onMobileOpenChange={setNavOpen}
          newestWhatsNewDate={newestWhatsNewDate}
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
          <Topbar userName={userName} role={role} phone={phone} userTeams={userTeams} onMenuClick={isMobile ? () => setNavOpen(true) : undefined} />
          <div
            data-dashboard-scroll=""
            className="themed-scroll-y"
            style={{ flex: 1, overflow: "auto", minHeight: 0 }}
          >
            <main>
              <div style={{ padding: isMobile ? "var(--gutter) 16px var(--fab-clearance)" : "var(--gutter) 32px 30px" }}>
                {children}
              </div>
            </main>
          </div>
        </div>
      </div>
    </ModuleNavProvider>
  );
}
