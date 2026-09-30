import { useEffect, useState } from "react";
import { Toaster } from "../components";
import { useIsMobile } from "../hooks/useIsMobile";
import { Sidebar, Topbar } from "../shell";
import { InstancePage } from "./InstancePage";
import { InstancesPage } from "./InstancesPage";
import { StaffRolesPage } from "./StaffRolesPage";
import type { ConsoleData } from "./types";

export interface ConsoleAppProps {
  data: ConsoleData;
}

const HOME = "/console/instances";

/** `#/console/instances/other` → "/console/instances/other". */
function readRoute(): string {
  const path = window.location.hash.replace(/^#/, "");
  return path.startsWith("/console/") ? path : HOME;
}

/**
 * OmniDel Console — the platform app staff use to run customer instances.
 *
 * A separate application from the workspace: its own brand, nav and user, and
 * none of the workspace's search, notifications, status bar or assistant. It
 * lives here only until the console's own app is built, then moves across;
 * the pages take plain props so they carry over without this file.
 *
 * Routing is the URL hash, so a deep link survives a reload on a static host.
 */
export function ConsoleApp({ data }: ConsoleAppProps) {
  const isMobile = useIsMobile();
  const [route, setRoute] = useState(readRoute);
  const [navOpen, setNavOpen] = useState(false);
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    const onHash = () => setRoute(readRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const navigate = (href: string) => {
    window.location.hash = href;
    setNavOpen(false);
  };

  const instanceId = route.startsWith("/console/instances/") ? route.slice("/console/instances/".length) : null;
  const instance = instanceId ? data.instances.find((i) => i.id === instanceId) : undefined;
  // The nav highlights the section, not the record inside it.
  const activeHref = route.startsWith("/console/instances") ? "/console/instances" : route;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", overflow: "hidden" }}>
      {instance && (
        <div className="console-viewing" role="status">
          <span>
            Viewing {instance.name} · {instance.prefix}
          </span>
          <button type="button" onClick={() => navigate(HOME)}>
            Leave this instance
          </button>
        </div>
      )}

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <Sidebar
          brand={data.brand}
          items={data.nav}
          activeHref={activeHref}
          onNavigate={navigate}
          isMobile={isMobile}
          mobileOpen={navOpen}
          onMobileOpenChange={setNavOpen}
          footer={[
            { label: "What's new", icon: "bell", onClick: () => undefined, dot: true },
            { label: "Sign out", icon: "logout", onClick: () => setSignedOut(true), tone: "crit" },
          ]}
        />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
          <Topbar user={data.user} onSignOut={() => setSignedOut(true)} onMenuClick={() => setNavOpen(true)} />

          <div className="themed-scroll-y" style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
            <main style={{ padding: isMobile ? "var(--gutter) 16px 48px" : "28px 32px 40px" }}>
              {signedOut && (
                <div className="form-error-banner" role="status">
                  Signed out — in the preview this only shows this line. Reload to reset.
                </div>
              )}
              {instance ? (
                <InstancePage key={instance.id} instance={instance} />
              ) : route === "/console/staff-roles" ? (
                <StaffRolesPage roles={data.roles} permissions={data.permissions} />
              ) : (
                <InstancesPage instances={data.instances} onOpen={(i) => navigate(`/console/instances/${i.id}`)} />
              )}
            </main>
          </div>
        </div>
      </div>

      <Toaster />
    </div>
  );
}
