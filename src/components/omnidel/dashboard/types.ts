import { formatCompactInr } from "@/lib/inr";
import { humanizeSlug } from "@/components/omnidel/table-ui";
import { IST_TZ } from "@/lib/ist";

/**
 * Admin-dashboard view models and their empty values.
 *
 * Extracted from admin/dashboard/page.tsx when that screen was split into five
 * tab files — each tab needs the same shapes, and the per-tab API routes return
 * subsets of them. Field names mirror the service layer exactly so a payload can
 * be spread straight in.
 */

export const DAYS_MAP: Record<string, number> = { "1d": 1, "7d": 7, "30d": 30, "90d": 90 };

/** Sentinel for the dropdown's custom entry; a chosen date becomes `since:ISO`. */
export const CUSTOM_PERIOD = "custom";

/** Preset windows offered by the period dropdown, plus the custom escape hatch. */
export const PERIOD_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "1d", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: CUSTOM_PERIOD, label: "Since a date…" },
];

/** Longest window the API accepts — every route clamps `days` to 1..90. */
export const MAX_WINDOW_DAYS = 90;

/**
 * Resolve a range token to a day count and a human label.
 *
 * A custom window is encoded as `since:YYYY-MM-DD` rather than a from–to pair on
 * purpose: every aggregate behind this dashboard — the analytics services and all
 * six RPCs in 20260873000000 — is defined as "the last N days from now". Offering
 * an arbitrary end date would mean rendering a number that does not match the
 * window shown beside it. "Since a date" is the widest honest choice, so the
 * dropdown says exactly that.
 */
export function resolveWindow(range: string): {
  days: number; label: string; since?: string;
  /** True when the requested window was wider than the API's 90-day ceiling. */
  clamped: boolean;
} {
  const custom = /^since:(\d{4}-\d{2}-\d{2})$/.exec(range || "");
  if (custom) {
    // Anchored to IST midnight, not the viewer's midnight. Every other date on
    // this dashboard is an IST calendar date (migration 20260876000000), so a
    // viewer in another timezone must still get the same window — and the label
    // must name the same day the window actually starts on.
    const from = new Date(`${custom[1]}T00:00:00+05:30`);
    const raw = Math.ceil((Date.now() - from.getTime()) / 86400000);
    const days = Math.max(1, Math.min(MAX_WINDOW_DAYS, raw));
    const shown = from.toLocaleDateString(undefined, {
      day: "numeric", month: "short", year: "numeric", timeZone: IST_TZ,
    });
    // Say so when the 90-day API ceiling moved the window the user asked for.
    const clamped = raw > MAX_WINDOW_DAYS;
    return {
      days,
      since: custom[1],
      clamped,
      label: clamped ? `last ${MAX_WINDOW_DAYS} days (capped)` : `since ${shown}`,
    };
  }
  const days = DAYS_MAP[range] ?? 7;
  return { days, clamped: false, label: days === 1 ? "last 24 hours" : `last ${days} days` };
}

export interface AppUsage {
  totalUsers: number; activeUsers: number; dailyActiveUsers: number;
  weeklyActiveUsers: number; monthlyActiveUsers: number; adminActions: number;
  /** Seen inside the selected window — the one that moves with the period. */
  activeInWindow: number;
}
export interface Pipeline {
  totalLeads: number; leadsNew: number; leadsWon: number; leadsLost: number;
  totalValueWon: number; leadsCreatedPeriod: number; conversionRate: number;
}
export interface Ops {
  tasksOpen: number; tasksInProgress: number; tasksDone: number; tasksBlocked: number;
  totalInvoiceAmount: number; paidAmount: number; overdueInvoices: number;
  visitsScheduled: number; visitsCompleted: number;
}
export interface RecentLogin {
  id: string; name: string; phone: string; role_name: string;
  last_seen_on: string; team_name: string | null;
}
export interface AdminAction {
  id: string; actor_name: string; action: string; target_table: string; created_on: string;
}
export interface LeadByStage { stage: string; count: number }
export interface DayPoint { day: string; value: number }
export interface NamedCount { label: string; count: number }
export interface TasksAnalytics {
  open: number; inProgress: number; done: number; blockedTracked: false; overdue: number;
  completionRate: number; completedByDay: DayPoint[]; ratioAnomaly: boolean;
  /** Completed inside the window. `done` is all-time and must never be shown
   *  under a windowed label — that bug read 243 when the truth was 129. */
  doneInWindow: number;
  /** userId lets each row link to that person's tasks; null for "Unassigned". */
  openByAssignee: Array<NamedCount & { userId: string | null }>;
  /** "hour" on a 1-day window; the chart title must follow it, not assume days. */
  completedBucket: "hour" | "day";
}
export interface StudioAnalytics {
  generations: number; assets: number; projects: number; creators: number;
  generationsByDay: DayPoint[]; typeMix: NamedCount[];
  topCreators: Array<NamedCount & { costUsd: number }>;
}
export interface TeamCount { team: string; members: number }
export interface AcharyaTaskLearning {
  chatTurns: number; quizAttempts: number; quizPassed: number; passRate: number;
  submissions: number; approved: number; pendingReview: number;
}
export interface ModuleCost { costUsd: number; eventCount: number }
export interface AiCost {
  omnivarsity: ModuleCost; tasks: ModuleCost; omnistudio: ModuleCost;
  totalUsd: number; exact: boolean; notes: string[];
}

/**
 * Counts behind the header's attention bell. Mirrors getAttentionCounts().
 *
 * Note this does not carry `ratioAnomaly`: computing it needs a count across all
 * live tasks, which is too expensive to pay on every tab. It stays on the
 * Dashboard tab next to the open/done figures it refers to.
 */
export interface AttentionCounts {
  overdue: number;
  pendingReview: number;
  zeroCost: number;
}

/** Grade band from fn_admin_score_distribution. */
export interface ScoreBand { band: string; sort_order: number; n: number; zero_cost_n: number }

/** Score rollup from fn_admin_score_summary. */
export interface ScoreSummary {
  evaluations: number;
  scored_evaluations: number;
  excluded_zero_cost: number;
  avg_acharya_score: number | null;
  avg_final_score: number | null;
  pending_review: number;
  reviewed: number;
  cost_usd: number;
}

/** Per-acharya task throughput from fn_admin_tasks_by_acharya. */
export interface AcharyaTaskCounts {
  acharya_id: string; display_name: string;
  created_count: number; completed_count: number; open_count: number;
}

/**
 * KarmYog task work per person (getKarmYogTaskPeople).
 *
 * `open` is current-state, `doneInWindow` is windowed — the table labels both,
 * because two different windows in one unlabelled row is how a dashboard misleads.
 */
export interface KarmYogPerson {
  user_id: string; name: string;
  /** planned and doing are current state; doneInWindow is windowed. */
  planned: number; doing: number; doneInWindow: number;
}

/** Per-person authorship from fn_admin_tasks_created_by_user / leads_by_user. */
export interface UserNamedCount { user_id: string; name: string; count: number }
export interface UserLeadCounts { user_id: string; name: string; created_count: number; touched_count: number }

/**
 * MahAcharya chat-quality triage, from chat-sentiment.ts's getChatSentimentStats.
 * Field names mirror the service exactly — see that file's ChatSentimentStats.
 */
export interface ChatSentimentStats {
  totalAnalyzed: number;
  positive: number;
  neutral: number;
  negative: number;
  qualityGood: number;
  qualityAdequate: number;
  qualityPoor: number;
  needsReview: number;
}

/**
 * Which bucket of scored conversations to list — mirrors chat-sentiment.ts's
 * own type exactly (duplicated per this file's convention: client-safe view
 * models never import from a "server-only" service file). One stat card on
 * the Chat Sentiment page maps to each value.
 */
export type SentimentFilter = "all" | "positive" | "neutral" | "negative" | "needs_review";

/** One flagged (negative sentiment OR poor quality) conversation — the drill-down row. */
export interface FlaggedConversation {
  id: string;
  threadId: string;
  userId: string;
  userName: string;
  title: string;
  userSentiment: "positive" | "neutral" | "negative";
  sentimentScore: number;
  responseQuality: "good" | "adequate" | "poor";
  resolved: boolean | null;
  summary: string;
  flaggedReason: string | null;
  lastMessageAt: string;
  analyzedAt: string;
}

export const EMPTY_APP_USAGE: AppUsage = { totalUsers: 0, activeUsers: 0, activeInWindow: 0, dailyActiveUsers: 0, weeklyActiveUsers: 0, monthlyActiveUsers: 0, adminActions: 0 };
export const EMPTY_PIPELINE: Pipeline = { totalLeads: 0, leadsNew: 0, leadsWon: 0, leadsLost: 0, totalValueWon: 0, leadsCreatedPeriod: 0, conversionRate: 0 };
export const EMPTY_OPS: Ops = { tasksOpen: 0, tasksInProgress: 0, tasksDone: 0, tasksBlocked: 0, totalInvoiceAmount: 0, paidAmount: 0, overdueInvoices: 0, visitsScheduled: 0, visitsCompleted: 0 };
export const EMPTY_TASKS: TasksAnalytics = { open: 0, inProgress: 0, done: 0, blockedTracked: false, overdue: 0, doneInWindow: 0, completionRate: 0, completedByDay: [], completedBucket: "day", openByAssignee: [], ratioAnomaly: false };
export const EMPTY_STUDIO: StudioAnalytics = { generations: 0, assets: 0, projects: 0, creators: 0, generationsByDay: [], typeMix: [], topCreators: [] };
export const EMPTY_ACHARYA: AcharyaTaskLearning = { chatTurns: 0, quizAttempts: 0, quizPassed: 0, passRate: 0, submissions: 0, approved: 0, pendingReview: 0 };
export const EMPTY_COST: AiCost = { omnivarsity: { costUsd: 0, eventCount: 0 }, tasks: { costUsd: 0, eventCount: 0 }, omnistudio: { costUsd: 0, eventCount: 0 }, totalUsd: 0, exact: true, notes: [] };
export const EMPTY_SCORE_SUMMARY: ScoreSummary = { evaluations: 0, scored_evaluations: 0, excluded_zero_cost: 0, avg_acharya_score: null, avg_final_score: null, pending_review: 0, reviewed: 0, cost_usd: 0 };
export const EMPTY_CHAT_SENTIMENT: ChatSentimentStats = { totalAnalyzed: 0, positive: 0, neutral: 0, negative: 0, qualityGood: 0, qualityAdequate: 0, qualityPoor: 0, needsReview: 0 };

/**
 * Compact rupees, delegated to the app-wide helper.
 *
 * This used to hand-roll lakh/thousand formatting, which meant the dashboard
 * could disagree with every other screen on how ₹1,00,000 is written. The
 * pre-restructure page imported `formatCompactInr`; this restores that. It also
 * handles negatives and absurd magnitudes, which the local version did not.
 */
export function formatInr(v: number) {
  return formatCompactInr(v, { kFractionDigits: 0 });
}
export function formatUsd(v: number) { return `$${v.toFixed(2)}`; }

/**
 * Task ratings out of 10, which is how the rest of the app speaks.
 *
 * `ops_task_evaluations.acharya_score` / `final_score` are stored 0–1 (the
 * evaluator's Zod schema bounds them that way), but every user-facing surface
 * uses /10 — `approveReview` even posts a task note reading "Score approved:
 * X/10". Rendering the raw 0–1 value on the dashboard made 5.2/10 look like 0.52.
 *
 * Quiz scores are NOT converted: log_task_quiz_attempts stores raw points with a
 * separate `total`, so they are already on their own scale.
 */
export function formatRating(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return (v * 10).toFixed(1);
}

/** Grade bands relabelled for the /10 scale the app uses. Keyed by the SQL
 *  function's stable sort_order so the numbers stay owned by one place. */
export const BAND_LABELS_OUT_OF_TEN: Record<number, string> = {
  0: "Not scored",
  1: "0 — failed to run",
  2: "0.1 – 3.9",
  3: "4.0 – 6.9",
  4: "7.0 – 10",
};
/**
 * Coarse "how long ago" label.
 *
 * Accepts null because two of its three former copies did: the dashboard's own
 * version took `string` while `users/page.tsx` and `users/[userId]/page.tsx` each
 * kept a near-identical local one that returned "Never" for a user who has never
 * signed in. Widened here and the duplicates deleted, so all three agree.
 */
export function timeAgo(ts: string | null | undefined) {
  if (!ts) return "Never";
  const mins = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}
/**
 * Pipeline stage slug → readable label.
 *
 * Delegates to the shared `humanizeSlug`, which also handles hyphens and — the
 * reason this changed — returns a dash for an empty or null slug instead of the
 * empty string this used to render as a blank cell.
 */
export function stageLabel(s: string) {
  return humanizeSlug(s);
}
