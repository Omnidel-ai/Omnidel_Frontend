"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { fetchNotices, dismissNotice, type NoticeRow } from "@/lib/api/notifications";
import {
  ResumeNoticeCard,
  useResumeNotice,
  type ResumeTaskLike,
} from "@/components/ContinueWhereYouLeftOff";
import type { AcharyaListItem } from "@/lib/server/acharyas";
import { useLang, useStrings } from "@/lib/i18n/useLang";
import { localizeNoticeText } from "@/lib/i18n/localize-content";
import { ghostIconButtonStyle, softIconButtonStyle } from "@/components/ghost-icon-button";

/**
 * Unread notices for the logged-in karigar (omnidel.log_notifications).
 *
 * Produced on the OmniDel side — mentions, assignments, `org_link_ended`, etc.
 * Known kinds are re-authored from i18n; anything unrecognised falls back to the
 * server's own title/body.
 *
 * `variant="menu"` (default): bell icon in a header — dropdown lists notices.
 * `variant="inline"`: stacked cards (used on Profile → Requests).
 *
 * `resume` (menu variant only) adds "continue where you left off" as the first
 * entry, counted in the badge. It used to be a card at the top of home; the bell
 * is where news about work the karigar already left belongs. See
 * components/ContinueWhereYouLeftOff.
 *
 * `scope="network"` narrows to company/link notices (`org_*`) — Profile → Requests
 * is about MSME links, so task `assignment` / `mention` notices do not belong there.
 * They stay reachable in the home bell, which is `scope="all"`.
 *
 * Fails silently: load error / empty / logged-out → renders nothing.
 */

/**
 * Company/link notices. Prefix match rather than an equality check on
 * `org_link_ended` so future `org_*` kinds surface on Requests automatically —
 * an allow-list, so a NEW task-side kind can never leak back onto this tab.
 */
function isNetworkNotice(notice: NoticeRow): boolean {
  return (notice.kind ?? "").startsWith("org_");
}

/**
 * OmniDel writes task deep-links as `/omnipulse/boards/<boardId>?task=<taskId>`
 * — see `notifyAssignees` (services/tasks.ts) and `mention-notifications.ts`.
 * Match the `?task=` param specifically: the FIRST uuid in that path is the
 * board, not the task.
 */
const TASK_ID_IN_LINK_RE = /[?&]task=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

/**
 * In-app task destination for a notice, or null when there is nothing to open.
 *
 * `link` points at a *manager* screen (`/omnipulse/boards/…`) that a karigar
 * must never be sent to, so we extract the task id and route to this app's own
 * `/tasks/<id>`, which redirects into the nested acharya shell.
 *
 * Deliberately strict — kind alone is not enough to trust a link:
 *  - `kind: "mention"` is ALSO used for lead comments, whose link is
 *    `/omnimart/pipeline/<leadId>?tab=Comments`. A loose uuid grab there would
 *    open a task page for a lead id.
 *  - `org_link_ended` has no link at all.
 * Anything without an explicit `?task=` therefore gets no button.
 */
function noticeTaskHref(notice: NoticeRow): string | null {
  const link = notice.link?.trim();
  if (!link) return null;
  const taskId = TASK_ID_IN_LINK_RE.exec(link)?.[1];
  return taskId ? `/tasks/${taskId}` : null;
}

export default function NoticeBanner({
  style,
  variant = "menu",
  scope = "all",
  tone = "ghost",
  resume,
}: {
  style?: CSSProperties;
  variant?: "menu" | "inline";
  scope?: "all" | "network";
  /** `soft` = filled tan disc (home header). `ghost` = bare glyph elsewhere. */
  tone?: "ghost" | "soft";
  /**
   * Naming data for the resume offer. Only the screen that HAS the acharya and
   * task lists passes it, so the offer lives in one bell rather than every
   * header that shows notices.
   */
  resume?: { acharyas: AcharyaListItem[]; tasks?: ResumeTaskLike[] };
}) {
  const s = useStrings();
  const lang = useLang();
  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    let cancelled = false;
    fetchNotices()
      .then((res) => {
        if (!cancelled) setNotices(res.items || []);
      })
      .catch(() => {
        /* not logged in / offline / DB down — stay invisible */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent | TouchEvent) {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onDismiss = useCallback(async (id: string) => {
    setDismissing(id);
    setNotices((prev) => {
      const next = prev.filter((n) => n.id !== id);
      if (next.length === 0) setOpen(false);
      return next;
    });
    try {
      await dismissNotice(id);
    } catch {
      /* ignore — read_at stays null, notice returns on next visit */
    } finally {
      setDismissing(null);
    }
  }, []);

  const visible = scope === "network" ? notices.filter(isNetworkNotice) : notices;

  // The resume offer rides in the dropdown only: Profile → Requests is about
  // MSME links, and an inline stack of cards is the page layout the offer just
  // moved out of.
  const resumeNotice = useResumeNotice(
    variant === "menu" && scope === "all" ? resume : undefined,
  );

  if (visible.length === 0 && !resumeNotice) return null;

  if (variant === "inline") {
    return (
      <div style={{ padding: "10px 16px 0", ...style }}>
        {visible.map((notice) => (
          <NoticeCard
            key={notice.id}
            notice={notice}
            dismissing={dismissing === notice.id}
            onDismiss={() => void onDismiss(notice.id)}
            title={noticeLabel(notice, s, lang).title}
            body={noticeLabel(notice, s, lang).body}
            dismissLabel={s.noticeDismiss}
            openLabel={s.openTaskCta}
          />
        ))}
      </div>
    );
  }

  // Count the same list the dropdown renders, so the badge can never disagree
  // with its contents under a narrowed scope — the resume offer included.
  const count = visible.length + (resumeNotice ? 1 : 0);
  const countLabel = count > 9 ? "9+" : String(count);

  return (
    <div ref={rootRef} style={{ position: "relative", ...style }}>
      <button
        type="button"
        className="press"
        aria-label={s.noticesAria(count)}
        aria-expanded={open}
        aria-controls={panelId}
        title={s.noticesTitle}
        onClick={() => setOpen((v) => !v)}
        style={{
          ...(tone === "soft" ? softIconButtonStyle : ghostIconButtonStyle),
          position: "relative",
        }}
      >
        <BellIcon />
        {/* On the tan disc the badge has to clear the fill, or it reads as part
            of the glyph — so it hangs off the corner instead of tucking inside. */}
        <span
          style={
            tone === "soft"
              ? { ...badgeStyle, top: -2, right: -2, minWidth: 18, height: 18, lineHeight: "14px", border: "2px solid var(--page)" }
              : badgeStyle
          }
          aria-hidden
        >
          {countLabel}
        </span>
      </button>

      {open ? (
        <div
          id={panelId}
          role="region"
          aria-label={s.noticesTitle}
          style={dropdownStyle}
        >
          <p style={dropdownHeaderStyle}>{s.noticesTitle}</p>
          <div style={dropdownListStyle}>
            {/* First: where they left off. Newest news, and the only entry that
                offers to take them somewhere they chose themselves. */}
            {resumeNotice ? (
              <ResumeNoticeCard
                notice={resumeNotice}
                onDone={() => {
                  if (visible.length === 0) setOpen(false);
                }}
              />
            ) : null}
            {visible.map((notice) => {
              const { title, body } = noticeLabel(notice, s, lang);
              return (
                <NoticeCard
                  key={notice.id}
                  notice={notice}
                  dismissing={dismissing === notice.id}
                  onDismiss={() => void onDismiss(notice.id)}
                  title={title}
                  body={body}
                  dismissLabel={s.noticeDismiss}
                  openLabel={s.openTaskCta}
                  compact
                />
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function noticeLabel(
  notice: NoticeRow,
  s: ReturnType<typeof useStrings>,
  lang: ReturnType<typeof useLang>,
): { title: string; body: string | null } {
  if (notice.kind === "org_link_ended") {
    return { title: s.noticeUnlinkedTitle, body: s.noticeUnlinkedBody };
  }
  return {
    title: localizeNoticeText(notice.title, lang) || notice.title,
    body: notice.body ? localizeNoticeText(notice.body, lang) : null,
  };
}

function NoticeCard({
  notice,
  title,
  body,
  dismissLabel,
  openLabel,
  dismissing,
  onDismiss,
  compact = false,
}: {
  notice: NoticeRow;
  title: string;
  body: string | null;
  dismissLabel: string;
  openLabel: string;
  dismissing: boolean;
  onDismiss: () => void;
  compact?: boolean;
}) {
  const href = noticeTaskHref(notice);
  return (
    <div key={notice.id} style={compact ? compactCardStyle : cardStyle}>
      <p style={compact ? compactTitleStyle : titleStyle}>{title}</p>
      {body ? <p style={compact ? compactBodyStyle : bodyStyle}>{body}</p> : null}
      <div style={actionRowStyle}>
        {href ? (
          // Opening also marks it read — a notice you acted on should not
          // come back on the next visit.
          <Link
            href={href}
            className="press"
            onClick={onDismiss}
            style={compact ? { ...openStyle, ...compactActionStyle } : openStyle}
          >
            {openLabel}
          </Link>
        ) : null}
        <button
          type="button"
          className="press"
          disabled={dismissing}
          onClick={onDismiss}
          style={compact ? { ...dismissStyle, ...compactActionStyle } : dismissStyle}
        >
          {dismissLabel}
        </button>
      </div>
    </div>
  );
}

function BellIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

const cardStyle: CSSProperties = {
  padding: 12,
  borderRadius: "var(--r-md)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--ochre-wash)",
  background: "var(--ochre-wash)",
  marginBottom: 10,
};

/**
 * Dropdown cards. Deliberately tighter than the inline (Profile → Requests)
 * ones: five assignment notices in a 420px-tall panel meant two visible cards
 * and a scroll, so the bell hid most of what it was counting. Same information,
 * ~40% of the height — title clamped to two lines, body to two, and the two
 * actions shrunk to a chip pair instead of full-height buttons.
 */
const compactCardStyle: CSSProperties = {
  ...cardStyle,
  padding: "9px 10px",
  marginBottom: 6,
  background: "var(--surface)",
  borderColor: "var(--rule)",
};

const clampLines = (lines: number): CSSProperties => ({
  display: "-webkit-box",
  WebkitLineClamp: lines,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
});

const titleStyle: CSSProperties = {
  fontFamily: "var(--serif)",
  fontSize: 15,
  fontWeight: 600,
  color: "var(--ink)",
  margin: 0,
};

const bodyStyle: CSSProperties = {
  fontSize: 13,
  lineHeight: 1.5,
  color: "var(--ink-soft)",
  margin: "6px 0 0",
};

const actionRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 8,
};

const openStyle: CSSProperties = {
  marginTop: 10,
  padding: "7px 14px",
  borderRadius: "var(--r-sm)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--green-deep)",
  background: "var(--green-deep)",
  color: "#f4efdf",
  fontSize: 13,
  fontWeight: 600,
  textDecoration: "none",
  whiteSpace: "nowrap",
};

const dismissStyle: CSSProperties = {
  marginTop: 10,
  padding: "7px 14px",
  borderRadius: "var(--r-sm)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontSize: 13,
  fontWeight: 500,
};

const compactTitleStyle: CSSProperties = {
  ...titleStyle,
  fontSize: 13.5,
  lineHeight: 1.3,
  ...clampLines(2),
};

const compactBodyStyle: CSSProperties = {
  ...bodyStyle,
  fontSize: 12,
  lineHeight: 1.4,
  margin: "3px 0 0",
  ...clampLines(2),
};

/** Chip-sized actions for the dropdown — the panel is a list, not a form. */
const compactActionStyle: CSSProperties = {
  marginTop: 7,
  minHeight: 30,
  padding: "0 11px",
  display: "inline-flex",
  alignItems: "center",
  fontSize: 12,
  borderRadius: 999,
};

const badgeStyle: CSSProperties = {
  position: "absolute",
  top: 2,
  right: 2,
  minWidth: 16,
  height: 16,
  padding: "0 4px",
  borderRadius: 999,
  background: "var(--terracotta)",
  color: "#fff",
  fontFamily: "var(--mono)",
  fontSize: 10,
  fontWeight: 600,
  lineHeight: "16px",
  textAlign: "center",
};

const dropdownStyle: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 8px)",
  right: 0,
  width: "min(320px, calc(100vw - 24px))",
  maxHeight: "min(70vh, 420px)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  background: "var(--page)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  borderRadius: "var(--r-md)",
  boxShadow: "0 12px 28px rgba(0,0,0,0.12)",
  zIndex: 40,
};

const dropdownHeaderStyle: CSSProperties = {
  margin: 0,
  padding: "8px 10px 7px",
  fontFamily: "var(--mono)",
  fontSize: 11,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--ink-soft)",
  borderBottomWidth: 1,
  borderBottomStyle: "solid",
  borderBottomColor: "var(--rule)",
};

const dropdownListStyle: CSSProperties = {
  padding: 8,
  overflowY: "auto",
  WebkitOverflowScrolling: "touch",
};
