"use client";

/**
 * Membership history — one row per MSME link.
 *
 * Each row used to read `Invited 18 Jul 2026 · Responded 18 Jul 2026 · Ended
 * 19 Jul 2026`: three labels and three years for what is really three points on
 * one short timeline, wrapping to two and three lines on a phone. The words
 * become icons and the year is printed once per row, so a row is a glance
 * instead of a paragraph.
 *
 * Nothing is lost to a screen reader: every stage still carries its full label
 * AND its full date in an `sr-only` span, and the icon beside it is hidden. The
 * visible short date is `aria-hidden` so the date is not announced twice.
 */

import type { CSSProperties, ReactNode } from "react";
import type { NetworkSheet } from "@/acharya/lib/api/network";
import type { Lang } from "@/acharya/lib/store";
import { dateLocaleFor, t } from "@/acharya/lib/i18n/strings";
import { localizeContent } from "@/acharya/lib/i18n/localize-content";
import {
  panelStyle, eyebrowStyle, emptyTextStyle, listStyle, listTitleStyle,
  statusBadgeStyle, formatDate, yearOf,
} from "./profile-ui";
import {
  OrgIcon, InvitedIcon, RequestedIcon, RespondedIcon, EndedIcon, orgGlyphStyle,
} from "./network-icons";

interface Props {
  sheet: NetworkSheet;
  lang: Lang;
  onGoToRequests: () => void;
}

type Stage = { key: string; label: string; icon: ReactNode; iso: string };

export default function HistoryTab({ sheet, lang, onGoToRequests }: Props) {
  const s = t(lang);
  const locale = dateLocaleFor(lang);

  return (
    <section style={panelStyle}>
      <p style={eyebrowStyle}>{s.profileTabHistory}</p>
      {sheet.links.length === 0 ? (
        <div>
          <p style={emptyTextStyle}>{s.historyEmpty}</p>
          <button type="button" onClick={onGoToRequests} className="press" style={emptyCtaStyle}>
            {s.exploreMsmes}
          </button>
        </div>
      ) : (
        <div style={listStyle}>
          {sheet.links.map((link) => {
            const stages: Stage[] = [];
            if (link.created_on) {
              const asked = link.initiated_by === "worker";
              stages.push({
                key: "start",
                label: asked ? s.linkRequested : s.linkInvited,
                icon: asked ? <RequestedIcon /> : <InvitedIcon />,
                iso: link.created_on,
              });
            }
            if (link.responded_on) {
              stages.push({
                key: "responded",
                label: s.linkResponded,
                icon: <RespondedIcon />,
                iso: link.responded_on,
              });
            }
            if (link.ended_on) {
              stages.push({ key: "ended", label: s.linkEnded, icon: <EndedIcon />, iso: link.ended_on });
            }

            // One year for the row when every stage falls in it — which is the
            // normal case, and the one that was printing "2026" three times.
            const years = stages.map((stage) => yearOf(stage.iso));
            const sharedYear =
              stages.length > 1 && years.every((y) => y !== null && y === years[0])
                ? String(years[0])
                : null;

            return (
              <div key={link.id} style={rowStyle}>
                <span style={orgGlyphStyle} aria-hidden><OrgIcon /></span>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={listTitleStyle}>
                    {link.org?.name ? localizeContent(link.org.name, lang) : "MSME"}
                  </p>

                  {stages.length === 0 ? (
                    <p style={fallbackStyle}>{s.networkCompany}</p>
                  ) : (
                    <div style={timelineStyle}>
                      {stages.map((stage) => {
                        const full = formatDate(stage.iso, { locale, empty: s.notAdded });
                        const short = sharedYear
                          ? formatDate(stage.iso, { locale, empty: s.notAdded, year: false })
                          : full;
                        return (
                          <span key={stage.key} style={stageStyle} title={`${stage.label} ${full}`}>
                            <span style={stageIconStyle} aria-hidden>{stage.icon}</span>
                            <span className="sr-only">{stage.label} {full}</span>
                            <span aria-hidden style={stageDateStyle}>{short}</span>
                          </span>
                        );
                      })}
                      {sharedYear ? <span aria-hidden style={yearStyle}>{sharedYear}</span> : null}
                    </div>
                  )}
                </div>

                <span style={statusBadgeStyle(link.status)}>{s.linkStatusLabel(link.status)}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 11,
  borderTopWidth: 1,
  borderTopStyle: "solid",
  borderTopColor: "var(--rule)",
  paddingTop: 10,
};

const timelineStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "3px 10px",
  margin: "3px 0 0",
};

const stageStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  color: "var(--ink-mute)",
};

const stageIconStyle: CSSProperties = {
  display: "inline-flex",
  color: "var(--ink-faint)",
};

const stageDateStyle: CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 11,
  lineHeight: 1.3,
  whiteSpace: "nowrap",
};

/** Printed once, after the stages it belongs to. */
const yearStyle: CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 11,
  lineHeight: 1.3,
  color: "var(--ink-faint)",
};

const fallbackStyle: CSSProperties = {
  color: "var(--ink-mute)",
  fontSize: 12,
  margin: "3px 0 0",
  lineHeight: 1.35,
};

const emptyCtaStyle: CSSProperties = {
  marginTop: 12,
  minHeight: 44,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 16px",
  borderRadius: "var(--r-md)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--green-deep)",
  background: "var(--green-wash)",
  color: "var(--green-deep)",
  fontSize: 14,
  fontWeight: 750,
  cursor: "pointer",
};
