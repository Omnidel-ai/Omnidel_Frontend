import { AvatarStack } from "../components";
import type { OmniPulseCard } from "./types";

/** Tone class for a list column, from the list's own `tone`. */
export function listToneClass(tone?: string): string {
  return `opx-list--${tone ?? "neutral"}`;
}

/**
 * The strip along the bottom of a task card: priority, due date, note counts,
 * then the assignees pushed to the right edge.
 *
 * Every chip is conditional — a card with nothing to say shows nothing, which
 * is what keeps a column of simple cards quiet.
 */
export function CardChips({ card }: { card: OmniPulseCard }) {
  const hasChips =
    card.priority || card.due || card.comments > 0 || card.attachments > 0 || card.assignees.length > 0;
  if (!hasChips) return null;

  return (
    <footer className="opx-card-item__foot">
      {card.priority && (
        <span className={`opx-chip opx-chip--${card.priority.toLowerCase()}`}>
          {card.priority.toUpperCase()}
        </span>
      )}

      {card.due && (
        <span className={`opx-chip opx-chip--due${card.overdue ? " opx-chip--overdue" : ""}`}>
          {card.overdue ? <ClockGlyph /> : <CheckGlyph />}
          {formatDue(card.due)}
        </span>
      )}

      {card.comments > 0 && (
        <span className="opx-meta">
          <CommentGlyph /> {card.comments}
        </span>
      )}

      {card.attachments > 0 && (
        <span className="opx-meta">
          <ClipGlyph /> {card.attachments}
        </span>
      )}

      <span style={{ marginLeft: "auto", display: "inline-flex" }}>
        <AvatarStack names={card.assignees} size={22} max={3} />
      </span>
    </footer>
  );
}

/**
 * "23 Sept" — the day and the short month, as the board writes it.
 *
 * Spelled out rather than taken from `toLocaleString`, which gives "Sep" for
 * September where the application shows "Sept".
 */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];

export function formatDue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function ClockGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function CheckGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CommentGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.3L3 21l1.2-3.6A8.4 8.4 0 1 1 21 11.5z" />
    </svg>
  );
}

function ClipGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.5 12.5 21a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L10 18.9a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9" />
    </svg>
  );
}
