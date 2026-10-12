/**
 * One voice turn's Jev bookkeeping, for useGeminiLiveSession.
 *
 * The hook owns the socket; this owns the moments that matter to Jev:
 *
 *   speechHeard      — each chunk of the karigar's transcript. After
 *                      SILENCE_MS with no new words the karigar has stopped
 *                      speaking and Jev is asked, before Gemini has answered.
 *   userTurnEnded    — Gemini started answering (tool call, caption, audio):
 *                      ask Jev now if the silence timer has not already.
 *   gate             — Gemini called a tool. In `fast` mode a move Jev owns is
 *                      decided by Jev's answer (see decideModelCall); anything
 *                      else runs as always. Every call is recorded.
 *   finish           — turnComplete: settle and send the whole turn to
 *                      /api/work/jev-action/outcome, which writes the DB row.
 *
 * In `fast` mode, Jev's confident pick of a move it owns is performed the
 * moment its answer arrives — through `perform`, the same handler a Gemini
 * tool call uses — without waiting for Gemini.
 *
 * No React, no DOM: the network and the handler are injected, so
 * scripts/verify-jev-action.ts drives it with a fake server.
 */

import {
  decideModelCall,
  jevMoveNow,
  parseJevActionMode,
  parseJevAnswer,
  toActionTool,
  type ActionTool,
  type JevActionMode,
  type JevAnswer,
  type JevSurface,
  type ModelCallDecision,
  type ModelCallRecord,
} from "./jev-action";

export interface JevTurnInput {
  surface: JevSurface;
  pathname: string;
  userText: string;
  lang?: string | null;
  acharyaSlug?: string | null;
  taskId?: string | null;
}

export interface JevTurnDeps {
  /** POST JSON, resolve the parsed body, or null on any failure. */
  postJson: (url: string, body: unknown) => Promise<unknown>;
  /** Fire-and-forget POST (keepalive). */
  beacon: (url: string, body: unknown) => void;
  /** Perform a move through the screen's own handler; resolve whether it worked. */
  perform: (tool: ActionTool) => Promise<boolean>;
  now?: () => number;
  /** Upper bound on waiting for Jev (gating a Gemini call, finishing a turn). */
  waitMs?: number;
  /** No new words for this long = the karigar has finished speaking. */
  silenceMs?: number;
}

/** Epoch ms on the client clock. Only differences within one turn are meaningful. */
export interface JevTurnTimings {
  speechEndAt: number | null;
  jevRequestedAt: number | null;
  jevAnsweredAt: number | null;
  modelFirstResponseAt: number | null;
  modelToolCallAt: number | null;
  modelDoneAt: number | null;
  executedAt: number | null;
}

type Decided = { mode: JevActionMode; threshold: number; jev: JevAnswer | null };

interface Turn {
  gen: number;
  input: JevTurnInput;
  timings: JevTurnTimings;
  decided: Promise<Decided | null>;
  /** undefined while Jev is still answering. */
  decidedValue: Decided | null | undefined;
  jevMoved: ActionTool | null;
  jevMoveOk: boolean | null;
  jevMove: Promise<void> | null;
  calls: ModelCallRecord[];
  pending: Promise<unknown>[];
}

export const JEV_ACTION_URL = "/api/work/jev-action";
export const JEV_ACTION_OUTCOME_URL = "/api/work/jev-action/outcome";
const DEFAULT_WAIT_MS = 4_500;
const DEFAULT_SILENCE_MS = 600;

function bounded<T>(p: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    p,
    new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), ms);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export function createJevTurnTracker(deps: JevTurnDeps) {
  const now = deps.now ?? (() => Date.now());
  const waitMs = deps.waitMs ?? DEFAULT_WAIT_MS;
  const silenceMs = deps.silenceMs ?? DEFAULT_SILENCE_MS;

  let mode: JevActionMode = "off";
  /** Exact Gemini Live model this session was minted with. */
  let geminiModel: string | null = null;
  let turn: Turn | null = null;
  let generation = 0;
  let lastSpeechAt: number | null = null;
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;

  function clearSilence() {
    if (silenceTimer) clearTimeout(silenceTimer);
    silenceTimer = null;
  }

  function decide(input: JevTurnInput): Promise<Decided | null> {
    return deps
      .postJson(JEV_ACTION_URL, input)
      .then((raw) => {
        if (!raw || typeof raw !== "object") return null;
        const r = raw as Record<string, unknown>;
        return {
          mode: parseJevActionMode(typeof r.mode === "string" ? r.mode : "off"),
          threshold: typeof r.threshold === "number" ? r.threshold : 1,
          jev: parseJevAnswer(r.jev, input.surface),
        };
      })
      .catch(() => null);
  }

  function userTurnEnded(input: JevTurnInput | null) {
    clearSilence();
    if (mode === "off" || turn || !input || !input.userText.trim()) return;
    const t: Turn = {
      gen: generation,
      input,
      timings: {
        speechEndAt: lastSpeechAt ?? now(),
        jevRequestedAt: now(),
        jevAnsweredAt: null,
        modelFirstResponseAt: null,
        modelToolCallAt: null,
        modelDoneAt: null,
        executedAt: null,
      },
      decided: Promise.resolve(null),
      decidedValue: undefined,
      jevMoved: null,
      jevMoveOk: null,
      jevMove: null,
      calls: [],
      pending: [],
    };
    t.decided = decide(input).then((d) => {
      t.decidedValue = d;
      t.timings.jevAnsweredAt = now();
      const move = d ? jevMoveNow({ mode: d.mode, surface: input.surface, threshold: d.threshold, jev: d.jev }) : null;
      // A move must never land late: not for a turn that has been torn down or
      // finished, and not once Gemini has already moved the karigar this turn
      // (a fallback while Jev was slow, or a detail move) — one sentence, one move.
      const geminiMoved = t.calls.some((c) => c.run && toActionTool(c.name) !== "none");
      if (move && t.gen === generation && turn === t && !geminiMoved) {
        t.jevMoved = move;
        t.jevMove = deps
          .perform(move)
          .catch(() => false)
          .then((ok) => {
            t.jevMoveOk = ok;
            t.timings.executedAt ??= now();
          });
      }
      return d;
    });
    turn = t;
  }

  return {
    /** From the voice mint. `off` makes every other call a no-op. */
    setMode(next: string | null | undefined) {
      mode = parseJevActionMode(next);
    },

    get mode(): JevActionMode {
      return mode;
    },

    /** From the voice mint: the exact Live model, recorded on every call and row. */
    setGeminiModel(model: string | null | undefined) {
      geminiModel = typeof model === "string" && model ? model : null;
    },

    /** A chunk of the karigar's transcript arrived. `getInput` is read when the silence ends. */
    speechHeard(getInput: () => JevTurnInput | null) {
      lastSpeechAt = now();
      if (mode === "off" || turn) return;
      clearSilence();
      silenceTimer = setTimeout(() => {
        silenceTimer = null;
        userTurnEnded(getInput());
      }, silenceMs);
    },

    /** Gemini began answering. Idempotent within a turn. */
    userTurnEnded,

    /** First sign of Gemini's answer (caption, audio or tool call). */
    modelResponded() {
      if (turn && turn.timings.modelFirstResponseAt === null) turn.timings.modelFirstResponseAt = now();
    },

    /**
     * Gemini called `name`. Resolves whether to run the real handler, and the
     * reply to send Gemini instead when not. Waits for Jev only when it has to:
     * in fast mode, for a move Jev owns.
     */
    gate(name: string): (ModelCallDecision & { done: (ok: boolean) => void }) | Promise<ModelCallDecision & { done: (ok: boolean) => void }> {
      const t = turn;
      const noop = () => {};
      if (!t) return { run: true, reason: "gemini_owns", done: noop };
      const at = now();
      t.timings.modelFirstResponseAt ??= at;
      t.timings.modelToolCallAt ??= at;

      let record: ModelCallRecord | null = null;
      let handlerStartedAt = 0;
      let finished!: () => void;
      // Settles when the hook reports the handler's result, so the row carries
      // how long it took; a call that does not run settles immediately.
      const handled = new Promise<void>((resolve) => {
        finished = resolve;
      });
      t.pending.push(handled);

      const recordDecision = (decision: ModelCallDecision) => {
        record = { name, at, run: decision.run, reason: decision.reason, model: geminiModel };
        t.calls.push(record);
        if (decision.run && toActionTool(name) !== "none" && t.timings.executedAt === null) {
          t.timings.executedAt = now();
        }
        handlerStartedAt = now();
        if (!decision.run) finished();
        return {
          ...decision,
          done: (ok: boolean) => {
            if (record) {
              record.handlerMs = now() - handlerStartedAt;
              record.ok = ok;
            }
            finished();
          },
        };
      };
      const initial = decideModelCall({ mode, surface: t.input.surface, threshold: 0, jev: null, tool: name });
      if (initial.reason === "gemini_owns") return recordDecision(initial);

      return (async () => {
        const d = t.decidedValue !== undefined ? t.decidedValue : await bounded(t.decided, waitMs);
        // A prediction is not evidence that a screen handler succeeded. Wait for
        // the attempted early move; a failed handler leaves Gemini's fallback available.
        if (t.jevMove && t.jevMoveOk === null) await bounded(t.jevMove, waitMs);
        if (t.gen !== generation || turn !== t) {
          return recordDecision({ run: false, reason: "turn_cancelled", reply: {
            ok: false, error: "turn_cancelled", note: "This turn has ended. Do not claim an action completed.",
          } });
        }
        if (t.jevMove && t.jevMoveOk === null) {
          // The pending handler may still finish. Starting another navigation
          // would race it; report uncertainty without claiming success.
          return recordDecision({ run: false, reason: "jev_pending", reply: {
            ok: false, pending: true, note: "Navigation is still pending. Do not claim it completed.",
          } });
        }
        const wantedMove = d ? jevMoveNow({ mode: d.mode, surface: t.input.surface, threshold: d.threshold, jev: d.jev }) : null;
        const answer = wantedMove && t.jevMoveOk !== true ? null : d?.jev ?? null;
        return recordDecision(decideModelCall({
          mode: d?.mode ?? mode, surface: t.input.surface,
          threshold: d?.threshold ?? 1, jev: answer, tool: name,
        }));
      })();
    },

    /**
     * turnComplete. `finalUserText` is the whole utterance as transcribed —
     * the row records it, and what Jev saw when it was asked, separately.
     */
    async finish(finalUserText?: string) {
      clearSilence();
      lastSpeechAt = null;
      const t = turn;
      turn = null;
      if (!t) return null;
      t.timings.modelDoneAt = now();

      const d = await bounded(t.decided, waitMs);
      await bounded(Promise.allSettled([...(t.jevMove ? [t.jevMove] : []), ...t.pending]), waitMs);
      if (t.gen !== generation) return null;

      const record = {
        ...t.input,
        userText: finalUserText?.trim() || t.input.userText,
        jevSawText: t.input.userText,
        geminiModel,
        jevAnswered: d !== null,
        jev: d?.jev ?? null,
        modelCalls: t.calls,
        jevMoved: t.jevMoved,
        jevMoveOk: t.jevMoveOk,
        timings: t.timings,
      };
      if ((d?.mode ?? mode) !== "off") deps.beacon(JEV_ACTION_OUTCOME_URL, record);
      return record;
    },

    /** Session ended / torn down: forget the open turn, disarm anything in flight. */
    reset() {
      clearSilence();
      lastSpeechAt = null;
      turn = null;
      generation += 1;
    },
  };
}

export type JevTurnTracker = ReturnType<typeof createJevTurnTracker>;
