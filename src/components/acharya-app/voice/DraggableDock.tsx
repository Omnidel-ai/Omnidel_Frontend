"use client";

/**
 * Floating dock the karigar can drag anywhere on screen — used for the
 * Start/End conversation pill on the acharya board AND on the task / learn /
 * timer screens nested under it.
 *
 * Why draggable: the pill is fixed over the screen, so on an empty board it
 * sits right on top of the inline chat composer (and on a full board, over the
 * last card). Dragging lets the worker park it out of the way instead of us
 * guessing one safe spot. Everything behind it stays usable: the full-screen
 * wrapper is `pointer-events: none` and only the pill itself takes touches —
 * which is also why it may be parked directly OVER a task card: the card stays
 * tappable everywhere the pill is not.
 *
 * Tap vs drag: a pointer that never travels DRAG_THRESHOLD px is a tap and the
 * child button gets its click. Past the threshold we swallow the click in the
 * capture phase, so letting go after a drag never starts/ends a voice session.
 *
 * Position is viewport px (top-left of the dock), persisted PER SURFACE in the
 * store (a spot clear of the board's cards may sit on the task screen's session
 * CTA) and re-clamped into view on mount / resize — a phone rotation or a
 * narrower screen would otherwise leave the pill parked off-screen for good.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useStore, type DockPoint, type VoiceDockSurface } from "@/lib/store";

/** Keep the dock this far inside the viewport edges. */
const EDGE = 8;
/** Travel before a press becomes a drag rather than a tap. */
const DRAG_THRESHOLD = 6;
/**
 * How long after a drag a click still counts as "the tail of that drag".
 * Time-boxed rather than a sticky flag: a drag that ends without a click (finger
 * lifted off the pill) must not swallow the NEXT real tap.
 */
const CLICK_SWALLOW_MS = 400;

type Point = DockPoint;

/**
 * Where an un-parked dock sits.
 * - `bottom-center`: the board — nothing owns the bottom edge there.
 * - `right-center`: task / learn / timer. Those screens own BOTH edges — the
 *   strip under the header carries back / ACTIVE SESSION / Task Done, and the
 *   bottom carries the proof + session CTAs — so the pill starts between them,
 *   over the content it is now allowed to cover. One drag moves it anywhere.
 */
export type DockPlacement = "bottom-center" | "right-center";

const PLACEMENT_STYLE: Record<DockPlacement, CSSProperties> = {
  "bottom-center": {
    left: "50%",
    bottom: "max(env(safe-area-inset-bottom), 14px)",
    transform: "translateX(-50%)",
  },
  "right-center": {
    right: 12,
    top: "50%",
    transform: "translateY(-50%)",
  },
};

export function DraggableDock({
  children,
  surface,
  placement = "bottom-center",
  zIndex = 40,
  ariaLabel,
}: {
  children: ReactNode;
  /** Which parked position this dock reads/writes. */
  surface: VoiceDockSurface;
  /** Where it sits until the karigar drags it. */
  placement?: DockPlacement;
  zIndex?: number;
  /** Names the drag handle for screen readers / tooltips. */
  ariaLabel?: string;
}) {
  const parked = useStore((s) => s.voiceDockPos[surface] ?? null);
  const setVoiceDockPos = useStore((s) => s.setVoiceDockPos);
  const setParked = useCallback(
    (pos: Point | null) => setVoiceDockPos(surface, pos),
    [setVoiceDockPos, surface],
  );

  const nodeRef = useRef<HTMLDivElement>(null);
  // Live position during a drag — local so a move is one paint, not a store write.
  const [dragPos, setDragPos] = useState<Point | null>(null);
  const [dragging, setDragging] = useState(false);
  const grabRef = useRef<{ px: number; py: number; left: number; top: number } | null>(null);
  const movedRef = useRef(false);
  // Latest dragged position, mirrored out of state so pointerup can commit it
  // without reading state inside an updater.
  const livePosRef = useRef<Point | null>(null);
  const dragEndedAtRef = useRef(0);

  const clamp = useCallback((point: Point): Point => {
    const el = nodeRef.current;
    const w = el?.offsetWidth ?? 0;
    const h = el?.offsetHeight ?? 0;
    const maxX = Math.max(EDGE, window.innerWidth - w - EDGE);
    const maxY = Math.max(EDGE, window.innerHeight - h - EDGE);
    return {
      x: Math.min(Math.max(point.x, EDGE), maxX),
      y: Math.min(Math.max(point.y, EDGE), maxY),
    };
  }, []);

  // Pull a persisted position back on screen, so a dock saved on a bigger
  // screen never stays parked outside the viewport.
  useEffect(() => {
    if (!parked) return;
    const next = clamp(parked);
    if (next.x !== parked.x || next.y !== parked.y) setParked(next);
    // Only on mount / when the parked value itself changes.
  }, [parked, clamp, setParked]);

  useEffect(() => {
    if (!parked) return;
    function onResize() {
      const current = useStore.getState().voiceDockPos[surface];
      if (!current) return;
      const next = clamp(current);
      if (next.x !== current.x || next.y !== current.y) setParked(next);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [parked, clamp, setParked, surface]);

  /**
   * Re-clamp when the DOCK ITSELF changes size, not just the viewport.
   *
   * The clamp above runs on mount and on a parked-value change, and measures
   * `offsetWidth` at that moment. A dock whose content grows LATER — the video
   * button appearing beside the mic once its availability probe resolves — was
   * never re-measured, so a dock parked near the right edge kept its old x and
   * the new control rendered off-screen. It looked exactly like the feature not
   * shipping. Anything that changes the dock's footprint has to re-clamp it.
   */
  useEffect(() => {
    const el = nodeRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const current = useStore.getState().voiceDockPos[surface];
      if (!current) return;
      const next = clamp(current);
      if (next.x !== current.x || next.y !== current.y) setParked(next);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [clamp, setParked, surface]);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    // Mouse: left button only. Touch/pen: any contact.
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const el = nodeRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    grabRef.current = { px: e.clientX, py: e.clientY, left: rect.left, top: rect.top };
    movedRef.current = false;
    el.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const grab = grabRef.current;
      if (!grab) return;
      const dx = e.clientX - grab.px;
      const dy = e.clientY - grab.py;
      if (!movedRef.current && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      if (!movedRef.current) {
        movedRef.current = true;
        setDragging(true);
      }
      const next = clamp({ x: grab.left + dx, y: grab.top + dy });
      livePosRef.current = next;
      setDragPos(next);
    },
    [clamp],
  );

  const endDrag = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const el = nodeRef.current;
      if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      grabRef.current = null;
      setDragging(false);
      const dropped = livePosRef.current;
      livePosRef.current = null;
      setDragPos(null);
      if (movedRef.current) {
        movedRef.current = false;
        // The click that follows this pointerup belongs to the drag, not to the
        // pill — see swallowClickAfterDrag.
        dragEndedAtRef.current = performance.now();
        if (dropped) setParked(dropped);
      }
    },
    [setParked],
  );

  const swallowClickAfterDrag = useCallback((e: React.MouseEvent) => {
    if (performance.now() - dragEndedAtRef.current > CLICK_SWALLOW_MS) return;
    dragEndedAtRef.current = 0;
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const position = dragPos ?? parked;

  return (
    <div style={{ ...wrap, zIndex }}>
      <div
        ref={nodeRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={swallowClickAfterDrag}
        title={ariaLabel}
        style={{
          ...dock,
          ...(position ? { left: position.x, top: position.y } : PLACEMENT_STYLE[placement]),
          cursor: dragging ? "grabbing" : "grab",
          filter: dragging
            ? "drop-shadow(0 10px 18px color-mix(in srgb, var(--ink) 28%, transparent))"
            : "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}

const wrap: CSSProperties = {
  position: "fixed",
  inset: 0,
  // The strip must never eat taps on the screen behind the pill.
  pointerEvents: "none",
};

const dock: CSSProperties = {
  position: "absolute",
  pointerEvents: "auto",
  display: "inline-flex",
  // No browser pan/zoom gesture on the pill — the pointer stream is ours.
  touchAction: "none",
};
