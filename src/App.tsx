import { useState } from "react";
import { Toaster } from "./components";
import { ShellLayout } from "./shell";
import { AdminPage } from "./admin";
import { Playground } from "./playground/Playground";
import { DashboardHome } from "./dashboard";
import { HomePage } from "./playground/HomePage";
import { PlaceholderPage } from "./playground/PlaceholderPage";
import demo from "./data/demo.json";
import type { DemoData } from "./data/types";

// One cast at the edge: JSON has no types, and everything downstream reads the
// declared shapes. When the real API lands, this is the line that changes.
const DATA = demo as DemoData;

/**
 * Demo application.
 *
 * The shell, the admin screens and the playground, wired to `demo.json` and
 * nothing else — no API, no router, no database. `activeHref` is the whole
 * routing layer: the sidebar reports where to go, and this switch decides what
 * to render.
 */
export function App() {
  const [activeHref, setActiveHref] = useState("/home");
  const [search, setSearch] = useState("");

  const master = activeHref.startsWith("/admin/")
    ? DATA.masters.find((m) => m.key === activeHref.slice("/admin/".length))
    : undefined;

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
        {master ? (
          // The topbar search reaches the admin table so the shell's search is
          // not decorative; the page keeps its own box too.
          <AdminPage key={master.key} master={master} externalSearch={search} />
        ) : activeHref === "/playground" ? (
          <Playground />
        ) : activeHref === "/home" ? (
          <DashboardHome data={DATA} onNavigate={setActiveHref} />
        ) : activeHref === "/about" ? (
          <HomePage data={DATA} onNavigate={setActiveHref} />
        ) : (
          <PlaceholderPage href={activeHref} onNavigate={setActiveHref} />
        )}
      </ShellLayout>
      <Toaster />
    </>
  );
}
