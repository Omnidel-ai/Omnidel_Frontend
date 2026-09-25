"use client";

/**
 * Google-Meet-style speaking bars for an open mic.
 *
 * Reads the live mic RMS off `voice-level`'s bus and writes bar heights
 * straight to the DOM inside one rAF loop — deliberately no React state, so a
 * meter running at 60fps never re-renders the screen it sits on.
 *
 * Bars settle to a flat line at silence rather than idling with a fake
 * animation: on this app the meter is the only proof the mic is actually
 * hearing the karigar, so it must never move when it isn't.
 */

import { useEffect, useRef, type CSSProperties } from "react";
import { getMicLevel, subscribeMicLevel } from "@/lib/voice-level";

/** Per-bar gain — the middle bars swing hardest, like Meet's meter. */
const BAR_WEIGHTS = [0.55, 0.9, 1, 0.7, 0.45];

interface Props {
  /** How many bars. 3 in a 40px button, 5 in the PiP window. */
  bars?: number;
  /** Full bar height in px; bars scale between ~18% and 100% of it. */
  height?: number;
  width?: number;
  gap?: number;
  /** Bar colour — defaults to the parent's text colour. */
  color?: string;
}

export function VoiceWaveform({
  bars = 4,
  height = 16,
  width = 3,
  gap = 2.5,
  color = "currentColor",
}: Props) {
  const barRefs = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    let raf = 0;
    let target = getMicLevel();
    let current = target;
    const unsubscribe = subscribeMicLevel((v) => {
      target = v;
    });

    const tick = () => {
      // Ease toward the newest frame: capture frames land ~11×/s, so stepping
      // straight to them makes the bars strobe instead of breathe.
      current += (target - current) * 0.28;
      // Speech RMS lives around 0.05–0.25, so lift it into a usable range and
      // clamp — shouting should max the meter, not overflow the button.
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
  }, []);

  return (
    <span
      aria-hidden
      style={{ display: "inline-flex", alignItems: "center", gap, height }}
    >
      {Array.from({ length: bars }, (_, i) => (
        <span
          key={i}
          ref={(el) => {
            barRefs.current[i] = el;
          }}
          style={{
            ...barStyle,
            width,
            height,
            background: color,
          }}
        />
      ))}
    </span>
  );
}

const barStyle: CSSProperties = {
  display: "block",
  borderRadius: 999,
  transformOrigin: "center",
  transform: "scaleY(0.18)",
  willChange: "transform",
};
