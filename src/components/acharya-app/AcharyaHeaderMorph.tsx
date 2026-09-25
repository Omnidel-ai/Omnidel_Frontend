"use client";

/**
 * Board hero → task avatar: the portrait travels instead of teleporting.
 *
 * The acharya shell keeps ONE header mounted and swaps its variant when a child
 * screen reports `showBack` — so opening a task replaced a 250px landscape
 * portrait with a 92px square in a single frame, and the karigar had no way to
 * see that the small photo in the corner is the same acharya they were looking
 * at. This animates that swap: the big portrait shrinks up into the corner.
 *
 * The same flight runs the other way inside a task when the mic goes live and
 * the header expands back to the full portrait — one trigger (`expanded`),
 * whatever caused it.
 *
 * **How.** A ghost, not a layout animation. Morphing the header's own DOM would
 * mean the board and task layouts becoming one animatable tree, and those two
 * differ in more than size (stacked vs row, gradient vs wash, back button
 * treatment). Instead the header reports whichever portrait box it currently
 * renders; on a variant flip we take the box it had a moment ago as `from`, the
 * box it has now as `to`, and fly a fixed-position copy of the photograph
 * between them. Nothing about the header's own layout changes, so nothing about
 * it can regress.
 *
 * The ghost animates width/height/top/left rather than a transform: both boxes
 * are `object-fit: cover` on the same image at different aspect ratios, so the
 * crop has to be re-resolved every frame — a scale transform would squash the
 * face instead. It is one small element for ~360ms.
 *
 * **Why it waits for `hold`.** Navigation paints a full-screen skeleton overlay
 * (see components/instant-nav) and the variant flips underneath it, while the
 * task screen mounts. Animating then would play the whole morph behind a cream
 * panel. The header passes the overlay's state in as `hold`; the morph is queued
 * and runs on the first frame the karigar can actually see it.
 *
 * Reduced motion, no photograph, or no Web Animations support → no ghost, and
 * the swap stays exactly as instant as it was before.
 */

import { useCallback, useEffect, useRef } from "react";

const DURATION_MS = 380;
/** Out-quint-ish: leaves fast, lands soft — reads as the photo settling. */
const EASING = "cubic-bezier(0.22, 0.61, 0.36, 1)";

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
  radius: number;
  /** `object-position` of the real image in this box, so the crop lands too. */
  objectPosition: string;
}

function readBox(el: HTMLElement, radius: number, objectPosition: string): Box {
  const r = el.getBoundingClientRect();
  return {
    top: r.top,
    left: r.left,
    width: r.width,
    height: r.height,
    radius,
    objectPosition,
  };
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export interface HeaderMorphInput {
  /**
   * True when the big portrait band is on screen (the board, or any screen while
   * the mic is live). The flip of this value is the trigger.
   */
  expanded: boolean;
  /** Photograph to fly. Null (initial-letter fallback) → no morph. */
  imageUrl: string | null;
  /** Corner radius of the box the current variant draws. */
  radius: number;
  /** `object-position` the current variant uses for the real image. */
  objectPosition: string;
  /** True while a nav skeleton covers the screen — queue, do not play. */
  hold: boolean;
}

/**
 * Returns the ref callback to attach to the portrait box of EVERY variant (the
 * hero frame on the board, the avatar square on task/learn). One callback, one
 * box at a time — that is what makes the two comparable.
 */
export function useAcharyaHeaderMorph({
  expanded,
  imageUrl,
  radius,
  objectPosition,
  hold,
}: HeaderMorphInput): (el: HTMLElement | null) => void {
  const nodeRef = useRef<HTMLElement | null>(null);
  const lastBoxRef = useRef<Box | null>(null);
  /** null until the first commit — a deep link straight to a task never morphs. */
  const lastExpandedRef = useRef<boolean | null>(null);
  const queuedFromRef = useRef<Box | null>(null);

  const setNode = useCallback((el: HTMLElement | null) => {
    nodeRef.current = el;
  }, []);

  // Measure on every variant flip: the box we find is this variant's `to`, and
  // the one remembered from the previous flip (or mount) is its `from`. A
  // passive effect is enough — `from` was captured on an earlier commit, so
  // nothing here needs to run before paint.
  useEffect(() => {
    const el = nodeRef.current;
    if (!el) return;
    const box = readBox(el, radius, objectPosition);
    const previous = lastBoxRef.current;
    const flipped = lastExpandedRef.current !== null && lastExpandedRef.current !== expanded;
    lastExpandedRef.current = expanded;
    lastBoxRef.current = box;
    if (flipped && previous && previous.width > 0 && box.width > 0) {
      queuedFromRef.current = previous;
    }
  }, [expanded, radius, objectPosition]);

  // Re-measure when the viewport changes: a remembered box from before a rotate
  // would fly the photo in from the wrong place. Cheap — one rect on resize.
  useEffect(() => {
    function onResize() {
      const el = nodeRef.current;
      if (!el) return;
      lastBoxRef.current = readBox(el, radius, objectPosition);
    }
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [radius, objectPosition]);

  // Play the queued morph on the first frame the karigar can see it.
  useEffect(() => {
    if (hold) return;
    const from = queuedFromRef.current;
    queuedFromRef.current = null;
    const el = nodeRef.current;
    if (!from || !el || !imageUrl) return;
    if (prefersReducedMotion()) return;

    const to = readBox(el, radius, objectPosition);
    // Same place, same size: nothing to show, and a zero-distance ghost would
    // just flash the photo over the header.
    if (Math.abs(to.width - from.width) < 2 && Math.abs(to.height - from.height) < 2) return;

    const ghost = document.createElement("div");
    ghost.setAttribute("aria-hidden", "true");
    Object.assign(ghost.style, {
      position: "fixed",
      // Above the header (30), below the chat sheet (70) and the nav overlay
      // (80) — it has no business covering either.
      zIndex: "45",
      overflow: "hidden",
      pointerEvents: "none",
      background: "var(--ink)",
      boxShadow: "0 12px 34px rgba(0,0,0,0.30)",
      top: `${from.top}px`,
      left: `${from.left}px`,
      width: `${from.width}px`,
      height: `${from.height}px`,
      borderRadius: `${from.radius}px`,
    } as Partial<CSSStyleDeclaration>);

    const img = document.createElement("img");
    img.src = imageUrl;
    img.alt = "";
    img.decoding = "async";
    Object.assign(img.style, {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      objectPosition: from.objectPosition,
      display: "block",
    } as Partial<CSSStyleDeclaration>);
    ghost.appendChild(img);

    if (typeof ghost.animate !== "function") return;
    document.body.appendChild(ghost);

    const frames: Keyframe[] = [
      {
        top: `${from.top}px`,
        left: `${from.left}px`,
        width: `${from.width}px`,
        height: `${from.height}px`,
        borderRadius: `${from.radius}px`,
      },
      {
        top: `${to.top}px`,
        left: `${to.left}px`,
        width: `${to.width}px`,
        height: `${to.height}px`,
        borderRadius: `${to.radius}px`,
      },
    ];
    const timing: KeyframeAnimationOptions = {
      duration: DURATION_MS,
      easing: EASING,
      fill: "forwards",
    };

    const boxAnim = ghost.animate(frames, timing);
    // The crop travels too: the hero shows the face high in the frame, the
    // avatar square shows it centred, and landing on a different crop than the
    // real avatar is what would read as a jump at the end.
    const cropAnim =
      typeof img.animate === "function" && from.objectPosition !== to.objectPosition
        ? img.animate(
            [{ objectPosition: from.objectPosition }, { objectPosition: to.objectPosition }],
            timing,
          )
        : null;

    let cancelled = false;
    function cleanup() {
      if (cancelled) return;
      cancelled = true;
      ghost.remove();
    }
    boxAnim.finished.then(cleanup).catch(() => cleanup());

    return () => {
      boxAnim.cancel();
      cropAnim?.cancel();
      cleanup();
    };
  }, [hold, expanded, imageUrl, radius, objectPosition]);

  return setNode;
}
