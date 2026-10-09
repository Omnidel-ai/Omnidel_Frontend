"use client";

/**
 * What's New — ChatGPT-like changelog in OmniDel theme.
 * Page tabs: What's new | Guide | Admin (Admin only for founder/admin).
 * Guide is view-only. Admin is where playlists/videos are added, edited, deleted.
 * Guide/Admin open on Videos; Playlist is a sibling pane (top-right).
 * Search is fixed (outside the feed scrollport).
 * Only the feed + date index scroll; date jump uses that scroller.
 */

import {
  useMemo,
  useState,
  useEffect,
  useCallback,
  useRef,
  type CSSProperties,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useIsMobile } from "@/lib/client/use-is-mobile";
import { DASHBOARD_TOPBAR_H } from "@/lib/client/dashboard-layout";
import {
  WHATS_NEW_DEFAULT_VIEW,
  WHATS_NEW_VIEW_LABELS,
  notesForView,
  type WhatsNewView,
} from "@/lib/client/whats-new-views";
import { usePermissions } from "@/lib/client/permissions";
import { MultiFilter, type FilterSectionConfig } from "@/components/omnidel/multi-filter";
import { SubTabs } from "@/components/omnidel/sub-tabs";
import type { ReleaseNote } from "@/lib/whats-new-schema";
import {
  WHATS_NEW_APPS,
  WHATS_NEW_APP_LABELS,
  WHATS_NEW_MODULES,
  WHATS_NEW_MODULE_LABELS,
  type WhatsNewApp,
  type WhatsNewModule,
} from "@/lib/whats-new-schema";
import type { GuidePlaylistDto } from "@/lib/guide-schema";
import { DateIndex, dateSectionId } from "./date-index";
import { Feed } from "./feed";
import { GuideGrid } from "./guide-grid";
import { GuidePlaylistsTable } from "./guide-playlists-table";
import { markWhatsNewSeen } from "./unread-dot";
import { useTr } from "@/lib/client/language";

/** Gap under the fixed chrome when a date section lands. */
const SCROLL_GAP = 8;

const PAGE_TABS = {
  changelog: "What's new",
  guide: "Guide",
  admin: "Admin",
} as const;

type PageTab = keyof typeof PAGE_TABS;
type GuidePane = "videos" | "playlist";

const GUIDE_PANE_TABS = {
  videos: "Videos",
  playlist: "Playlist",
} as const;

function matchesFilters(
  note: ReleaseNote,
  apps: string[],
  modules: string[],
  q: string,
): boolean {
  if (apps.length > 0 && !note.apps.some((a) => apps.includes(a))) return false;
  if (modules.length > 0 && !note.items.some((it) => modules.includes(it.module))) return false;
  const query = q.trim().toLowerCase();
  if (query) {
    const hit =
      note.title.toLowerCase().includes(query) ||
      (note.summary ?? "").toLowerCase().includes(query) ||
      note.items.some((it) => it.text.toLowerCase().includes(query));
    if (!hit) return false;
  }
  return true;
}

/** Scroll the What's New feed so `el` sits at the top of the feed pane. */
function scrollFeedTo(el: HTMLElement, scroller: HTMLElement, offsetPx: number) {
  const next =
    el.getBoundingClientRect().top
    - scroller.getBoundingClientRect().top
    + scroller.scrollTop
    - offsetPx;
  scroller.scrollTo({ top: Math.max(0, next), behavior: "smooth" });
}

function pageTabFromParam(raw: string | null, allowAdmin: boolean): PageTab {
  if (raw === "guide") return "guide";
  if (raw === "admin" && allowAdmin) return "admin";
  return "changelog";
}

export function WhatsNewClient({
  notes,
  newestReleasedOn,
}: {
  notes: ReleaseNote[];
  newestReleasedOn: string | null;
}) {
  const tr = useTr();
  const isMobile = useIsMobile();
  const { isAdmin } = usePermissions();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pageTab, setPageTab] = useState<PageTab>(() =>
    pageTabFromParam(searchParams.get("tab"), isAdmin),
  );
  const [view, setView] = useState<WhatsNewView>(WHATS_NEW_DEFAULT_VIEW);
  const [search, setSearch] = useState("");
  const [apps, setApps] = useState<string[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const feedScrollRef = useRef<HTMLDivElement>(null);
  /** Keep the date column inside the visible feed pane (not past the screen). */
  const [asideMaxH, setAsideMaxH] = useState(360);
  const [guidePane, setGuidePane] = useState<GuidePane>(() =>
    searchParams.get("view") === "playlist" ? "playlist" : "videos",
  );
  const [seedPlaylistId, setSeedPlaylistId] = useState<string | null>(
    () => searchParams.get("playlist")?.trim() || null,
  );

  useEffect(() => {
    const raw = searchParams.get("tab");
    if (raw === "admin" && !isAdmin) {
      setPageTab("changelog");
      router.replace("/whats-new", { scroll: false });
      return;
    }
    setPageTab(pageTabFromParam(raw, isAdmin));
  }, [searchParams, isAdmin, router]);

  useEffect(() => {
    if (pageTab !== "guide" && pageTab !== "admin") return;
    setGuidePane(searchParams.get("view") === "playlist" ? "playlist" : "videos");
    setSeedPlaylistId(searchParams.get("playlist")?.trim() || null);
  }, [pageTab, searchParams]);

  useEffect(() => {
    markWhatsNewSeen(newestReleasedOn);
  }, [newestReleasedOn]);

  useEffect(() => {
    const el = feedScrollRef.current;
    if (!el) return;
    // Leave room above the Ask MahAcharya FAB so dates aren't covered.
    const FAB_CLEAR = 72;
    const measure = () => setAsideMaxH(Math.max(160, el.clientHeight - FAB_CLEAR));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pageTab]);

  const viewNotes = useMemo(() => notesForView(notes, view), [notes, view]);

  const filtered = useMemo(
    () => viewNotes.filter((n) => matchesFilters(n, apps, modules, search)),
    [viewNotes, apps, modules, search],
  );

  useEffect(() => {
    setActiveDate(filtered[0]?.released_on ?? null);
  }, [filtered]);

  const filterSections = useMemo((): FilterSectionConfig[] => {
    return [
      {
        key: "app",
        label: "App",
        type: "checklist",
        options: WHATS_NEW_APPS.map((a) => ({
          value: a,
          label: WHATS_NEW_APP_LABELS[a as WhatsNewApp],
        })),
        value: apps,
        onChange: setApps,
      },
      {
        key: "module",
        label: "Area",
        type: "checklist",
        divider: true,
        options: WHATS_NEW_MODULES.map((m) => ({
          value: m,
          label: WHATS_NEW_MODULE_LABELS[m as WhatsNewModule],
        })),
        value: modules,
        onChange: setModules,
      },
    ];
  }, [apps, modules]);

  const replaceGuideParams = useCallback(
    (next: { tab?: PageTab; pane?: GuidePane; playlistId?: string | null }) => {
      const params = new URLSearchParams(searchParams.toString());
      const tab = next.tab ?? pageTab;
      const pane = next.pane ?? guidePane;
      if (tab === "changelog") {
        params.delete("tab");
        params.delete("playlist");
        params.delete("view");
      } else {
        params.set("tab", tab);
        if (pane === "playlist") params.set("view", "playlist");
        else params.delete("view");
        if (next.playlistId) params.set("playlist", next.playlistId);
        else if (next.playlistId === null) params.delete("playlist");
      }
      const qs = params.toString();
      router.replace(qs ? `/whats-new?${qs}` : "/whats-new", { scroll: false });
    },
    [router, searchParams, pageTab, guidePane],
  );

  const onPageTabChange = useCallback(
    (label: string) => {
      const next: PageTab =
        label === PAGE_TABS.guide
          ? "guide"
          : label === PAGE_TABS.admin && isAdmin
            ? "admin"
            : "changelog";
      setPageTab(next);
      setGuidePane("videos");
      setSeedPlaylistId(null);
      replaceGuideParams({ tab: next, pane: "videos", playlistId: null });
      const scroller = feedScrollRef.current;
      if (scroller) scroller.scrollTo({ top: 0 });
    },
    [isAdmin, replaceGuideParams],
  );

  const onGuidePaneChange = useCallback(
    (label: string) => {
      const next: GuidePane = label === GUIDE_PANE_TABS.playlist ? "playlist" : "videos";
      setGuidePane(next);
      if (next === "playlist") setSeedPlaylistId(null);
      replaceGuideParams({
        tab: pageTab === "admin" ? "admin" : "guide",
        pane: next,
        playlistId: next === "playlist" ? null : undefined,
      });
      const scroller = feedScrollRef.current;
      if (scroller) scroller.scrollTo({ top: 0 });
    },
    [pageTab, replaceGuideParams],
  );

  const openPlaylist = useCallback(
    (playlist: GuidePlaylistDto) => {
      const tab: PageTab = pageTab === "admin" ? "admin" : "guide";
      setGuidePane("videos");
      setSeedPlaylistId(playlist.id);
      replaceGuideParams({ tab, pane: "videos", playlistId: playlist.id });
      const scroller = feedScrollRef.current;
      if (scroller) scroller.scrollTo({ top: 0 });
    },
    [pageTab, replaceGuideParams],
  );

  const onViewChange = useCallback((label: string) => {
    if (label === WHATS_NEW_VIEW_LABELS.features) setView("features");
    else if (label === WHATS_NEW_VIEW_LABELS.fixes) setView("fixes");
    const scroller = feedScrollRef.current;
    if (scroller) scroller.scrollTo({ top: 0 });
  }, []);

  const jumpToDate = useCallback((isoDate: string) => {
    setActiveDate(isoDate);
    requestAnimationFrame(() => {
      const el = document.getElementById(dateSectionId(isoDate));
      const scroller = feedScrollRef.current;
      if (el && scroller) scrollFeedTo(el, scroller, SCROLL_GAP);
    });
  }, []);

  const gutterX = isMobile ? 16 : 32;
  const bottomPad = isMobile ? "var(--fab-clearance)" : "30px";
  const emptyCopy =
    view === "features"
      ? {
          title: "No new features yet",
          hint: "When new capabilities ship, they will show up here.",
        }
      : {
          title: "No bug fixes yet",
          hint: "When fixes ship, they will show up here.",
        };

  const [guideToolbarHost, setGuideToolbarHost] = useState<HTMLDivElement | null>(null);
  const isGuideSurface = pageTab === "guide" || pageTab === "admin";
  const pageTabLabels = isAdmin
    ? [PAGE_TABS.changelog, PAGE_TABS.guide, PAGE_TABS.admin]
    : [PAGE_TABS.changelog, PAGE_TABS.guide];
  const guidePaneTabs = (
    <SubTabs
      tabs={[GUIDE_PANE_TABS.videos, GUIDE_PANE_TABS.playlist]}
      active={GUIDE_PANE_TABS[guidePane]}
      onChange={onGuidePaneChange}
    />
  );

  return (
    <div
      style={{
        // Cancel shell padding and fill the column under the topbar so chrome
        // can stay fixed while only the feed scrolls.
        marginTop: "calc(-1 * var(--gutter))",
        marginLeft: -gutterX,
        marginRight: -gutterX,
        marginBottom: isMobile ? "calc(-1 * var(--fab-clearance))" : -30,
        height: `calc(100dvh - ${DASHBOARD_TOPBAR_H}px)`,
        maxHeight: `calc(100dvh - ${DASHBOARD_TOPBAR_H}px)`,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "var(--page)",
      }}
    >
      {/* Fixed chrome — never scrolls with the feed. */}
      <div
        style={{
          flexShrink: 0,
          padding: `var(--gutter) ${gutterX}px 0`,
          background: "var(--page)",
          zIndex: 2,
        }}
      >
        <header style={isGuideSurface ? pageHeaderGuide : pageHeader}>
          <div style={titleRow}>
            <div style={{ minWidth: 0 }}>
              <h1 style={pageTitle}>
                {pageTab === "guide" ? (
                  tr("Guide")
                ) : pageTab === "admin" ? (
                  tr("Admin")
                ) : (
                  <>{tr("What's new")}</>
                )}
              </h1>
              {pageTab === "changelog" && (
                <p style={subtitleStyle}>
                  {tr("Plain-language updates — what changed and why it helps you.")}
                </p>
              )}
              {pageTab === "admin" && (
                <p style={subtitleStyle}>
                  {tr("Manage playlists and videos shown on Guide.")}
                </p>
              )}
            </div>
            <SubTabs
              tabs={pageTabLabels}
              active={PAGE_TABS[pageTab]}
              onChange={onPageTabChange}
            />
          </div>
          {isGuideSurface && (
            <div
              ref={setGuideToolbarHost}
              className="table-toolbar"
              style={guideToolbarHostStyle}
            />
          )}
          {pageTab === "changelog" && (
            <div style={toolbarStyle}>
              <MultiFilter
                searchInput={search}
                onSearchChange={setSearch}
                searchPlaceholder={tr("Search titles and notes…")}
                sections={filterSections}
              />
              <div style={toolbarRight}>
                <SubTabs
                  tabs={[WHATS_NEW_VIEW_LABELS.features, WHATS_NEW_VIEW_LABELS.fixes]}
                  active={WHATS_NEW_VIEW_LABELS[view]}
                  onChange={onViewChange}
                />
                <span style={countChip}>
                  {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
                </span>
              </div>
            </div>
          )}
        </header>
      </div>

      {/* Feed scrollport — only this region moves. */}
      <div
        ref={feedScrollRef}
        data-whats-new-scroll=""
        className="themed-scroll-y"
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          padding: `28px ${gutterX}px ${bottomPad}`,
        }}
      >
        {isGuideSurface ? (
          guidePane === "playlist" ? (
            <GuidePlaylistsTable
              onOpenPlaylist={openPlaylist}
              manage={pageTab === "admin"}
              paneTabs={guidePaneTabs}
              toolbarHost={guideToolbarHost}
            />
          ) : (
            <GuideGrid
              manage={pageTab === "admin"}
              seedPlaylistId={seedPlaylistId}
              paneTabs={guidePaneTabs}
              toolbarHost={guideToolbarHost}
            />
          )
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1fr) 176px",
              gap: isMobile ? 0 : 56,
              alignItems: "start",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <Feed
                notes={filtered}
                activeDate={activeDate}
                onActiveDateChange={setActiveDate}
                scrollRootRef={feedScrollRef}
                emptyTitle={emptyCopy.title}
                emptyHint={emptyCopy.hint}
              />
            </div>

            {!isMobile && (
              <aside
                style={{
                  ...dateAside,
                  maxHeight: asideMaxH,
                }}
                className="themed-scroll-y"
                aria-label={tr("Jump by date")}
              >
                <DateIndex
                  notes={filtered}
                  activeDate={activeDate}
                  onJump={jumpToDate}
                />
              </aside>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const pageHeader: CSSProperties = {
  marginBottom: 0,
  paddingBottom: 16,
  borderBottom: "1px solid var(--rule)",
};

/** Guide has no header divider — meta row sits above the scroll content. */
const pageHeaderGuide: CSSProperties = {
  marginBottom: 0,
  paddingBottom: 8,
  borderBottom: "none",
};

const titleRow: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
};

const pageTitle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--serif)",
  fontSize: 40,
  fontWeight: 600,
  letterSpacing: "-0.025em",
  color: "var(--ink)",
  lineHeight: 1.1,
};

const crumbTitle: CSSProperties = {
  ...pageTitle,
  fontSize: 28,
  letterSpacing: "-0.02em",
  lineHeight: 1.2,
  minWidth: 0,
};

const subtitleStyle: CSSProperties = {
  margin: "8px 0 0",
  fontSize: 16,
  color: "var(--ink-soft)",
  fontFamily: "var(--sans)",
  maxWidth: 640,
  lineHeight: 1.45,
};

const guideToolbarHostStyle: CSSProperties = {
  flexWrap: "nowrap",
  marginTop: 14,
  marginBottom: 0,
  alignItems: "center",
};

const toolbarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  marginTop: 14,
};

const toolbarRight: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexShrink: 0,
  marginLeft: "auto",
};

const countChip: CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 11,
  color: "var(--ink-soft)",
  background: "var(--surface-sunk)",
  borderRadius: "var(--r-sm)",
  padding: "3px 9px",
  flexShrink: 0,
};

const dateAside: CSSProperties = {
  position: "sticky",
  top: 0,
  alignSelf: "start",
  overflowY: "auto",
  overflowX: "hidden",
  paddingTop: 2,
  paddingBottom: 8,
};
