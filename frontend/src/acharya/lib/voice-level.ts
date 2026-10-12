/**
 * Mic loudness bus for the live voice session.
 *
 * The Gemini Live capture graph already sees every mic frame in
 * `onaudioprocess` (useGeminiLiveSession → ensureMic), so the RMS is free —
 * what is NOT free is pushing it through React: frames land ~11×/second and the
 * session provider sits above the whole (app) subtree, so a state update per
 * frame would re-render every screen just to nudge a 3px bar.
 *
 * Hence this module-level bus: the audio thread publishes, waveform components
 * subscribe and write to the DOM directly inside their own rAF loop. No React
 * state, no re-renders, and a component mounted after the session started still
 * gets a sane first value from `getMicLevel()`.
 *
 * Level is a 0..1 RMS, NOT normalised for perceived loudness — speech usually
 * lands around 0.05–0.25, which is why the waveform scales it up.
 */

let level = 0;
const subscribers = new Set<(value: number) => void>();

export function publishMicLevel(value: number) {
  level = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  for (const fn of subscribers) fn(level);
}

export function getMicLevel(): number {
  return level;
}

export function subscribeMicLevel(fn: (value: number) => void): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

/** RMS of one capture frame. Strided — 1-in-4 samples is plenty for a meter. */
export function frameRms(samples: Float32Array): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < samples.length; i += 4) {
    const v = samples[i] || 0;
    sum += v * v;
    n += 1;
  }
  return n > 0 ? Math.sqrt(sum / n) : 0;
}
