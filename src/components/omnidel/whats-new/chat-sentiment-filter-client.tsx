"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { CustomSelect } from "@/components/omnidel/custom-select";
import { DatePicker } from "@/components/omnidel/date-picker";
import { istToday, istDateDaysAgo } from "@/lib/ist";
import {
  PERIOD_OPTIONS,
  CUSTOM_PERIOD,
  MAX_WINDOW_DAYS,
  resolveWindow,
  type SentimentFilter,
} from "@/components/omnidel/dashboard/types";
import { FILTER_TITLES, SentimentConversationsCard } from "@/components/omnidel/whats-new/chat-sentiment-shared";
import { useTr } from "@/lib/client/language";

const VALID_FILTERS: SentimentFilter[] = ["all", "positive", "neutral", "negative", "needs_review"];
function isSentimentFilter(v: string): v is SentimentFilter {
  return (VALID_FILTERS as readonly string[]).includes(v);
}

/**
 * Full conversation list for ONE sentiment bucket — its own page, not a panel
 * that expands on the overview (user-directed, 2026-08-20: "one new page
 * should be opened... not on the same page"). Reached by clicking any stat
 * card on /whats-new/chat-sentiment.
 *
 * Owns its own period picker (seeded from `?days=` on arrival, defaulting to
 * 7d) rather than inheriting the overview's window — this is a standalone,
 * bookmarkable/shareable page, so it needs to be usable on its own.
 */
export function ChatSentimentFilterClient() {
  const tr = useTr();
  const params = useParams();
  const searchParams = useSearchParams();

  const rawFilter = String(params.filter || "");
  const filter: SentimentFilter = isSentimentFilter(rawFilter) ? rawFilter : "all";

  // Seed from `?days=` on first arrival: a plain day-count that matches one of
  // the presets (1/7/30/90 — the overview's own options) is shown as that
  // preset, not as a "custom since" window, since that is what actually
  // linked here. Anything else falls back to the default 7-day preset.
  const initialRange = (() => {
    const initialDays = parseInt(searchParams.get("days") || "", 10);
    if (initialDays === 1) return "1d";
    if (initialDays === 7) return "7d";
    if (initialDays === 30) return "30d";
    if (initialDays === 90) return "90d";
    return "7d";
  })();
  const [range, setRange] = useState<string>(initialRange);
  const win = resolveWindow(range);
  const isCustom = !!win.since;

  const setPreset = useCallback((next: string) => {
    if (next === CUSTOM_PERIOD) {
      setRange(`since:${istDateDaysAgo(30)}`);
      return;
    }
    setRange(next);
  }, []);
  const setSince = useCallback((iso: string) => {
    setRange(iso ? `since:${iso}` : "7d");
  }, []);

  const todayIso = istToday();
  const earliestIso = istDateDaysAgo(MAX_WINDOW_DAYS);

  return (
    <div>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 16, flexWrap: "wrap", marginBottom: 6,
      }}>
        <h2 style={{ fontFamily: "var(--serif)", margin: 0, flexShrink: 0 }}>
          <Link href="/whats-new/chat-sentiment" style={{ color: "var(--ink-mute)", textDecoration: "none" }}>
            {tr("Platform updates / Chat Sentiment")}
          </Link>
          {" / "}
          {FILTER_TITLES[filter]}
        </h2>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "nowrap" }}>
          {isCustom && (
            <div style={{ width: 150, flexShrink: 0 }}>
              <DatePicker
                value={win.since || ""}
                onChange={setSince}
                min={earliestIso}
                max={todayIso}
                placeholder={tr("since dd-mm-yyyy")}
              />
            </div>
          )}
          <div style={{ width: 138, flexShrink: 0 }}>
            <CustomSelect
              value={isCustom ? CUSTOM_PERIOD : range}
              onChange={setPreset}
              options={PERIOD_OPTIONS}
              compact
            />
          </div>
        </div>
      </div>

      <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 18 }}>
        {tr("Showing")} <strong>{win.label}</strong>
        <span style={{ color: "var(--ink-faint)" }}> {tr("· days counted in IST")}</span>
        {win.clamped && (
          <> {tr("— the API caps a window at")} {MAX_WINDOW_DAYS} {tr("days, so an earlier date is reported as the last")} {MAX_WINDOW_DAYS}.</>
        )}
      </div>

      <SentimentConversationsCard filter={filter} days={win.days} title={FILTER_TITLES[filter]} />
    </div>
  );
}
