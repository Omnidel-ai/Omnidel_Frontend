/**
 * Live microphone level, as a module-level bus.
 *
 * Kaarigar (`src/lib/voice-level.ts`) and Contractor
 * (`src/lib/client/voice-level.ts`) carry this module line for line; only the
 * comments differ. The audio capture path publishes an RMS per frame, and the
 * waveform subscribes and writes bar heights straight to the DOM. Pushing ~11
 * frames a second through React state would re-render the whole screen to nudge
 * a 3px bar.
 *
 * Level is a 0..1 RMS, not corrected for loudness. Speech lands around
 * 0.05–0.25, which is why `VoiceWaveform` scales it up.
 */

export interface LevelSource {
  get(): number;
  subscribe(fn: (value: number) => void): () => void;
}

/** A bus of your own. Tests and the playground use one each, so they never share a level. */
export function createLevelBus(): LevelSource & { publish(value: number): void } {
  let level = 0;
  const subscribers = new Set<(value: number) => void>();
  return {
    publish(value) {
      level = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
      for (const fn of subscribers) fn(level);
    },
    get: () => level,
    subscribe(fn) {
      subscribers.add(fn);
      return () => {
        subscribers.delete(fn);
      };
    },
  };
}

/** The app-wide bus — what the two apps' `publishMicLevel` / `subscribeMicLevel` were. */
export const micLevel = createLevelBus();

/** RMS of one capture frame, sampling every 4th value — plenty for a meter. */
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
