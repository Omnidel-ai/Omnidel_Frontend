/**
 * Display-only helpers for session / planned-time labels in the karigar UI.
 * Timer length and segment math come from the server — never computed here for logic.
 */

import type { Lang } from "@/acharya/lib/store";

export const SESSION_DURATION_SECONDS = 45 * 60;
export const SESSION_DURATION_MINUTES = 45;

export interface SegmentPlanDisplay {
  total_planned_seconds: number;
  segment_count: number;
  segment_durations_seconds: number[];
}

export function formatDurationLabel(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes} min`;
}

export function formatSessionCountLabel(count: number, lang: Lang = "en"): string {
  const n = Math.max(1, Math.floor(count));
  if (lang === "bn") return n === 1 ? "১টি পালা" : `${n}টি পালা`;
  if (lang === "hi") return n === 1 ? "१ सत्र" : `${n} सत्र`;
  if (lang === "fr") return n === 1 ? "1 session" : `${n} sessions`;
  if (lang === "te") return n === 1 ? "1 విడత" : `${n} విడతలు`;
  if (lang === "am") return n === 1 ? "1 ዙር" : `${n} ዙሮች`;
  return n === 1 ? "1 session" : `${n} sessions`;
}

export function formatTotalSessionDuration(
  sessionCount: number,
  minutesPerSession = SESSION_DURATION_MINUTES,
  lang: Lang = "en",
): string {
  const totalMin = Math.max(1, Math.floor(sessionCount)) * minutesPerSession;
  if (lang === "bn") {
    if (totalMin < 60) return `${totalMin} মিনিট`;
    const hours = Math.floor(totalMin / 60);
    const minutes = totalMin % 60;
    if (minutes === 0) return hours === 1 ? "১ ঘণ্টা" : `${hours} ঘণ্টা`;
    return `${hours} ঘণ্টা ${minutes} মিনিট`;
  }
  if (lang === "hi") {
    if (totalMin < 60) return `${totalMin} मिनट`;
    const hours = Math.floor(totalMin / 60);
    const minutes = totalMin % 60;
    if (minutes === 0) return hours === 1 ? "१ घंटा" : `${hours} घंटे`;
    return `${hours} घंटे ${minutes} मिनट`;
  }
  if (lang === "fr") {
    if (totalMin < 60) return `${totalMin} min`;
    const hours = Math.floor(totalMin / 60);
    const minutes = totalMin % 60;
    if (minutes === 0) return `${hours} h`;
    return `${hours} h ${minutes} min`;
  }
  if (lang === "te") {
    if (totalMin < 60) return `${totalMin} నిమిషాలు`;
    const hours = Math.floor(totalMin / 60);
    const minutes = totalMin % 60;
    if (minutes === 0) return hours === 1 ? "1 గంట" : `${hours} గంటలు`;
    return `${hours} గంటల ${minutes} నిమిషాలు`;
  }
  if (lang === "am") {
    if (totalMin < 60) return `${totalMin} ደቂቃ`;
    const hours = Math.floor(totalMin / 60);
    const minutes = totalMin % 60;
    if (minutes === 0) return `${hours} ሰዓት`;
    return `${hours} ሰዓት ${minutes} ደቂቃ`;
  }
  if (totalMin < 60) return `${totalMin} min`;
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  if (minutes === 0) return hours === 1 ? "1 hr" : `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}

export function formatBreaksPerSessionLabel(count: number, lang: Lang = "en"): string {
  const n = Math.max(0, Math.floor(count));
  if (lang === "bn") {
    if (n === 0) return "প্রতি পালায় কোনো বিরতি নেই";
    return n === 1 ? "প্রতি পালায় ১টি বিরতি" : `প্রতি পালায় ${n}টি বিরতি`;
  }
  if (lang === "hi") {
    if (n === 0) return "प्रति सत्र कोई ब्रेक नहीं";
    return n === 1 ? "प्रति सत्र १ ब्रेक" : `प्रति सत्र ${n} ब्रेक`;
  }
  if (lang === "fr") {
    if (n === 0) return "Aucune pause par session";
    return n === 1 ? "1 pause par session" : `${n} pauses par session`;
  }
  if (lang === "te") {
    if (n === 0) return "ఒక్కో విడతకు విరామం లేదు";
    return n === 1 ? "ఒక్కో విడతకు 1 విరామం" : `ఒక్కో విడతకు ${n} విరామాలు`;
  }
  if (lang === "am") {
    if (n === 0) return "በአንድ ዙር ዕረፍት የለም";
    return n === 1 ? "በአንድ ዙር 1 ዕረፍት" : `በአንድ ዙር ${n} ዕረፍቶች`;
  }
  if (n === 0) return "No breaks per session";
  return n === 1 ? "1 break per session" : `${n} breaks per session`;
}

export function formatSessionDetailLine(
  sessionCount: number,
  breaksPerSession: number,
  lang: Lang = "en",
): string {
  const sessions = formatSessionCountLabel(sessionCount, lang);
  const duration = formatTotalSessionDuration(sessionCount, SESSION_DURATION_MINUTES, lang);
  const breaks = formatBreaksPerSessionLabel(breaksPerSession, lang);
  // bn and hi used to share this branch, so Hindi showed the Bengali "এবং".
  if (lang === "bn") {
    return `${sessions} (${duration}) এবং ${breaks}`;
  }
  if (lang === "hi") {
    return `${sessions} (${duration}) और ${breaks}`;
  }
  if (lang === "fr") {
    return `${sessions} (${duration}) et ${breaks}`;
  }
  if (lang === "te") {
    return `${sessions} (${duration}) మరియు ${breaks}`;
  }
  if (lang === "am") {
    return `${sessions} (${duration}) እና ${breaks}`;
  }
  return `${sessions} (${duration}) and ${breaks}`;
}

/** Compact chip for cards: "3 sessions · 2 breaks/session" */
export function formatSessionBreaksChip(
  sessionCount: number,
  breaksPerSession: number,
  lang: Lang = "en",
): string {
  const sessions = formatSessionCountLabel(sessionCount, lang);
  if (breaksPerSession <= 0) return sessions;
  const n = Math.floor(breaksPerSession);
  if (lang === "bn") {
    const breaks = n === 1 ? "১ বিরতি/পালা" : `${n} বিরতি/পালা`;
    return `${sessions} · ${breaks}`;
  }
  if (lang === "hi") {
    const breaks = n === 1 ? "१ ब्रेक/सत्र" : `${n} ब्रेक/सत्र`;
    return `${sessions} · ${breaks}`;
  }
  if (lang === "fr") {
    const breaks = n === 1 ? "1 pause/session" : `${n} pauses/session`;
    return `${sessions} · ${breaks}`;
  }
  if (lang === "te") {
    const breaks = n === 1 ? "1 విరామం/విడత" : `${n} విరామాలు/విడత`;
    return `${sessions} · ${breaks}`;
  }
  if (lang === "am") {
    const breaks = n === 1 ? "1 ዕረፍት/ዙር" : `${n} ዕረፍቶች/ዙር`;
    return `${sessions} · ${breaks}`;
  }
  const breaks = n === 1 ? "1 break/session" : `${n} breaks/session`;
  return `${sessions} · ${breaks}`;
}

export function formatSessionOfTotal(current: number, total: number): string {
  return `Session ${current} of ${total}`;
}

/** Timer header when timing is scoped to a checklist subtask. */
export function formatSubtaskSessionLabel(
  subtaskTitle: string,
  current: number,
  total: number,
  breaksRemaining?: number,
  breaksAllowed?: number,
): string {
  const base = `${subtaskTitle} · ${formatSessionOfTotal(current, total)}`;
  if (typeof breaksRemaining === "number" && typeof breaksAllowed === "number" && breaksAllowed > 0) {
    return `${base} · Breaks ${breaksRemaining}/${breaksAllowed}`;
  }
  return base;
}

/** Rollup line for tasks with per-subtask timing. */
export function formatTimingRollupLabel(
  subtaskCount: number,
  totalSessions: number,
  totalSeconds: number,
  lang: Lang = "en",
): string {
  const duration = formatDurationLabel(totalSeconds);
  if (lang === "bn") {
    return `${subtaskCount}টি উপ-কাজ · ${totalSessions}টি পালা · ${duration} মোট`;
  }
  if (lang === "hi") {
    return `${subtaskCount} उप-कार्य · ${totalSessions} सत्र · ${duration} कुल`;
  }
  if (lang === "fr") {
    const subtasks = subtaskCount === 1 ? "1 sous-tâche" : `${subtaskCount} sous-tâches`;
    const sessions = totalSessions === 1 ? "1 session" : `${totalSessions} sessions`;
    return `${subtasks} · ${sessions} · ${duration} au total`;
  }
  if (lang === "te") {
    const subtasks = subtaskCount === 1 ? "1 ఉప పని" : `${subtaskCount} ఉప పనులు`;
    const sessions = totalSessions === 1 ? "1 విడత" : `${totalSessions} విడతలు`;
    return `${subtasks} · ${sessions} · ${duration} మొత్తం`;
  }
  if (lang === "am") {
    const subtasks = subtaskCount === 1 ? "1 ንዑስ ሥራ" : `${subtaskCount} ንዑስ ሥራዎች`;
    const sessions = totalSessions === 1 ? "1 ዙር" : `${totalSessions} ዙሮች`;
    return `${subtasks} · ${sessions} · በጠቅላላ ${duration}`;
  }
  const subtasks = subtaskCount === 1 ? "1 subtask" : `${subtaskCount} subtasks`;
  const sessions = totalSessions === 1 ? "1 session" : `${totalSessions} sessions`;
  return `${subtasks} · ${sessions} · ${duration} total`;
}

export function formatSegmentPreview(plan: SegmentPlanDisplay, lang: Lang = "en"): string {
  const n = plan.segment_count;
  const per = formatDurationLabel(plan.segment_durations_seconds[0] ?? SESSION_DURATION_SECONDS);
  if (lang === "bn") {
    if (n === 1) return `১টি পালা · ${per}`;
    return `${n}টি পালা · প্রতিটি ${per}`;
  }
  if (lang === "hi") {
    if (n === 1) return `१ सत्र · ${per}`;
    return `${n} सत्र · प्रत्येक ${per}`;
  }
  if (lang === "fr") {
    if (n === 1) return `1 session · ${per}`;
    return `${n} sessions · ${per} chacune`;
  }
  if (lang === "te") {
    if (n === 1) return `1 విడత · ${per}`;
    return `${n} విడతలు · ప్రతి విడత ${per}`;
  }
  if (lang === "am") {
    if (n === 1) return `1 ዙር · ${per}`;
    return `${n} ዙሮች · እያንዳንዱ ${per}`;
  }
  if (n === 1) return `1 session · ${per}`;
  return `${n} sessions · ${per} each`;
}

export function formatIntervalLabel(seconds: number, segmentIndex: number, segmentCount: number): string {
  const duration = formatDurationLabel(seconds);
  if (segmentCount <= 1) return `${duration} session`;
  return `${duration} · ${formatSessionOfTotal(segmentIndex, segmentCount)}`;
}

/** Seconds for the given session index (1-based). Server should always send 2700. */
export function sessionDurationSeconds(
  segmentIndex: number,
  plan?: SegmentPlanDisplay | null,
): number {
  const idx = Math.max(0, segmentIndex - 1);
  const fromPlan = plan?.segment_durations_seconds?.[idx];
  if (typeof fromPlan === "number" && fromPlan > 0) return fromPlan;
  return SESSION_DURATION_SECONDS;
}
