"use client";

/**
 * Opt-in evidence for voice artifacts: exact incoming PCM, Float32 samples
 * produced by the playback worklet, and a separate MediaRecorder tap.
 * Neither browser recording is a physical-speaker recording. Compare aligned
 * waveforms; peak, zero-crossing and packet-join statistics alone cannot locate
 * an audible buzz. Enable with ?voicedebug=1 (2 adds noisy console tracing).
 * Captures are bounded to five minutes and reset on a full page reload.
 */

type Stage =
  | "session" // lifecycle: mint, connect, remint, teardown
  | "socket" // raw frames in/out, socket identity
  | "chunk" // an inbound PCM chunk, measured
  | "schedule" // what the Web Audio scheduler did with it
  | "playback" // source start/end, queue depth
  | "interrupt" // barge-in, stopPlayback, generation bumps
  | "capture" // mic frames going out
  | "ctx"; // AudioContext health

type Entry = {
  /** ms since the recorder started — the one clock everything shares. */
  t: number;
  stage: Stage;
  msg: string;
  [k: string]: unknown;
};

const MAX_ENTRIES = 20000;
/** ~5 min of 24 kHz mono PCM16. Bounded so a long session cannot OOM a phone. */
const MAX_PCM_SAMPLES = 24000 * 60 * 5;

let enabled = false;
/** 0 = nothing printed, 1 = lifecycle, 2 = every chunk. See `consoleMirror`. */
let verbosity = 0;
let startedAt = 0;
let entries: Entry[] = [];
let logDroppedEntries = 0;
let chunkSeq = 0;

/** Concatenated inbound PCM, exactly as decoded from the socket. */
let pcmIn: Int16Array[] = [];
let pcmInSamples = 0;
/** Previous incoming sample, for descriptive boundary statistics only. */
let prevChunkLastSample: number | null = null;
/** Wall time the previous chunk arrived — for the inter-arrival histogram. */
let prevChunkAt = 0;

type RenderBlock = {
  fileOffsetFrames: number;
  frames: number;
  sampleRate: number;
  contextId: number;
  generation: number;
  startFrame: number;
};
const renderedParts: ArrayBuffer[] = [];
const renderedBlocks: RenderBlock[] = [];
let renderedFrames = 0;
let captureStopped = false;
let inboundLimited = false;
let renderLimited = false;
type OutputTap = {
  recorder: MediaRecorder;
  chunks: Blob[];
  node: MediaStreamAudioDestinationNode;
  source: AudioNode;
  stopped: Promise<void>;
  contextId: number;
  complete: boolean;
};
const outputTaps: OutputTap[] = [];
let captureTimer: ReturnType<typeof setTimeout> | null = null;

function now() {
  return Math.round(performance.now() - startedAt);
}

export function isVoiceDebugOn() {
  return enabled;
}

/**
 * Reads the flag once per page load. Called from the hook's start path so a
 * session that begins with debugging on records from its very first frame.
 */
export function initVoiceDebug(): boolean {
  if (typeof window === "undefined") return false;
  let level = 0;
  try {
    const qs = new URLSearchParams(window.location.search);
    const raw = qs.get("voicedebug") ?? window.localStorage.getItem("voiceDebug") ?? "";
    level = raw === "2" ? 2 : raw === "1" ? 1 : 0;
    if (qs.get("voicedebug") === "0") window.localStorage.removeItem("voiceDebug");
    // A URL flag sticks, so a remint or a client-side navigation mid-session
    // does not silently stop the recording half way through the evidence.
    if (level > 0 && qs.get("voicedebug")) {
      window.localStorage.setItem("voiceDebug", String(level));
    }
  } catch {
    /* private mode / storage blocked — stay off */
  }
  if (level === 0) return false;
  verbosity = level;
  if (enabled) return true;
  enabled = true;
  startedAt = performance.now();
  entries = [];
  logDroppedEntries = 0;
  pcmIn = [];
  pcmInSamples = 0;
  chunkSeq = 0;
  prevChunkLastSample = null;
  prevChunkAt = 0;
  log("session", "voice debug armed", {
    ua: navigator.userAgent,
    href: window.location.href,
  });
  // Hang the controls off window so they can be driven from a phone's remote
  // inspector, from the desktop console, or by an agent over CDP.
  (window as unknown as Record<string, unknown>).__voiceDebug = {
    dump,
    send,
    summary,
    entries: () => entries,
    stop: stopOutputTap,
  };
  console.info(
    "%c[voice-debug] armed — run __voiceDebug.summary() then __voiceDebug.dump()",
    "color:#b45309;font-weight:bold",
  );
  mountBadge();
  captureTimer = setTimeout(() => {
    log("session", "five minute capture limit reached");
    stopOutputTap();
  }, 5 * 60 * 1000);
  return true;
}

/**
 * On-screen chunk counter + Send button.
 *
 * The device that reproduces the beep is a phone. Android Chrome has no console
 * and no inspector without a cable, so a recorder that can only be driven from
 * `window.__voiceDebug` is a recorder that cannot be used where the bug is. This
 * is plain DOM rather than React on purpose — it must not depend on the voice
 * components rendering, or on a render happening at all while audio is stalled.
 *
 * Parked top-LEFT: every live voice control (the mic disc, the dock) sits bottom
 * and right, and a debug badge must not cover the thing under test.
 */
function mountBadge() {
  if (typeof document === "undefined" || document.getElementById("voice-debug-badge")) return;
  const wrap = document.createElement("div");
  wrap.id = "voice-debug-badge";
  wrap.style.cssText =
    "position:fixed;top:8px;left:8px;z-index:2147483647;display:flex;gap:6px;align-items:center;" +
    "font:600 11px/1.2 ui-monospace,Menlo,monospace;background:#1c1917;color:#fbbf24;" +
    "padding:6px 8px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.35);opacity:.92";

  const count = document.createElement("span");
  count.textContent = "REC 0";
  const btn = document.createElement("button");
  btn.textContent = "Send";
  btn.style.cssText =
    "font:600 11px ui-monospace,monospace;background:#b45309;color:#fff;border:0;" +
    "border-radius:6px;padding:5px 9px;cursor:pointer";
  btn.onclick = () => {
    btn.disabled = true;
    btn.textContent = "…";
    void send()
      .then((msg) => {
        btn.textContent = "Sent";
        count.textContent = msg;
      })
      .catch((e) => {
        btn.textContent = "Failed";
        count.textContent = String(e).slice(0, 40);
      });
  };

  wrap.append(count, btn);
  document.body.appendChild(wrap);
  setInterval(() => {
    if (!btn.disabled) count.textContent = `REC ${chunkSeq} · ${(now() / 1000) | 0}s`;
  }, 1000);
}

/** Verbose packet tracing is opt-in because console work can disturb timing. */
function consoleMirror(stage: Stage, msg: string, data?: Record<string, unknown>) {
  if (verbosity === 0) return;
  const noisy = stage === "chunk" || stage === "schedule" || stage === "capture";
  if (noisy && verbosity < 2) return;
  const colour =
    stage === "interrupt" ? "#dc2626" : stage === "chunk" ? "#0891b2" : "#b45309";
  console.debug(
    `%c[vd ${String(now()).padStart(6)}ms ${stage}]%c ${msg}`,
    `color:${colour};font-weight:bold`,
    "color:inherit",
    data || "",
  );
}

export function log(stage: Stage, msg: string, data?: Record<string, unknown>) {
  if (!enabled) return;
  consoleMirror(stage, msg, data);
  if (entries.length >= MAX_ENTRIES) { logDroppedEntries++; return; }
  entries.push({ t: now(), stage, msg, ...(data || {}) });
}

/**
 * Record one inbound PCM chunk and measure it BEFORE Web Audio sees it.
 *
 * Everything here is computed from the raw Int16 samples, so a finding in this
 * record is a finding about what Gemini sent — independent of our scheduler,
 * the browser's resampler, and the output device.
 */
export function recordInboundPcm(bytes: Uint8Array) {
  if (!enabled || captureStopped) return;
  const seq = chunkSeq++;
  const at = now();
  const odd = bytes.byteLength % 2 === 1;
  const sampleCount = Math.floor(bytes.byteLength / 2);
  if (sampleCount === 0) {
    log("chunk", "empty chunk", { seq, bytes: bytes.byteLength });
    return;
  }

  // Copy rather than view: the caller's buffer may be reused, and a misaligned
  // byteOffset would make an Int16Array view throw outright.
  const pcm = new Int16Array(sampleCount);
  const dv = new DataView(bytes.buffer, bytes.byteOffset, sampleCount * 2);
  for (let i = 0; i < sampleCount; i++) pcm[i] = dv.getInt16(i * 2, true);

  let peak = 0;
  let sum = 0;
  let sumSq = 0;
  let zeroCrossings = 0;
  for (let i = 0; i < sampleCount; i++) {
    const s = pcm[i];
    const a = s < 0 ? -s : s;
    if (a > peak) peak = a;
    sum += s;
    sumSq += s * s;
    if (i > 0 && (pcm[i - 1] < 0) !== (s < 0)) zeroCrossings++;
  }

  const first = pcm[0];
  const last = pcm[sampleCount - 1];
  // Descriptive only: a steep voiced waveform can also have a large join.
  const joinJump = prevChunkLastSample === null ? null : Math.abs(first - prevChunkLastSample);
  prevChunkLastSample = last;

  const sincePrevMs = prevChunkAt === 0 ? null : at - prevChunkAt;
  prevChunkAt = at;

  const capturedStartFrame = pcmInSamples;
  const captured = !inboundLimited && pcmInSamples + sampleCount <= MAX_PCM_SAMPLES;
  if (captured) {
    pcmIn.push(pcm);
    pcmInSamples += sampleCount;
  } else inboundLimited = true;

  log("chunk", "pcm in", {
    seq,
    captured,
    capturedStartFrame: captured ? capturedStartFrame : null,
    bytes: bytes.byteLength,
    // An odd byte count is invalid PCM16. Playback rejects it; this statistic
    // does not establish whether the sender split a sample or sent bad data.
    oddBytes: odd || undefined,
    samples: sampleCount,
    durMs: Math.round((sampleCount / 24000) * 1000),
    sincePrevMs,
    peak,
    rms: Math.round(Math.sqrt(sumSq / sampleCount)),
    dc: Math.round(sum / sampleCount),
    // Descriptive, not a tone detector.
    zcr: Math.round((zeroCrossings / sampleCount) * 24000),
    first,
    last,
    joinJump,
  });
}

/** Preserve Float32 bits and processor frame offsets; never normalize or clip. */
export function recordRenderedPcm(
  samples: Float32Array, sampleRate: number, generation: number,
  startFrame: number, contextId: number,
) {
  if (!enabled || captureStopped || renderLimited) return;
  if (sampleRate !== 24000 || renderedFrames + samples.length > MAX_PCM_SAMPLES) {
    renderLimited = true;
    log("playback", "raw render capture limit or unsupported rate", { sampleRate });
    return;
  }
  const bytes = new ArrayBuffer(samples.length * 4);
  const view = new DataView(bytes);
  for (let i = 0; i < samples.length; i++) view.setFloat32(i * 4, samples[i], true);
  renderedBlocks.push({ fileOffsetFrames: renderedFrames, frames: samples.length,
    sampleRate, generation, startFrame, contextId });
  renderedParts.push(bytes);
  renderedFrames += samples.length;
}

/** Separate encoded graph tap. It includes the browser's recorder/codec path. */
export function startOutputTap(ctx: AudioContext, source: AudioNode, contextId = 0) {
  if (!enabled || captureStopped || outputTaps.some((tap) => tap.source === source)) return;
  let node: MediaStreamAudioDestinationNode | null = null;
  try {
    node = ctx.createMediaStreamDestination();
    source.connect(node);
    const recorder = new MediaRecorder(node.stream);
    const chunks: Blob[] = [];
    let resolveStopped!: () => void;
    const stopped = new Promise<void>((resolve) => { resolveStopped = resolve; });
    const tap: OutputTap = { recorder, chunks, node, source, stopped, contextId, complete: false };
    const finished = () => {
      tap.complete = true;
      try { source.disconnect(tap.node); } catch { /* context may already be closed */ }
      tap.node.stream.getTracks().forEach((track) => track.stop());
      resolveStopped();
    };
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = finished;
    recorder.onerror = () => {
      log("ctx", "encoded output tap error", { contextId });
      if (recorder.state !== "inactive") recorder.stop();
      // Even an inactive recorder can still have final data/onstop queued.
      // Resolve only from onstop; finishCapture has a bounded timeout.
    };
    recorder.start(1000);
    outputTaps.push(tap);
    ctx.addEventListener("statechange", () => {
      if (ctx.state === "closed" && recorder.state !== "inactive") recorder.stop();
    });
    log("ctx", "encoded output tap started", { contextId, sampleRate: ctx.sampleRate,
      baseLatency: ctx.baseLatency, outputLatency: ctx.outputLatency,
      state: ctx.state, mime: recorder.mimeType });
  } catch (err) {
    if (node) {
      try { source.disconnect(node); } catch { /* not connected */ }
      node.stream.getTracks().forEach((track) => track.stop());
    }
    log("ctx", "encoded output tap unavailable", { contextId, err: String(err) });
  }
}

/** Freeze this evidence capture; the conversation itself can continue. */
export function stopOutputTap() {
  captureStopped = true;
  if (captureTimer) clearTimeout(captureTimer);
  captureTimer = null;
  for (const tap of outputTaps) {
    if (tap.recorder.state !== "inactive") {
      try { tap.recorder.stop(); } catch { /* already stopped */ }
    }
  }
}

async function finishCapture() {
  stopOutputTap();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    Promise.all(outputTaps.map((tap) => tap.stopped)),
    new Promise<void>((resolve) => { timeout = setTimeout(() => {
      log("ctx", "encoded tap finalization timed out; last block may be missing");
      resolve();
    }, 2000); }),
  ]);
  if (timeout) clearTimeout(timeout);
}

function renderMetadata() {
  return { format: "Float32 little-endian", channels: 1, sampleRate: 24000,
    capturedFrames: renderedFrames, limitReached: renderLimited,
    location: "playback worklet output before downstream browser mixing, resampling and hardware",
    continuity: "Blocks retain exact processor startFrame and contextId. Interrupt/close may drop pending debug blocks; gaps must not be treated as contiguous audio. No acoustic recording is included.",
    blocks: renderedBlocks };
}

/** Wrap the raw inbound samples in a WAV header so any player/editor opens it. */
function pcmToWav(samples: Int16Array, sampleRate: number): Blob {
  const bytes = samples.length * 2;
  const buf = new ArrayBuffer(44 + bytes);
  const v = new DataView(buf);
  const ascii = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };
  ascii(0, "RIFF");
  v.setUint32(4, 36 + bytes, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  ascii(36, "data");
  v.setUint32(40, bytes, true);
  new Int16Array(buf, 44).set(samples);
  return new Blob([buf], { type: "audio/wav" });
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** Descriptive counters only; attribution requires waveform comparison. */
export function summary() {
  if (!enabled) return "voice debug is off";
  const chunks = entries.filter((e) => e.stage === "chunk" && e.msg === "pcm in");
  const jumps = chunks
    .map((c) => c.joinJump as number | null)
    .filter((j): j is number => typeof j === "number");
  const sched = entries.filter((e) => e.stage === "schedule");
  const gaps = sched.map((s) => s.gapS as number).filter((g) => typeof g === "number");
  const overlaps = sched
    .map((s) => s.overlapS as number)
    .filter((o) => typeof o === "number" && o > 0);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const out = {
    durationS: +(now() / 1000).toFixed(1),
    chunks: chunkSeq,
    loggedChunks: chunks.length,
    logDroppedEntries,
    logLimitReached: logDroppedEntries > 0,
    oddByteChunks: chunks.filter((c) => c.oddBytes).length,
    // Legacy descriptive metrics retained for comparison with older captures.
    joinJump: {
      avg: Math.round(avg(jumps)),
      max: jumps.length ? Math.max(...jumps) : 0,
      overThreshold: jumps.filter((j) => j > 3000).length,
    },
    // Empty with the continuous player; processor progress is the current clock.
    scheduleGapsS: { avg: +avg(gaps).toFixed(4), max: gaps.length ? Math.max(...gaps) : 0 },
    scheduleOverlaps: overlaps.length,
    interrupts: entries.filter((e) => e.stage === "interrupt").length,
    underruns: sched.filter((s) => s.scheduledAhead === false).length,
    pcmCapturedS: +(pcmInSamples / 24000).toFixed(1),
    inboundLimitReached: inboundLimited,
    renderCapturedS: +(renderedFrames / 24000).toFixed(1),
    renderLimitReached: renderLimited,
    captureStopped,
    artifactDetector: false,
  };
  console.table(out);
  return out;
}

/** The inbound PCM, concatenated, as one WAV blob. Null if nothing was captured. */
function inboundWav(): Blob | null {
  if (pcmInSamples === 0) return null;
  const all = new Int16Array(pcmInSamples);
  let off = 0;
  for (const part of pcmIn) {
    all.set(part, off);
    off += part.length;
  }
  return pcmToWav(all, 24000);
}

/** Build a stable snapshot after the encoded recorders flush. */
async function evidenceFiles(label: string) {
  await finishCapture();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const prefix = `${label}-${stamp}`;
  const s = summary();
  const files: { name: string; blob: Blob }[] = [{ name: `${prefix}-log.json`,
    blob: new Blob([JSON.stringify({ summary: s, entries,
      encodedTaps: outputTaps.map((tap, index) => ({ index, contextId: tap.contextId,
        mime: tap.recorder.mimeType, finalized: tap.complete })),
    }, null, 2)], { type: "application/json" }) }];
  const wav = inboundWav();
  if (wav) files.push({ name: `${prefix}-INBOUND-from-gemini.wav`, blob: wav });
  if (renderedFrames) {
    files.push({ name: `${prefix}-RENDER-worklet.f32le`, blob: new Blob(renderedParts) });
    files.push({ name: `${prefix}-RENDER-worklet.json`,
      blob: new Blob([JSON.stringify(renderMetadata(), null, 2)], { type: "application/json" }) });
  }
  for (const [index, tap] of outputTaps.entries()) {
    if (!tap.chunks.length) continue;
    const mime = tap.recorder.mimeType || tap.chunks[0].type;
    const ext = mime.includes("mp4") ? "mp4" : mime.includes("ogg") ? "ogg" : "webm";
    files.push({ name: `${prefix}-ENCODED-graph-tap-${index}.${ext}`,
      blob: new Blob(tap.chunks, { type: mime }) });
  }
  return { files, summary: s };
}

/** Send only to the same-origin development capture endpoint. */
export async function send(label = "voice") {
  if (!enabled) return "voice debug is off";
  const { files } = await evidenceFiles(label);
  for (const file of files) {
    const result = await fetch(`/api/work/voice-debug?name=${encodeURIComponent(file.name)}`, {
      method: "POST", body: file.blob,
    });
    if (!result.ok) throw new Error(`${file.name} → ${result.status}`);
  }
  return `sent ${chunkSeq} chunks`;
}

/** Desktop download of the same evidence snapshot. */
export async function dump(label = "voice") {
  if (!enabled) return "voice debug is off";
  const result = await evidenceFiles(label);
  for (const file of result.files) download(file.blob, file.name);
  return result.summary;
}
