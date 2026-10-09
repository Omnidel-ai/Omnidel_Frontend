"use client";

import { useCallback, useState } from "react";
import { usePanel } from "@/components/omnidel/dashboard/use-panel";
import { CustomSelect } from "@/components/omnidel/custom-select";
import { DatePicker } from "@/components/omnidel/date-picker";
import { ChartFrame, DonutChart, BarList, EmptyChart } from "@/components/omnidel/dash-charts";
import { StatCard, cardStyle, cardHeaderStyle, ViewAllLink, PanelSkeleton } from "@/components/omnidel/dashboard/primitives";
import { istToday, istDateDaysAgo } from "@/lib/ist";
import {
  PERIOD_OPTIONS,
  CUSTOM_PERIOD,
  MAX_WINDOW_DAYS,
  resolveWindow,
  EMPTY_CHAT_SENTIMENT,
  type ChatSentimentStats,
  type FlaggedConversation,
} from "@/components/omnidel/dashboard/types";
import { SENTIMENT_COLORS, QUALITY_COLORS, FlaggedRow } from "@/components/omnidel/whats-new/chat-sentiment-shared";
import { useTr } from "@/lib/client/language";

/**
 * Chat quality triage for MahAcharya conversations.
 *
 * Lives at Admin ▸ Platform updates ▸ Chat Sentiment — a standalone page, not a
 * tab on /admin/dashboard. It sits beside "Approve" (also a Platform-updates
 * screen) rather than inside the tabbed dashboard because it is reviewing a
 * different kind of thing: not usage counts, a stream of individual AI
 * exchanges someone needs to read. Full design: docs/mahacharya-chat-sentiment-plan.md.
 *
 * "Approximate, not authoritative" per that plan — this is a triage signal, not
 * a verdict, and the copy on this page says so rather than implying certainty.
 *
 * Every stat card is a real navigation, not an in-place expansion (user-
 * directed, 2026-08-20: "one new page should be opened... not on the same
 * page"). Each links to /whats-new/chat-sentiment/{filter}, carrying the
 * current window so the drill-down opens already scoped to what was on screen.
 */

interface SentimentPanelPayload {
  stats: ChatSentimentStats;
  flagged: FlaggedConversation[];
}

export function ChatSentimentClient() {
  const tr = useTr();

  const [range, setRange] = useState<string>("7d");
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

  const panel = usePanel<SentimentPanelPayload>("sentiment", win.days);
  const stats = panel.data?.stats || EMPTY_CHAT_SENTIMENT;
  const flagged = panel.data?.flagged || [];

  const todayIso = istToday();
  const earliestIso = istDateDaysAgo(MAX_WINDOW_DAYS);

  // Every stat card's drill-down page, carrying the window it was clicked from.
  const filterHref = (filter: string) => `/whats-new/chat-sentiment/${filter}?days=${win.days}`;

  const nothingAnalyzed = stats.totalAnalyzed === 0;

  return (
    <div>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 16, flexWrap: "wrap", marginBottom: 6,
      }}>
        <h2 style={{ fontFamily: "var(--serif)", margin: 0, flexShrink: 0 }}>
          <span style={{ color: "var(--ink-mute)" }}>{tr("Platform updates")}</span> {tr("/ Chat Sentiment")}
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

      <p style={{ fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.55, maxWidth: "62ch", marginBottom: 14 }}>
        {tr("A triage signal for MahAcharya's own AI response quality — worth a look, not a verdict, and never a judgement of the person on the other side of the chat. Windowed by when the conversation happened, not when it was scored, so a backfilled older thread still lands in the right window.")}
      </p>

      <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 18 }}>
        {tr("Showing")} <strong>{win.label}</strong>
        <span style={{ color: "var(--ink-faint)" }}> {tr("· days counted in IST")}</span>
        {win.clamped && (
          <> {tr("— the API caps a window at")} {MAX_WINDOW_DAYS} {tr("days, so an earlier date is reported as the last")} {MAX_WINDOW_DAYS}.</>
        )}
      </div>

      {panel.error && (
        <div style={{
          fontSize: 13, color: "var(--crit)", background: "var(--crit-wash)",
          border: "1px solid var(--crit)", borderRadius: "var(--r-sm)",
          padding: "10px 14px", marginBottom: 16,
        }}>
          {panel.error}
        </div>
      )}

      {panel.loading && !panel.data ? (
        <PanelSkeleton rows={3} height={78} />
      ) : (
        <>
          <div className="dash-auto-grid" style={{ marginBottom: 20 }}>
            <StatCard
              label={tr("ANALYZED")} value={stats.totalAnalyzed} bg="var(--surface)" accent="var(--ink-soft)"
              note="Threads scored in this window"
              href={filterHref("all")} linkLabel={tr("View conversations")}
            />
            <StatCard
              label={tr("POSITIVE")} value={stats.positive} bg="var(--ok-wash)" accent="var(--ok)"
              href={filterHref("positive")} linkLabel={tr("View conversations")}
            />
            <StatCard
              label={tr("NEUTRAL")} value={stats.neutral} bg="var(--ochre-wash)" accent="var(--ochre)"
              href={filterHref("neutral")} linkLabel={tr("View conversations")}
            />
            <StatCard
              label={tr("NEGATIVE")} value={stats.negative} bg="var(--crit-wash)" accent="var(--crit)"
              href={filterHref("negative")} linkLabel={tr("View conversations")}
            />
            <StatCard
              label={tr("NEEDS REVIEW")}
              value={stats.needsReview}
              bg="var(--crit-wash)"
              accent="var(--crit)"
              note="Negative sentiment or poor quality"
              href={filterHref("needs_review")} linkLabel={tr("View conversations")}
            />
          </div>

          {nothingAnalyzed ? (
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>{tr("CHAT SENTIMENT")}</div>
              <div style={{ padding: "8px 0 20px" }}>
                <EmptyChart
                  message={`Nothing scored in the ${win.label}`}
                  hint="Either MahAcharya had no conversations in this window, or the scheduled classifier hasn't run yet — it ticks once a day and doubles as the backfill, so a wider window may still show older scored threads."
                />
              </div>
            </div>
          ) : (
            <>
              <div className="dash-chart-grid is-even" style={{ marginBottom: 20 }}>
                <ChartFrame label={tr("USER SENTIMENT")} sub={win.label}>
                  <DonutChart
                    data={[
                      { label: "Positive", count: stats.positive, color: SENTIMENT_COLORS.positive },
                      { label: "Neutral", count: stats.neutral, color: SENTIMENT_COLORS.neutral },
                      { label: "Negative", count: stats.negative, color: SENTIMENT_COLORS.negative },
                    ]}
                    caption="How users felt across the conversation"
                    showZeroLegend
                  />
                </ChartFrame>

                <ChartFrame label={tr("RESPONSE QUALITY")} sub="did the assistant actually answer">
                  <BarList
                    data={[
                      { label: "Good", count: stats.qualityGood, color: QUALITY_COLORS.good },
                      { label: "Adequate", count: stats.qualityAdequate, color: QUALITY_COLORS.adequate },
                      { label: "Poor", count: stats.qualityPoor, color: QUALITY_COLORS.poor },
                    ]}
                    accent="var(--green-deep)"
                    labelWidth={90}
                  />
                </ChartFrame>
              </div>

              <div style={cardStyle}>
                <div style={{ ...cardHeaderStyle, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                  <h4 style={{ margin: 0, font: "inherit" }}>{tr("FLAGGED CONVERSATIONS")}</h4>
                  <span style={{ display: "inline-flex", alignItems: "baseline", gap: 10 }}>
                    <span style={{ fontSize: 9, letterSpacing: "0.08em", fontWeight: 400 }}>
                      {tr("TOP")} {flagged.length} {tr("· NEGATIVE OR POOR")}
                    </span>
                    <ViewAllLink href={filterHref("needs_review")} />
                  </span>
                </div>
                {flagged.length === 0 ? (
                  <div style={{ padding: 20, color: "var(--ink-faint)", textAlign: "center", fontSize: 12 }}>
                    {tr("Nothing flagged in this window — no negative-sentiment or poor-quality conversations scored so far.")}
                  </div>
                ) : (
                  <div className="themed-scroll-y" style={{ maxHeight: 480, overflowY: "auto" }}>
                    {flagged.map((f, i) => (
                      <FlaggedRow key={f.id} item={f} divider={i < flagged.length - 1} />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
