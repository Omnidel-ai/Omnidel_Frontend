"use client";

import { useState, type CSSProperties } from "react";
import { walkthroughFor } from "@/lib/client/mahacharya-walkthroughs";
import { parseAssistantTurn } from "@/lib/client/mahacharya-parse";
import { useTr } from "@/lib/client/language";

// ─────────────────────────────────────────────────────────────────────────────
// ConfirmCard — renders an act-tool PROPOSAL and lets the user choose how it
// happens. MahAcharya never mutates silently: when the model decides an action
// is warranted (create a lead, create a task), it emits a proposal the widget
// turns into this card. Two paths:
//
//   • "Do it for me"  → re-invoke the act tool with confirmed:true. The parent
//     supplies onConfirm, which POSTs a confirmation turn back to the chat
//     route; the act tool (server, behind the user's session + RBAC) performs
//     the write. The card reflects pending / done / failed inline.
//
//   • "Show me how"   → run a Walkthrough over the real flow so the user does it
//     themselves. The parent owns the Walkthrough mount; the card just signals.
//
// The proposal shape is the contract between the act tool's output and this
// card. It's intentionally small + display-oriented: an action verb, a human
// title/summary, and the resolved fields to echo back for confirmation. The raw
// args travel opaquely in `args` so the confirm round-trip is loss-free.
// ─────────────────────────────────────────────────────────────────────────────

export interface ActProposalField {
  label: string;
  value: string;
}

/** One toggle-able sub-item in a multi-item proposal (create_project checklist). */
export interface ActProposalItem {
  id: string;            // "list:0" | "label:1" | "task:2"
  group: "lists" | "labels" | "tasks";
  label: string;
  detail?: string;
  color?: string | null;
  included: boolean;
}

export interface ActProposal {
  /** Discriminates the card from plain assistant text + keys the walkthrough. */
  kind: "act_proposal";
  /** Action verb, aligned with the walkthrough registry (create_lead, …). */
  action: string;
  /** One-line human title, e.g. "Create a new lead". */
  title: string;
  /** Optional longer explanation of what will happen. */
  summary?: string;
  /** Resolved fields to echo back so the user can sanity-check before acting. */
  fields?: ActProposalField[];
  /** Multi-item checklist (create_project): cards/labels/tasks the user can toggle. */
  items?: ActProposalItem[];
  /** Opaque args the act tool emitted; sent back verbatim on confirm. */
  args?: Record<string, unknown>;
  /**
   * True when the tool couldn't resolve a task's team/project to exactly one
   * real project (missing, or a name matching zero/several). The Thread
   * renders a TeamProjectSelectCard instead of this card's confirm button —
   * a real dropdown of the user's teams then that team's projects, never a
   * guessed or user-retyped name.
   */
  needsSelection?: boolean;
  /** "destructive" (registry destructive/external defs) → crit-colored confirm button. */
  severity?: "destructive";
  /** Side-effects outside the app (publish etc.) → the confirm requires a second tap. */
  external?: boolean;
  /**
   * Idempotency key minted by this card per confirm click (crypto.randomUUID)
   * and carried in the confirmedAct body so a double-fire executes once.
   */
  clientActionId?: string;
}

type Phase = "idle" | "pending" | "done" | "failed";

/**
 * Last line of defence for the card's own status text (retest NEW-3).
 *
 * `resultMsg` is whatever the confirm round-trip resolved or rejected with, and
 * it was rendered verbatim — so when a confirm came back still needing a field,
 * the entire internal envelope printed under the card in red:
 * `mahacharya-need-fields {"kind":"need_fields","action":"create_tasks",…}`.
 * The server no longer puts a fence in that string, and this strips one anyway
 * if any future caller does: the same parser the Thread uses returns the prose
 * with every ```mahacharya-* region (and any mangled/unfenced remnant) removed.
 */
function proseOnly(raw: string, fallback: string): string {
  const cleaned = parseAssistantTurn(raw || "").text.trim();
  return cleaned || fallback;
}

interface ConfirmCardProps {
  proposal: ActProposal;
  voiceMode?: boolean;
  /**
   * Perform the action: re-call the act tool with confirmed:true. Resolves to a
   * short success line (shown to the user) or rejects on failure.
   */
  onConfirm: (proposal: ActProposal) => Promise<string | void>;
  /** Start the guided walkthrough for this action, carrying the proposal args
   *  so the Walkthrough can auto-fill the form fields. */
  onShowMe: (proposal: ActProposal) => void;
}

export function ConfirmCard({ proposal, voiceMode, onConfirm, onShowMe }: ConfirmCardProps) {
  const tr = useTr();
  const [phase, setPhase] = useState<Phase>("idle");
  const [resultMsg, setResultMsg] = useState<string>("");
  // External-action double-tap: the first tap only ARMS the button ("Tap again
  // to confirm"); the second actually fires. Extra friction for side-effects
  // outside the app (publish a post, send a message) that can't be recalled.
  const [armed, setArmed] = useState(false);

  const hasWalkthrough = walkthroughFor(proposal.action).length > 0;
  const destructive = proposal.severity === "destructive";

  async function handleConfirm() {
    if (phase === "pending" || phase === "done") return;
    if (proposal.external && !armed) {
      setArmed(true);
      return;
    }
    setPhase("pending");
    setResultMsg("");
    try {
      // Mint the idempotency key PER CLICK so the server can collapse a
      // double-fire of this same confirmation into one execution.
      const clientActionId =
        typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : undefined;
      const msg = await onConfirm({ ...proposal, clientActionId });
      setPhase("done");
      setResultMsg(typeof msg === "string" && msg ? proseOnly(msg, "Done.") : "Done.");
    } catch (err) {
      setArmed(false);
      setPhase("failed");
      setResultMsg(
        proseOnly(
          err instanceof Error ? err.message : "",
          "That didn't go through. Please try again.",
        ),
      );
    }
  }

  return (
    <div style={cardStyle}>
      <div style={titleRowStyle}>
        <span style={badgeStyle}>{tr("Action")}</span>
        <span style={titleStyle}>{proposal.title}</span>
      </div>

      {proposal.summary && <p style={summaryStyle}>{proposal.summary}</p>}

      {voiceMode && phase === "idle" && (
        <p style={voiceHintStyle}>{tr("Say")} <strong>yes</strong> {tr("to confirm or")} <strong>no</strong> {tr("to cancel.")}</p>
      )}

      {proposal.fields && proposal.fields.length > 0 && (
        <dl style={fieldsStyle}>
          {proposal.fields.map((f, i) => (
            <div key={i} style={fieldRowStyle}>
              <dt style={fieldLabelStyle}>{f.label}</dt>
              <dd style={fieldValueStyle}>{f.value || "—"}</dd>
            </div>
          ))}
        </dl>
      )}

      {phase === "done" ? (
        <div style={doneStyle}>{resultMsg}</div>
      ) : (
        <>
          <div style={actionsStyle}>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={phase === "pending"}
              style={{
                ...primaryBtnStyle,
                ...(destructive ? { background: "var(--crit)" } : {}),
                opacity: phase === "pending" ? 0.6 : 1,
              }}
            >
              {phase === "pending"
                ? tr("Working…")
                : proposal.external && armed
                  ? tr("Tap again to confirm")
                  : tr("Do it for me")}
            </button>
            {hasWalkthrough && (
              <button
                type="button"
                onClick={() => onShowMe(proposal)}
                disabled={phase === "pending"}
                style={secondaryBtnStyle}
              >
                {tr("Show me how")}
              </button>
            )}
          </div>
          {phase === "failed" && <div style={errorStyle}>{resultMsg}</div>}
        </>
      )}
    </div>
  );
}

// ─── Styles (CSS variables only) ─────────────────────────────────────────────

const cardStyle: CSSProperties = {
  marginTop: 8,
  padding: 12,
  background: "var(--surface)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--green-deep)",
  borderRadius: "var(--r-md)",
};
const titleRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};
const badgeStyle: CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 9,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--green-deep)",
  background: "var(--green-wash)",
  padding: "2px 6px",
  borderRadius: 999,
};
const titleStyle: CSSProperties = {
  fontFamily: "var(--serif)",
  fontSize: 14,
  color: "var(--ink)",
};
const summaryStyle: CSSProperties = {
  margin: "8px 0 0",
  fontFamily: "var(--sans)",
  fontSize: 12,
  lineHeight: 1.5,
  color: "var(--ink-soft)",
};
const voiceHintStyle: CSSProperties = {
  margin: "8px 0 0",
  fontFamily: "var(--sans)",
  fontSize: 12,
  lineHeight: 1.5,
  color: "var(--ochre)",
};
const fieldsStyle: CSSProperties = {
  margin: "10px 0 0",
  display: "flex",
  flexDirection: "column",
  gap: 4,
};
const fieldRowStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  fontSize: 12,
  fontFamily: "var(--sans)",
};
const fieldLabelStyle: CSSProperties = {
  flex: "0 0 38%",
  color: "var(--ink-mute)",
  margin: 0,
};
const fieldValueStyle: CSSProperties = {
  flex: 1,
  color: "var(--ink)",
  margin: 0,
  wordBreak: "break-word",
  whiteSpace: "pre-wrap", // multi-line Task 1 / Task 2 lists
};
const actionsStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  marginTop: 12,
};
const primaryBtnStyle: CSSProperties = {
  padding: "7px 13px",
  fontFamily: "var(--sans)",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--page)",
  background: "var(--green-deep)",
  borderWidth: 0,
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
};
const secondaryBtnStyle: CSSProperties = {
  padding: "7px 13px",
  fontFamily: "var(--sans)",
  fontSize: 12,
  fontWeight: 500,
  color: "var(--green-deep)",
  background: "var(--surface)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--green-deep)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
};
const doneStyle: CSSProperties = {
  marginTop: 10,
  fontFamily: "var(--sans)",
  fontSize: 12,
  color: "var(--green-deep)",
  fontWeight: 500,
};
const errorStyle: CSSProperties = {
  marginTop: 10,
  fontFamily: "var(--sans)",
  fontSize: 12,
  color: "var(--crit)",
};
