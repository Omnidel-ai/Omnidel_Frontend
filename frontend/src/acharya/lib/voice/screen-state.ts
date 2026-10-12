/**
 * Which screen the karigar is looking at, from the URL — for voice tool results.
 *
 * Every navigation tool used to answer `{ ok: true }` and nothing else. The
 * model's picture of where the karigar stood was whatever "(context: …)" notes
 * happened to arrive, and those differ per handler and per surface — so the
 * same request got a different answer depending on which note the model last
 * read, and it announced moves that never happened. QA's "inconsistent handling"
 * and "already on the task list" findings are both this.
 *
 * Now every navigating handler returns `now_showing` built here, and the prompt
 * tells the model to trust it over its own memory. One function, one vocabulary,
 * shared by the acharya shell, the home guide and the Profile/Settings handlers.
 *
 * ISOMORPHIC on purpose — no `window`, no React — so the shell can call it with
 * `window.location` and scripts/verify-voice-tools.ts can call it with strings.
 */

import { normalizeProfileTab, normalizeSettingsSection, profileTabFromParam } from "@/acharya/lib/voice-nav-targets";
import { laneFromTab } from "@/acharya/lib/lane-ids";

export type VoiceScreen =
  | "home"
  | "task_list"
  | "task"
  | "learn"
  | "timer"
  | "all_tasks"
  | "profile"
  | "settings"
  | "other";

export interface ScreenState {
  screen: VoiceScreen;
  /** Spoken-friendly one-liner the model can repeat: "the task list", "a task". */
  label: string;
  acharyaSlug?: string;
  taskId?: string;
  /** Learn tab / Profile tab / Settings section, when the URL names one. */
  tab?: string;
}

const LABELS: Record<VoiceScreen, string> = {
  home: "the app Home — the list of all Acharyas",
  task_list: "this Acharya's task list",
  task: "a task's detail",
  learn: "a task's learning tabs",
  timer: "the running work timer",
  all_tasks: "the all-tasks page",
  profile: "their Profile",
  settings: "Settings",
  other: "another screen",
};

export function describeScreen(pathname: string, search = ""): ScreenState {
  const path = trimTrailingSlash(pathname || "/");
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const seg = path.split("/").filter(Boolean).map(safeDecode);

  if (seg[0] === "acharyas") {
    if (seg.length === 1) return { screen: "home", label: LABELS.home };
    const acharyaSlug = seg[1];
    if (seg.length === 2) {
      // The board's lane rides in `?tab=` (todo / doing / review / done), so
      // "already there" can tell Planned from Done.
      const lane = laneFromTab(params.get("tab"));
      return {
        screen: "task_list",
        label: lane ? `this Acharya's task list, ${lane} lane` : LABELS.task_list,
        acharyaSlug,
        ...(lane ? { tab: lane } : null),
      };
    }
    if (seg[2] === "tasks" && seg[3]) {
      const taskId = seg[3];
      if (seg[4] === "learn") {
        const tab = params.get("tab") ?? undefined;
        return { screen: "learn", label: LABELS.learn, acharyaSlug, taskId, ...(tab ? { tab } : null) };
      }
      if (seg[4] === "active") return { screen: "timer", label: LABELS.timer, acharyaSlug, taskId };
      const tab = params.get("tab") ?? undefined;
      return { screen: "task", label: LABELS.task, acharyaSlug, taskId, ...(tab ? { tab } : null) };
    }
    return { screen: "other", label: LABELS.other, acharyaSlug };
  }

  if (seg[0] === "tasks") {
    // Legacy un-nested task routes still exist as redirects; describe them the
    // same way so a tool result never says "another screen" for a task.
    if (seg[1]) {
      const taskId = seg[1];
      if (seg[2] === "learn") return { screen: "learn", label: LABELS.learn, taskId };
      if (seg[2] === "active") return { screen: "timer", label: LABELS.timer, taskId };
      return { screen: "task", label: LABELS.task, taskId };
    }
    return { screen: "all_tasks", label: LABELS.all_tasks };
  }

  if (path === "/profile") {
    // A bare /profile shows Report (see profileHref) — say which tab is really up.
    const tab = normalizeProfileTab(params.get("tab")) ?? profileTabFromParam(params.get("tab"));
    return { screen: "profile", label: `their Profile, ${tab} tab`, tab };
  }

  if (path === "/settings" || path === "/profile/settings") {
    const section = normalizeSettingsSection(params.get("section"));
    return {
      screen: "settings",
      label: section ? `Settings, at ${section.replace(/_/g, " ")}` : LABELS.settings,
      ...(section ? { tab: section } : null),
    };
  }

  return { screen: "other", label: LABELS.other };
}

function trimTrailingSlash(p: string): string {
  return p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p;
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
