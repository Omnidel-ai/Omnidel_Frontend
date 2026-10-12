"use client";

/**
 * Shared lane definitions for the Apply (/tasks) task-list lanes.
 */

import type { Lang } from "@/acharya/lib/store";
import { t } from "@/acharya/lib/i18n/strings";
import { LANE_IDS, LANE_STATUS_SLUGS, type LaneId } from "@/acharya/lib/lane-ids";

export type { LaneId };

const LANE_ACCENT: Record<LaneId, { accentColor: string; accentBg: string }> = {
  todo: {
    accentColor: "var(--terracotta)",
    accentBg: "var(--terra-wash)",
  },
  doing: {
    accentColor: "var(--ochre)",
    accentBg: "var(--ochre-wash)",
  },
  // Waiting on someone else — deliberately the calmest of the four accents so
  // it does not read as "act on me" beside Doing.
  review: {
    accentColor: "var(--ink-mute)",
    accentBg: "var(--surface-sunk)",
  },
  done: {
    accentColor: "var(--ok)",
    accentBg: "var(--ok-wash)",
  },
};

function laneLabel(id: LaneId, lang: Lang): string {
  const s = t(lang);
  if (id === "doing") return s.doing;
  if (id === "review") return s.review;
  if (id === "done") return s.done;
  return s.planned;
}

export function getLanes(lang: Lang) {
  return LANE_IDS.map((id) => ({
    id,
    slugs: [...LANE_STATUS_SLUGS[id]],
    ...LANE_ACCENT[id],
    label: laneLabel(id, lang),
  }));
}

/** @deprecated Use getLanes(lang) for localized labels */
export const LANES = getLanes("en");
