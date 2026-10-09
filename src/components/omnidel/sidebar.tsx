"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { usePermissions } from "@/lib/client/permissions";
import { useNavLabel, useStrings, useTr } from "@/lib/client/language";
import type { SidebarWorkflowStage } from "@/app/(dashboard)/layout";
import { type PinnedItem, getPins, removePin, subscribePins } from "@/lib/client/pins";
import { PinIcon } from "@/components/omnidel/pin-button";

import type { ModuleNavData } from "@/lib/client/module-nav";
import {
  MODULE_FALLBACK_LABELS,
  MODULE_DEFAULT_SORT,
  SIDEBAR_ADMIN_DEFINITION,
  SIDEBAR_MODULE_DEFINITIONS,
  SIDEBAR_MODULE_SLUGS,
  canonicalNavDisplayLabel,
  navKeyFromHref,
  fallbackNavLabel,
  type SidebarNavDefinition,
} from "@/lib/module-nav-defaults";
import {
  useWhatsNewUnread,
  WhatsNewUnreadDot,
} from "@/components/omnidel/whats-new/unread-dot";
import { useRouter } from "next/navigation";
import { DASHBOARD_TOPBAR_H } from "@/lib/client/dashboard-layout";

export type { ModuleNavData };

interface NavItem {
  label: string;
  href: string;
  iconKey: string;
  moduleSlug?: string;
  permission?: string;
  children?: NavItem[];
  badge?: number;
  // A collapsible category header (no page of its own) — used to group a long
  // child list (e.g. Admin). Renders as a pure expand/collapse toggle.
  group?: boolean;
}

const MODULE_FALLBACK_LABELS_LOCAL = MODULE_FALLBACK_LABELS;

function moduleLabel(slug: string, moduleNav: ModuleNavData | null | undefined): string {
  return moduleNav?.labels[slug] ?? MODULE_FALLBACK_LABELS_LOCAL[slug] ?? slug;
}

function navItemLabel(
  moduleSlug: string,
  href: string,
  defaultLabel: string,
  moduleNav: ModuleNavData | null | undefined,
): string {
  const key = navKeyFromHref(moduleSlug, href);
  if (key && moduleNav?.nav_labels[moduleSlug]?.[key]) {
    return canonicalNavDisplayLabel(moduleSlug, key, moduleNav.nav_labels[moduleSlug][key]);
  }
  if (key) {
    const fallback = fallbackNavLabel(moduleSlug, key);
    return canonicalNavDisplayLabel(moduleSlug, key, fallback === key ? defaultLabel : fallback);
  }
  return defaultLabel;
}

function applyNavLabels(
  moduleSlug: string,
  children: NavItem[],
  moduleNav: ModuleNavData | null | undefined,
): NavItem[] {
  const labeled = children.map((child) => ({
    ...child,
    label: navItemLabel(moduleSlug, child.href, child.label, moduleNav),
    children: child.children
      ? child.children.map((stage) => ({
          ...stage,
          label: stage.label,
        }))
      : undefined,
  }));

  if (!moduleNav?.nav_sort_order?.[moduleSlug]) return labeled;

  const orderMap = moduleNav.nav_sort_order[moduleSlug];
  return [...labeled].sort((a, b) => {
    const keyA = navKeyFromHref(moduleSlug, a.href);
    const keyB = navKeyFromHref(moduleSlug, b.href);
    const oa = keyA ? (orderMap[keyA] ?? 999) : 999;
    const ob = keyB ? (orderMap[keyB] ?? 999) : 999;
    return oa - ob;
  });
}

function moduleSortOrder(slug: string, moduleNav: ModuleNavData | null | undefined): number {
  return moduleNav?.sort_order[slug] ?? MODULE_DEFAULT_SORT[slug] ?? 999;
}

function buildModuleNavItem(
  moduleSlug: string,
  href: string,
  children: NavItem[],
  moduleNav: ModuleNavData | null | undefined,
): NavItem {
  return {
    label: moduleLabel(moduleSlug, moduleNav),
    href,
    iconKey: moduleSlug,
    moduleSlug,
    children: applyNavLabels(moduleSlug, children, moduleNav),
  };
}

/** Recursively swap every nav label for its translation. Shape is preserved. */
function translateNav(items: NavItem[], navT: (label: string) => string): NavItem[] {
  return items.map((item) => ({
    ...item,
    label: navT(item.label),
    ...(item.children ? { children: translateNav(item.children, navT) } : {}),
  }));
}

function buildNav(
  pipelineStages: SidebarWorkflowStage[],
  operationStages: SidebarWorkflowStage[],
  pendingWorkerSetupCount: number,
  moduleNav?: ModuleNavData | null,
  isAdmin = false,
): NavItem[] {
  const adminLabel = (href: string, fallback: string) =>
    navItemLabel("admin", href, fallback, moduleNav);
  const seenSlug = new Set<string>();
  const stageChildren: NavItem[] = [];
  for (const s of pipelineStages) {
    if (seenSlug.has(s.slug)) continue;
    seenSlug.add(s.slug);
    stageChildren.push({
      label: s.label,
      href: `/omnimart/pipeline/stage/${s.slug}`,
      iconKey: "pipeline",
      permission: "pipeline.view",
      badge: s.count,
    });
  }
  const operationChildren: NavItem[] = operationStages.map((s) => ({
    label: s.label,
    href: `/omnimart/operations/stage/${s.slug}`,
    iconKey: "pipeline",
    permission: "operations.view",
    badge: s.count,
  }));

  function materializeProductPage(def: SidebarNavDefinition): NavItem | null {
    if (def.feature === "meta-ads" && process.env.NEXT_PUBLIC_META_ADS !== "1") return null;
    if (def.permissionOnly) return null;

    let children = def.children
      ?.map(materializeProductPage)
      .filter((child): child is NavItem => child !== null);
    if (def.dynamicChildren === "pipeline-stages") {
      children = stageChildren.length > 0 ? stageChildren : undefined;
    } else if (def.dynamicChildren === "operation-stages") {
      children = operationChildren.length > 0 ? operationChildren : undefined;
    }

    return {
      label: def.label,
      href: def.href,
      iconKey: def.iconKey,
      permission: def.permission,
      children: children && children.length > 0 ? children : undefined,
    };
  }

  function materializeAdminPage(def: SidebarNavDefinition): NavItem | null {
    if (def.feature === "admin-only" && !isAdmin) return null;
    const children = def.children
      ?.map(materializeAdminPage)
      .filter((child): child is NavItem => child !== null);
    return {
      label: adminLabel(def.href, def.label),
      href: def.href,
      iconKey: def.iconKey,
      permission: def.permission,
      group: def.group,
      badge: def.badge === "pending-worker-setup" ? pendingWorkerSetupCount : undefined,
      children: children && children.length > 0 ? children : undefined,
    };
  }

  // Materialized from the shared canonical definition also used by Roles &
  // Permissions.
  const canonicalModuleTemplates: Array<{ slug: string; href: string; children: NavItem[] }> =
    SIDEBAR_MODULE_DEFINITIONS.map((module) => ({
      slug: module.slug,
      href: module.href,
      children: module.children
        .map(materializeProductPage)
        .filter((child): child is NavItem => child !== null),
    }));

  const activeSlugs = moduleNav
    ? SIDEBAR_MODULE_SLUGS.filter((slug) => moduleNav.labels[slug])
    : [...SIDEBAR_MODULE_SLUGS];

  const moduleItems = canonicalModuleTemplates
    .filter((t) => activeSlugs.includes(t.slug as (typeof SIDEBAR_MODULE_SLUGS)[number]))
    .sort((a, b) => moduleSortOrder(a.slug, moduleNav) - moduleSortOrder(b.slug, moduleNav))
    .map((t) => buildModuleNavItem(t.slug, t.href, t.children, moduleNav));

  const canonicalAdmin = materializeAdminPage(SIDEBAR_ADMIN_DEFINITION);
  return [
    { label: "Home", href: "/home", iconKey: "home" },
    ...moduleItems,
    ...(canonicalAdmin ? [canonicalAdmin] : []),
  ];
}

// Exactly-one-highlight: a path can prefix-match several nav hrefs at once
// (module → child → pinned board all share the /omnipulse/boards stem). To
// avoid lighting up the whole chain, we resolve a SINGLE winning href — the
// longest href that the current path matches — and every row highlights only
// when its own href equals that winner. Pins contribute their path (sans query).
function matchesPath(pathname: string, href: string): boolean {
  const pathOnly = href.split("?")[0];
  return pathname === pathOnly || pathname.startsWith(pathOnly + "/");
}

/** True when this nav node (or any nested child) matches the current path. */
function navItemMatchesPath(item: NavItem, pathname: string): boolean {
  if (matchesPath(pathname, item.href)) return true;
  return (item.children ?? []).some((c) => navItemMatchesPath(c, pathname));
}

/** Normalize to `?a=b` or `""` (no bare `?`). */
function normalizeSearch(search: string): string {
  if (!search || search === "?") return "";
  return search.startsWith("?") ? search : `?${search}`;
}

// Exclusive highlight: only the winning activeHref lights up. Query siblings
// (Users & Access vs Pending setup) are resolved in computeActiveHref.
function isNavRowActive(href: string, _pathname: string, activeHref: string | null): boolean {
  return href === activeHref;
}

function computeActiveHref(
  pathname: string,
  search: string,
  nav: NavItem[],
  pins: PinnedItem[],
): string | null {
  const q = normalizeSearch(search);
  const full = `${pathname}${q}`;

  // Admin kaarigar detail routes stay under People & Access nav.
  if (pathname.startsWith("/admin/users/pending-setup/")) {
    return "/admin/users?tab=pending_setup";
  }
  if (pathname.startsWith("/admin/users/kaarigars/")) {
    return "/admin/users";
  }

  const candidates: string[] = [];
  for (const item of nav) {
    candidates.push(item.href);
    for (const c of item.children ?? []) {
      candidates.push(c.href);
      for (const s of c.children ?? []) candidates.push(s.href);
    }
  }
  for (const p of pins) candidates.push(p.href.split("?")[0]);

  // 1) Exact path+query match (e.g. /admin/users?tab=pending_setup)
  let best: string | null = null;
  for (const h of candidates) {
    if (h.includes("?") && full === h) {
      if (best === null || h.length > best.length) best = h;
    }
  }
  if (best) return best;

  // 2) Pathname-only: ignore query-bearing candidates so Pending setup never
  //    steals highlight on plain /admin/users.
  for (const h of candidates) {
    if (h.includes("?")) continue;
    if (matchesPath(pathname, h) && (best === null || h.length > best.length)) {
      best = h;
    }
  }
  return best;
}

// Which sub-section (a child that itself has children — pipeline stages or an
// Admin group) contains the current route, so we can auto-expand it.
function subSectionForPath(nav: NavItem[], pathname: string): string | null {
  for (const item of nav) {
    for (const child of item.children ?? []) {
      if (child.children && child.children.some((s) => matchesPath(pathname, s.href))) {
        return child.href;
      }
    }
  }
  return null;
}

const ICONS: Record<string, React.ReactNode> = {
  home: <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
  pipeline: <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
  schedule: <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
  store: <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />,
  billing: <path d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />,
  missions: <><path d="M12 21s7-4.35 7-11a7 7 0 10-14 0c0 6.65 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
  omnivarsity: <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />,
  omnistudio: <><circle cx="12" cy="12" r="3" /><path d="M2 12h2M20 12h2M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></>,
  omnimart: <><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16" /><path d="M3 21h18" /><path d="M9 7h1" /><path d="M14 7h1" /><path d="M9 11h1" /><path d="M14 11h1" /><path d="M9 15h1" /><path d="M14 15h1" /></>,
  omnipulse: <path d="M3 12h4l2-7 4 14 2-7h6" />,
  omnimoney: <><path d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /><path d="M16 12h.01" /><path d="M3 9h18" /></>,
  analytics: <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
  admin: <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z" />,
  ads: <><path d="M3 11v2a1 1 0 001 1h2l4 4V6L6 10H4a1 1 0 00-1 1z" /><path d="M16 9a4 4 0 010 6" /><path d="M19 6.5a8 8 0 010 11" /></>,
  instagram: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><path d="M16.8 7.2h.01" /></>,
};

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const child = ICONS[name];
  if (!child) return <span style={{ width: size, height: size, display: "inline-block", flexShrink: 0 }} />;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      {child}
    </svg>
  );
}

function canSee(item: NavItem, can: (permission: string) => boolean, isFounder: boolean): boolean {
  if (isFounder) return true;
  // A grouping row is visible only when at least one permitted descendant is
  // visible. Without this recursive check, empty Admin sections (whose group
  // rows have no permission of their own) were shown to restricted roles.
  if (item.children) return item.children.some((child) => canSee(child, can, isFounder));
  if (!item.permission) return true;
  return can(item.permission);
}

function canSeeParent(item: NavItem, can: (permission: string) => boolean, isFounder: boolean, hasModule: (mod: string) => boolean): boolean {
  if (isFounder) return true;
  if (!item.children) return canSee(item, can, isFounder);
  if (item.moduleSlug && !hasModule(item.moduleSlug)) return false;
  return item.children.some((c) => canSee(c, can, isFounder));
}

const W_OPEN = 220;
const W_CLOSED = 56;
const TOPBAR_H = DASHBOARD_TOPBAR_H; // sidebar logo row — must match Topbar

// Drawer-style curve (from Ionic / Vaul) — strong ease-out that lands cleanly.
const EASE_OUT = "cubic-bezier(0.32, 0.72, 0, 1)";
// Emil polish: sub-menu expand uses same ease-out family but slightly faster.
const SUB_EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
const WIDTH_MS = 280;
const FADE_MS = 160;
const SUB_MS = 200;

// Returns true when the user has requested reduced motion. Used to skip
// transform animations on the new stage sub-menu reveal (Emil polish requirement).
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

// Fixed-position tooltip — card style matching flyout
function Tooltip({ anchorRef, label, visible }: { anchorRef: React.RefObject<HTMLDivElement | null>; label: string; visible: boolean }) {
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (visible && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({ top: rect.top + rect.height / 2, left: rect.right + 8 });
    }
  }, [visible, anchorRef]);

  if (!visible) return null;
  return (
    <div style={{
      position: "fixed", top: pos.top, left: pos.left, transform: "translateY(-50%)",
      background: "var(--surface)", color: "var(--ink)",
      padding: "6px 12px",
      border: "1px solid var(--rule)", borderRadius: "var(--r-sm)",
      fontSize: 13, fontWeight: 500,
      whiteSpace: "nowrap", zIndex: "var(--z-flyout)", pointerEvents: "none",
      fontFamily: "var(--sans)",
      boxShadow: "var(--shadow-md)",
    }}>
      {label}
    </div>
  );
}

// Rows in the FIRST flyout card. Sub-menus now cascade into a second card on
// hover, so each child (group or leaf) is a single row here.
function flyoutTotalRows(kids: NavItem[]): number {
  return kids.length;
}

// Fixed-position flyout for parent sub-menus (collapsed rail).
// Bridge + flyout are React/DOM descendants of the parent NavSection div, so
// parent's onMouseLeave only fires when the cursor exits the entire subtree.
// Close ownership lives on the parent — no per-element onMouseLeave here.
function Flyout({ anchorRef, visible, title, kids, activeHref, onEnter, onChildClick }: {
  anchorRef: React.RefObject<HTMLDivElement | null>; visible: boolean;
  title: string; kids: NavItem[]; activeHref: string | null;
  onEnter: () => void; onChildClick?: () => void;
}) {
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const totalRows = flyoutTotalRows(kids);

  useEffect(() => {
    if (visible && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      // Estimate natural height (header ~34 + ~34 per row) so a menu anchored
      // low on screen shifts up to fit before the maxHeight cap forces a scroll.
      const estHeight = totalRows * 34 + 34;
      const maxTop = Math.max(8, window.innerHeight - estHeight - 12);
      setPos({ top: Math.min(rect.top, maxTop), left: rect.right + 8 });
    }
  }, [visible, anchorRef, totalRows]);

  if (!visible) return null;

  return (
    <>
      {/* Invisible bridge prevents gap between icon and flyout from closing hover */}
      <div
        onMouseEnter={onEnter}
        style={{
          position: "fixed", top: pos.top - 4, left: pos.left - 12,
          width: 16, height: Math.max(60, totalRows * 34 + 34), zIndex: "var(--z-flyout-bridge)",
        }}
      />
      <div
        onMouseEnter={onEnter}
        className="sidebar-flyout"
        style={{
          position: "fixed", top: pos.top, left: pos.left,
          background: "var(--surface)", border: "1px solid var(--rule)",
          borderRadius: "var(--r-md)", padding: "4px 0",
          minWidth: 160, zIndex: "var(--z-flyout)",
          boxShadow: "var(--shadow-md)",
          // Cap to the space below the anchor's top edge so a tall menu
          // (e.g. Admin) scrolls instead of running off the viewport bottom.
          maxHeight: `calc(100vh - ${pos.top + 12}px)`,
          overflowY: "auto",
          overscrollBehavior: "contain",
        }}
      >
        <div style={{
          padding: "8px 14px", fontFamily: "var(--mono)", fontSize: 9,
          letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-mute)",
          borderBottom: "1px solid var(--rule)", marginBottom: 2,
        }}>
          {title}
        </div>
        {kids.map((child) => (
          <FlyoutRow key={child.href} child={child} activeHref={activeHref} onEnter={onEnter} onChildClick={onChildClick} />
        ))}
      </div>
    </>
  );
}

// A single row in the collapsed flyout. Leaf children navigate directly; a child
// that has sub-items shows its name only and opens a SECOND flyout card to the
// right on hover (cascading menu). All rows share the parent-menu font.
function FlyoutRow({ child, activeHref, onEnter, onChildClick }: {
  child: NavItem; activeHref: string | null;
  onEnter: () => void; onChildClick?: () => void;
}) {
  const pathname = usePathname();
  const hasSub = !!(child.children && child.children.length > 0);
  const childActive = isNavRowActive(child.href, pathname, activeHref);
  const anySubActive = hasSub && child.children!.some((s) => isNavRowActive(s.href, pathname, activeHref));
  const rowRef = useRef<HTMLDivElement>(null);
  const [subOpen, setSubOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openSub = () => {
    onEnter();
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    if (rowRef.current) {
      const r = rowRef.current.getBoundingClientRect();
      setPos({ top: r.top - 4, left: r.right - 2 });
    }
    setSubOpen(true);
  };
  const closeSub = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setSubOpen(false), 120);
  };

  // Leaf row → direct link.
  if (!hasSub) {
    return (
      <Link
        href={child.href}
        className="nav-link"
        onClick={() => onChildClick?.()}
        style={{
          display: "block", padding: "8px 14px", fontSize: 13, fontFamily: "var(--sans)",
          color: childActive ? "var(--green-deep)" : "var(--ink-soft)",
          fontWeight: childActive ? 600 : 400, background: childActive ? "var(--green-wash)" : "transparent",
          textDecoration: "none",
        }}
      >
        {child.label}
      </Link>
    );
  }

  // Parent row → name + chevron; hover opens the second card. A non-group parent
  // (e.g. Pipeline) still navigates on click; a group has no page of its own.
  const RowInner = (
    <>
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{child.label}</span>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </>
  );
  const rowStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 8, width: "100%",
    padding: "8px 14px", fontSize: 13, fontFamily: "var(--sans)", border: "none",
    textAlign: "left", cursor: "pointer", textDecoration: "none",
    color: anySubActive ? "var(--green-deep)" : "var(--ink-soft)",
    fontWeight: anySubActive ? 600 : 400,
    background: subOpen ? "var(--green-wash)" : "transparent",
  };

  return (
    <div ref={rowRef} onMouseEnter={openSub} onMouseLeave={closeSub} style={{ position: "relative" }}>
      {child.group ? (
        <button type="button" className="nav-link" style={rowStyle} onClick={openSub}>{RowInner}</button>
      ) : (
        <Link href={child.href} className="nav-link" style={rowStyle} onClick={() => onChildClick?.()}>{RowInner}</Link>
      )}

      {subOpen && (
        <div
          onMouseEnter={() => { onEnter(); if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; } }}
          onMouseLeave={closeSub}
          className="sidebar-flyout"
          style={{
            position: "fixed", top: pos.top, left: pos.left,
            background: "var(--surface)", border: "1px solid var(--rule)",
            borderRadius: "var(--r-md)", padding: "4px 0", minWidth: 170, zIndex: "var(--z-flyout-sub)",
            boxShadow: "var(--shadow-md)",
            maxHeight: `calc(100vh - ${pos.top + 12}px)`, overflowY: "auto", overscrollBehavior: "contain",
          }}
        >
          {child.children!.map((sub) => {
            const subActive = isNavRowActive(sub.href, pathname, activeHref);
            return (
              <Link
                key={sub.href}
                href={sub.href}
                className="nav-link"
                onClick={() => onChildClick?.()}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                  padding: "8px 14px", fontSize: 13, fontFamily: "var(--sans)",
                  color: subActive ? "var(--green-deep)" : "var(--ink-soft)",
                  fontWeight: subActive ? 600 : 400, background: subActive ? "var(--green-wash)" : "transparent",
                  textDecoration: "none",
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub.label}</span>
                {sub.badge !== undefined && sub.badge > 0 && <StageCount n={sub.badge} active={subActive} />}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Sidebar({
  role, permissions, pipelineStages = [], operationStages = [], pendingWorkerSetupCount = 0, moduleNav,
  isMobile = false, mobileOpen = false, onMobileOpenChange,
  newestWhatsNewDate = null,
}: {
  userName: string; role: string; permissions: string[]; phone?: string;
  pipelineStages?: SidebarWorkflowStage[];
  operationStages?: SidebarWorkflowStage[];
  pendingWorkerSetupCount?: number;
  moduleNav?: ModuleNavData | null;
  // Mobile drawer wiring (supplied by DashboardShell). When isMobile is false
  // these are ignored and the sidebar renders exactly as before.
  isMobile?: boolean;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
  newestWhatsNewDate?: string | null;
}) {
  const tr = useTr();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const whatsNewUnread = useWhatsNewUnread(newestWhatsNewDate);
  const search = normalizeSearch(
    searchParams?.toString() ? `?${searchParams.toString()}` : "",
  );
  const { can, isFounder, isAdmin, hasModule } = usePermissions();

  const navT = useNavLabel();
  const str = useStrings();

  // Translate the tree ONCE here rather than at each render site. The sidebar
  // paints labels from a dozen places (collapsed tooltips, group headers, nested
  // children, aria-labels), and wrapping every one of them would be a large diff
  // on a hot file with an easy miss. Doing it at the source means every consumer
  // — including the aria-labels a screen reader announces — gets the translation
  // for free. Brand names (Instagram, Meta Ads) have no entry and fall through
  // to their English text on purpose.
  const NAV = translateNav(
    buildNav(pipelineStages, operationStages, pendingWorkerSetupCount, moduleNav, isAdmin),
    navT,
  );

  const [collapsed, setCollapsed] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(() => {
    // Match the parent group when the current path matches the parent href OR
    // any of its children's hrefs. This handles the omnipulse case where the
    // parent href is /omnipulse/boards but a child route is /omnipulse/dashboards.
    // Also covers Admin → nested group → leaf (e.g. /whats-new/approve).
    const active = NAV.find(
      (item) => item.children && navItemMatchesPath(item, pathname),
    );
    return active?.href ?? null;
  });
  const [openSubSection, setOpenSubSection] = useState<string | null>(
    () => subSectionForPath(NAV, pathname),
  );
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinnedSection, setPinnedSection] = useState<string | null>(null);
  const asideRef = useRef<HTMLElement>(null);

  // Quick-access pins (localStorage), shown inside the OmniPulse dropdown.
  const [pins, setPins] = useState<PinnedItem[]>([]);
  useEffect(() => {
    const update = () => setPins(getPins());
    update();
    return subscribePins(update);
  }, []);

  // The single nav href the current route resolves to — only the row whose
  // href === activeHref lights up, so module/child/pin never highlight together.
  // Include search so /admin/users vs /admin/users?tab=pending_setup resolve apart.
  const activeHref = computeActiveHref(pathname, search, NAV, pins);

  useEffect(() => {
    // Match parent group by parent href OR any nested child href.
    const activeParent = NAV.find(
      (item) => item.children && navItemMatchesPath(item, pathname),
    );
    if (activeParent) setOpenSection(activeParent.href);
    const sub = subSectionForPath(NAV, pathname);
    if (sub) setOpenSubSection(sub);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search]);

  // Pin survives mouseLeave; clear it when the user clicks anywhere outside
  // the sidebar (including outside the fixed-positioned flyout, which IS a
  // DOM descendant of the aside via React tree → aside.contains catches it).
  useEffect(() => {
    if (!pinnedSection) return;
    const handler = (e: MouseEvent) => {
      if (asideRef.current && !asideRef.current.contains(e.target as Node)) {
        setPinnedSection(null);
        setHovered(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pinnedSection]);

  // Collapse the sidebar wipes any pin so we don't open back into a stale flyout.
  useEffect(() => {
    if (!collapsed) {
      setPinnedSection(null);
      setHovered(null);
    }
  }, [collapsed]);

  // On mobile the rail-collapse behavior is bypassed: the drawer is always
  // full width when open and slides off-screen when closed.
  const w = isMobile ? W_OPEN : collapsed ? W_CLOSED : W_OPEN;

  // Close the mobile drawer whenever the route changes (tapping a nav link
  // navigates, so the drawer should get out of the way). No-op on desktop.
  useEffect(() => {
    if (isMobile) onMobileOpenChange?.(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const handleLogout = useCallback(async () => {
    await fetch("/api/auth/phone/logout", { method: "POST" });
    window.location.href = "/login";
  }, []);

  return (
    <>
      {/* Mobile backdrop — tap to dismiss the drawer. Desktop never renders it. */}
      {isMobile && mobileOpen && (
        <div
          onClick={() => onMobileOpenChange?.(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 39,
            background: "rgba(0,0,0,0.5)",
          }}
          aria-hidden="true"
        />
      )}
    <aside ref={asideRef} style={{
      width: w, minWidth: w, background: "var(--surface)", borderRight: "1px solid var(--rule)",
      display: "flex", flexDirection: "column",
      // overflow: hidden clips fading labels so they don't bleed past the
      // shrinking border. position:fixed flyout/tooltip escape this naturally.
      overflow: "hidden",
      ...(isMobile
        ? {
            // Off-canvas drawer: fixed to the viewport, slides in from the left.
            position: "fixed", top: 0, left: 0, height: "100dvh", flexShrink: 0,
            transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
            transition: `transform ${WIDTH_MS}ms ${EASE_OUT}`,
            boxShadow: mobileOpen ? "var(--shadow-md)" : "none",
            zIndex: 40,
          }
        : {
            // Desktop: in-flow sticky rail — unchanged.
            position: "sticky", top: 0, height: "100vh", flexShrink: 0,
            transition: `width ${WIDTH_MS}ms ${EASE_OUT}, min-width ${WIDTH_MS}ms ${EASE_OUT}`,
            zIndex: 20,
          }),
    }}>
      {/* Logo — padding stays constant so the "O" badge centers naturally
          at x=28 when the rail collapses to 56px (14px padding + 14px half-badge). */}
      <div style={{
        height: TOPBAR_H, display: "flex", alignItems: "center",
        padding: "0 14px", justifyContent: "flex-start",
        gap: 9, borderBottom: "1px solid var(--rule)", flexShrink: 0,
      }}>
        <div onClick={() => setCollapsed(!collapsed)} style={{
          width: 28, height: 28, borderRadius: "50%", background: "var(--green-deep)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", flexShrink: 0,
        }}>
          <span style={{ color: "var(--surface)", fontFamily: "var(--sans)", fontSize: 13, fontWeight: 700, lineHeight: 1 }}>O</span>
        </div>
        <span style={{
          fontFamily: "var(--serif)", fontSize: 16, fontWeight: 600,
          letterSpacing: "-0.01em", whiteSpace: "nowrap",
          opacity: collapsed ? 0 : 1,
          transition: `opacity ${FADE_MS}ms ${EASE_OUT}`,
        }}>
          {tr("OmniDEL.ai")}
        </span>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain", padding: "6px 4px" }}>
        {NAV.map((item) => {
          if (!canSeeParent(item, can, isFounder, hasModule)) return null;

          if (item.children) {
            return (
              <NavSection
                key={item.href}
                item={item}
                collapsed={collapsed}
                sectionOpen={openSection === item.href}
                setSectionOpen={(open) => setOpenSection(open ? item.href : null)}
                openSubSection={openSubSection}
                setOpenSubSection={setOpenSubSection}
                hovered={hovered}
                setHovered={setHovered}
                pinnedSection={pinnedSection}
                setPinnedSection={setPinnedSection}
                pathname={pathname}
                activeHref={activeHref}
                can={can}
                isFounder={isFounder}
                hasModule={hasModule}
                // Pinned quick-access rows render inside the OmniPulse dropdown,
                // keyed off the stable moduleSlug (not the admin-editable label)
                // so renaming the module in Admin > Module Names doesn't hide pins.
                pins={item.moduleSlug === "omnipulse" ? pins : undefined}
              />
            );
          }

          const active = item.href === activeHref;
          return <CollapsibleLink key={item.href} item={item} active={active} collapsed={collapsed} hovered={hovered} setHovered={setHovered} />;
        })}
      </nav>

      {/* Bottom — always same position */}
      <div style={{ borderTop: "1px solid var(--rule)", flexShrink: 0 }}>
        <BottomBtn
          collapsed={collapsed}
          label={str.ui.whatsNew}
          hoverLabel={str.ui.whatsNew}
          hovered={hovered}
          setHovered={setHovered}
          id="whats-new"
          onClick={() => {
            onMobileOpenChange?.(false);
            router.push("/whats-new");
          }}
          color="var(--ink-mute)"
          trailing={<WhatsNewUnreadDot show={whatsNewUnread} />}
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden>
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              <line x1="8" y1="7" x2="16" y2="7" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          }
        />
        <BottomBtn collapsed={collapsed} label={str.ui.collapse} hoverLabel={collapsed ? "Expand" : ""} hovered={hovered} setHovered={setHovered} id="collapse" onClick={() => setCollapsed(!collapsed)} color="var(--ink-mute)"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transform: collapsed ? "rotate(180deg)" : "rotate(0)", transition: `transform 220ms ${EASE_OUT}` }}><polyline points="15 18 9 12 15 6" /></svg>}
        />
        <BottomBtn collapsed={collapsed} label={str.ui.signOut} hoverLabel={str.ui.signOut} hovered={hovered} setHovered={setHovered} id="signout" onClick={handleLogout} color="var(--crit)" border
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>}
        />
      </div>
    </aside>
    </>
  );
}

function CollapsibleLink({ item, active, collapsed, hovered, setHovered }: {
  item: NavItem; active: boolean; collapsed: boolean;
  hovered: string | null; setHovered: (v: string | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      style={{ position: "relative" }}
      onMouseEnter={() => collapsed && setHovered(item.href)}
      onMouseLeave={() => collapsed && setHovered(null)}
    >
      <Link href={item.href} className="nav-link" style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "9px 14px", fontSize: 14, fontWeight: active ? 600 : 400,
        color: active ? "var(--green-deep)" : "var(--ink-soft)",
        background: active ? "var(--green-wash)" : "transparent",
        borderRadius: "var(--r-sm)", textDecoration: "none",
        marginBottom: 1, whiteSpace: "nowrap",
      }}>
        <Icon name={item.iconKey} />
        <span style={{
          opacity: collapsed ? 0 : 1,
          transition: `opacity ${FADE_MS}ms ${EASE_OUT}`,
        }}>
          {item.label}
        </span>
      </Link>
      {collapsed && <Tooltip anchorRef={ref} label={item.label} visible={hovered === item.href} />}
    </div>
  );
}

// Inline child row — handles both plain links and sub-section headers (level 3).
function ChildRow({ child, pathname, activeHref, openSubSection, setOpenSubSection, rowIndex }: {
  child: NavItem; pathname: string; activeHref: string | null;
  openSubSection: string | null; setOpenSubSection: (v: string | null) => void;
  rowIndex: number;
}) {
  // Exclusive highlight: this row lights up only when it IS the winning href —
  // not when a descendant stage is active (the stage row highlights instead).
  const active = child.href === activeHref;
  const hasSubChildren = !!(child.children && child.children.length > 0);
  // Sub-section open state is keyed by href (labels are now admin-editable, so
  // a label key would break when renamed). Highlight stays exclusive — the
  // active stage row lights up, not this parent.
  const subOpen = hasSubChildren && openSubSection === child.href;
  const reducedMotion = useReducedMotion();

  // Staggered row reveal: 40ms base + 30ms per row index (capped at 8 rows)
  // Skipped when prefers-reduced-motion is set.
  const staggerDelay = reducedMotion ? "0ms" : `${Math.min(rowIndex, 8) * 30 + 40}ms`;

  if (!hasSubChildren) {
    const rowActive = isNavRowActive(child.href, pathname, activeHref);
    return (
      <Link
        href={child.href}
        className="nav-link"
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
          padding: "7px 14px", fontSize: 13,
          color: rowActive ? "var(--green-deep)" : "var(--ink-soft)",
          fontWeight: rowActive ? 600 : 400, textDecoration: "none",
          borderLeft: rowActive ? "2px solid var(--green-deep)" : "2px solid transparent",
          marginLeft: -1, background: rowActive ? "var(--green-wash)" : "transparent",
          // Staggered fade-in on section open (opacity only — no transform needed here)
          transition: reducedMotion ? "none" : `opacity 120ms ${SUB_EASE_OUT} ${staggerDelay}`,
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{child.label}</span>
        {child.badge !== undefined && child.badge > 0 && <StageCount n={child.badge} active={rowActive} />}
      </Link>
    );
  }

  // Sub-section header (e.g. Pipeline with stage children)
  const subKids = child.children ?? [];
  // maxHeight: each stage row ~30px; +8 bottom padding
  const subMaxHeight = subOpen ? subKids.length * 30 + 8 : 0;
  // Only apply translateY when motion is allowed (Emily polish: animate transform/opacity only)
  const subTransform = reducedMotion ? "none" : (subOpen ? "translateY(0)" : "translateY(-4px)");
  const subTransition = reducedMotion
    ? `max-height ${SUB_MS}ms ${SUB_EASE_OUT}`
    : [
        `max-height ${SUB_MS}ms ${SUB_EASE_OUT}`,
        `opacity ${FADE_MS}ms ${SUB_EASE_OUT}`,
        `transform ${SUB_MS}ms ${SUB_EASE_OUT}`,
      ].join(", ");

  const isGroup = !!child.group;

  return (
    <div>
      {isGroup ? (
        /* Category group — a pure expand/collapse toggle, no page of its own. */
        <button
          onClick={() => setOpenSubSection(subOpen ? null : child.href)}
          aria-expanded={subOpen}
          className="nav-link"
          style={{
            display: "flex", alignItems: "center", gap: 8, width: "100%",
            padding: "7px 8px 7px 14px", border: "none", cursor: "pointer",
            background: "transparent", fontFamily: "var(--sans)",
            color: "var(--ink-soft)", textAlign: "left",
          }}
        >
          <span style={{ flex: 1, fontSize: 13, fontWeight: 400 }}>
            {child.label}
          </span>
          <svg
            width="10" height="10" viewBox="0 0 24 24" fill="none"
            stroke="var(--ink-mute)" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
            style={{
              flexShrink: 0,
              transform: subOpen ? "rotate(90deg)" : "rotate(0deg)",
              transition: reducedMotion ? "none" : `transform ${SUB_MS}ms ${SUB_EASE_OUT}`,
            }}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      ) : (
      /* Pipeline row: link (left) + toggle (right) share ONE nav-link surface
         (the class lives on this wrapping div, not the Link) so hover/active
         paints a single continuous background across label + chevron instead
         of the Link's own hover box leaving the chevron in a separate pill. */
      <div
        className="nav-link"
        style={{
          display: "flex", alignItems: "center",
          borderLeft: active ? "2px solid var(--green-deep)" : "2px solid transparent",
          marginLeft: -1,
          background: active ? "var(--green-wash)" : "transparent",
        }}
      >
        <Link
          href={child.href}
          style={{
            flex: 1, padding: "7px 8px 7px 14px", fontSize: 13,
            color: active ? "var(--green-deep)" : "var(--ink-soft)",
            fontWeight: active ? 600 : 400, textDecoration: "none",
          }}
        >
          {child.label}
        </Link>
        {/* Toggle button for sub-children — keyboard accessible, visible focus ring */}
        <button
          onClick={() => setOpenSubSection(subOpen ? null : child.href)}
          aria-label={subOpen ? `Collapse ${child.label}` : `Expand ${child.label}`}
          aria-expanded={subOpen}
          style={{
            background: "transparent", border: "none", cursor: "pointer",
            padding: "7px 10px", display: "flex", alignItems: "center",
            color: "var(--ink-mute)", borderRadius: "var(--r-sm)",
            outline: "none",
          }}
          onFocus={(e) => { e.currentTarget.style.boxShadow = "0 0 0 2px var(--green-wash)"; }}
          onBlur={(e) => { e.currentTarget.style.boxShadow = "none"; }}
        >
          <svg
            width="10" height="10" viewBox="0 0 24 24" fill="none"
            stroke="var(--ink-mute)" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
            style={{
              flexShrink: 0,
              transform: subOpen ? "rotate(90deg)" : "rotate(0deg)",
              transition: reducedMotion ? "none" : `transform ${SUB_MS}ms ${SUB_EASE_OUT}`,
            }}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
      )}

      {/* Stage sub-links — animate max-height + opacity + transform (Emil polish).
          transform and transition are gated behind prefers-reduced-motion. */}
      <div
        style={{
          maxHeight: subMaxHeight,
          opacity: subOpen ? 1 : 0,
          overflow: "hidden",
          transform: subTransform,
          transition: subTransition,
        }}
      >
        {subKids.map((stage, si) => {
          const stageActive = isNavRowActive(stage.href, pathname, activeHref);
          // Staggered within sub-children: 30ms per item (skipped under reduced-motion)
          const subDelay = reducedMotion ? "0ms" : `${si * 30}ms`;
          return (
            <Link
              key={stage.href}
              href={stage.href}
              className="nav-link"
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                padding: "6px 14px 6px 28px", fontSize: 12,
                color: stageActive ? "var(--green-deep)" : "var(--ink-mute)",
                fontWeight: stageActive ? 600 : 400, textDecoration: "none",
                borderLeft: stageActive ? "2px solid var(--green-deep)" : "2px solid transparent",
                marginLeft: -1, background: stageActive ? "var(--green-wash)" : "transparent",
                opacity: subOpen ? 1 : 0,
                transform: reducedMotion ? "none" : (subOpen ? "translateY(0)" : "translateY(-4px)"),
                transition: reducedMotion ? "none" : [
                  `opacity 120ms ${SUB_EASE_OUT} ${subDelay}`,
                  `transform 120ms ${SUB_EASE_OUT} ${subDelay}`,
                ].join(", "),
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stage.label}</span>
              {stage.badge !== undefined && stage.badge > 0 && <StageCount n={stage.badge} active={stageActive} />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function NavSection({ item, collapsed, sectionOpen, setSectionOpen, openSubSection, setOpenSubSection, hovered, setHovered, pinnedSection, setPinnedSection, pathname, activeHref, can, isFounder, hasModule, pins }: {
  item: NavItem; collapsed: boolean; sectionOpen: boolean;
  setSectionOpen: (v: boolean) => void;
  openSubSection: string | null; setOpenSubSection: (v: string | null) => void;
  hovered: string | null; setHovered: (v: string | null) => void;
  pinnedSection: string | null; setPinnedSection: (v: string | null) => void;
  pathname: string; activeHref: string | null; can: (permission: string) => boolean; isFounder: boolean;
  hasModule: (mod: string) => boolean;
  // Quick-access pins to render inside this section's dropdown (OmniPulse only).
  pins?: PinnedItem[];
}) {
  const tr = useTr();
  const ref = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const kids = (item.children || [])
    .filter((c) => canSee(c, can, isFounder))
    // ChildRow renders nested groups from the child object it receives. Pass
    // it the already-filtered descendants so a permitted sibling (for example
    // Roles & Perms) cannot expose denied siblings such as Users & Access.
    .map((child) => child.children
      ? { ...child, children: child.children.filter((grandchild) => canSee(grandchild, can, isFounder)) }
      : child);
  if (kids.length === 0) return null;

  // Exclusive highlight: the module header lights up ONLY when it is itself the
  // winning href — and never when a child shares its href (OmniPulse's "Teams"
  // child duplicates /omnipulse/boards), so the child wins the highlight, not
  // the parent. Expansion (the chevron) is separate, driven by sectionOpen.
  const moduleActive =
    activeHref === item.href && !kids.some((c) => c.href === item.href);

  const isPinned = pinnedSection === item.href;
  const isVisible = hovered === item.href || isPinned;

  const open = () => {
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
    setHovered(item.href);
  };
  const closeSoon = () => {
    if (isPinned) return;
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => setHovered(null), 150);
  };
  const togglePin = () => {
    if (isPinned) { setPinnedSection(null); setHovered(null); }
    else { setPinnedSection(item.href); setHovered(item.href); }
  };
  const dismissAfterChild = () => {
    setPinnedSection(null);
    setHovered(null);
  };

  const handleClick = () => {
    if (collapsed) togglePin();
    else setSectionOpen(!sectionOpen);
  };

  // Collapsed-rail hover shows a transient highlight on the flyout anchor. The
  // expanded section being open does NOT highlight the header (only moduleActive
  // does) — that's what keeps exactly one row lit at a time.
  const hoverHighlight = collapsed && isVisible;

  // Compute the total inline max-height needed when this section is open.
  // Base: kids.length * 34 + 8 (existing formula).
  // Extra: if a sub-section (Pipeline) is open and has N stage children,
  // add N * 30px for the stage rows.
  const subSectionKid = kids.find((k) => k.href === openSubSection && k.children);
  const extraHeight = subSectionKid ? (subSectionKid.children?.length ?? 0) * 30 + 8 : 0;
  // Pinned rows render inside the dropdown; reserve height for them + the label
  // so the max-height animation doesn't clip them (overshoot is harmless — the
  // container only grows to its actual content within the cap).
  const pinnedItems = pins ?? [];
  const teamPins = pinnedItems.filter((p) => p.type === "team");
  const projectPins = pinnedItems.filter((p) => p.type === "board");
  // Rows (36px each) + one 30px header per non-empty group.
  const pinnedExtra =
    pinnedItems.length * 36 + (teamPins.length > 0 ? 30 : 0) + (projectPins.length > 0 ? 30 : 0);
  const inlineMaxHeight = !collapsed && sectionOpen ? kids.length * 34 + 8 + extraHeight + pinnedExtra : 0;

  return (
    <div
      ref={ref}
      style={{ marginTop: 4, position: "relative" }}
      onMouseEnter={collapsed ? open : undefined}
      onMouseLeave={collapsed ? closeSoon : undefined}
    >
      <button onClick={handleClick} className="nav-link" style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "9px 14px", fontSize: 14, fontWeight: moduleActive ? 600 : 400,
        width: "100%", border: "none", fontFamily: "var(--sans)",
        color: moduleActive ? "var(--green-deep)" : "var(--ink-soft)",
        background: (moduleActive || hoverHighlight) ? "var(--green-wash)" : "transparent",
        borderRadius: "var(--r-sm)", cursor: "pointer", marginBottom: 1,
      }}>
        <Icon name={item.iconKey} />
        <span style={{
          flex: 1, textAlign: "left", whiteSpace: "nowrap",
          opacity: collapsed ? 0 : 1,
          transition: `opacity ${FADE_MS}ms ${EASE_OUT}`,
        }}>
          {item.label}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{
          flexShrink: 0,
          opacity: collapsed ? 0 : 1,
          transform: sectionOpen ? "rotate(90deg)" : "rotate(0)",
          transition: `opacity ${FADE_MS}ms ${EASE_OUT}, transform 180ms ${EASE_OUT}`,
        }}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {/* Inline sub-list (expanded only). Kept mounted in DOM during collapse,
          but max-height collapses to 0 so it folds before the rail narrows.
          max-height includes extra room for open sub-sections (e.g. Pipeline stages). */}
      <div style={{
        marginLeft: 22, borderLeft: "1px solid var(--rule)", paddingLeft: 0, marginBottom: 4,
        maxHeight: inlineMaxHeight,
        opacity: !collapsed && sectionOpen ? 1 : 0,
        overflow: "hidden",
        transition: `max-height 240ms ${EASE_OUT}, opacity ${FADE_MS}ms ${EASE_OUT}`,
      }}>
        {(item.moduleSlug === "omnipulse" ? kids.slice(0, 1) : kids).map((child, i) => (
          <ChildRow
            key={child.href}
            child={child}
            pathname={pathname}
            activeHref={activeHref}
            openSubSection={openSubSection}
            setOpenSubSection={setOpenSubSection}
            rowIndex={i}
          />
        ))}

        {/* Pinned quick-access rows — split into Teams and Projects groups,
            nested in the dropdown below the kids. A team pins under "Pinned
            teams"; a project (board) pins under "Pinned projects". */}
        <PinnedGroup label={tr("Pinned teams")} items={teamPins} activeHref={activeHref} />
        {item.moduleSlug === "omnipulse" && kids.slice(1).map((child, i) => (
          <ChildRow
            key={child.href}
            child={child}
            pathname={pathname}
            activeHref={activeHref}
            openSubSection={openSubSection}
            setOpenSubSection={setOpenSubSection}
            rowIndex={i + 1}
          />
        ))}
        <PinnedGroup label={tr("Pinned projects")} items={projectPins} activeHref={activeHref} />
      </div>

      {collapsed && (
        <Flyout
          anchorRef={ref}
          visible={isVisible}
          title={item.label}
          kids={kids}
          activeHref={activeHref}
          onEnter={open}
          onChildClick={dismissAfterChild}
        />
      )}
    </div>
  );
}

// PinnedGroup — a labelled cluster of pinned rows (Teams or Projects) shown
// inside the OmniPulse dropdown. Renders nothing when the group is empty.
function PinnedGroup({
  label, items, activeHref,
}: {
  label: string;
  items: PinnedItem[];
  activeHref: string | null;
}) {
  const tr = useTr();
  if (items.length === 0) return null;
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{
        padding: "2px 14px 4px", fontFamily: "var(--mono)", fontSize: 9,
        letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-mute)",
        whiteSpace: "nowrap",
      }}>
        {label}
      </div>
      {items.map((p) => {
        const hrefPath = p.href.split("?")[0];
        // Boards have a unique path; team hrefs share /omnipulse/boards with the
        // "Teams" link, so we only light up project (board) pins on match.
        const pinActive = p.type === "board" && hrefPath === activeHref;
        return (
          <Link
            key={`${p.type}:${p.id}`}
            href={p.href}
            className="nav-link"
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "7px 14px", fontSize: 13,
              color: pinActive ? "var(--green-deep)" : "var(--ink-soft)",
              fontWeight: pinActive ? 600 : 400,
              background: pinActive ? "var(--green-wash)" : "transparent",
              textDecoration: "none", whiteSpace: "nowrap",
              borderLeft: pinActive ? "2px solid var(--green-deep)" : "2px solid transparent",
              marginLeft: -1,
            }}
          >
            <span style={{ color: "var(--green-deep)", display: "inline-flex", flexShrink: 0 }}>
              <PinIcon filled size={13} />
            </span>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
            <span
              role="button"
              aria-label={`Unpin ${p.name}`}
              title={tr("Unpin")}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); removePin(p.type, p.id); }}
              style={{ display: "inline-flex", color: "var(--ink-faint)", flexShrink: 0 }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function BottomBtn({ collapsed, label, hoverLabel, hovered, setHovered, id, onClick, color, icon, border, trailing }: {
  collapsed: boolean; label: string; hoverLabel: string;
  hovered: string | null; setHovered: (v: string | null) => void;
  id: string; onClick: () => void; color: string; icon: React.ReactNode; border?: boolean;
  trailing?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} style={{ position: "relative", borderTop: border ? "1px solid var(--rule)" : undefined }}
      onMouseEnter={() => collapsed && setHovered(id)}
      onMouseLeave={() => setHovered(null)}
    >
      {/* Padding 21px parks the 14px icon at viewport x=28 — exact horizontal
          centre of the 56px collapsed rail — without flipping justifyContent. */}
      <button onClick={onClick} className="nav-link" style={{
        display: "flex", alignItems: "center", justifyContent: "flex-start",
        gap: 10, padding: "10px 21px",
        width: "100%", border: "none", background: "transparent",
        color, cursor: "pointer", borderRadius: 0,
        fontSize: 12, fontFamily: "var(--sans)",
      }}>
        {icon}
        <span style={{
          whiteSpace: "nowrap",
          opacity: collapsed ? 0 : 1,
          transition: `opacity ${FADE_MS}ms ${EASE_OUT}`,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
        }}>
          {label}
          {!collapsed && trailing}
        </span>
        {collapsed && trailing ? (
          <span style={{ position: "absolute", top: 8, right: 10 }}>{trailing}</span>
        ) : null}
      </button>
      {collapsed && <Tooltip anchorRef={ref} label={hoverLabel || label} visible={hovered === id} />}
    </div>
  );
}

// Small pill showing how many leads sit at a pipeline stage (sidebar badge).
function StageCount({ n, active }: { n: number; active: boolean }) {
  return (
    <span style={{
      flexShrink: 0,
      minWidth: 18,
      textAlign: "center",
      fontFamily: "var(--mono)",
      fontSize: 10,
      lineHeight: 1.6,
      padding: "0 6px",
      borderRadius: 999,
      background: active ? "var(--green-deep)" : "var(--surface-sunk)",
      color: active ? "var(--surface)" : "var(--ink-mute)",
    }}>
      {n}
    </span>
  );
}
