"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { cardStyle, cardHeaderStyle, rowStyle } from "@/components/omnidel/dashboard/primitives";
import { Pagination, useTablePagination } from "@/components/omnidel/table-controls";
import { fetchJson, FetchError } from "@/lib/client/fetch-json";
import { timeAgo, type FlaggedConversation, type SentimentFilter } from "@/components/omnidel/dashboard/types";
import { useTr } from "@/lib/client/language";

/**
 * Shared between the Chat Sentiment overview (chat-sentiment-client.tsx) and
 * its per-bucket drill-down pages (chat-sentiment/[filter]) — the row styling,
 * tag colors, and the paginated fetch+list both places render the same way.
 *
 * Split out because a bucket's full conversation list now opens on ITS OWN
 * page rather than expanding in place on the overview (user-directed,
 * 2026-08-20) — the overview and the five per-bucket pages are separate
 * client components, and both need this.
 */

export const SENTIMENT_COLORS: Record<string, string> = {
  positive: "var(--ok)",
  neutral: "var(--ochre)",
  negative: "var(--crit)",
};
export const QUALITY_COLORS: Record<string, string> = {
  good: "var(--ok)",
  adequate: "var(--ochre)",
  poor: "var(--crit)",
};
export const QUALITY_LABELS: Record<string, string> = { good: "Good", adequate: "Adequate", poor: "Poor" };

/** Bucket → page title / card header. One entry per stat card on the overview. */
export const FILTER_TITLES: Record<SentimentFilter, string> = {
  all: "All analyzed conversations",
  positive: "Positive conversations",
  neutral: "Neutral conversations",
  negative: "Negative conversations",
  needs_review: "Needs review",
};

export function sentimentTagStyle(color: string): CSSProperties {
  return {
    fontFamily: "var(--mono)",
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    padding: "2px 7px",
    borderRadius: 999,
    color,
    background: "color-mix(in srgb, " + color + " 14%, transparent)",
  };
}

/**
 * One conversation row. Links into the SAME per-user transcript viewer every
 * other admin conversation read uses (UserConversations) rather than a second
 * reader — the plan's "deep-link, not a new viewer" call.
 */
export function FlaggedRow({ item, divider }: { item: FlaggedConversation; divider: boolean }) {
  const tr = useTr();
  const href =
    `/admin/dashboard/users/${item.userId}?tab=Conversations` +
    `&conversationId=${encodeURIComponent(item.threadId)}` +
    `&conversationTitle=${encodeURIComponent(item.title)}`;

  return (
    <div style={{ ...rowStyle(divider), alignItems: "flex-start", flexDirection: "column", gap: 6, padding: "12px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, width: "100%", flexWrap: "wrap" }}>
        <Link href={href} style={{ fontSize: 13, fontWeight: 500, color: "var(--green-deep)", textDecoration: "underline", textUnderlineOffset: 2 }}>
          {item.title}
        </Link>
        <span style={{ fontSize: 11, color: "var(--ink-faint)", whiteSpace: "nowrap" }}>{timeAgo(item.lastMessageAt)}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{item.userName}</span>
        <span style={sentimentTagStyle(SENTIMENT_COLORS[item.userSentiment])}>{item.userSentiment}</span>
        <span style={sentimentTagStyle(QUALITY_COLORS[item.responseQuality])}>
          {QUALITY_LABELS[item.responseQuality]}
        </span>
        {item.resolved === false && (
          <span style={sentimentTagStyle("var(--ink-mute)")}>{tr("Unresolved")}</span>
        )}
      </div>

      {item.summary && (
        <p style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.5, margin: 0 }}>{item.summary}</p>
      )}
      {item.flaggedReason && (
        <p style={{ fontSize: 12, color: "var(--crit)", lineHeight: 1.5, margin: 0 }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase" }}>{tr("Why flagged:")} </span>
          {item.flaggedReason}
        </p>
      )}
    </div>
  );
}

interface ConversationsPage {
  items: FlaggedConversation[];
  total: number;
}

/**
 * Full paginated list of every conversation in one bucket — the content of
 * a per-bucket drill-down page. Card chrome included (header with a live
 * count, the scrollable row list, pagination); the caller supplies the title
 * and owns everything above it (breadcrumb, period picker).
 */
export function SentimentConversationsCard({
  filter, days, title,
}: {
  filter: SentimentFilter;
  days: number;
  title: string;
}) {
  const tr = useTr();
  const [rows, setRows] = useState<FlaggedConversation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const { page, setPage, perPage } = useTablePagination(20, total, `${filter}|${days}`);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setErr(null);

    const qs = new URLSearchParams({
      days: String(days),
      filter,
      page: String(page),
      per_page: String(perPage),
    });

    fetchJson<ConversationsPage>(`/api/admin/dashboard/chat-sentiment/conversations?${qs.toString()}`)
      .then((d) => {
        if (!live) return;
        setRows(d.items || []);
        setTotal(d.total || 0);
      })
      .catch((e) => {
        if (!live) return;
        setErr(e instanceof FetchError ? e.message : "Failed to load conversations");
      })
      .finally(() => {
        if (live) setLoading(false);
      });

    return () => {
      live = false;
    };
  }, [filter, days, page, perPage]);

  return (
    <div style={cardStyle}>
      <div style={{ ...cardHeaderStyle, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <h4 style={{ margin: 0, font: "inherit" }}>{title.toUpperCase()}</h4>
        <span style={{ fontSize: 9, letterSpacing: "0.08em", fontWeight: 400 }}>
          {loading && rows.length === 0 ? tr("LOADING…") : `${total} TOTAL`}
        </span>
      </div>

      {err && (
        <div role="alert" style={{ padding: "12px 16px", fontSize: 13, color: "var(--crit)" }}>
          {err}
        </div>
      )}

      {!err && loading && rows.length === 0 && (
        <div style={{ padding: 20, color: "var(--ink-mute)", textAlign: "center", fontSize: 12 }}>
          {tr("Loading conversations…")}
        </div>
      )}

      {!err && !loading && rows.length === 0 && (
        <div style={{ padding: 20, color: "var(--ink-faint)", textAlign: "center", fontSize: 12 }}>
          {tr("Nothing in this bucket for this window.")}
        </div>
      )}

      {rows.length > 0 && (
        <div className="themed-scroll-y" style={{ maxHeight: 640, overflowY: "auto" }}>
          {rows.map((f, i) => (
            <FlaggedRow key={f.id} item={f} divider={i < rows.length - 1} />
          ))}
        </div>
      )}

      {total > perPage && (
        <div style={{ padding: "0 16px 12px" }}>
          <Pagination page={page} total={total} perPage={perPage} onChange={setPage} label="conversations" />
        </div>
      )}
    </div>
  );
}
