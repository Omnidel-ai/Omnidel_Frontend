"use client";

/**
 * Header portrait that stops looking like a frozen photograph while the Acharya
 * is actually talking.
 *
 * Placeholder until a real lip-sync video exists. Two levels of motion:
 *  - 2+ portraits (extras come from `persona_meta`, see lib/acharya-portraits.ts):
 *    cross-fade between them on an interval, screensaver style.
 *  - 1 portrait, which is every acharya today: a slow Ken Burns drift, so the
 *    single photo still breathes instead of sitting dead on screen.
 *
 * Motion runs ONLY while `live` — an idle board must not animate in a karigar's
 * peripheral vision (or burn battery on a low-end phone). `prefers-reduced-motion`
 * disables both paths.
 */

import { useEffect, useState, type CSSProperties } from "react";
import AcharyaAvatar from "@/components/acharya-avatar";

const SLIDE_MS = 5000;
const FADE_MS = 900;

interface Props {
  slug?: string;
  name: string;
  /** Primary first. Falls back to AcharyaAvatar when empty. */
  portraits: string[];
  initial?: string;
  size: number;
  live: boolean;
  radius: number;
  imageStyle?: CSSProperties;
  /**
   * Stretch to the parent box instead of a `size`×`size` square — used by the
   * board's landscape hero. `size` is still required: it is the fallback
   * initial-letter avatar's size when no portrait renders.
   */
  fill?: boolean;
}

export default function AcharyaPortrait({
  slug,
  name,
  portraits,
  initial,
  size,
  live,
  radius,
  imageStyle,
  fill = false,
}: Props) {
  const [index, setIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Drop anything that 404s so a bad persona_meta URL can't fade the portrait
  // to an empty box mid-conversation.
  const usable = portraits.filter((url) => !failed.has(url));
  const canCycle = live && !reduceMotion && usable.length > 1;

  useEffect(() => {
    if (!canCycle) return;
    const id = window.setInterval(() => {
      setIndex((i) => i + 1);
    }, SLIDE_MS);
    return () => window.clearInterval(id);
  }, [canCycle]);

  // No renderable portrait at all — initial-letter avatar, same as everywhere.
  if (usable.length === 0) {
    return (
      <AcharyaAvatar
        slug={slug}
        name={name}
        initial={initial}
        size={size}
        shape="rounded"
        style={
          fill
            ? { position: "absolute", inset: 0, width: "100%", height: "100%", borderRadius: 0, borderWidth: 0 }
            : { borderRadius: radius, boxShadow: PORTRAIT_SHADOW }
        }
        imageStyle={imageStyle}
      />
    );
  }

  const kenBurns = live && !reduceMotion && usable.length === 1;
  // Derived, never reset in an effect: `index` only ever increments, so ending
  // a session (canCycle false) snaps back to the primary portrait on its own.
  const safeIndex = canCycle ? index % usable.length : 0;

  return (
    <span
      style={
        fill
          ? {
              position: "absolute",
              inset: 0,
              display: "block",
              overflow: "hidden",
              background: "var(--ink)",
            }
          : {
              position: "relative",
              display: "inline-block",
              width: size,
              height: size,
              borderRadius: radius,
              overflow: "hidden",
              background: "var(--color-accent-soft)",
              borderWidth: 1,
              borderStyle: "solid",
              borderColor: "var(--rule)",
              boxShadow: PORTRAIT_SHADOW,
              flexShrink: 0,
            }
      }
      aria-hidden
    >
      {usable.map((url, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={url}
          src={url}
          alt=""
          onError={() => {
            setFailed((prev) => {
              if (prev.has(url)) return prev;
              const next = new Set(prev);
              next.add(url);
              return next;
            });
          }}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: i === safeIndex ? 1 : 0,
            transition: `opacity ${FADE_MS}ms ease-in-out`,
            animation: kenBurns ? "acharya-ken-burns 14s ease-in-out infinite alternate" : undefined,
            ...imageStyle,
          }}
        />
      ))}
      {/* Scoped here rather than globals.css — this is the only user. */}
      <style>{`
        @keyframes acharya-ken-burns {
          from { transform: scale(1) translate3d(0, 0, 0); }
          to   { transform: scale(1.08) translate3d(0, -2.5%, 0); }
        }
      `}</style>
    </span>
  );
}

const PORTRAIT_SHADOW = "0 1px 0 color-mix(in srgb, var(--ink) 12%, transparent)";
