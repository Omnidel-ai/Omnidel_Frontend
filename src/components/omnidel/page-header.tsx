"use client";

import { useRouter } from "next/navigation";
import { useModuleNav } from "@/lib/client/module-nav";
import { useTr } from "@/lib/client/language";
import { OmnistudioMobilePageBack } from "@/components/omnidel/mobile-page-back";
import { BreadcrumbTrail } from "@/components/omnidel/breadcrumb-trail";

export interface PageCrumb {
  /** Stable nav key — label resolved from admin config */
  navKey?: string;
  /** Static label when no nav key applies */
  label?: string;
  href?: string;
}

interface PageHeaderProps {
  moduleSlug: string;
  /** Primary section nav key (e.g. content, boards) */
  sectionKey?: string;
  /**
   * Override the section crumb label. Useful when the DB-seeded nav label
   * differs from the sidebar label (e.g. omnivarsity.dashboards may still be
   * "Dashboards" while the UI shows "Acharya Dashboard").
   */
  sectionLabel?: string;
  /** When set, module and section crumbs link here (detail pages) */
  sectionHref?: string;
  /** Extra crumbs after module + section */
  crumbs?: PageCrumb[];
  headerExtra?: React.ReactNode;
  marginBottom?: number;
  /** Suppress the mobile "← Back" control (e.g. while a form has unsaved edits,
   *  where a raw router.back() would silently discard the draft). Default false. */
  hideMobileBack?: boolean;
}

export function PageHeader({
  moduleSlug,
  sectionKey,
  sectionLabel: sectionLabelOverride,
  sectionHref,
  crumbs = [],
  headerExtra,
  marginBottom = 16,
  hideMobileBack = false,
}: PageHeaderProps) {
  const router = useRouter();
  const { moduleLabel, navLabel } = useModuleNav();
  const tr = useTr();

  const modLabel = moduleLabel(moduleSlug);
  // A static override is a plain English string ("Billings", "Sales Pipeline"),
  // not a nav key, so nothing has translated it yet.
  const sectionLabel =
    (sectionLabelOverride ? tr(sectionLabelOverride) : undefined)
    ?? (sectionKey ? navLabel(moduleSlug, sectionKey) : undefined);
  const resolvedSectionHref =
    sectionHref ?? (sectionKey ? `/${moduleSlug}/${sectionKey}` : undefined);

  const allCrumbs: Array<{ label: string; href?: string }> = [];
  // The module crumb (e.g. "OmniMart") is intentionally non-clickable: module
  // roots (/omnimart, /omnivarsity, /omnipulse) have no page.tsx and clicking
  // them would 404. Only the section crumb links somewhere real.
  allCrumbs.push({ label: modLabel });
  if (sectionLabel) {
    allCrumbs.push({ label: sectionLabel, href: resolvedSectionHref });
  }
  for (const c of crumbs) {
    // The `label` branch is the LEAF crumb — "Overview", "New", "Planning". It
    // was the only part of the trail nothing translated, so every detail page
    // read "<module in Bengali> / <section in Bengali> / <leaf in English>".
    const label = c.navKey ? navLabel(moduleSlug, c.navKey) : (c.label ? tr(c.label) : "");
    if (label) allCrumbs.push({ label, href: c.href });
  }

  return (
    <div style={{ marginBottom }}>
      {!hideMobileBack && <OmnistudioMobilePageBack />}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ fontFamily: "var(--serif)", minWidth: 0, flex: "1 1 160px", display: "flex", overflow: "hidden", margin: 0 }}>
          <BreadcrumbTrail crumbs={allCrumbs} onNavigate={(href) => router.push(href)} />
        </h2>
        {headerExtra != null && (
          <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 8 }}>
            {headerExtra}
          </div>
        )}
      </div>
    </div>
  );
}

/** For MasterFormShell subtitle prop — uppercase mono line */
export function usePageEyebrow(moduleSlug: string, navKey?: string): string {
  const { eyebrow } = useModuleNav();
  return eyebrow(moduleSlug, navKey);
}

/** Build breadcrumb array with dynamic module + nav labels */
export function useModuleBreadcrumb(
  moduleSlug: string,
  crumbs: PageCrumb[],
): { label: string; href?: string }[] {
  const { moduleLabel, navLabel } = useModuleNav();
  const tr = useTr();
  return crumbs.map((c) => ({
    label: c.navKey ? navLabel(moduleSlug, c.navKey) : (c.label ? tr(c.label) : ""),
    href: c.href,
  }));
}
