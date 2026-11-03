import { useEffect, useRef, type CSSProperties } from "react";
import { micLevel, type LevelSource } from "./micLevel";

/** Per-bar gain — the middle bars swing hardest. */
const BAR_WEIGHTS = [0.55, 0.9, 1, 0.7, 0.45];

export interface VoiceWaveformProps {
  /** 3 in a 40px button, 4 in the dock mic, 5 in a PiP window. */
  bars?: number;
  /** Full bar height in px; bars scale between ~18% and 100% of it. */
  height?: number;
  width?: number;
  gap?: number;
  /** Bar colour — defaults to the parent's text colour. */
  color?: string;
  /** Where the level comes from. Defaults to the app-wide `micLevel` bus. */
  source?: LevelSource;
}

/**
 * Speaking bars for an open mic.
 *
 * Identical in both apps (`voice/VoiceWaveform.tsx` in Kaarigar,
 * `voice/voice-waveform.tsx` in Contractor). It reads the live level off a bus
 * and writes `scaleY` in one rAF loop, with no React state. The bars settle flat
 * at silence and never idle on a canned animation. On a noisy site this meter is
 * the only proof the phone can hear the person, so it must not move when the
 * phone can't.
 */
export function VoiceWaveform({ bars = 4, height = 18, width = 3, gap = 3, color = "currentColor", source = micLevel }: VoiceWaveformProps) {
  const barRefs = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    let raf = 0;
    let target = source.get();
    let current = target;
    const unsubscribe = source.subscribe((v) => {
      target = v;
    });
    const tick = () => {
      // Ease toward the newest frame; stepping straight to it strobes.
      current += (target - current) * 0.28;
      const amplitude = Math.min(1, current * 3.6);
      for (let i = 0; i < barRefs.current.length; i++) {
        const el = barRefs.current[i];
        if (!el) continue;
        const weight = BAR_WEIGHTS[i % BAR_WEIGHTS.length];
        el.style.transform = `scaleY(${(0.18 + amplitude * weight * 0.82).toFixed(3)})`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      unsubscribe();
    };
  }, [source]);

  return (
    <span aria-hidden style={{ display: "inline-flex", alignItems: "center", gap, height }}>
      {Array.from({ length: bars }, (_, i) => (
        <span
          key={i}
          ref={(el) => {
            barRefs.current[i] = el;
          }}
          style={{ ...BAR, width, height, background: color }}
        />
      ))}
    </span>
  );
}

const BAR: CSSProperties = {
  display: "block",
  borderRadius: 999,
  transformOrigin: "center",
  transform: "scaleY(0.18)",
  willChange: "transform",
};
