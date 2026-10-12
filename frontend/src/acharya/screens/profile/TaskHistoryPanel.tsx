"use client";

import type { NetworkExperienceEntry } from "@/acharya/lib/api/network";
import type { Lang } from "@/acharya/lib/store";
import { t } from "@/acharya/lib/i18n/strings";
import {
  panelStyle,
  eyebrowStyle,
  listStyle,
  listRowStyle,
  listTitleStyle,
  summaryStyle,
  toneBadgeStyle,
} from "./profile-ui";
import HistoryTags from "./HistoryTags";
import { ClockIcon, ChecklistArt } from "./report-art";

interface Props {
  items: NetworkExperienceEntry[];
  lang: Lang;
}

/** Always-visible task history on the profile surface (fed by `/api/network/me`). */
export default function TaskHistoryPanel({ items, lang }: Props) {
  const s = t(lang);
  const empty = items.length === 0;

  return (
    <section className="journey-task-history" style={panelStyle} aria-label={s.taskHistoryTitle}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={toneBadgeStyle("green", 32)} aria-hidden>
          <ClockIcon />
        </span>
        <p style={eyebrowStyle}>{s.taskHistoryTitle}</p>
      </div>

      {empty ? (
        // Illustration sits to the right of the copy and shrinks first — on a
        // narrow phone the two sentences matter, the clipboard does not.
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 12 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={emptyTitleStyle}>{s.taskHistoryEmpty}</p>
            <p style={emptyBodyStyle}>{s.taskHistoryEmptyBody}</p>
          </div>
          <ChecklistArt width={96} />
        </div>
      ) : (
        <div style={listStyle}>
          {items.map((item) => (
            <article key={item.id} style={listRowStyle}>
              <p style={listTitleStyle}>{item.task_title || s.taskHistoryUntitled}</p>
              <HistoryTags item={item} lang={lang} />
              {item.summary ? <p style={summaryStyle}>{item.summary}</p> : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

const emptyTitleStyle = {
  fontSize: 17,
  fontWeight: 750,
  color: "var(--ink)",
  margin: 0,
  lineHeight: 1.25,
} as const;

const emptyBodyStyle = {
  fontSize: 13.5,
  color: "var(--ink-soft)",
  margin: "7px 0 0",
  lineHeight: 1.45,
} as const;
