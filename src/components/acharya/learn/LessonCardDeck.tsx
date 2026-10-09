"use client";

/**
 * The lesson as a deck of cards, one module per card, swiped through.
 *
 * It was a column of accordions: three collapsed headings, and everything
 * worth reading one tap and one scroll away. A deck puts the module the
 * karigar is on in front of them, open, and shows by the edges behind it how
 * much is left — which is the thing a list of closed rows could not say.
 *
 * Nothing here decides how a card LOOKS. It is handed finished cards and owns
 * only the stack, the drag and the position, so the lesson's own type and
 * colour stay in TaskCourseView where they were.
 *
 * Deliberate:
 *
 *  - **Swipe is never the only way through.** Prev/Next are real buttons and
 *    the arrow keys work, because a swipe is invisible, undiscoverable and
 *    unusable with a screen reader. The karigars this app is for are also the
 *    least likely to have met the gesture.
 *  - **Vertical scrolling wins.** A card can be longer than the screen, and a
 *    deck that grabs every drag would make its own content unreadable. The
 *    gesture only becomes a swipe once it is clearly more horizontal than
 *    vertical, and until then the card scrolls as normal.
 *  - **It does not wrap.** A lesson is ordered; snapping from the last module
 *    back to the first would lose the karigar their place. The edge is a
 *    resisted drag that springs back.
 */

import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

/** How far a mostly-horizontal drag must travel to turn the card. */
const COMMIT_PX = 64;
/** Past the ends the card still moves, but grudgingly. */
const EDGE_RESISTANCE = 0.32;
/** Cards drawn behind the front one. More than two is a smudge, not a stack. */
const VISIBLE_BEHIND = 2;

interface Props {
  /** One finished card body per module, in lesson order. */
  cards: ReactNode[];
  /** Accessible name for card `i`, e.g. "Module 2 of 5: Communicating". */
  labelFor: (index: number) => string;
  /** Text for the position readout, e.g. `(2, 5) => "2 / 5"`. */
  positionLabel: (current: number, total: number) => string;
  previousLabel: string;
  nextLabel: string;
}

export default function LessonCardDeck({
  cards,
  labelFor,
  positionLabel,
  previousLabel,
  nextLabel,
}: Props) {
  const [storedIndex, setIndex] = useState(0);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);

  const startRef = useRef<{ x: number; y: number } | null>(null);
  /** null until the gesture has declared itself horizontal or vertical. */
  const axisRef = useRef<"x" | "y" | null>(null);
  const total = cards.length;

  /**
   * Clamped while rendering, not corrected afterwards in an effect.
   *
   * A reload that returns three modules while the karigar was on the fifth
   * leaves the stored index pointing at nothing. Fixing that in an effect
   * paints an empty deck first and then re-renders; deriving it paints the
   * right card immediately, and `setIndex` is still free to hold whatever the
   * drag put there.
   */
  const index = Math.min(storedIndex, Math.max(total - 1, 0));

  /**
   * Written as an updater rather than `setIndex(index + delta)` so a pointer
   * handler cannot act on a stale `index` captured when the drag began.
   */
  const step = useCallback(
    (delta: number) => {
      setIndex((current) => Math.min(Math.max(current + delta, 0), total - 1));
    },
    [total],
  );

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    // Mouse wheel / secondary buttons are not swipes.
    if (event.pointerType === "mouse" && event.button !== 0) return;
    startRef.current = { x: event.clientX, y: event.clientY };
    axisRef.current = null;
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const start = startRef.current;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;

    if (axisRef.current === null) {
      // Wait for a real direction. 10px of slop, then whichever axis is
      // clearly ahead — a tie stays vertical, because reading is the default
      // and stealing a scroll is worse than missing a swipe.
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      axisRef.current = Math.abs(dx) > Math.abs(dy) * 1.2 ? "x" : "y";
      if (axisRef.current === "x") {
        setDragging(true);
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }
    }
    if (axisRef.current !== "x") return;

    const atStart = index === 0 && dx > 0;
    const atEnd = index === total - 1 && dx < 0;
    setDrag(atStart || atEnd ? dx * EDGE_RESISTANCE : dx);
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (axisRef.current === "x") {
      if (drag <= -COMMIT_PX) step(1);
      else if (drag >= COMMIT_PX) step(-1);
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    startRef.current = null;
    axisRef.current = null;
    setDragging(false);
    setDrag(0);
  }

  if (total === 0) return null;

  return (
    <div>
      <div
        role="group"
        aria-roledescription="carousel"
        aria-label={labelFor(index)}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") { event.preventDefault(); step(1); }
          if (event.key === "ArrowLeft") { event.preventDefault(); step(-1); }
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={deckStyle}
      >
        {cards.map((card, i) => {
          const depth = i - index;
          // Only the front card and the two behind it are drawn; everything
          // else is left mounted but out of the way, so a long lesson does
          // not paint ten cards on every frame.
          if (depth < 0 || depth > VISIBLE_BEHIND) {
            return <div key={i} hidden>{card}</div>;
          }
          const isFront = depth === 0;
          const offset = isFront ? drag : 0;
          const lift = depth * 12;
          const shrink = 1 - depth * 0.045;
          return (
            <div
              key={i}
              aria-hidden={!isFront}
              // Behind cards are decoration; their buttons and links must not
              // be reachable by tab or by a stray tap through the front card.
              inert={!isFront}
              style={{
                ...cardStyle,
                zIndex: VISIBLE_BEHIND - depth,
                transform: `translate3d(${offset}px, ${lift}px, 0) scale(${shrink}) rotate(${isFront ? offset * 0.02 : 0}deg)`,
                opacity: depth === 0 ? 1 : 1 - depth * 0.28,
                transition: dragging ? "none" : "transform 260ms cubic-bezier(.2,.8,.3,1), opacity 220ms ease",
                pointerEvents: isFront ? "auto" : "none",
              }}
            >
              <div className="hide-scrollbar" style={cardScrollStyle}>
                {card}
              </div>
            </div>
          );
        })}
      </div>

      <div style={controlsStyle}>
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={index === 0}
          className="press"
          style={{ ...navButtonStyle, opacity: index === 0 ? 0.4 : 1 }}
        >
          <ArrowIcon dir="left" />
          {previousLabel}
        </button>

        <div style={dotsStyle} aria-hidden>
          {cards.map((_, i) => (
            <span
              key={i}
              style={{
                width: i === index ? 18 : 6,
                height: 6,
                borderRadius: 999,
                background: i === index ? "var(--green-deep)" : "var(--rule-strong)",
                transition: "width 200ms ease, background 200ms ease",
              }}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => step(1)}
          disabled={index === total - 1}
          className="press"
          style={{ ...navButtonStyle, opacity: index === total - 1 ? 0.4 : 1 }}
        >
          {nextLabel}
          <ArrowIcon dir="right" />
        </button>
      </div>

      {/* Announced on change; the dots are decoration and carry no text. */}
      <p aria-live="polite" style={positionStyle}>
        {positionLabel(index + 1, total)}
      </p>
    </div>
  );
}

function ArrowIcon({ dir }: { dir: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {dir === "left" ? <path d="M19 12H5M12 5l-7 7 7 7" /> : <path d="M5 12h14M12 5l7 7-7 7" />}
    </svg>
  );
}

const deckStyle: CSSProperties = {
  position: "relative",
  height: "min(62dvh, 520px)",
  /**
   * The cards behind are `inset: 0` translated DOWN, so they hang past the
   * deck's own box by `VISIBLE_BEHIND * 12`. Without clearance for that they
   * sit on top of the Prev/Next row — which is not just untidy, it puts a
   * decorative card over a control.
   */
  marginBottom: VISIBLE_BEHIND * 12 + 16,
  outline: "none",
  // The browser keeps vertical panning; horizontal is ours to interpret.
  touchAction: "pan-y",
};

const cardStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  transformOrigin: "50% 100%",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  borderRadius: "var(--r-xl)",
  background: "var(--surface)",
  boxShadow: "var(--shadow-md)",
  overflow: "hidden",
  willChange: "transform",
};

const cardScrollStyle: CSSProperties = {
  height: "100%",
  overflowY: "auto",
  overscrollBehavior: "contain",
  WebkitOverflowScrolling: "touch",
};

const controlsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const navButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  minHeight: 44,
  padding: "0 14px",
  borderRadius: 999,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule-strong)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontFamily: "var(--sans)",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  flexShrink: 0,
};

const dotsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 5,
};

const positionStyle: CSSProperties = {
  margin: "10px 0 0",
  textAlign: "center",
  fontFamily: "var(--mono)",
  fontSize: 11,
  letterSpacing: "0.1em",
  color: "var(--ink-mute)",
};
