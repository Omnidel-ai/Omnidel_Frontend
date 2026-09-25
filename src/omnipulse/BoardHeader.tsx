import { AvatarStack } from "../components";
import type { OmniPulseBoard } from "./types";

/**
 * A board's masthead: the trail, the visibility chip, the brief, and who is on
 * it.
 *
 * The trail is a heading rather than the shared `PageHeader`, because on a
 * board it is the page title — set in the serif at full size, with the team
 * segment picked out.
 */
export function BoardHeader({
  board,
  shown,
  onBack,
}: {
  board: OmniPulseBoard;
  /** Tasks currently in view, for the count beside the view tabs. */
  shown?: number;
  onBack: () => void;
}) {
  return (
    <header style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
        <h1 className="opx-title">
          <span>OmniPulse</span>
          <span className="opx-title__sep">/</span>
          <button type="button" className="opx-title__link" onClick={onBack}>
            Teams
          </button>
          <span className="opx-title__sep">/</span>
          <span className="opx-title__current">{board.name}</span>
        </h1>
        <span style={{ marginLeft: "auto", flexShrink: 0, paddingTop: 6 }}>
          <AvatarStack names={board.members} size={28} max={5} />
        </span>
      </div>

      {board.visibility && (
        <span className="opx-visibility">
          <LockGlyph />
          {board.visibility}
        </span>
      )}

      {board.description && <p className="opx-brief">{board.description}</p>}

      {shown != null && <span style={{ display: "none" }}>{shown}</span>}
    </header>
  );
}

function LockGlyph() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
