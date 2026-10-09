"use client";

import { useEffect, useRef, useState, useCallback, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useTr } from "@/lib/client/language";

// How many consecutive 401s before we give up and stop the interval.
// 1 is enough — a 401 means the session expired; further polls are pointless.
const MAX_AUTH_FAILURES = 1;

// First-page size. The API unions all unread rows into this page, so
// `items.length` after the first load can exceed PAGE_SIZE — it must NOT be
// used as the next offset for "Check previous" (history pagination is keyed
// off a stable offset instead, see historyOffset below).
const PAGE_SIZE = 15;

interface Notif {
  id: string;
  kind: string | null;
  title: string;
  body: string | null;
  link: string | null;
  actor_name?: string | null;
  project_name?: string | null;
  team_name?: string | null;
  lead_no?: string | number | null;
  lead_title?: string | null;
  read_at: string | null;
  created_on: string;
}

// B-7: Mentions/Assigned toggle. "" means All (no ?kind= filter sent).
type KindFilter = "" | "mention" | "assignment";
const KIND_TABS: Array<{ label: string; value: KindFilter }> = [
  { label: "All", value: "" },
  { label: "Mentions", value: "mention" },
  { label: "Assigned", value: "assignment" },
];

// ── Legacy mention row parsing ──────────────────────────────────────────────
// Rows written before migration 20260809000000 carry no board_id/workspace_id
// and a generic stored title ("Mentioned on a project task" / "Mentioned on
// a pipeline lead"); the actor/subject/container are packed into `body`
// instead, e.g.:
//   `<Actor> mentioned you on "<Subject>" in <Container>`   (board tasks)
//   `<Actor> mentioned you on "<Subject>"`                  (pipeline leads —
//                                                             no container)
// New rows (post-migration) already resolve project_name/team_name/lead_title
// server-side from board_id/workspace_id/lead_id, and store title as
// "<Actor> mentioned you" with the bare subject in `body` (no wrapper text).
const GENERIC_MENTION_TITLE_RE = /^Mentioned on /i;
const LEGACY_MENTION_BODY_RE = /^(.+?) mentioned you on "(.+?)"(?: in (.+))?$/;

interface NotifDisplay {
  /** The SUBJECT the notification is about — leads the row (line 1). */
  line1: string;
  /** Who triggered it — demoted to an "A:" pill instead of repeated in prose. */
  actor: string | null;
  /** Container name parsed out of a legacy body — a text-only P: pill fallback
   *  when there's no board_id to resolve project_name from. */
  legacyProjectTag: string | null;
}

// Lead with the SUBJECT; demote the actor to an "A:" pill and the
// mention/assignment verb to the All/Mentions/Assigned tab. This drops the
// repetitive "<Actor> mentioned you on …" wrapper that read identically on
// every row.
function deriveDisplay(n: Notif): NotifDisplay {
  // Legacy mention rows (pre-20260809): generic title, actor/subject packed in body.
  if (n.kind === "mention" && GENERIC_MENTION_TITLE_RE.test(n.title)) {
    const m = n.body ? LEGACY_MENTION_BODY_RE.exec(n.body) : null;
    if (m) {
      const [, parsedActor, subject, container] = m;
      return { line1: subject, actor: n.actor_name || parsedActor || null, legacyProjectTag: container || null };
    }
    return { line1: n.body || n.title, actor: n.actor_name || null, legacyProjectTag: null };
  }
  // New rows (mention or assignment): title is actor-led ("<Actor> mentioned/
  // assigned you"); body is the bare subject. Lead with the subject.
  return { line1: n.body || n.title, actor: n.actor_name || null, legacyProjectTag: null };
}

function timeAgo(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    const diff = Date.now() - then;
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ago`;
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

export function NotificationBell() {
  const tr = useTr();
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // Stable offset for "Check previous" history paging — independent of
  // items.length, which is inflated by the first-page unread union.
  const [historyOffset, setHistoryOffset] = useState(PAGE_SIZE);
  // B-7: All / Mentions / Assigned toggle, reused as the ?kind= API param.
  const [kindFilter, setKindFilter] = useState<KindFilter>("");
  const [open, setOpen] = useState(false);
  const [isMobilePanel, setIsMobilePanel] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  // Track consecutive 401s so we stop polling after session expiry.
  const authFailures = useRef(0);
  // Stable ref to the active interval so visibility-change handler can clear it.
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    // Skip silently when the tab is in the background — avoids pointless
    // requests on inactive tabs. The next visible-tab event will restart polling.
    if (typeof document !== "undefined" && document.hidden) return;

    try {
      // First page: size PAGE_SIZE. The API unions all unread with the newest
      // page for the *selected* kind, so unread rows are never dropped
      // regardless of page size or which tab (All/Mentions/Assigned) is
      // active — see the GET handler's per-kind union in route.ts.
      const kindQuery = kindFilter ? `&kind=${kindFilter}` : "";
      const res = await fetch(`/api/omnipulse/notifications?limit=${PAGE_SIZE}${kindQuery}`, { cache: "no-store" });

      if (res.status === 401) {
        // Session has expired. Stop the poll interval immediately so we don't
        // spam the server after logout/expiry. The page-level auth gate (or a
        // future visit) will redirect to /login.
        authFailures.current += 1;
        if (authFailures.current >= MAX_AUTH_FAILURES && intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return;
      }

      if (res.ok) {
        authFailures.current = 0; // reset on success
        const d = await res.json();
        setItems(Array.isArray(d.items) ? d.items : []);
        setUnread(d.unread_count || 0);
        setHasMore(Boolean(d.has_more));
        // Every (re)load of the first page restarts history paging from a
        // clean, stable offset — prevents drift across close/reopen or polls.
        setHistoryOffset(PAGE_SIZE);
      }
    } catch {
      /* network error — leave stale data, interval continues */
    }
  }, [kindFilter]);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 45_000); // poll every 45s

    // Pause the interval when the tab is hidden; resume (with an immediate
    // fetch) when it becomes visible again. Prevents stale background polls.
    function onVisibilityChange() {
      if (!document.hidden) {
        // Tab regained focus — fetch immediately then restart the interval
        // (only if it wasn't stopped due to auth failures).
        if (authFailures.current < MAX_AUTH_FAILURES) {
          load();
          if (!intervalRef.current) {
            intervalRef.current = setInterval(load, 45_000);
          }
        }
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [load]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobilePanel(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  function openItem(n: Notif) {
    if (!n.read_at) {
      fetch("/api/omnipulse/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: n.id }),
      }).catch(() => {});
      setUnread((u) => Math.max(0, u - 1));
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  // Switching tabs must reset pagination cleanly — clear the stale list and
  // the historyOffset synchronously so a "Check previous" click that lands
  // in the split-second before the refetch completes can't merge an
  // old-kind window into the new-kind list (no dupes/skips). The actual
  // refetch happens via the `load` effect re-running (its identity changes
  // with kindFilter).
  function selectKind(next: KindFilter) {
    if (next === kindFilter) return;
    setItems([]);
    setHasMore(false);
    setHistoryOffset(PAGE_SIZE);
    setKindFilter(next);
  }

  function markAll() {
    fetch("/api/omnipulse/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    }).catch(() => {});
    const now = new Date().toISOString();
    setItems((prev) => prev.map((x) => ({ ...x, read_at: x.read_at || now })));
    setUnread(0);
  }

  async function loadMore() {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      // Page by a stable historyOffset (NOT items.length — the first page's
      // unread union can make items.length exceed PAGE_SIZE, which would
      // skip read rows sitting between offset PAGE_SIZE and the injected
      // old-unread rows). Contiguous windows may re-include rows already
      // shown (e.g. old-unread rows from the union) — dedupe by id (Map)
      // handles that.
      const kindQuery = kindFilter ? `&kind=${kindFilter}` : "";
      const res = await fetch(`/api/omnipulse/notifications?offset=${historyOffset}&limit=${PAGE_SIZE}${kindQuery}`, { cache: "no-store" });
      if (res.ok) {
        const d = await res.json();
        const incoming: Notif[] = Array.isArray(d.items) ? d.items : [];
        setItems((prev) => {
          const merged = new Map<string, Notif>();
          for (const x of prev) merged.set(x.id, x);
          for (const x of incoming) merged.set(x.id, x);
          return Array.from(merged.values());
        });
        setHasMore(Boolean(d.has_more));
        setHistoryOffset((o) => o + PAGE_SIZE);
      }
    } catch {
      /* network error — keep current list; button stays for retry */
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); if (!open) load(); }}
        aria-label={tr("Notifications")}
        style={bellBtnStyle}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span style={badgeStyle}>{unread > 9 ? "9+" : unread}</span>
        )}
      </button>

      {open && (
        <div style={isMobilePanel ? mobilePanelStyle : panelStyle}>
          <div style={panelHeaderStyle}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-mute)" }}>
              {tr("Notifications")}
            </span>
            {unread > 0 && (
              <button type="button" onClick={markAll} style={markAllStyle}>{tr("Mark all read")}</button>
            )}
          </div>
          <div style={kindTabsRowStyle}>
            {KIND_TABS.map((t) => (
              <button
                key={t.value || "all"}
                type="button"
                onClick={() => selectKind(t.value)}
                style={kindTabBtnStyle(t.value === kindFilter)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div style={{ maxHeight: 380, overflowY: "auto", overscrollBehavior: "contain" }} className="themed-scroll-y">
            {items.length === 0 && (
              <div style={{ padding: "20px 14px", fontSize: 13, color: "var(--ink-mute)", textAlign: "center" }}>
                {tr("You're all caught up.")}
              </div>
            )}
            {items.map((n) => {
              const disp = deriveDisplay(n);
              const line1 = disp.line1;
              const teamTag = n.team_name || null;
              // Pipeline mentions have no project_name — fall back to the lead,
              // then to the container name parsed out of a legacy body.
              const projectTag =
                n.project_name ||
                n.lead_title ||
                (n.lead_no != null && n.lead_no !== "" ? String(n.lead_no) : null) ||
                disp.legacyProjectTag;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => openItem(n)}
                  style={{
                    ...rowStyle,
                    background: n.read_at ? "transparent" : "var(--green-wash)",
                  }}
                >
                  {!n.read_at && <span style={unreadDotStyle} />}
                  <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                    {/* Subject line: what the notification is ABOUT — leads the
                        row, wraps up to TWO lines then clamps (full text on
                        hover). The actor + mention/assignment verb are demoted
                        to the A: pill + the All/Mentions/Assigned tab, not
                        repeated as "<Actor> mentioned you on …" prose. */}
                    <span
                      title={line1}
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        fontSize: 13,
                        color: "var(--ink)",
                        fontWeight: n.read_at ? 400 : 600,
                        lineHeight: 1.35,
                      }}
                    >
                      {line1}
                    </span>
                    {/* Meta row: A: actor / P: project / T: team pills on the
                        LEFT, date on the RIGHT (space-between). Order unified
                        with the urgent-tasks panel (@·P·T). Pills degrade
                        gracefully when absent. */}
                    <span style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flexWrap: "wrap" }}>
                        {disp.actor && (
                          <span style={pillStyle} title={disp.actor}>{`A: ${disp.actor}`}</span>
                        )}
                        {projectTag && (
                          <span style={pillStyle} title={projectTag}>{`P: ${projectTag}`}</span>
                        )}
                        {teamTag && (
                          <span style={pillStyle} title={teamTag}>{`T: ${teamTag}`}</span>
                        )}
                      </span>
                      <span style={dateStyle}>{timeAgo(n.created_on)}</span>
                    </span>
                  </span>
                </button>
              );
            })}
            {hasMore && (
              <button type="button" onClick={loadMore} disabled={loadingMore} style={viewMoreStyle}>
                {loadingMore ? tr("Loading…") : tr("Check previous")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const bellBtnStyle: CSSProperties = {
  position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: 34, height: 34, borderRadius: "var(--r-sm)",
  background: "transparent", border: "none", cursor: "pointer", color: "var(--ink-soft)",
};

const badgeStyle: CSSProperties = {
  position: "absolute", top: 2, right: 2, minWidth: 16, height: 16, padding: "0 4px",
  borderRadius: 999, background: "var(--crit)", color: "var(--avatar-fg)",
  fontSize: 10, fontWeight: 700, fontFamily: "var(--mono)",
  display: "inline-flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
};

const panelStyle: CSSProperties = {
  position: "absolute", top: "calc(100% + 8px)", right: 0, width: 340, zIndex: "var(--z-notification)",
  background: "var(--surface)", borderWidth: 1, borderStyle: "solid", borderColor: "var(--rule)",
  borderRadius: "var(--r-md)", boxShadow: "var(--shadow-md)", overflow: "hidden",
};

const mobilePanelStyle: CSSProperties = {
  position: "fixed",
  top: 64,
  left: "50%",
  transform: "translateX(-50%)",
  width: "calc(100vw - 24px)",
  maxWidth: 340,
  zIndex: "var(--z-notification)",
  background: "var(--surface)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  borderRadius: "var(--r-md)",
  boxShadow: "var(--shadow-md)",
  overflow: "hidden",
};

const panelHeaderStyle: CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "10px 14px", borderBottom: "1px solid var(--rule)",
};

const markAllStyle: CSSProperties = {
  background: "transparent", border: "none", cursor: "pointer",
  fontFamily: "var(--sans)", fontSize: 11, color: "var(--green-deep)", fontWeight: 600,
};

// B-7: small pill-tab row (All / Mentions / Assigned), right-aligned under
// the header — a scaled-down variant of the SubTabs idiom for this compact
// dropdown context.
const kindTabsRowStyle: CSSProperties = {
  display: "flex", justifyContent: "flex-end", gap: 4,
  padding: "6px 14px 8px", borderBottom: "1px solid var(--rule)",
};

function kindTabBtnStyle(active: boolean): CSSProperties {
  return {
    padding: "3px 10px", borderRadius: 999,
    border: "1px solid var(--rule-strong)",
    background: active ? "var(--green-deep)" : "transparent",
    color: active ? "var(--avatar-fg)" : "var(--ink-soft)",
    fontFamily: "var(--sans)", fontSize: 11, fontWeight: 600,
    cursor: "pointer", whiteSpace: "nowrap",
    transition: "background .15s, color .15s",
  };
}

const rowStyle: CSSProperties = {
  display: "flex", alignItems: "flex-start", gap: 8, width: "100%", textAlign: "left",
  padding: "14px 14px", border: "none", borderBottom: "1px solid var(--rule)",
  cursor: "pointer", fontFamily: "var(--sans)",
};

const unreadDotStyle: CSSProperties = {
  width: 7, height: 7, borderRadius: "50%", background: "var(--green-deep)", flexShrink: 0, marginTop: 5,
};

// Quiet metadata chip — NOT solid-colored (these are context labels, not status).
const pillStyle: CSSProperties = {
  display: "inline-block", maxWidth: 120,
  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  fontFamily: "var(--mono)", fontSize: 11, lineHeight: 1.4,
  color: "var(--ink-mute)", background: "var(--surface-sunk)",
  borderWidth: 1, borderStyle: "solid", borderColor: "var(--rule)",
  borderRadius: "var(--r-sm)", padding: "1px 6px",
};

// Right-aligned in the meta row via the wrapper's space-between; the pills
// group sits on the left, the date here on the right.
const dateStyle: CSSProperties = {
  flexShrink: 0,
  fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-faint)",
};

const viewMoreStyle: CSSProperties = {
  display: "block", width: "100%", textAlign: "center",
  padding: "10px 14px", background: "transparent", border: "none",
  borderTop: "1px solid var(--rule)", cursor: "pointer",
  fontFamily: "var(--sans)", fontSize: 12, fontWeight: 600, color: "var(--green-deep)",
};
