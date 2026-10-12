"use client";

import type { CSSProperties } from "react";
import type { NetworkExperienceEntry } from "@/acharya/lib/api/network";
import type { Lang } from "@/acharya/lib/store";
import { dateLocaleFor, t } from "@/acharya/lib/i18n/strings";
import { formatDate, formatScore } from "./profile-ui";

/**
 * When, how well, and who said so — as tags rather than one run-on sentence.
 *
 * The line used to read "1 Sep 2026 · 0.8/10 · approved", three unrelated facts
 * separated by dots in one grey paragraph: a karigar scanning their history for
 * a score had to read the date to get past it. Three chips carry the same facts
 * with the verdict coloured, so approval is visible without reading at all.
 *
 * One component, used by both the Progress panel and the report sheet — those
 * two printed the same three values in different orders with different
 * separators, which is how they came to disagree in the first place.
 */
export default function HistoryTags({
  item,
  lang,
}: {
  item: NetworkExperienceEntry;
  lang: Lang;
}) {
  const s = t(lang);
  const date = formatDate(item.occurred_on, { locale: dateLocaleFor(lang), empty: "" });
  const score = formatScore(item.score);
  const verdictRaw = (item.verdict || item.acharya_slug || "").replaceAll("_", " ").trim();

  return (
    <div style={tagRow}>
      {date ? <span style={{ ...tag, ...neutralTag }}>{date}</span> : null}
      {score && score !== "-" ? <span style={{ ...tag, ...scoreTag }}>{score}</span> : null}
      {verdictRaw ? <span style={{ ...tag, ...verdictTone(item.verdict) }}>{verdictRaw}</span> : null}
      {!date && (!score || score === "-") && !verdictRaw ? (
        <span style={{ ...tag, ...neutralTag }}>{s.notAdded}</span>
      ) : null}
    </div>
  );
}

/**
 * Only a real verdict gets a colour. `acharya_slug` also lands in this chip when
 * no verdict was recorded, and painting a name green would read as an approval
 * nobody gave.
 */
function verdictTone(verdict: string | null | undefined): CSSProperties {
  const v = (verdict || "").toLowerCase();
  if (!v) return neutralTag;
  if (v.includes("approve") || v.includes("pass") || v.includes("accept")) return okTag;
  if (v.includes("reject") || v.includes("fail") || v.includes("redo") || v.includes("needs")) return critTag;
  return neutralTag;
}

const tagRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  margin: "6px 0 0",
};

const tag: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 22,
  padding: "0 8px",
  borderRadius: 999,
  borderWidth: 1,
  borderStyle: "solid",
  fontFamily: "var(--mono)",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const neutralTag: CSSProperties = {
  borderColor: "var(--rule)",
  background: "var(--surface)",
  color: "var(--ink-mute)",
};

const scoreTag: CSSProperties = {
  borderColor: "color-mix(in srgb, var(--ochre) 34%, transparent)",
  background: "var(--ochre-wash)",
  color: "var(--ochre)",
};

const okTag: CSSProperties = {
  borderColor: "color-mix(in srgb, var(--green) 34%, transparent)",
  background: "var(--green-wash)",
  color: "var(--green-deep)",
};

const critTag: CSSProperties = {
  borderColor: "color-mix(in srgb, var(--crit) 30%, transparent)",
  background: "var(--crit-wash)",
  color: "var(--crit)",
};
