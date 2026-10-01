import { Suspense, lazy, useState, type ReactNode } from "react";
import { ErrorBoundary, SkeletonCard, Toaster } from "./components";
import { ShellLayout } from "./shell";
import { SettingsPage } from "./admin";
import { WorkHome } from "./home";
import { PlaceholderPage } from "./playground/PlaceholderPage";
import demo from "./data/demo.json";
import type { DemoData } from "./data/types";

/**
 * One cast at the edge.
 *
 * JSON has no types; everything downstream reads the declared shapes. Only the
 * shell's own content is loaded here — the nav, the person in the topbar, the
 * notifications, Home and the dashboard. Each module's data loads with that
 * module; see the lazy imports below.
 */
const DATA = demo as unknown as DemoData;

/**
 * The screens, fetched when they are first needed.
 *
 * Every one of these was a plain import, which meant the browser downloaded
 * all 41 screens — and 221 KB of JSON describing them — before Home could
 * paint. Someone who opens the workspace to look at Home now downloads Home.
 *
 * What stays eager is deliberate: the shell and Home, because they are what a
 * visitor sees first, and a lazy landing screen would show a skeleton for no
 * reason. Everything behind a click can afford a chunk fetch, which on a warm
 * connection is imperceptible.
 *
 * `React.lazy` wants a module with a default export; each screen module has
 * one, so these stay one line each.
 */
const AdminScreen = lazy(() => import("./admin/AdminScreen"));
const MartScreen = lazy(() => import("./omnimart/MartScreen"));
const PulseScreen = lazy(() => import("./omnipulse/PulseScreen"));
const VarsityScreen = lazy(() => import("./omnivarsity/VarsityScreen"));
const DashboardHome = lazy(() =>
  import("./dashboard").then((m) => ({ default: m.DashboardHome })),
);
const Playground = lazy(() =>
  import("./playground/Playground").then((m) => ({ default: m.Playground })),
);
const AboutPage = lazy(() =>
  import("./playground/HomePage").then((m) => ({ default: m.HomePage })),
);

/** /admin/<key> → the key, for the master and settings lookups. */
function adminKey(href: string): string | null {
  return href.startsWith("/admin/") ? href.slice("/admin/".length) : null;
}

/**
 * Demo application.
 *
 * `activeHref` is the whole routing layer: the sidebar reports where to go,
 * and this component decides which module answers for it. It knows the module
 * boundaries and nothing inside them — a module's own screens, its data and
 * its internal navigation live with that module.
 */
export function App() {
  const [activeHref, setActiveHref] = useState("/home");
  const [search, setSearch] = useState("");

  const key = adminKey(activeHref);
  const settings = key ? DATA.settings.find((s) => s.key === key) : undefined;

  return (
    <>
      <ShellLayout
        data={DATA}
        activeHref={activeHref}
        onNavigate={(href) => {
          setActiveHref(href);
          setSearch("");
        }}
        search={search}
        onSearchChange={setSearch}
      >
        {/* Keyed on the route so a crash on one screen is cleared by
            navigating away, rather than following the person around. */}
        <ErrorBoundary key={activeHref}>
          <Screen href={activeHref} search={search} settings={settings} onNavigate={setActiveHref} />
        </ErrorBoundary>
      </ShellLayout>
      <Toaster />
    </>
  );
}

function Screen({
  href,
  search,
  settings,
  onNavigate,
}: {
  href: string;
  search: string;
  settings: DemoData["settings"][number] | undefined;
  onNavigate: (href: string) => void;
}) {
  const missing = <PlaceholderPage href={href} onNavigate={onNavigate} />;

  // Eager: what a visitor sees before they have clicked anything.
  if (href === "/home") return <WorkHome data={DATA.home} />;
  if (settings) return <SettingsPage key={settings.key} settings={settings} />;

  if (href === "/admin/dashboard") {
    // Admin's own dashboard is the dashboard — one component, two routes.
    return (
      <Lazy>
        <DashboardHome data={DATA} onNavigate={onNavigate} />
      </Lazy>
    );
  }
  if (href.startsWith("/admin/")) {
    return (
      <Lazy>
        <AdminScreen masterKey={href.slice("/admin/".length)} search={search} fallback={missing} />
      </Lazy>
    );
  }
  if (href.startsWith("/omnimart/")) {
    return (
      <Lazy>
        <MartScreen href={href} search={search} fallback={missing} />
      </Lazy>
    );
  }
  if (href.startsWith("/omnivarsity/")) {
    return (
      <Lazy>
        <VarsityScreen href={href} search={search} fallback={missing} />
      </Lazy>
    );
  }
  if (href.startsWith("/omnipulse/")) {
    return (
      <Lazy>
        <PulseScreen href={href} onNavigate={onNavigate} />
      </Lazy>
    );
  }
  if (href === "/playground") {
    return (
      <Lazy>
        <Playground />
      </Lazy>
    );
  }
  if (href === "/about") {
    return (
      <Lazy>
        <AboutPage data={DATA} onNavigate={onNavigate} />
      </Lazy>
    );
  }

  return missing;
}

/**
 * What fills the content area while a chunk is in flight.
 *
 * The same skeleton the screens themselves open through, so the fetch and the
 * screen's own loading state read as one wait rather than two.
 */
function Lazy({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div style={{ display: "grid", gap: 16, maxWidth: 1560 }}>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={5} />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
