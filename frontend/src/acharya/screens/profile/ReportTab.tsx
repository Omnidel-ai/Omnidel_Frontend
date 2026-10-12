"use client";

import type { CSSProperties, ReactNode } from "react";
import type { NetworkSheet } from "@/acharya/lib/api/network";
import type { Lang } from "@/acharya/lib/store";
import { t } from "@/acharya/lib/i18n/strings";
import {
  eyebrowStyle, listStyle, listRowStyle,
  listTitleStyle, summaryStyle,
  statsGridStyle, statValueStyle, statLabelStyle,
  statTileStyleFor, toneBadgeStyle,
  accentCardStyle, accentTitleStyle, accentBodyStyle, accentActionStyle,
  formatScore,
  type ReportTone,
} from "./profile-ui";
import HistoryTags from "./HistoryTags";
import {
  CheckCircleIcon, StarIcon, BriefcaseIcon,
  EnvelopeIcon, DocumentIcon, ArrowRightIcon, Sparkles,
} from "./report-art";

interface Props {
  sheet: NetworkSheet;
  lang: Lang;
  onGoToProfile: () => void;
  /** When true, KPIs + task history live above the tab rail. */
  hideStats?: boolean;
  /** When true, task list is shown on the profile surface instead. */
  hideExperience?: boolean;
}

export function ProfileKpiCards({ sheet, lang }: { sheet: NetworkSheet; lang: Lang }) {
  const s = t(lang);
  const profile = sheet.profile;
  return (
    <section className="journey-profile-stats" style={statsGridStyle} aria-label={s.workerStatsAria}>
      <StatTile tone="green" icon={<CheckCircleIcon />} value={String(profile.tasks_done ?? 0)} label={s.tasksDone} />
      <StatTile tone="ochre" icon={<StarIcon />} value={formatScore(profile.avg_score)} label={s.avgScore} />
      <StatTile tone="slate" icon={<BriefcaseIcon />} value={String(profile.jobs_done ?? 0)} label={s.jobsDone} />
    </section>
  );
}

export default function ReportTab({
  sheet, lang, onGoToProfile, hideStats = false, hideExperience = false,
}: Props) {
  const s = t(lang);
  const profile = sheet.profile;
  const incomplete = !profile.email || !profile.trade_id || !profile.city_id;

  return (
    <div>
      {hideStats ? null : <ProfileKpiCards sheet={sheet} lang={lang} />}

      {incomplete ? (
        // Whole card is the target, not just the arrow — a 44px hit area on a
        // two-line nudge is needlessly precise on a phone.
        <button type="button" onClick={onGoToProfile} className="press" style={{ ...accentCardStyle("ochre"), cursor: "pointer" }}>
          <Sparkles />
          <span style={toneBadgeStyle("ochre", 44)} aria-hidden>
            <EnvelopeIcon />
          </span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={accentTitleStyle}>{s.completeProfileTitle}</span>
            <span style={accentBodyStyle}>{s.completeProfileBody}</span>
          </span>
          <span style={accentActionStyle} aria-hidden>
            <ArrowRightIcon />
          </span>
        </button>
      ) : null}

      {hideExperience ? null : (
        <section style={sheet.experience.length === 0 ? accentCardStyle("green") : reportListPanel}>
          {sheet.experience.length === 0 ? (
            <>
              <span style={toneBadgeStyle("green", 44)} aria-hidden>
                <DocumentIcon />
              </span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={accentTitleStyle}>{s.reportSheet}</span>
                <span style={accentBodyStyle}>{s.reportEmpty}</span>
              </span>
            </>
          ) : (
            <>
              <p style={eyebrowStyle}>{s.reportSheet}</p>
              <div style={listStyle}>
                {sheet.experience.map((item) => (
                  <div key={item.id} style={listRowStyle}>
                    <p style={listTitleStyle}>{item.task_title || s.taskHistoryUntitled}</p>
                    <HistoryTags item={item} lang={lang} />
                    {item.summary ? <p style={summaryStyle}>{item.summary}</p> : null}
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}

function StatTile({
  tone, icon, value, label,
}: { tone: ReportTone; icon: ReactNode; value: string; label: string }) {
  return (
    <div className="journey-profile-stat" style={statTileStyleFor(tone)}>
      <span style={toneBadgeStyle(tone)} aria-hidden>{icon}</span>
      <p style={statValueStyle}>{value}</p>
      <p style={statLabelStyle}>{label}</p>
    </div>
  );
}

/** Filled sheet — a plain panel; the tinted accent card is the empty state. */
const reportListPanel: CSSProperties = {
  padding: 14,
  borderRadius: "var(--r-xl)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  background: "var(--surface)",
  marginBottom: 12,
};
