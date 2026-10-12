"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { WalkthroughStep } from "@/lib/client/mahacharya-walkthroughs";
import type { TaskGuidedFillValues } from "@/lib/client/task-guided-fill";
import { applyFieldFill, setGuidedFill } from "@/lib/client/task-guided-fill";
import { useTr } from "@/lib/client/language";

// ─────────────────────────────────────────────────────────────────────────────
// Walkthrough — the "show me how" guided tour.
//
// Given an ordered list of steps, it walks the user through a real product flow:
//   1. Navigate to step.route (next/navigation) if we aren't already there.
//   2. Find the live element via `[data-mah="<anchor>"]`, scroll it into view,
//      and draw a highlight ring + a coach-mark with step.label over it.
//   3. The user reads, does the action themselves, then clicks Next to advance.
//
// AUTO-FILL (create_task only):
//   When a step carries a `fillKey` AND `fillValues` were supplied by the parent
//   (from the proposal's args), the Walkthrough applies the value automatically
//   as the step becomes active:
//   - Title (fillKey:"title")  → written via setGuidedFill() BEFORE the modal
//     opens, so TaskCreateModal picks it up on its first render via
//     consumeGuidedFill().
//   - Priority / assignees / due_date → written via applyFieldFill() AFTER the
//     modal is open; the modal's useEffect listener updates its controlled state.
//   A 350ms pause after reaching a fill step lets the user see the value appear
//   before "Next" is auto-advanced (we do NOT auto-advance — the user still
//   taps Next; the pause just makes the fill visible).
//
// OPEN-ON-RESOLVE (openOnResolve: true on a step):
//   The assistant programmatically clicks the resolved anchor after a short
//   highlight pause (OPEN_DELAY_MS). This is used for the "Add Task" button on
//   the board page — clicking it via its real onClick fires setCreateOpen(true),
//   which opens the modal. The Walkthrough then auto-advances to the title step
//   so field fills run against the now-open modal. The user never has to click
//   the button; the walkthrough operates it. This pattern is NOT used for Save —
//   the user must always be the one to submit.
//
// The final step (Save button) never auto-fills or auto-clicks — the user taps.
//
// The highlight is a fixed-position overlay measured from the target's bounding
// box, re-measured on scroll/resize so it tracks the element.
//
// Robustness: an anchor may not exist yet (route still mounting, a modal not
// open, the element gated by permissions). We poll briefly for it; if it never
// appears we still show the coach-mark centred with the instruction, so the tour
// never dead-ends.
// ─────────────────────────────────────────────────────────────────────────────

interface WalkthroughProps {
  steps: WalkthroughStep[];
  onClose: () => void;
  /**
   * Fired ONLY when the user reaches and confirms the final step ("Done"),
   * i.e. the guided flow was actually completed — not on an early "Exit". Phase
   * D records this as a completed_action feedback signal.
   */
  onComplete?: () => void;
  /**
   * Values from the proposal's args (title, priority, assignee_ids, due_date).
   * When provided, steps with a matching fillKey auto-fill the form field as the
   * step becomes active. If absent the walkthrough is highlight-only (Phase C
   * original behaviour; used for create_lead).
   */
  fillValues?: TaskGuidedFillValues;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const ANCHOR_POLL_MS = 120;
const ANCHOR_POLL_TRIES = 20; // ~2.4s total before falling back to centred card.

// How long to pause on a fill step so the user can see the value appear before
// the coach-mark re-renders with the "Next" prompt. The user still taps Next;
// we do not auto-advance. This is purely a visual breathing space.
const FILL_APPLY_DELAY_MS = 350;


export function Walkthrough({ steps, onClose, onComplete, fillValues }: WalkthroughProps) {
  const tr = useTr();
  const router = useRouter();
  const pathname = usePathname();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [resolving, setResolving] = useState(true);
  // Tracks whether we have already applied the fill for the current step so we
  // don't fire it twice (e.g. on scroll/resize re-renders).
  const fillAppliedRef = useRef<number>(-1);
  // Tracks whether we have already fired the programmatic click for an
  // openOnResolve step — same guard as fillAppliedRef to prevent double-fire
  // on scroll/resize re-renders while the timeout is pending.
  const openFiredRef = useRef<number>(-1);
  // For nav steps: the resolved clickable element + its listener cleanup, so the
  // user can advance by tapping the highlighted control OR via the Next button.
  const navClickableRef = useRef<HTMLElement | null>(null);
  const navCleanupRef = useRef<(() => void) | null>(null);
  const pollRef = useRef<number | null>(null);

  const step = steps[index];
  const isLast = index === steps.length - 1;

  // When the user taps "Show me how" and fillValues are present, store the title
  // immediately so TaskCreateModal picks it up via consumeGuidedFill() on open.
  // This runs once on mount. Other fields (priority, assignees, due_date) are
  // applied via applyFieldFill() per-step below because the modal is already
  // open by then.
  useEffect(() => {
    if (!fillValues) return;
    const initialFill: TaskGuidedFillValues = {};
    if (fillValues.title) initialFill.title = fillValues.title;
    if (Object.keys(initialFill).length > 0) setGuidedFill(initialFill);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally runs only once on mount

  // Navigate to the step's route when the anchor is not present on the current
  // page. We check the anchor directly rather than comparing pathnames so that:
  //   a) Being on an exact sub-route (e.g. /omnipulse/boards/[id]) does NOT
  //      suppress navigation when the anchor belongs to the listing page —
  //      the user must go to /omnipulse/boards first for the board-open step
  //      (Bug 2 fix).
  //   b) Dynamic routes that happen to contain the anchor in-place are still
  //      handled: the anchor presence check below prevents the yank.
  useEffect(() => {
    if (!step) return;
    if (pathname === step.route) return;
    // When the step targets a SPECIFIC board (/omnipulse/boards/<uuid>), always
    // navigate there — even if the current (different) board shows the same
    // anchor (e.g. its own Add Task button). Otherwise we'd open the form on the
    // wrong board.
    const targetsSpecificBoard = /\/omnipulse\/boards\/[0-9a-f-]{8,}/i.test(step.route);
    if (
      !targetsSpecificBoard &&
      typeof document !== "undefined" &&
      document.querySelector(`[data-mah="${step.anchor}"]`)
    ) {
      return; // generic route + anchor already visible here — no navigation needed.
    }
    router.push(step.route);
  }, [step, pathname, router]);

  const measure = useCallback((el: Element): Rect => {
    const r = el.getBoundingClientRect();
    return { top: r.top, left: r.left, width: r.width, height: r.height };
  }, []);

  // Resolve + track the anchor for the current step. Polls until the element
  // exists (route/modal still mounting), then keeps the highlight glued to it on
  // scroll/resize. Falls back to a centred coach-mark if it never appears.
  useEffect(() => {
    if (!step) return;
    // Start hunting once we're on the step's route (or a sub-route) OR the anchor
    // is already present where we stand (dynamic-route case).
    const anchorHere =
      typeof document !== "undefined" && !!document.querySelector(`[data-mah="${step.anchor}"]`);
    const onRoute = pathname === step.route || pathname.startsWith(step.route + "/");
    if (!onRoute && !anchorHere) return;

    let tries = 0;
    let target: Element | null = null;
    setResolving(true);
    setRect(null);

    function clearPoll() {
      if (pollRef.current !== null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }

    function lockOn(el: Element) {
      target = el;
      setResolving(false);
      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      setRect(measure(el));

      // Apply fill value for this step if one is configured and we haven't yet.
      if (fillValues && step.fillKey && fillAppliedRef.current !== index) {
        fillAppliedRef.current = index;
        const value = fillValues[step.fillKey];
        if (value !== undefined) {
          // Small delay so the element is visible before the value appears.
          window.setTimeout(() => {
            if (fillValues && step.fillKey) {
              applyFieldFill(step.fillKey, value);
            }
          }, FILL_APPLY_DELAY_MS);
        }
      }

      // Navigation step (openOnResolve): DON'T auto-click — the user controls the
      // pace. We highlight the control and advance when the user TAPS it (real
      // navigation / modal-open) or clicks Next (which taps it for them). Store
      // the clickable element so the Next button can trigger it. Cards wrap a
      // Next <Link>, so the real target is the inner <a>/<button>, not the div.
      if (step.openOnResolve) {
        const clickable =
          el instanceof HTMLElement
            ? el.matches("a,button")
              ? el
              : (el.querySelector("a,button") as HTMLElement | null) ?? el
            : null;
        navClickableRef.current = clickable;
        navCleanupRef.current?.();
        navCleanupRef.current = null;
        if (clickable) {
          const onTap = () => {
            if (openFiredRef.current === index) return;
            openFiredRef.current = index;
            // Let the link's navigation / modal-open run first, then advance.
            window.setTimeout(() => setIndex((i) => i + 1), 60);
          };
          clickable.addEventListener("click", onTap);
          navCleanupRef.current = () => clickable.removeEventListener("click", onTap);
        }
      }
    }

    pollRef.current = window.setInterval(() => {
      const el = document.querySelector(`[data-mah="${step.anchor}"]`);
      if (el) {
        clearPoll();
        lockOn(el);
      } else if (++tries >= ANCHOR_POLL_TRIES) {
        clearPoll();
        // A nav step (openOnResolve) whose anchor never appears means we're past
        // it in the hierarchy (e.g. already on the projects view or board detail)
        // — skip it instead of hanging on a dead "opening…" card with no Next.
        if (step.openOnResolve && index < steps.length - 1) {
          setIndex((i) => i + 1);
        } else {
          setResolving(false); // highlight steps fall back to a centred card
        }
      }
    }, ANCHOR_POLL_MS);

    function track() {
      if (target) setRect(measure(target));
    }
    window.addEventListener("scroll", track, true);
    window.addEventListener("resize", track);

    return () => {
      clearPoll();
      navCleanupRef.current?.();
      navCleanupRef.current = null;
      window.removeEventListener("scroll", track, true);
      window.removeEventListener("resize", track);
    };
  }, [step, index, pathname, measure, fillValues]);

  if (!step) return null;

  function next() {
    // Nav step: clicking Next performs the navigation/open for the user (same as
    // tapping the highlighted control), then advances. The onTap listener guards
    // against a double advance.
    if (step.openOnResolve) {
      navClickableRef.current?.click();
      if (openFiredRef.current !== index) {
        openFiredRef.current = index;
        window.setTimeout(() => setIndex((i) => i + 1), 60);
      }
      return;
    }
    if (isLast) {
      // Genuine completion (final "Done") — signal it before closing.
      onComplete?.();
      onClose();
    } else {
      setIndex((i) => i + 1);
    }
  }

  // Coach-mark position: below the target when there's room, else above; centred
  // when no anchor resolved. Padding gives the highlight ring some breathing room.
  // z-index budget: modals sit at 1000; the walkthrough must be above them so
  // the coach-mark is readable when a task/add-task modal is open. We use 3000
  // for the ring/backdrop and 3001 for the mark card (Bug 3 fix).
  const WALK_Z_RING = 3000;
  const WALK_Z_MARK = 3001;

  const pad = 6;
  const ring: CSSProperties | null = rect
    ? {
        position: "fixed",
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
        border: "2px solid var(--green-deep)",
        borderRadius: "var(--r-sm)",
        boxShadow: "0 0 0 9999px rgba(20, 30, 22, 0.45)",
        pointerEvents: "none",
        zIndex: WALK_Z_RING,
        transition: "all .15s ease",
      }
    : null;

  // Coach-mark position: below the target when there's room, else above. When
  // the highlighted element is inside a modal (which fills the viewport), keep
  // the mark at the top of the viewport so it's never clipped. Always clamp to
  // the viewport so it stays visible.
  const markTop = rect
    ? rect.top + rect.height + pad + 10 + 150 > window.innerHeight
      ? Math.max(12, rect.top - pad - 10 - 150) // above
      : Math.min(rect.top + rect.height + pad + 10, window.innerHeight - 170) // below, clamped
    : undefined;

  // Keep the coach-mark clear of the MahAcharya chat panel (~400px, bottom
  // left or right). Default assumes right-docked (historical); clamp still
  // keeps the 300px mark inside the viewport.
  const CHAT_SAFE_LEFT = typeof window !== "undefined" ? window.innerWidth - 720 : 9999;
  const markStyle: CSSProperties = rect
    ? {
        position: "fixed",
        top: markTop,
        left: Math.max(12, Math.min(rect.left, Math.max(12, CHAT_SAFE_LEFT))),
        zIndex: WALK_Z_MARK,
        ...markBase,
      }
    : { position: "fixed", top: "50%", left: Math.max(12, Math.min(CHAT_SAFE_LEFT, 12)), zIndex: WALK_Z_MARK, ...markBase };

  // Determine if this step auto-fills a value (for the badge copy).
  const isFillStep = !!(step.fillKey && fillValues?.[step.fillKey] !== undefined);
  // Nav steps (openOnResolve): the user advances by tapping the highlighted
  // control or clicking Next (which taps it for them) — no auto-click.
  const isNavStep = !!step.openOnResolve;

  return (
    <>
      {/* Dim backdrop when there's no ring (centred fallback) — the ring's own
          box-shadow provides the dim when an anchor is highlighted. */}
      {!rect && <div style={backdropStyle} />}
      {ring && <div style={ring} aria-hidden="true" />}

      <div style={markStyle} role="dialog" aria-label={tr("MahAcharya walkthrough")}>
        <div style={stepCountStyle}>
          {tr("Step")} {index + 1} of {steps.length}
        </div>
        <p style={labelTextStyle}>{step.label}</p>
        {isFillStep && (
          <p style={fillNoteStyle}>
            {tr("Auto-filled from your request")}
          </p>
        )}
        {isNavStep && !resolving && (
          <p style={hintStyle}>{tr("Tap the highlighted item, or click Continue.")}</p>
        )}
        {step.prefill && !isFillStep && !isNavStep && (
          <p style={prefillStyle}>
            {tr("Suggested:")} <span style={prefillValueStyle}>{step.prefill}</span>
          </p>
        )}
        {resolving && <p style={hintStyle}>{tr("Looking for that on the page…")}</p>}
        <div style={actionsStyle}>
          <button type="button" onClick={onClose} style={skipBtnStyle}>
            {tr("Exit")}
          </button>
          <button type="button" onClick={next} style={nextBtnStyle}>
            {isNavStep ? tr("Continue ›") : isLast ? tr("Review and tap Save") : tr("Next")}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Styles (CSS variables only) ─────────────────────────────────────────────

const backdropStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(20, 30, 22, 0.45)",
  // z-index is set inline (WALK_Z_RING) so it can reference the constant
  // defined inside the component (avoids a magic number here).
  zIndex: 3000,
};
const markBase: CSSProperties = {
  // z-index set inline per instance (WALK_Z_MARK = 3001).
  width: 300,
  maxWidth: "calc(100vw - 24px)",
  background: "var(--surface)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  borderRadius: "var(--r-md)",
  boxShadow: "var(--shadow-md)",
  padding: 14,
};
const stepCountStyle: CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 10,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--ink-mute)",
  marginBottom: 6,
};
const labelTextStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--sans)",
  fontSize: 13,
  lineHeight: 1.5,
  color: "var(--ink)",
};
const fillNoteStyle: CSSProperties = {
  margin: "6px 0 0",
  fontFamily: "var(--mono)",
  fontSize: 10,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--green-deep)",
  background: "var(--green-wash)",
  display: "inline-block",
  padding: "2px 6px",
  borderRadius: 999,
};
const prefillStyle: CSSProperties = {
  margin: "8px 0 0",
  fontFamily: "var(--sans)",
  fontSize: 12,
  color: "var(--ink-soft)",
};
const prefillValueStyle: CSSProperties = {
  fontFamily: "var(--mono)",
  color: "var(--green-deep)",
};
const hintStyle: CSSProperties = {
  margin: "8px 0 0",
  fontFamily: "var(--sans)",
  fontSize: 11,
  fontStyle: "italic",
  color: "var(--ink-mute)",
};
const actionsStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  marginTop: 12,
};
const skipBtnStyle: CSSProperties = {
  padding: "6px 12px",
  fontFamily: "var(--sans)",
  fontSize: 12,
  fontWeight: 500,
  color: "var(--ink-soft)",
  background: "var(--surface)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule-strong)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
};
const nextBtnStyle: CSSProperties = {
  padding: "6px 14px",
  fontFamily: "var(--sans)",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--page)",
  background: "var(--green-deep)",
  borderWidth: 0,
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
};
