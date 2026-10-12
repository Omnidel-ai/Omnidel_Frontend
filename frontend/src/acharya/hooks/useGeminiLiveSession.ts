"use client";

import { VOICE_LANGUAGES, isVoiceLang } from "@/acharya/lib/i18n/registry";
import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@/acharya/lib/store";
import { frameRms, publishMicLevel } from "@/acharya/lib/voice-level";
import { PcmPlayer } from "@/acharya/lib/voice/pcm-player";
import {
  CAPTION_TICK_MS,
  createCaptionPacer,
} from "@/acharya/lib/voice-caption-pace";
import {
  initVoiceDebug,
  isVoiceDebugOn,
  log as vlog,
  recordInboundPcm,
  recordRenderedPcm,
  startOutputTap,
} from "@/acharya/lib/voice/voice-debug";
import { createJevTurnTracker } from "@/acharya/lib/voice-jev-turn";

/** Jev's side of a voice turn: JSON POST that never throws. */
async function postJevJson(url: string, body: unknown): Promise<unknown> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

function beaconJev(url: string, body: unknown): void {
  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify(body),
  }).catch(() => {});
}

/**
 * Headless owner of ONE Gemini Live voice session, reusable across screens.
 *
 * Ports the battle-tested audio + WebSocket machinery from bks-bangla's
 * GeminiLiveClient.tsx (PCM16@16k mic capture, PCM24k playback with a
 * generation counter + ctx.resume() before every chunk, mutable ctrl.cancelled
 * StrictMode guard, close-previous-socket-before-open, auto-reconnect budget,
 * and the websocketUrl guard) — but rewired for this app:
 *
 *   - OPEN-MIC (START/END conversation), not push-to-talk. While `live` the mic
 *     streams continuously; Gemini server-side VAD handles turn-taking and
 *     `interrupted` drives barge-in.
 *   - CONTINUOUS PCM playback in a dedicated 24 kHz AudioWorklet. Microphone
 *     processing stays on its own context; output never reuses an old buffer.
 *     Captions follow consumed source frames, including pauses for buffering.
 *   - CAPTION PACED TO PLAYBACK: the output transcript arrives at generation
 *     speed, which is several times faster than the voice takes to say it, so
 *     the visible caption is revealed off the playback timeline instead of
 *     straight off the socket — see @/lib/voice-caption-pace.
 *   - Mic ScriptProcessor feeds a muted GainNode so capture stays wired
 *     without monitoring into the speakers (echo → false VAD interrupts).
 *   - GENERIC tools: the hook does not hardcode tool names. On a WS `toolCall`
 *     it looks up `handlers[name]` and replies with its result; unknown tools
 *     get `{ ok:false, error:"unhandled" }`.
 *   - SURVIVES client-side navigation: `setContext` re-mints + reconnects when
 *     the context KEY changes, WITHOUT tearing down the mic or AudioContext
 *     (changing prompt/tools mid-session requires a fresh mint + new WS — see
 *     ~/brain/skills/gemini-live-voice-integration.md §10).
 *   - WATCHDOGGED CAPTURE: a live session whose capture graph has gone quiet is
 *     indistinguishable, from the UI, from one that is listening — see
 *     `startMicWatchdog`.
 */

export type VoiceStatus = "idle" | "minting" | "connecting" | "live" | "reminting" | "error";

export type VoiceContextKind =
  | "acharya"
  | "acharya_board"
  | "task_detail"
  | "learn"
  /** Home /acharyas MahAcharya navigator — distinct from per-slug board sessions. */
  | "home_nav";

export type VoiceContext = {
  context: VoiceContextKind;
  acharyaSlug?: string;
  taskId?: string;
  workspace?: string;
  /** Override mint URL (public register help, etc.). */
  tokenEndpoint?: string;
  /**
   * Extra fields merged into the mint POST body.
   * May be a getter so reconnects always see the latest form draft
   * (registration voice must not remint with an empty snapshot).
   */
  tokenBody?: Record<string, unknown> | (() => Record<string, unknown>);
  /**
   * Spoken language bound at mint — the app language, or the karigar's
   * voice-only choice (store.voiceLang). Part of the session key so changing it
   * remints with the correct speech_config language_code.
   */
  speechLang?: string;
};

export type ToolArgs = Record<string, unknown>;

/** Every tool handler resolves to a JSON-serialisable response with an `ok` flag. */
export type ToolResult = { ok: boolean } & Record<string, unknown>;

export type ToolHandlers = Record<string, (args: ToolArgs) => Promise<ToolResult>>;

export type VoiceAcharya = { slug: string; displayName: string; avatarUrl: string | null };

export type GeminiLiveSession = {
  status: VoiceStatus;
  error: string;
  /** Current screen context remembered for the live session. */
  context: VoiceContext | null;
  /** From the last token mint. */
  acharya: VoiceAcharya | null;
  /** Live user transcript (cleared on turnComplete). */
  inputText: string;
  /**
   * Live acharya transcript, PACED to the audio actually playing — the words on
   * screen are the words being spoken, not the whole generated turn (which
   * arrives seconds ahead of the voice). Cleared a beat after the run has been
   * heard, not on turnComplete. See @/lib/voice-caption-pace.
   */
  outputText: string;
  /** Gesture entry point: unlock audio + getUserMedia, then mint + connect. */
  start: (ctx: VoiceContext, handlers: ToolHandlers, lang?: string) => Promise<void>;
  /**
   * Register the current screen's context + handlers. If live and the context
   * KEY changed → remint + reconnect (mic/AudioContext stay alive); otherwise
   * just swap the handlers (and remember ctx for the next mint).
   */
  setContext: (ctx: VoiceContext, handlers: ToolHandlers, lang?: string) => void;
  /**
   * Swap tool handlers only (no remint, no React state). Used when a child
   * screen layers tools via setScreenHandlers while the acharya key is unchanged.
   */
  setHandlers: (handlers: ToolHandlers) => void;
  /**
   * Push a context note to the model WITHOUT re-minting (no WS teardown). Used
   * when the karigar navigates manually within the same acharya so the model
   * knows the screen changed. No-op if not live.
   */
  notify: (text: string) => void;
  /** audioStreamEnd + close WS + stop tracks → idle. */
  end: () => void;
};

type ConnectMode = "start" | "remint" | "reconnect";
type Ctrl = { cancelled: boolean };

type LiveServerMessage = {
  setupComplete?: unknown;
  toolCall?: { functionCalls?: Array<{ id: string; name: string; args?: ToolArgs }> };
  serverContent?: {
    interrupted?: boolean;
    turnComplete?: boolean;
    inputTranscription?: { text?: string };
    outputTranscription?: { text?: string };
    modelTurn?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> };
  };
};

const MAX_RECONNECTS = 3;
const TOKEN_ENDPOINT = "/api/work/gemini-live-token";
/**
 * Capture watchdog (see startMicWatchdog). The ScriptProcessor fires ~11×/s at a
 * 4096 frame, so a live session that has not seen a frame for well over a tenth
 * of a second is not a quiet karigar — it is a dead graph.
 */
const MIC_WATCHDOG_MS = 700;
const MIC_STALL_MS = 1_500;
/** Sign-up Talk only — never used on a signed-in Lakshya/Lakshman board. */
const SESSION_START_REGISTER =
  "<session-start> Greet briefly in one short sentence, then ask only the next missing registration field (language first if unset).";
/** Work / board / Learn mic — persona + Memory, not registration. */
const SESSION_START_WORK =
  "<session-start> Greet once in one short sentence, then listen and answer what they say using your persona and Memory. Do not ask for registration or language fields.";
/**
 * After WS drop / remint — do NOT re-greet. System prompt already has latest
 * context; model should continue mid-flow (e.g. registration form progress).
 */
const SESSION_RESUME_REGISTER =
  "<session-resume> Continue mid-flow only. No greeting. Ask only the next missing field from the draft. One short sentence.";
const SESSION_RESUME_WORK =
  "<session-resume> Continue mid-flow only. No greeting. One short sentence if you must speak. Do not ask for registration fields.";
/**
 * Sign-in mic only. Neither of the pairs above fits it: the work kickoff
 * forbids asking for "registration fields", and a mobile number reads as one,
 * so the acharya opened a voice SIGN-IN by declining to ask the single thing it
 * exists to collect. The register kickoff is wrong the other way — it asks for
 * the next missing field of a form this screen does not have.
 */
const SESSION_START_SIGNIN =
  "<session-start> Greet in one short sentence and ask for the one thing this screen needs. Nothing else.";
const SESSION_RESUME_SIGNIN =
  "<session-resume> Continue mid-flow only. No greeting. One short sentence.";

function isRegisterVoice(ctx: VoiceContext | null): boolean {
  return (ctx?.tokenEndpoint || "").includes("register");
}

/** The public sign-in mint (`/api/auth/phone/help/live-token`). */
function isSignInVoice(ctx: VoiceContext | null): boolean {
  return (ctx?.tokenEndpoint || "").includes("/phone/help");
}

function sessionStartText(ctx: VoiceContext | null): string {
  if (isSignInVoice(ctx)) return SESSION_START_SIGNIN;
  return isRegisterVoice(ctx) ? SESSION_START_REGISTER : SESSION_START_WORK;
}

function sessionResumeText(ctx: VoiceContext | null): string {
  if (isSignInVoice(ctx)) return SESSION_RESUME_SIGNIN;
  return isRegisterVoice(ctx) ? SESSION_RESUME_REGISTER : SESSION_RESUME_WORK;
}
/**
 * The karigar was carried into a DIFFERENT acharya mid-conversation ("take me to
 * Vivek Acharya"). The mic never stopped, but the mint did change — this is a new
 * persona with its own prompt and tools, and it has none of the conversation
 * behind it. So neither of the other two kickoffs fits: <session-start> would
 * open as if the karigar had just walked up, and <session-resume> tells a persona
 * that was not there to carry on mid-flow (it also carries registration wording
 * that has nothing to do with arriving on a board).
 */
const SESSION_HANDOVER_TEXT =
  "<session-handover> The karigar asked to be brought to you and has just landed on your screen, still mid-conversation with the mic open. Introduce yourself in ONE short sentence and ask what they need here. Do not welcome them to the app, do not ask for anything they have already given.";

// ── PCM helpers (verbatim from the reference implementations) ──────────────

function base64ToBytes(b64: string) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function downsampleToPcm16(input: Float32Array, inputRate: number, outputRate = 16000) {
  const ratio = inputRate / outputRate;
  const length = Math.floor(input.length / ratio);
  const out = new Int16Array(length);
  for (let i = 0; i < length; i++) {
    const sample = Math.max(-1, Math.min(1, input[Math.floor(i * ratio)] || 0));
    out[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return new Uint8Array(out.buffer);
}

/** Split on sentence-ending punctuation (., ?, !, Hindi purna viram ।), keeping
 *  any trailing partial sentence in the returned remainder. */
function splitCompleteSentences(text: string): { sentences: string[]; remainder: string } {
  const sentences: string[] = [];
  let rest = text;
  const re = /[^.?!।]*[.?!।]+/;
  for (;;) {
    const m = re.exec(rest);
    if (!m || m.index !== 0) break;
    const piece = m[0].trim();
    if (piece) sentences.push(piece);
    rest = rest.slice(m[0].length);
  }
  return { sentences, remainder: rest };
}

/**
 * The session key WITHOUT the spoken language. A change that differs only in
 * speechLang does not remint a live session: Gemini's native-audio Live models
 * detect and switch language inside one session, so a re-mint would only throw
 * the conversation away (a new session starts with no history). The new
 * language is announced to the live model instead — see setContext.
 */
function sessionKeyIgnoringLang(ctx: VoiceContext) {
  return JSON.stringify({
    surface: ctx.context === "home_nav" ? "home_nav" : "acharya",
    acharyaSlug: ctx.acharyaSlug,
  });
}

/** Spoken-language switch note — added to context, does not force a reply. */
function languageSwitchNote(code: string | undefined): string {
  const name = code && isVoiceLang(code) ? VOICE_LANGUAGES[code].name : "the language they chose";
  return `(context: from now on speak ONLY in ${name}, in its own native script. This is the same conversation — do not greet, do not start over, carry on exactly where you were.)`;
}

function contextKey(ctx: VoiceContext) {
  // Per-acharya session: slug is the main key so board → task → learn does not
  // remint. speechLang is included so an IDLE session mints in the new
  // language; a LIVE one switches in place (sessionKeyIgnoringLang).
  // Home navigator also uses slug "mahacharya", and MahAcharya'ji is a real
  // selectable board — so the surface (home_nav vs acharya) MUST be in the key
  // or handing off home → MahAcharya board keeps home_nav tools (QA Finding 8).
  return JSON.stringify({
    surface: ctx.context === "home_nav" ? "home_nav" : "acharya",
    acharyaSlug: ctx.acharyaSlug,
    speechLang: ctx.speechLang ?? null,
  });
}

export function useGeminiLiveSession(): GeminiLiveSession {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState("");
  const [context, setContextState] = useState<VoiceContext | null>(null);
  const [acharya, setAcharya] = useState<VoiceAcharya | null>(null);
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");

  // Session identity + config (kept in refs so timers/callbacks never read stale state).
  const ctxRef = useRef<VoiceContext | null>(null);
  const contextKeyRef = useRef<string>("");
  const handlersRef = useRef<ToolHandlers>({});
  const langRef = useRef<string | undefined>(undefined);

  // WebSocket + connect control.
  const wsRef = useRef<WebSocket | null>(null);
  const ctrlRef = useRef<Ctrl>({ cancelled: true });
  const setupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // True only between setupComplete and teardown — gates mic sends + reconnect.
  const liveRef = useRef(false);
  /** Last connect mode — setupComplete chooses greet vs resume. */
  const connectModeRef = useRef<ConnectMode>("start");
  /** Set for a remint that changes WHO is speaking — see SESSION_HANDOVER_TEXT. */
  const handoverRef = useRef(false);

  // Transcript accumulators.
  const inputTextRef = useRef("");
  const outputTextRef = useRef("");
  // Thread id for admin-dashboard voice persistence: the server returns it on the
  // first turn of a session and we echo it on later turns, so one voice session =
  // one admin conversation. Reset on a fresh "start" (not on reconnect/remint,
  // which continue the same session). See turnComplete + connect().
  const voiceThreadIdRef = useRef<string | null>(null);

  // Caption pacing. The accumulators above hold the whole turn as it ARRIVES,
  // which is the wrong thing to put on screen: the model finishes generating
  // seconds before its voice finishes speaking. The pacer reveals the visible
  // caption off the playback timeline instead — all of that logic, and the
  // reasoning for it, lives in @/lib/voice-caption-pace (pure and unit-tested;
  // this hook only feeds it the socket and the two clocks).
  const capPacerRef = useRef(createCaptionPacer());
  // Jev beside Gemini on each karigar turn (JEV_ACTION_MODE, bound at mint).
  // All policy lives in @/lib/jev-action; this hook only reports the moments.
  // `perform` is how a fast-mode Jev move lands: the screen's OWN handler, the
  // same one a Gemini tool call runs, so it navigates exactly as Gemini would.
  const jevTurnRef = useRef(
    createJevTurnTracker({
      postJson: postJevJson,
      beacon: beaconJev,
      perform: async (tool) => {
        const handler = handlersRef.current[tool];
        if (!liveRef.current || !handler) return false;
        try {
          const result = await handler({});
          console.info("[voice-tools] jev move", { name: tool, result });
          return result?.ok === true;
        } catch (err) {
          console.warn("[voice-tools] jev move failed", { name: tool, error: err instanceof Error ? err.message : err });
          return false;
        }
      },
    }),
  );
  const capTickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Capture and playback use separate clocks and contexts. Both survive remint.
  const playerRef = useRef<PcmPlayer | null>(null);
  const captureGenRef = useRef(0);
  const debugContextIdRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  /** Silent gain so ScriptProcessor stays in the graph (required for onaudioprocess)
   *  without monitoring the mic into the speakers (echo → false VAD interrupts). */
  const micMuteRef = useRef<GainNode | null>(null);
  // Invalidates pending cloned-voice fetches across interruption/handover.
  const playbackGenRef = useRef(0);
  /** Wall clock of the last mic frame — the watchdog's only evidence of life. */
  const lastCaptureAtRef = useRef(0);
  const micWatchdogRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** When the karigar's transcribed words last arrived, and whether this
   *  turn's reply has started.
   *
   *  The first version of this stamped every mic SEND. Wrong anchor: the mic
   *  streams continuously, including while the acharya is talking, so the
   *  "gap" it reported was just the mic frame interval -- 30-90ms on every
   *  reply, which no model can achieve. Input transcription only arrives while
   *  the karigar is actually speaking, so its last arrival is the honest proxy
   *  for "they stopped". From there to Gemini's first audio byte is THEIR
   *  wait (end-of-speech detection + time to first token); from that byte to a
   *  sample sounding is OURS. */
  const lastUserWordsRef = useRef(0);
  const replyStartedRef = useRef(false);
  const rewiringMicRef = useRef(false);
  // ── ElevenLabs cloned-voice override (opt-in, per acharya) ────────────────
  // Set from the token mint response only when this acharya has a cloned voice
  // configured (voice_config.elevenVoiceId in the DB). null for every other
  // acharya, which keeps this entire code path a no-op for them.
  const elevenVoiceRef = useRef<{ voiceId: string; modelId?: string } | null>(null);
  const elevenAcharyaSlugRef = useRef<string | undefined>(undefined);
  /** Buffers output_audio_transcription deltas until a full sentence forms. */
  const elevenSentenceBufferRef = useRef("");
  /** Serializes ElevenLabs fetch+decode calls so sentences play IN ORDER even
   *  though fetches can resolve out of order. */
  const ttsChainRef = useRef(Promise.resolve());

  function clearSetupTimer() {
    if (setupTimerRef.current) clearTimeout(setupTimerRef.current);
    setupTimerRef.current = null;
  }

  function clearReconnectTimer() {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = null;
  }

  function closeCurrentSocket() {
    clearSetupTimer();
    try {
      wsRef.current?.close();
    } catch {
      /* ignore */
    }
    wsRef.current = null;
  }

  /** Drop the paced caption and stop its ticker. Refs only — no setState,
   *  because teardown() runs from the unmount cleanup. */
  function resetCaption() {
    if (capTickerRef.current) clearInterval(capTickerRef.current);
    capTickerRef.current = null;
    capPacerRef.current.reset();
  }

  /** One pacing tick: hand the pacer both clocks, apply what it asks for. */
  function tickCaption() {
    const player = playerRef.current;
    const next = capPacerRef.current.tick(player ? player.playedSeconds : null, Date.now());
    if (next.text !== undefined) setOutputText(next.text);
    // Run drained and cleared — stop ticking until there is something to say.
    if (next.idle && capTickerRef.current) {
      clearInterval(capTickerRef.current);
      capTickerRef.current = null;
    }
  }

  function startCaptionTicker() {
    if (capTickerRef.current) return;
    capTickerRef.current = setInterval(tickCaption, CAPTION_TICK_MS);
  }

  function playbackFailed(error: unknown, player: PcmPlayer | null = playerRef.current) {
    if (player !== playerRef.current) return;
    const message = error instanceof Error ? error.message : "Voice playback failed";
    teardown();
    setError(message);
    setStatus("error");
  }

  /** Created inside the Start gesture, before microphone permission or mint awaits. */
  function ensurePlayer() {
    if (playerRef.current) return playerRef.current;
    const debug = isVoiceDebugOn();
    const debugContextId = ++debugContextIdRef.current;
    let player: PcmPlayer | null = null;
    player = new PcmPlayer({
      onError: (error) => { if (player) playbackFailed(error, player); },
      ...(debug ? {
        onRendered: ({ samples, sampleRate, generation, startFrame }: { samples: Float32Array; sampleRate: number; generation: number; startFrame: number }) => {
          if (playerRef.current === player) recordRenderedPcm(samples, sampleRate, generation, startFrame, debugContextId);
        },
      } : {}),
    });
    playerRef.current = player;
    void player.ready.then(() => {
      if (!player || playerRef.current !== player) return;
      vlog("ctx", "dedicated playback ready", { sampleRate: player.context.sampleRate, renderer: "continuous-worklet" });
      startOutputTap(player.context, player.output, debugContextId);
    }).catch(() => undefined); // start/resume and onError own the visible failure.
    return player;
  }

  function stopPlayback() {
    const player = playerRef.current;
    vlog("interrupt", "stopPlayback", {
      queuedSeconds: player?.queuedSeconds ?? 0,
      renderedSourceSeconds: player?.playedSeconds ?? 0,
      genBefore: playbackGenRef.current,
    });
    playbackGenRef.current++;
    try { player?.interrupt(); } catch { /* Cleanup must also work after a processor failure. */ }
    ttsChainRef.current = Promise.resolve();
    resetCaption();
  }

  /** Accept exact PCM bytes; the render thread owns queueing and the audio clock. */
  function enqueuePcm(bytes: Uint8Array, inbound: boolean) {
    const player = playerRef.current;
    if (!player) throw new Error("Voice playback is unavailable. Start the conversation again.");
    if (inbound && isVoiceDebugOn()) recordInboundPcm(bytes);
    const receipt = player.enqueue(bytes);
    capPacerRef.current.pushAudio(receipt.durationSeconds, player.playedSeconds);
    startCaptionTicker();
    // Mobile browsers can suspend a context between turns. No PCM is consumed
    // while suspended, so captions use the processor's source-frame clock.
    void player.resume().catch((error) => playbackFailed(error, player));
  }

  function enqueueAudio(b64: string, mimeType?: string) {
    if (mimeType) {
      const [format, ...parameters] = mimeType.toLowerCase().split(";").map((p) => p.trim());
      const rate = parameters.find((p) => p.startsWith("rate="));
      if (format !== "audio/pcm" || (rate && rate !== "rate=24000")) {
        throw new Error("Voice returned an unsupported audio format.");
      }
    }
    enqueuePcm(base64ToBytes(b64), true);
  }

  function enqueueElevenAudio(bytes: Uint8Array) {
    enqueuePcm(bytes, false);
    playerRef.current?.finishTurn();
  }

  /** Hand the session back to Gemini Live's own audio for good.
   *
   *  While a cloned voice is set, Gemini's audio parts are DISCARDED as they
   *  arrive (see the modelTurn loop) — so a relay that cannot answer used to
   *  mean silence, not a wrong voice. Clearing the ref makes the very next
   *  audio part play natively. The one case that reaches here in practice is a
   *  token minted while the clone was still on (they live 30 minutes) being
   *  used after it was switched off: the relay answers 409 and the karigar
   *  keeps talking to an acharya that can still speak. */
  function fallBackToNativeAudio(reason: string) {
    if (!elevenVoiceRef.current) return;
    console.warn("[eleven-voice] falling back to Gemini Live audio:", reason);
    elevenVoiceRef.current = null;
    elevenSentenceBufferRef.current = "";
  }

  /** Fetch + play one sentence's cloned-voice audio, chained so sentences that
   *  resolve out of order still play in the order they were spoken. */
  function playElevenSentence(text: string) {
    const slug = elevenAcharyaSlugRef.current;
    const trimmed = text.trim();
    if (!slug || !trimmed) return;
    const myGen = playbackGenRef.current;
    ttsChainRef.current = ttsChainRef.current
      .then(async () => {
        if (myGen !== playbackGenRef.current) return; // stale turn — barge-in happened
        try {
          const res = await fetch("/api/work/eleven-tts-stream", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ acharyaSlug: slug, text: trimmed, lang: langRef.current }),
          });
          if (myGen !== playbackGenRef.current) return;
          if (!res.ok) {
            // 409 = this acharya is not on a cloned voice any more. Anything
            // else (500 unconfigured, 502 upstream) leaves the same choice:
            // native audio beats a session that says nothing.
            fallBackToNativeAudio(`tts request failed (${res.status})`);
            return;
          }
          const buf = new Uint8Array(await res.arrayBuffer());
          if (myGen !== playbackGenRef.current || buf.length === 0) return;
          enqueueElevenAudio(buf);
        } catch (err) {
          if (myGen !== playbackGenRef.current) return;
          fallBackToNativeAudio(`tts request threw (${String(err)})`);
        }
      })
      .catch(() => undefined);
  }

  /** Pull complete sentences out of the buffered output transcript and speak
   *  each one; `final` also flushes a trailing partial sentence (turnComplete). */
  function flushElevenSentences(final: boolean) {
    if (!elevenVoiceRef.current) return;
    const { sentences, remainder } = splitCompleteSentences(elevenSentenceBufferRef.current);
    for (const s of sentences) playElevenSentence(s);
    if (final && remainder.trim()) {
      playElevenSentence(remainder);
      elevenSentenceBufferRef.current = "";
    } else {
      elevenSentenceBufferRef.current = remainder;
    }
  }

  function sendJson(payload: unknown) {
    try {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(payload));
      }
    } catch {
      /* socket likely closing */
    }
  }

  const dispatchToolCall = useCallback(
    async (fc: { id: string; name: string; args?: ToolArgs }): Promise<ToolResult> => {
      const available = Object.keys(handlersRef.current);
      const handler = handlersRef.current[fc.name];
      if (!handler) {
        console.warn("[voice-tools] unhandled", {
          id: fc.id,
          name: fc.name,
          args: fc.args ?? {},
          available,
        });
        return { ok: false, error: "unhandled" };
      }
      try {
        const result = await handler(fc.args ?? {});
        console.info("[voice-tools] ok", {
          id: fc.id,
          name: fc.name,
          args: fc.args ?? {},
          result,
        });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "handler_error";
        console.error("[voice-tools] error", {
          id: fc.id,
          name: fc.name,
          args: fc.args ?? {},
          error: message,
        });
        return { ok: false, error: message };
      }
    },
    [],
  );

  async function handleMessage(data: unknown, ctrl: Ctrl, socket: WebSocket) {
    const current = () => !ctrl.cancelled && ctrlRef.current === ctrl && wsRef.current === socket;
    if (!current()) return;
    const raw =
      typeof data === "string"
        ? data
        : data instanceof Blob
          ? await data.text()
          : data instanceof ArrayBuffer
            ? new TextDecoder().decode(data)
            : "";
    if (!raw || !current()) return;

    // Jev is asked when the karigar stops speaking (a pause in the transcript),
    // or at the first sign Gemini is answering — whichever comes first — so it
    // runs beside Gemini rather than after it. No-ops when the mode is off.
    const jevInput = () => {
      const ctx = ctxRef.current;
      if (!ctx || isRegisterVoice(ctx)) return null;
      return {
        surface: ctx.context === "home_nav" ? ("voice_home" as const) : ("voice_acharya" as const),
        pathname: typeof window !== "undefined" ? window.location.pathname : "",
        userText: inputTextRef.current,
        lang: langRef.current ?? null,
        acharyaSlug: ctx.acharyaSlug ?? null,
        taskId: ctx.taskId ?? null,
      };
    };
    const jevModelAnswering = () => {
      jevTurnRef.current.userTurnEnded(jevInput());
      jevTurnRef.current.modelResponded();
    };

    let msg: LiveServerMessage;
    try {
      msg = JSON.parse(raw) as LiveServerMessage;
    } catch {
      return;
    }

    if ("setupComplete" in msg) {
      if (process.env.NODE_ENV !== "production") console.debug("[voice] setup complete; live");
      clearSetupTimer();
      // Connect-time split: `connect` is stamped before the mint, this is
      // Gemini acknowledging setup, and the first greeting audio follows.
      vlog("session", "setupComplete");
      reconnectAttemptsRef.current = 0; // healthy session — refill the budget
      liveRef.current = true;
      setStatus("live");
      setError("");
      // Fresh start greets; reconnect/remint must RESUME so registration (and
      // other multi-step flows) do not restart from "what is your first name?".
      // A remint that swapped the acharya is neither — it is a handover, and the
      // one-shot flag is consumed here so a later reconnect resumes normally.
      const kickoff =
        connectModeRef.current === "start"
          ? sessionStartText(ctxRef.current)
          : handoverRef.current
            ? SESSION_HANDOVER_TEXT
            : sessionResumeText(ctxRef.current);
      handoverRef.current = false;
      sendJson({
        clientContent: {
          turns: [{ role: "user", parts: [{ text: kickoff }] }],
          turnComplete: true,
        },
      });
      return;
    }

    if (msg.toolCall?.functionCalls?.length) {
      jevModelAnswering();
      console.info(
        "[voice-tools] toolCall received",
        msg.toolCall.functionCalls.map((fc) => ({
          id: fc.id,
          name: fc.name,
          args: fc.args ?? {},
        })),
      );
      // Tools may take seconds. Keep incoming audio/interruption processing
      // live, and send the result only to the socket that requested it.
      // In fast mode a move Jev owns is Jev's call: `gate` says whether the
      // real handler runs, and what Gemini is told when it does not.
      void Promise.all(msg.toolCall.functionCalls.map((fc) => {
        const gateOrPromise = jevTurnRef.current.gate(fc.name);
        if (gateOrPromise instanceof Promise) {
          return gateOrPromise.then(async (gate) => {
            if (!gate.run) console.info("[voice-tools] jev owns this move", { name: fc.name, reason: gate.reason });
            let response: ToolResult;
            if (!current()) response = { ok: false, error: "session_ended" };
            else if (gate.run) response = await dispatchToolCall(fc);
            else response = (gate.reply as ToolResult | undefined) ?? { ok: false, error: "not_performed" };
            gate.done(gate.run && response.ok === true);
            return { id: fc.id, name: fc.name, response };
          });
        }
        const gate = gateOrPromise;
        if (!gate.run) console.info("[voice-tools] jev owns this move", { name: fc.name, reason: gate.reason });
        const resPromise = current() && gate.run ? dispatchToolCall(fc) : null;
        return (async () => {
          let response: ToolResult;
          if (!current()) response = { ok: false, error: "session_ended" };
          else if (resPromise) response = await resPromise;
          else response = (gate.reply as ToolResult | undefined) ?? { ok: false, error: "not_performed" };
          gate.done(gate.run && response.ok === true);
          return { id: fc.id, name: fc.name, response };
        })();
      })).then((responses) => {
        if (!current()) return;
        console.info("[voice-tools] toolResponse", responses);
        sendJson({ toolResponse: { functionResponses: responses } });
      }).catch((error) => {
        if (current()) console.warn("[voice-tools] response failed", error);
      });
    }

    // A tool handler can synchronously hand over before its promise resolves.
    if (!current()) return;
    const sc = msg.serverContent;
    if (!sc) return;

    if (sc.interrupted) {
      vlog("interrupt", "server VAD interrupted");
      // Barge-in: stopPlayback drops the paced queue, and the words that were
      // never spoken come off the screen with the audio that was never heard.
      stopPlayback();
      setOutputText("");
      // Also drop whatever of this turn had not been spoken yet, rather than
      // queuing it behind the interruption once playback resumes.
      elevenSentenceBufferRef.current = "";
    }

    const input = sc.inputTranscription?.text;
    if (input) lastUserWordsRef.current = Date.now();
    if (input) {
      inputTextRef.current = (inputTextRef.current + " " + input).trim();
      setInputText(inputTextRef.current);
      // A pause after this chunk means they have finished: Jev is asked then.
      jevTurnRef.current.speechHeard(jevInput);
    }

    // An interrupted event may carry stale model parts alongside the cancel.
    const output = sc.interrupted ? undefined : sc.outputTranscription?.text;
    if (output) {
      jevModelAnswering();
      if (!outputTextRef.current && process.env.NODE_ENV !== "production") console.debug("[voice] first caption delta", { characters: output.length });
      // The accumulator stays the WHOLE turn — chat mirroring and the admin
      // dashboard want the full text as soon as it exists. The caption does
      // not: it is paced off playback by the pacer, so no setOutputText
      // here. Queued before this message's audio is scheduled, which is also
      // the position on the timeline that audio will occupy.
      outputTextRef.current = (outputTextRef.current + " " + output).trim();
      // No setOutputText here: the caption is paced off the playback clock by
      // the pacer. Setting it here too would put the whole turn on screen at
      // once and undo that. (#166 set it; #168 moved ownership to the pacer.)
      capPacerRef.current.pushWords(output, Date.now());
      startCaptionTicker();
      if (elevenVoiceRef.current) {
        elevenSentenceBufferRef.current += output;
        flushElevenSentences(false);
      }
    }

    for (const part of (sc.interrupted ? [] : sc.modelTurn?.parts) || []) {
      const audioData = part.inlineData?.data;
      if (audioData) jevModelAnswering();
      // Gemini's own audio is the default path and plays here. It is muted only
      // while a cloned voice is active for this acharya (off unless the
      // deployment opts in), where the ElevenLabs audio driven off
      // outputTranscription plays instead.
      if (audioData && !replyStartedRef.current) {
        replyStartedRef.current = true;
        // Gemini's share of the wait. Everything after this line is ours.
        vlog("chunk", "first audio of reply", {
          msSinceUserWords: lastUserWordsRef.current ? Date.now() - lastUserWordsRef.current : null,
        });
      }
      if (audioData && !elevenVoiceRef.current) enqueueAudio(audioData, part.inlineData?.mimeType);
    }

    if (sc.turnComplete) {
      if (process.env.NODE_ENV !== "production") console.debug("[voice] turn complete");
      replyStartedRef.current = false; // next turn measures its own wait
      if (!elevenVoiceRef.current) playerRef.current?.finishTurn();
      flushElevenSentences(true);
      const ctx = ctxRef.current;
      const userText = inputTextRef.current.trim();
      const assistantText = outputTextRef.current.trim();
      // Mirror the spoken turn into the SAME local chat thread the text chat
      // renders, so a voice conversation shows up on the acharya's chat page.
      // Task surfaces key on taskId (AcharyaThread); board/home surfaces key on
      // the acharya slug — `__acharya:<slug>` is exactly what BoardAcharyaChat and
      // HomeMahAcharyaChat read. Without the slug fallback, board/home voice was
      // written nowhere and never appeared in the thread.
      const chatKey = ctx?.taskId
        ? ctx.taskId
        : ctx?.acharyaSlug
          ? `__acharya:${ctx.acharyaSlug}`
          : null;
      if (chatKey && (userText || assistantText)) {
        const { appendTaskMessage } = useStore.getState();
        const now = Date.now();
        if (userText) {
          appendTaskMessage(chatKey, { role: "user", content: userText, ts: now });
        }
        if (assistantText) {
          appendTaskMessage(chatKey, { role: "assistant", content: assistantText, ts: now + 1 });
        }
      }
      // Persist to the admin dashboard's Conversations view. Only real spoken
      // turns (a user utterance) — the synthetic <session-start>/<session-resume>/
      // <session-handover>
      // kickoff is a text turn with no audio, so it produces no user transcript
      // and never lands here; the guard is belt-and-suspenders. keepalive so a
      // turn that completes as the user ends/navigates still posts. Fire-and-
      // forget; the returned thread id keeps the whole session in one conversation.
      if (
        userText &&
        userText !== SESSION_START_REGISTER &&
        userText !== SESSION_START_WORK &&
        userText !== SESSION_RESUME_REGISTER &&
        userText !== SESSION_RESUME_WORK &&
        userText !== SESSION_HANDOVER_TEXT &&
        // The pre-signup register-help voice session runs with no karigar
        // cookie yet — every turn's fetch here 401'd and retried nowhere,
        // just spamming the network with a request that can never succeed.
        !isRegisterVoice(ctx)
      ) {
        void fetch("/api/work/voice-turn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          keepalive: true,
          body: JSON.stringify({
            acharyaSlug: ctxRef.current?.acharyaSlug,
            userText,
            assistantText: assistantText || undefined,
            conversationId: voiceThreadIdRef.current || undefined,
          }),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((j) => {
            if (current() && j && typeof j.conversationId === "string") voiceThreadIdRef.current = j.conversationId;
          })
          .catch(() => {});
      }

      // Jev's side of the turn: settle and log it (one DB row per turn).
      void jevTurnRef.current.finish(userText);

      inputTextRef.current = "";
      outputTextRef.current = "";
      setInputText("");
      // The acharya's caption is NOT cleared here. turnComplete means the model
      // has finished GENERATING; its voice is still seconds from finishing, and
      // clearing on this message took the words off screen mid-sentence.
      // The pacer clears once the audio for this run has been heard.
      capPacerRef.current.markTurnDone();
      startCaptionTicker();
    }
  }

  async function connect(ctrl: Ctrl, mode: ConnectMode) {
    const ctx = ctxRef.current;
    if (!ctx || ctrl.cancelled || ctrlRef.current !== ctrl) return;
    // Socket identity is part of the evidence: duplicate or late delivery can
    // corrupt playback even when each individual PCM packet is valid.
    vlog("socket", "connect", { mode, acharya: ctx.acharyaSlug, key: contextKey(ctx) });
    connectModeRef.current = mode;
    // A genuinely new session starts a new admin conversation; reconnect/remint
    // keep the mic + session alive, so they keep the same thread.
    if (mode === "start") voiceThreadIdRef.current = null;
    setStatus(mode === "remint" ? "reminting" : mode === "reconnect" ? "connecting" : "minting");
    setError("");
    try {
      // Prefer latest tokenBody (e.g. registration form progress) so reconnect
      // system prompts include already-filled fields — not an empty draft.
      const body =
        typeof ctx.tokenBody === "function"
          ? (ctx.tokenBody as () => Record<string, unknown>)()
          : ctx.tokenBody || {};
      const res = await fetch(ctx.tokenEndpoint || TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: ctx.context,
          acharyaSlug: ctx.acharyaSlug,
          taskId: ctx.taskId,
          workspace: ctx.workspace,
          lang: langRef.current,
          // The language to SPEAK, when it differs from the app language `lang`
          // (a voice-only choice, possibly one the app has no UI for).
          voiceLang: ctx.speechLang,
          ...body,
        }),
      });
      const token = (await res.json().catch(() => ({}))) as {
        websocketUrl?: string;
        acharya?: VoiceAcharya;
        elevenVoice?: { voiceId: string; modelId?: string } | null;
        /** JEV_ACTION_MODE on the server: off | shadow | fast. Absent means off. */
        jevActionMode?: string;
        /** Exact Live model this session is bound to. */
        model?: string;
        error?: string;
      };
      if (ctrl.cancelled || ctrlRef.current !== ctrl) return;
      if (!res.ok || !token.websocketUrl) {
        throw new Error(token.error || "Could not start voice session");
      }
      // Reset per connect — a remint can move to a different acharya, so a
      // stale voiceId/slug from the previous mint must never carry over.
      elevenVoiceRef.current = token.elevenVoice ?? null;
      jevTurnRef.current.setMode(token.jevActionMode);
      jevTurnRef.current.setGeminiModel(token.model);
      elevenAcharyaSlugRef.current = token.acharya?.slug;
      elevenSentenceBufferRef.current = "";
      // Defense-in-depth: reject a malformed socket URL before opening it. A
      // regression to the `?key=` / non-Constrained shape fails as an opaque WS
      // 1007; this surfaces it as a clear client error instead.
      if (
        token.websocketUrl.includes("?key=") ||
        !token.websocketUrl.includes("BidiGenerateContentConstrained")
      ) {
        throw new Error("Invalid websocketUrl from token route");
      }
      if (token.acharya) setAcharya(token.acharya);
      if (process.env.NODE_ENV !== "production") console.debug("[voice] mint received; connecting");

      // Never run two live sockets: close any a previous (raced) connect left.
      closeCurrentSocket();

      const ws = new WebSocket(token.websocketUrl);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;
      let decodeChain = Promise.resolve();
      const currentSocket = () => !ctrl.cancelled && ctrlRef.current === ctrl && wsRef.current === ws;

      ws.onopen = () => {
        if (!currentSocket()) {
          try {
            ws.close();
          } catch {
            /* ignore */
          }
          return;
        }
        // The constrained token binds model, tools and config at mint time.
        // Keep the handshake empty even if a token response includes setup fields.
        ws.send(JSON.stringify({ setup: {} }));
        if (process.env.NODE_ENV !== "production") console.debug("[voice] socket open; empty setup sent");
        if (mode !== "remint") setStatus("connecting");
        clearSetupTimer();
        setupTimerRef.current = setTimeout(() => {
          // Some sessions never emit an explicit setupComplete; treat a still-open
          // socket after the grace window as live so the mic engages.
          if (currentSocket() && ws.readyState === WebSocket.OPEN) {
            liveRef.current = true;
            setStatus("live");
          }
        }, 8000);
      };
      ws.onmessage = (event) => {
        // Serialize decoding only. A slow Blob must not reorder packets; an
        // async tool handler must not block a later interruption message.
        decodeChain = decodeChain.then(async () => {
          if (!currentSocket()) return;
          const data = event.data instanceof Blob ? await event.data.text() : event.data;
          if (!currentSocket()) return;
          await handleMessage(data, ctrl, ws);
        }).catch((error) => {
          if (currentSocket()) playbackFailed(error);
        });
      };
      ws.onerror = () => {
        if (!currentSocket()) return;
        setError("Voice connection failed");
        setStatus("error");
      };
      ws.onclose = () => {
        // Unexpected close of the CURRENT socket. Reading state here would be a
        // stale closure; the cancelled flag + socket identity are the truth.
        // Auto-reconnect a few times so an idle/timeout drop doesn't kill the mic.
        if (!currentSocket()) return;
        clearSetupTimer();
        ctrl.cancelled = true;
        wsRef.current = null;
        stopPlayback();
        liveRef.current = false;
        if (reconnectAttemptsRef.current < MAX_RECONNECTS) {
          reconnectAttemptsRef.current += 1;
          setStatus("connecting");
          clearReconnectTimer();
          const nextCtrl: Ctrl = { cancelled: false };
          ctrlRef.current = nextCtrl;
          reconnectTimerRef.current = setTimeout(() => {
            void connect(nextCtrl, "reconnect");
          }, 800);
        } else {
          setError("Voice connection lost");
          setStatus("error");
        }
      };
    } catch (err) {
      if (ctrl.cancelled || ctrlRef.current !== ctrl) return;
      setError(err instanceof Error ? err.message : "Could not start voice session");
      setStatus("error");
    }
  }

  /** Builds the capture graph. Callers own the "already wired?" check. */
  function wireCapture(ctx: AudioContext, stream: MediaStream) {
    const source = ctx.createMediaStreamSource(stream);
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    // Mute before destination: ScriptProcessor must stay connected to run, but
    // an unmuted path monitors the mic into the speakers → acoustic echo on
    // open-mic + TTS, which trips server VAD `interrupted` and sounds scatty.
    const mute = ctx.createGain();
    mute.gain.value = 0;
    sourceRef.current = source;
    processorRef.current = processor;
    micMuteRef.current = mute;
    processor.onaudioprocess = (ev) => {
      const frame = ev.inputBuffer.getChannelData(0);
      lastCaptureAtRef.current = Date.now();
      // Loudness first, before any early return: the waveform must keep moving
      // while the socket is mid-remint or under backpressure — a frozen meter
      // reads as "the mic died".
      publishMicLevel(frameRms(frame));
      // Open-mic: stream continuously, but only while a live socket is ready.
      const ws = wsRef.current;
      if (!liveRef.current || ws?.readyState !== WebSocket.OPEN) return;
      // Drop frames under WS backpressure instead of growing a multi-second lag
      // that makes the Acharya reply feel late / cut up.
      if (ws.bufferedAmount > 256_000) return;
      const pcm = downsampleToPcm16(frame, ctx.sampleRate);
      ws.send(
        JSON.stringify({
          realtimeInput: { audio: { data: bytesToBase64(pcm), mimeType: "audio/pcm;rate=16000" } },
        }),
      );
    };
    source.connect(processor);
    processor.connect(mute);
    mute.connect(ctx.destination);
    lastCaptureAtRef.current = Date.now();
  }

  async function ensureMic(ctrl: Ctrl) {
    const ctx = audioCtxRef.current || new AudioContext();
    audioCtxRef.current = ctx;
    // Both resume calls and the permission request happen before the first await.
    const captureReady = ctx.resume();
    const player = ensurePlayer();
    const playbackReady = player.resume();
    const current = () => !ctrl.cancelled && ctrlRef.current === ctrl && audioCtxRef.current === ctx;
    const streamReady = navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    }).then((stream) => {
      if (!current()) stream.getTracks().forEach((track) => track.stop());
      // Own the grant immediately: another initialization promise may reject
      // before Promise.all returns, and teardown still has to release the mic.
      else mediaStreamRef.current = stream;
      return stream;
    });
    const [, , stream] = await Promise.all([captureReady, playbackReady, streamReady]);
    if (!current()) {
      stream.getTracks().forEach((track) => track.stop());
      throw new Error("Voice start cancelled");
    }
    mediaStreamRef.current = stream;
    wireCapture(ctx, stream);
    startMicWatchdog();
  }

  /**
   * Drop the capture NODES and nothing else — the AudioContext, the MediaStream
   * and the socket all survive. Separate from stopMic because rewiring must not
   * send `audioStreamEnd`: that tells Gemini the karigar's audio is finished,
   * which is the opposite of what a reconnecting mic means.
   */
  function detachCapture() {
    captureGenRef.current++;
    const processor = processorRef.current;
    if (processor) processor.onaudioprocess = null;
    processor?.disconnect();
    sourceRef.current?.disconnect();
    micMuteRef.current?.disconnect();
    processorRef.current = null;
    sourceRef.current = null;
    micMuteRef.current = null;
  }

  /**
   * Rebuild capture under a session that is still live. Reuses the granted
   * MediaStream unless its track has actually ended (device change, another app
   * taking the mic) — re-acquiring needs no user gesture, permission is already
   * held, but a needless getUserMedia flickers the browser's recording chip.
   */
  async function rewireMic() {
    if (rewiringMicRef.current) return;
    rewiringMicRef.current = true;
    try {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      let generation = captureGenRef.current;
      const current = () => audioCtxRef.current === ctx && captureGenRef.current === generation;
      if (ctx.state !== "running") await ctx.resume();
      if (!current()) return;
      detachCapture();
      generation = captureGenRef.current;
      let stream = mediaStreamRef.current;
      const track = stream?.getAudioTracks()[0];
      if (!stream || !track || track.readyState === "ended") {
        stream?.getTracks().forEach((t) => t.stop());
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        if (!current()) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        mediaStreamRef.current = stream;
      }
      wireCapture(ctx, stream);
    } catch {
      /* nothing left to try this round — the watchdog comes back around */
    } finally {
      rewiringMicRef.current = false;
    }
  }

  /**
   * Keeps an open mic actually open.
   *
   * Capture only runs while the AudioContext runs, and browsers suspend an
   * AudioContext far more eagerly than this code used to assume. The PLAYBACK
   * path already knows that — `enqueueAudio` resumes before every single chunk,
   * and says why. Capture had no equivalent: it resumed once, inside the start
   * gesture, and then trusted the context forever.
   *
   * That asymmetry is the "he finishes his answer and then stops hearing you"
   * bug QA raised on PR #145. While the acharya is speaking, every arriving PCM
   * chunk resumes the context, so the answer plays out in full and the karigar
   * sees a live session. The moment playback stops, nothing resumes it any
   * more: `onaudioprocess` never fires again, no frames reach the socket, the
   * meter freezes at its last value and `status` happily stays "live". Nothing
   * on screen could tell the karigar their mic was gone — they had to end the
   * call and start over, which is exactly what QA had to do.
   *
   * So: while live, resume a context that is not running, and rebuild the graph
   * if frames have stopped arriving for longer than speech silence explains. One
   * timer and a ref read, and it covers the class rather than one path into it —
   * a suspended context, a torn-down node and an ended track all present to the
   * karigar as the same dead mic.
   */
  function startMicWatchdog() {
    if (micWatchdogRef.current) return;
    micWatchdogRef.current = setInterval(() => {
      if (!liveRef.current) return;
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      if (ctx.state !== "running") {
        // Grace: frames cannot have been arriving while suspended, so do not
        // let this tick's silence also trigger a rewire on the next one.
        lastCaptureAtRef.current = Date.now();
        void ctx.resume().catch(() => undefined);
        return;
      }
      if (!processorRef.current) {
        void rewireMic();
        return;
      }
      if (Date.now() - lastCaptureAtRef.current > MIC_STALL_MS) void rewireMic();
    }, MIC_WATCHDOG_MS);
  }

  function stopMicWatchdog() {
    if (micWatchdogRef.current) clearInterval(micWatchdogRef.current);
    micWatchdogRef.current = null;
  }

  function stopMic() {
    // Meter back to flat, or the waveform freezes at the last spoken level.
    publishMicLevel(0);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      sendJson({ realtimeInput: { audioStreamEnd: true } });
    }
    detachCapture();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }

  function teardown() {
    ctrlRef.current.cancelled = true;
    liveRef.current = false;
    clearSetupTimer();
    clearReconnectTimer();
    stopMicWatchdog();
    reconnectAttemptsRef.current = 0;
    handoverRef.current = false;
    stopMic();
    closeCurrentSocket();
    stopPlayback();
    void audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
    const player = playerRef.current;
    playerRef.current = null;
    void player?.close().catch(() => undefined);
    inputTextRef.current = "";
    outputTextRef.current = "";
    jevTurnRef.current.reset();
    elevenVoiceRef.current = null;
    elevenAcharyaSlugRef.current = undefined;
    elevenSentenceBufferRef.current = "";
  }

  const start = useCallback(
    async (ctx: VoiceContext, handlers: ToolHandlers, lang?: string) => {
      // End any previous/pending start before acquiring a new pair of contexts.
      teardown();
      const ctrl: Ctrl = { cancelled: false };
      ctrlRef.current = ctrl;
      clearReconnectTimer();
      reconnectAttemptsRef.current = 0;
      handoverRef.current = false;
      ctxRef.current = ctx;
      setContextState(ctx);
      contextKeyRef.current = contextKey(ctx);
      handlersRef.current = handlers;
      langRef.current = lang;
      setError("");
      setInputText("");
      setOutputText("");
      inputTextRef.current = "";
      outputTextRef.current = "";
      resetCaption();
      setStatus("minting");
      initVoiceDebug();
      vlog("session", "start", { acharya: ctx.acharyaSlug, taskId: ctx.taskId, lang });
      try {
        // Unlock audio + acquire mic inside the user gesture, before the mint.
        await ensureMic(ctrl);
      } catch (err) {
        if (ctrl.cancelled || ctrlRef.current !== ctrl) return;
        teardown();
        setError(err instanceof Error ? err.message : "Microphone permission required");
        setStatus("error");
        return;
      }
      if (ctrl.cancelled || ctrlRef.current !== ctrl) return;
      await connect(ctrl, "start");
    },
    // Session helpers read refs; keep Start stable for provider consumers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const setContext = useCallback(
    (ctx: VoiceContext, handlers: ToolHandlers, lang?: string) => {
      handlersRef.current = handlers;
      langRef.current = lang;
      const nextKey = contextKey(ctx);
      const prevCtx = ctxRef.current;
      const prevSlug = prevCtx?.acharyaSlug;
      // Always keep latest ctx (tokenBody getter, etc.) on the ref for remint.
      ctxRef.current = ctx;

      // Not in a live/connecting session → remember key; only setState if changed
      // so idle screens do not loop on identical context objects.
      if (!liveRef.current && wsRef.current === null && status !== "connecting" && status !== "reminting") {
        if (nextKey !== contextKeyRef.current) {
          contextKeyRef.current = nextKey;
          setContextState(ctx);
        } else {
          // Same key: still allow React consumers to see updated tokenBody/lang
          // only when content identity matters — skip setState to avoid loops.
          contextKeyRef.current = nextKey;
        }
        return;
      }
      // Same context key → keep the socket; handlers already swapped above.
      // Do NOT setContextState here — a new ctx object every call caused
      // Maximum update depth when callers put setContext in useEffect deps.
      if (nextKey === contextKeyRef.current) return;

      // Only the spoken language changed → keep the socket and the whole
      // conversation; tell the live model to switch. The ref already holds the
      // new ctx, so a later reconnect mints with the new language_code.
      // turnComplete false: the note joins the context without forcing a reply
      // (it would otherwise cut across the acharya's answer to the
      // set_spoken_language call that usually caused this).
      if (prevCtx && sessionKeyIgnoringLang(prevCtx) === sessionKeyIgnoringLang(ctx)) {
        contextKeyRef.current = nextKey;
        setContextState(ctx);
        if (liveRef.current) {
          sendJson({
            clientContent: {
              turns: [{ role: "user", parts: [{ text: languageSwitchNote(ctx.speechLang) }] }],
              turnComplete: false,
            },
          });
        }
        return;
      }

      // Context key changed mid-session → remint + reconnect, keeping the mic
      // and AudioContext alive (prompt/tools are bound at mint time). A changed
      // ACHARYA means someone else is about to answer (voice navigation between
      // acharyas, or stepping off a board back to the home guide), so the new
      // session opens as a handover rather than resuming a flow it never had.
      // (A language-only change never gets here — it switches in place above.)
      handoverRef.current = Boolean(prevSlug && ctx.acharyaSlug && prevSlug !== ctx.acharyaSlug);
      contextKeyRef.current = nextKey;
      setContextState(ctx);
      ctrlRef.current.cancelled = true;
      clearReconnectTimer();
      clearSetupTimer();
      liveRef.current = false;
      reconnectAttemptsRef.current = 0;
      closeCurrentSocket();
      stopPlayback();
      // The new persona will not finish the old one's sentence, and stopPlayback
      // only drops the pacing refs — the words already on screen need clearing.
      setOutputText("");
      const ctrl: Ctrl = { cancelled: false };
      ctrlRef.current = ctrl;
      void connect(ctrl, "remint");
    },
    // Session helpers read refs; only the idle-state decision uses render state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status],
  );

  const setHandlers = useCallback((handlers: ToolHandlers) => {
    handlersRef.current = handlers;
    if (process.env.NODE_ENV !== "production") {
      console.debug("[voice-tools] handlers swapped", Object.keys(handlers));
    }
  }, []);

  const notify = useCallback((text: string) => {
    // Same-acharya navigation note: inject as a user turn so the model keeps its
    // context current WITHOUT closing/reopening the socket. Silent if not live.
    if (!liveRef.current) return;
    sendJson({
      clientContent: {
        turns: [{ role: "user", parts: [{ text }] }],
        turnComplete: true,
      },
    });
  }, []);

  const end = useCallback(() => {
    teardown();
    setStatus("idle");
    setError("");
    setContextState(null);
    setInputText("");
    setOutputText("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * A hidden tab throttles `setInterval` hard, so the watchdog can be a long
   * way late noticing a suspended context. Re-check the moment the karigar
   * comes back: a conversation they left running has to be listening again by
   * the time they are looking at it, not a tick later.
   */
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== "visible" || !liveRef.current) return;
      const ctx = audioCtxRef.current;
      if (ctx && ctx.state !== "running") void ctx.resume().catch(() => undefined);
      const player = playerRef.current;
      if (player) void player.resume().catch((error) => playbackFailed(error, player));
      if (!processorRef.current) void rewireMic();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup on unmount only — tear down refs without setState (no unmount warn).
  useEffect(() => {
    return () => teardown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    status,
    error,
    context,
    acharya,
    inputText,
    outputText,
    start,
    setContext,
    setHandlers,
    notify,
    end,
  };
}
