/**
 * Jev beside Gemini at the moment the karigar asks for something — voice and
 * chat. The rules only: no network, no React, no env reads, so the whole policy
 * is checked by `npm run verify:jev-action` without a browser or a key.
 *
 *   karigar speaks / types
 *        │
 *        ├── Gemini (Live voice, or the chat model) answers and may call a tool
 *        └── Jev (through OmniDel /api/ai/decide) picks ONE action, with a confidence
 *
 * JEV_ACTION_MODE (agreed with Shubham, 2026-09-28):
 *
 *   off     Gemini only. Jev is never called.
 *   shadow  Gemini decides and acts. Jev's pick is logged beside it.
 *   fast    Jev decides the SIMPLE screen moves (the per-surface list below)
 *           and the app acts the moment Jev answers — it does not wait for
 *           Gemini. When Gemini asks for one of those moves, the call is
 *           logged, not performed. Everything that needs details Jev cannot
 *           give (which task, which tab, which Acharya, proof text, quiz
 *           answers, lookups) stays with Gemini in every mode.
 *
 * `fast` degrades to today's behaviour, never to a dead end: if Jev did not
 * answer (gateway down, timed out) or answered below the confidence threshold,
 * Gemini's call for that move runs exactly as it would in `off`.
 *
 * Every turn in shadow and fast writes one row to gunakul.log_jev_decisions,
 * with both picks and the timings of both, so the comparison is a SQL query.
 */

import { ACTION_TOOLS, ACTION_TOOL_CRITERIA, type ActionTool } from "./action-decision";

export { ACTION_TOOLS, type ActionTool } from "./action-decision";

export const JEV_ACTION_MODES = ["off", "shadow", "fast"] as const;
export type JevActionMode = (typeof JEV_ACTION_MODES)[number];

/** Anything unrecognised — including the retired `on` — is off. */
export function parseJevActionMode(raw: string | undefined | null): JevActionMode {
  const value = (raw || "").trim().toLowerCase();
  if (value === "fast") return "fast";
  if (value === "shadow") return "shadow";
  return "off";
}

/**
 * Where the request was made. Each surface offers the karigar a different set
 * of actions, and Jev is only ever shown the ones that exist there — asking it
 * to choose `take_break` on the home screen would invite an answer the screen
 * cannot act on.
 */
export const JEV_SURFACES = ["voice_acharya", "voice_home", "chat_board", "chat_home"] as const;
export type JevSurface = (typeof JEV_SURFACES)[number];

export function isJevSurface(value: unknown): value is JevSurface {
  return typeof value === "string" && (JEV_SURFACES as readonly string[]).includes(value);
}

export function channelOf(surface: JevSurface): "voice" | "chat" {
  return surface.startsWith("voice") ? "voice" : "chat";
}

/** Actions Jev may choose from, per surface. `none` is always an option. */
const SURFACE_OPTIONS: Record<JevSurface, readonly ActionTool[]> = {
  // Per-acharya Gemini Live session binds the union of every screen's tools.
  voice_acharya: ACTION_TOOLS,
  // buildHomeNavToolDeclarations.
  voice_home: [
    "open_profile",
    "open_settings",
    "open_acharya",
    "open_task_list",
    "go_home",
    "go_back",
    "end_conversation",
    "none",
  ],
  // Board / task chat has no navigation tools; Jev's pick is recorded to show
  // what the karigar asked for, never acted on (see JEV_OWNED.chat_board).
  chat_board: ACTION_TOOLS,
  // handleHomeNavChat's navTools.
  chat_home: ["open_profile", "open_settings", "open_acharya", "go_home", "none"],
};

/**
 * The moves Jev OWNS in `fast` mode (Shubham, 2026-09-28): simple screen moves
 * that need no argument and only open a screen or a sheet the karigar can back
 * out of. Jev picks an action, not a task id, a tab or a slug, so open_task /
 * switch_tab / open_acharya / set_proof_text stay with Gemini; so do start_task
 * (starts the timer), create_quiz (generates one), end_conversation (drops the
 * mic) and get_task_details (a lookup, not a move).
 */
const JEV_OWNED: Record<JevSurface, readonly ActionTool[]> = {
  voice_acharya: [
    "open_task_list",
    "open_learn",
    "open_chat",
    "take_break",
    "open_complete",
    "show_proof_text_tab",
    "show_proof_image_tab",
    "open_profile",
    "open_settings",
    "go_home",
    "go_back",
  ],
  // open_task_list needs acharya_slug on home; go_back there is go_home.
  voice_home: ["open_profile", "open_settings", "go_home"],
  // Board / task chat cannot navigate today (no <<NAV|…>> parser there).
  chat_board: [],
  // HomeMahAcharyaChat's NAV_RX understands these without an argument.
  chat_home: ["open_profile", "open_settings", "go_home"],
};

export function jevOptionsFor(surface: JevSurface): readonly ActionTool[] {
  return SURFACE_OPTIONS[surface];
}

export function jevOwnedActions(surface: JevSurface): readonly ActionTool[] {
  return JEV_OWNED[surface];
}

export function isJevOwned(surface: JevSurface, tool: string): boolean {
  return (JEV_OWNED[surface] as readonly string[]).includes(tool);
}

/** `criteria` for Jev's choice question on this surface. */
export function jevCriteriaFor(surface: JevSurface): Record<string, string> {
  const out: Record<string, string> = {};
  for (const tool of SURFACE_OPTIONS[surface]) out[tool] = ACTION_TOOL_CRITERIA[tool];
  return out;
}

export const JEV_ACTION_INSTRUCTIONS =
  "The karigar (a field worker) just said or typed the message below while on the screen named. " +
  "Pick the ONE app action that carries out what they are asking for right now. " +
  "Pick none when they are chatting, greeting, answering a question, or asking something factual rather than asking the app to do something.";

/**
 * Tool names Gemini (voice) and the chat model use, mapped onto Jev's action
 * vocabulary. Tools that are not app actions — memory lookups, quiz answers,
 * the chat-only status/note tools, the language switch — count as `none`:
 * the model treated the turn as conversation, which is exactly what Jev's
 * `none` means.
 */
const MODEL_TOOL_ALIASES: Record<string, ActionTool> = {
  // Retired voice tool, still callable by a session minted before 2026-08-20.
  open_msme_requests: "open_profile",
  // Chat's name for the same lookup.
  get_task_detail: "get_task_details",
};

export function toActionTool(modelToolName: string): ActionTool {
  const name = (modelToolName || "").trim();
  if (Object.prototype.hasOwnProperty.call(MODEL_TOOL_ALIASES, name)) return MODEL_TOOL_ALIASES[name];
  if ((ACTION_TOOLS as readonly string[]).includes(name)) return name as ActionTool;
  return "none";
}

/** The action a model's turn amounts to: its first app action, else none. */
export function modelActionOf(modelToolNames: readonly string[]): ActionTool {
  for (const name of modelToolNames) {
    const action = toActionTool(name);
    if (action !== "none") return action;
  }
  return "none";
}

/** Human-readable screen for Jev's state, from the path the karigar is on. */
export function describeScreen(pathname: string | null | undefined): string {
  const path = (pathname || "").split("?")[0].replace(/\/+$/, "") || "/";
  if (path === "/" || path === "/acharyas") return "Home: the list of all Acharyas";
  if (path === "/profile/settings") return "Settings";
  if (path.startsWith("/profile")) return "Profile";
  if (/^\/acharyas\/[^/]+\/tasks\/[^/]+\/active$/.test(path)) return "Running work timer for a task";
  if (/^\/acharyas\/[^/]+\/tasks\/[^/]+\/learn$/.test(path)) return "Learn view of a task";
  if (/^\/acharyas\/[^/]+\/tasks\/[^/]+$/.test(path)) return "Task detail";
  if (/^\/acharyas\/[^/]+$/.test(path)) return "One Acharya's task board";
  if (path.startsWith("/tasks")) return "All tasks list";
  return path;
}

const MAX_USER_TEXT = 1_000;

/** Jev's `state`: the screen and the words, nothing else. Null when there is nothing to decide. */
export function buildJevActionState(screen: string, userText: string): string | null {
  const text = (userText || "").replace(/\s+/g, " ").trim().slice(0, MAX_USER_TEXT);
  if (!text) return null;
  return `Screen: ${screen || "unknown"}\nKarigar said: "${text}"`;
}

export interface JevAnswer {
  tool: ActionTool;
  confidence: number;
  /** OmniDel /api/ai/decide round trip, as the Acharya server measured it. */
  latencyMs: number;
  probabilities?: Record<string, number>;
  /** Exact model/version the gateway reports it ran (e.g. typesafe/jev-1.13). */
  model?: string | null;
}

export function isConfident(jev: JevAnswer | null, threshold: number): jev is JevAnswer {
  return Boolean(jev) && (jev as JevAnswer).confidence >= threshold;
}

/**
 * fast: the move the app should make the moment Jev answers, or null.
 * Only a confident pick of a Jev-owned move acts.
 */
export function jevMoveNow(input: {
  mode: JevActionMode;
  surface: JevSurface;
  threshold: number;
  jev: JevAnswer | null;
}): ActionTool | null {
  if (input.mode !== "fast" || !isConfident(input.jev, input.threshold)) return null;
  return isJevOwned(input.surface, input.jev.tool) ? input.jev.tool : null;
}

export type ModelCallReason =
  | "jev_pending"
  | "turn_cancelled"
  /** Not fast mode, or not a move Jev owns: Gemini's call runs as always. */
  | "gemini_owns"
  /** fast, but Jev did not answer: Gemini's call runs (fallback). */
  | "jev_unavailable"
  /** fast, but Jev was below the threshold: Gemini's call runs (fallback). */
  | "jev_unsure"
  /** fast: Jev already made this same move. */
  | "jev_did_same"
  /** fast: Jev made a different move. */
  | "jev_did_other"
  /** fast: Jev was confident no simple move was wanted. */
  | "jev_declined";

export interface ModelCallDecision {
  run: boolean;
  reason: ModelCallReason;
  /** When run is false: what the model is told instead of the handler's result. */
  reply?: { ok: boolean } & Record<string, unknown>;
}

/**
 * fast: what happens to ONE tool call Gemini (or the chat model) made. The
 * reply is worded for the model, because it will speak next and must not claim
 * a move the app did not make.
 */
export function decideModelCall(input: {
  mode: JevActionMode;
  surface: JevSurface;
  threshold: number;
  /** Jev's answer, or null when it did not answer at all. */
  jev: JevAnswer | null;
  tool: string;
}): ModelCallDecision {
  if (input.mode !== "fast" || !isJevOwned(input.surface, input.tool)) {
    return { run: true, reason: "gemini_owns" };
  }
  if (!input.jev) return { run: true, reason: "jev_unavailable" };
  if (!isConfident(input.jev, input.threshold)) return { run: true, reason: "jev_unsure" };

  const jevTool = input.jev.tool;
  if (jevTool === input.tool) {
    return {
      run: false,
      reason: "jev_did_same",
      reply: { ok: true, already_done: true, note: "The app has already done this for the karigar. Do not call it again." },
    };
  }
  if (isJevOwned(input.surface, jevTool)) {
    return {
      run: false,
      reason: "jev_did_other",
      reply: {
        ok: true,
        not_done: true,
        app_did: jevTool,
        note: `The app did ${jevTool} instead of ${input.tool}. Say only what the app did; do not claim ${input.tool}.`,
      },
    };
  }
  return {
    run: false,
    reason: "jev_declined",
    reply: {
      ok: false,
      error: "not_performed",
      note: "The app did not make this move. Do not tell the karigar you did it; answer them in words instead.",
    },
  };
}

export type ExecutedBy = "gemini" | "jev" | "gemini_fallback" | "none";

/** One Gemini tool call as it played out in the turn. */
export interface ModelCallRecord {
  name: string;
  /** Epoch ms the call arrived. */
  at: number;
  run: boolean;
  reason: ModelCallReason;
  /** Exact Gemini model that made the call. */
  model?: string | null;
  /** How long the app's handler took, when it ran (voice). */
  handlerMs?: number | null;
  /** Whether the handler reported ok, when it ran (voice). */
  ok?: boolean | null;
}

/**
 * Who actually moved the karigar this turn, and to what. The first move made
 * counts — in fast mode Jev's own move, else the first Gemini call that ran
 * and was an app action.
 */
export function whoExecuted(input: {
  jevMoved: ActionTool | null;
  modelCalls: readonly ModelCallRecord[];
}): { executedBy: ExecutedBy; executedAction: ActionTool | null } {
  if (input.jevMoved) return { executedBy: "jev", executedAction: input.jevMoved };
  for (const call of input.modelCalls) {
    const action = toActionTool(call.name);
    if (!call.run || action === "none") continue;
    const fallback = call.reason === "jev_unavailable" || call.reason === "jev_unsure";
    return { executedBy: fallback ? "gemini_fallback" : "gemini", executedAction: action };
  }
  return { executedBy: "none", executedAction: null };
}

/** Coerce an untrusted `{tool, confidence, latencyMs, probabilities}` (from JSON) to a JevAnswer. */
export function parseJevAnswer(raw: unknown, surface: JevSurface): JevAnswer | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.tool !== "string") return null;
  if (!SURFACE_OPTIONS[surface].includes(r.tool as ActionTool)) return null;
  const confidence = typeof r.confidence === "number" && Number.isFinite(r.confidence) ? r.confidence : 0;
  const latencyMs = typeof r.latencyMs === "number" && Number.isFinite(r.latencyMs) ? r.latencyMs : 0;
  let probabilities: Record<string, number> | undefined;
  if (r.probabilities && typeof r.probabilities === "object" && !Array.isArray(r.probabilities)) {
    probabilities = {};
    for (const [k, v] of Object.entries(r.probabilities as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v) && (SURFACE_OPTIONS[surface] as readonly string[]).includes(k)) {
        probabilities[k] = v;
      }
    }
  }
  const model = typeof r.model === "string" && r.model.trim() ? r.model.trim().slice(0, 100) : null;
  return { tool: r.tool as ActionTool, confidence, latencyMs, model, ...(probabilities ? { probabilities } : {}) };
}

/**
 * Chat: pass-through filter for the model's `<<NAV|tool(|arg)>>` sentinels.
 * Text streams out as it arrives except while a `<<` is still open — the
 * sentinel may be split across chunks, and a half-sentinel must not reach the
 * client before we know whether to keep it. `keep(tool)` decides each one.
 */
export function createNavSentinelFilter(keep: (tool: string, raw: string) => boolean) {
  let pending = "";
  const SENTINEL = /<<NAV\|([a-z_]+)(?:\|[^>\s]*)?>>/g;
  function drain(final: boolean): string {
    let out = "";
    for (;;) {
      const open = pending.indexOf("<<");
      if (open < 0) {
        out += pending;
        pending = "";
        return out;
      }
      out += pending.slice(0, open);
      pending = pending.slice(open);
      const close = pending.indexOf(">>");
      if (close < 0) {
        // Still open: hold it, unless the stream is over or it plainly is
        // not a sentinel (a long run with no close).
        if (final || pending.length > 200) {
          out += pending;
          pending = "";
        }
        return out;
      }
      const candidate = pending.slice(0, close + 2);
      pending = pending.slice(close + 2);
      SENTINEL.lastIndex = 0;
      const m = SENTINEL.exec(candidate);
      if (m && m.index === 0 && m[0].length === candidate.length) {
        if (keep(m[1], candidate)) out += candidate;
      } else {
        out += candidate;
      }
    }
  }
  return {
    push(chunk: string): string {
      pending += chunk;
      return drain(false);
    },
    flush(): string {
      return drain(true);
    },
  };
}
