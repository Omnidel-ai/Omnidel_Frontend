"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type KeyboardEvent } from "react";
import {
  AttachButton,
  AttachmentChipList,
  AttachmentUploadingBanner,
  MessageAttachmentsBubble,
  partitionDocFiles,
  toastUnsupportedFiles,
  toastDocLimitReached,
  MAX_DOCS,
  type UiAttachment,
} from "@/components/omnidel/mahacharya/AttachmentBar";
import { Markdown } from "@/components/omnidel/markdown";
import { emitToast } from "@/components/omnidel/toaster";
import type { MahacharyaMessage } from "@/lib/client/mahacharya-store";
import {
  mahacharyaActions,
  selectConsumedProposals,
  useMahacharyaStore,
} from "@/lib/client/mahacharya-store";
import { ConfirmCard, type ActProposal } from "@/components/omnidel/mahacharya/ConfirmCard";
import { MultiItemConfirmCard } from "@/components/omnidel/mahacharya/MultiItemConfirmCard";
import { TeamProjectSelectCard } from "@/components/omnidel/mahacharya/TeamProjectSelectCard";
import {
  NeedFieldsCard,
  type NeedFieldsCardPayload,
} from "@/components/omnidel/mahacharya/NeedFieldsCard";
import { walkthroughFor } from "@/lib/client/mahacharya-walkthroughs";
import type { TaskGuidedFillValues } from "@/lib/client/task-guided-fill";
import type { WalkthroughStep } from "@/lib/client/mahacharya-walkthroughs";
import {
  parseAssistantTurn,
  parseUserMessage,
  proposalSignature,
  stripConfirmLeadIn,
  stripFillSubmission,
  type ParsedNav,
  type Trace,
} from "@/lib/client/mahacharya-parse";
import { TraceDisclosure } from "@/components/omnidel/mahacharya/TraceDisclosure";
import { CollapsibleText } from "@/components/omnidel/mahacharya/CollapsibleText";
import { useTr } from "@/lib/client/language";

type VoicePhase = "idle" | "listening" | "thinking" | "speaking";

type MahacharyaActivity = {
  event: "step-start" | "tool-start" | "tool-finish" | "tool-error" | "finish";
  label: string;
  detail?: string;
  ts: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Thread — the scrollable message list + composer for the MahAcharya widget.
//
// Pure presentational: it owns no chat state. The parent (ChatWidget) passes
// messages, the in-flight draft, and the send/typing callbacks. This keeps the
// streaming + persistence logic in one place (the widget) and lets the Thread
// be trivially testable. Styling is inline + CSS vars, matching task-modal.
// ─────────────────────────────────────────────────────────────────────────────

interface ThreadProps {
  messages: MahacharyaMessage[];
  activity?: MahacharyaActivity[];
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  // Abort the in-flight reply (the composer shows Stop instead of Send while sending).
  onStop: () => void;
  sending: boolean;
  // Re-invoke the act tool with confirmed:true (the "Do it for me" path). The
  // widget owns the round-trip; the Thread only renders the card + result.
  onConfirmAct: (proposal: ActProposal) => Promise<string | void>;
  // Route the browser to a server-resolved in-app path (```mahacharya-nav
  // blocks). The widget validates the path before router.push. Optional so
  // other Thread hosts without a router stay unaffected.
  onNavigate?: (nav: ParsedNav) => void;
  // Submit a guided need-fields card: the widget turns the collected answers
  // into a synthetic user turn and re-POSTs the chat so the flow advances.
  onSubmitNeedFields: (
    payload: NeedFieldsCardPayload,
    values: Record<string, string>,
    displayValues: Record<string, string>,
  ) => Promise<void> | void;
  // Start the guided walkthrough. The parent (ChatWidget) owns the Walkthrough
  // mount so it sits outside the chat panel's stacking context and is never
  // covered by modals with a higher z-index than the panel itself.
  onShowMe: (steps: WalkthroughStep[], fillValues: TaskGuidedFillValues | null) => void;
  // Quick-action chip tapped: the widget either prefills the composer with the
  // starter prompt (submit:false) or sends it straight away (submit:true).
  onChip: (prompt: string, submit: boolean) => void;
  voiceMode?: boolean;
  /** Toggle voice conversation on/off (button lives beside the composer). */
  onToggleVoice?: () => void;
  voicePhase?: VoicePhase;
  listening?: boolean;
  transcribing?: boolean;
  /** Live / refining transcript — shown in the hearing bar, not the composer. */
  hearingText?: string;
  speechSupported?: boolean;
  speechError?: string | null;
  voiceConnecting?: boolean;
  onVoiceMicStart?: () => void;
  onVoiceMicStop?: () => void;
  onVoiceMicCancel?: () => void;
  voiceMicDisabled?: boolean;
  voiceMicRecording?: boolean;
  voiceMicSpeaking?: boolean;
  attachments?: UiAttachment[];
  uploadingDocs?: boolean;
  onUploadDocs?: (files: File[]) => void;
  onRemoveDoc?: (id: string) => void;
}

// Quick-action chips above the composer. Most prefill a starter prompt the user
// completes; "Today's tasks" is a complete prompt that auto-sends.
const QUICK_ACTIONS: { label: string; prompt: string; submit: boolean }[] = [
  { label: "Create task", prompt: "Create a task ", submit: false },
  { label: "Move task", prompt: "Move task ", submit: false },
  { label: "Today's tasks", prompt: "What are today's tasks?", submit: true },
  { label: "Create lead", prompt: "Create a lead ", submit: false },
];

// A proposal rides inside the assistant turn as a fenced JSON block the act tool
// emits, e.g.:
//   ```mahacharya-act
//   { "kind": "act_proposal", "action": "create_lead", "title": "…", … }
//   ```
// Splitting it out lets the surrounding prose stream + render as Markdown while
// the structured part becomes a ConfirmCard. The act region is always stripped
// from the prose (even mid-stream / if malformed) so raw JSON never shows.

// ── Feedback (Phase D) ───────────────────────────────────────────────────────
// Post a thumbs / outcome signal to the learning loop. Best-effort: the control
// optimistically reflects the tap and a network failure is swallowed (feedback
// is signal, never a blocking action). thread_id + message_id are resolved
// server-side from the session, so the client sends only the signal itself.
async function postFeedback(rating: 1 | -1, outcome?: string): Promise<void> {
  try {
    await fetch("/api/mahacharya/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(outcome ? { rating, outcome } : { rating }),
    });
  } catch {
    /* signal only — never surface a feedback failure to the user */
  }
}

/** Need-fields / guided-card submits re-POST as this machine line for the model. */
function isSyntheticContinueUserTurn(text: string | undefined | null): boolean {
  const t = (text || "").trim();
  if (!t) return false;
  // "Continue create_task. My choices:\n- Title: …"
  if (/^Continue\s+\S+/i.test(t) && /My choices:/i.test(t)) return true;
  // Older / alternate phrasing
  if (/^Continue\s+\S+\.\s*My choices:/i.test(t)) return true;
  return false;
}

/**
 * Confirm / need-fields cards are stale once the user continues the conversation
 * (e.g. "put it in a different project"). Keep synthetic Continue relays from
 * invalidating cards mid-flow.
 */
function hasLaterRealUserMessage(
  messages: { role: string; content: string }[],
  fromIndex: number,
): boolean {
  for (let j = fromIndex + 1; j < messages.length; j++) {
    if (messages[j].role !== "user") continue;
    const { text } = parseUserMessage(messages[j].content);
    if (isSyntheticContinueUserTurn(text)) continue;
    if ((text || "").trim()) return true;
  }
  return false;
}

/**
 * A need-fields card is done once a LATER assistant turn exists (the flow
 * advanced past that guided step — typically after a synthetic Continue).
 * Without this, step-2 "Continue" stays visible above a create_project plan
 * that says "tap confirm" with no confirm button.
 */
function hasLaterAssistantMessage(
  messages: { role: string; content: string }[],
  fromIndex: number,
): boolean {
  for (let j = fromIndex + 1; j < messages.length; j++) {
    if (messages[j].role === "assistant") return true;
  }
  return false;
}

// ── Universal navigation (```mahacharya-nav) ─────────────────────────────────
// One-shot guard for THIS mounted session: streaming re-writes the message
// content on every chunk, so the fence can re-appear after markActDone already
// stripped it from the store — this Set stops a remounted chip re-navigating.
// Cross-reload one-shot-ness comes from markActDone itself (the fence is gone
// from the persisted store, so the chip never re-parses).
const executedNavTs = new Set<number>();

/**
 * Quiet inline chip for a server-resolved navigation. AUTO-EXECUTES exactly
 * once: marks the message done in the store BEFORE pushing (plan §3.5 — the
 * mark-before-push order is what prevents re-navigation on re-render or
 * back-nav), then hands the validated path to the widget's router. D1: no
 * confirmation for navigation.
 */
function NavChip({
  nav,
  msgTs,
  onNavigate,
}: {
  nav: ParsedNav;
  msgTs: number;
  onNavigate?: (nav: ParsedNav) => void;
}) {
  const tr = useTr();
  useEffect(() => {
    if (executedNavTs.has(msgTs)) return;
    executedNavTs.add(msgTs);
    // Mark BEFORE push: the store strips the nav fence durably, so a
    // re-render, reload, or back-navigation never replays the route change.
    mahacharyaActions.markActDone(msgTs);
    onNavigate?.(nav);
    // Intentionally run-once per message ts; nav payloads are immutable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div style={navChipStyle}>{tr("→ Opening destination…")}</div>;
}

const navChipStyle: CSSProperties = {
  marginTop: 6,
  alignSelf: "flex-start",
  padding: "4px 10px",
  fontFamily: "var(--sans)",
  fontSize: 12,
  color: "var(--green-deep)",
  background: "var(--green-wash)",
  borderRadius: 999,
};

/**
 * Client-authored status lines (stop, timeout, transport failures) that occupy
 * the assistant bubble but are not an answer. Kept in sync with the strings
 * ChatWidget writes via updateLastAssistant.
 */
const NON_ANSWER_LINES = new Set([
  "Stopped.",
  "That took too long — please try again.",
  "Sorry, the connection to MahAcharya dropped. Check your network and try again.",
]);
function isNonAnswerLine(text: string): boolean {
  return NON_ANSWER_LINES.has(text.trim());
}

/** Visually hidden, still read by assistive tech. */
const srOnlyStyle: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};

// Thumbs control shown under a finished assistant bubble.
function FeedbackBar({ disabled }: { disabled: boolean }) {
  const tr = useTr();
  const [rated, setRated] = useState<1 | -1 | null>(null);

  async function rate(value: 1 | -1) {
    if (rated !== null || disabled) return;
    setRated(value);
    await postFeedback(value);
  }

  if (rated !== null) {
    return (
      <div style={feedbackRowStyle}>
        <span style={feedbackThanksStyle}>{tr("Thanks for the feedback.")}</span>
      </div>
    );
  }

  return (
    <div style={feedbackRowStyle}>
      <button
        type="button"
        onClick={() => rate(1)}
        disabled={disabled}
        style={feedbackBtnStyle}
        aria-label={tr("Mark this answer helpful")}
      >
        {tr("Helpful")}
      </button>
      <button
        type="button"
        onClick={() => rate(-1)}
        disabled={disabled}
        style={feedbackBtnStyle}
        aria-label={tr("Mark this answer not helpful")}
      >
        {tr("Not helpful")}
      </button>
    </div>
  );
}

function ThinkingIndicator({ activity = [] }: { activity?: MahacharyaActivity[] }) {
  const tr = useTr();
  const recent = activity.slice(-4);

  return (
    <div style={thinkingWrapStyle} aria-live="polite">
      <div style={thinkingTitleStyle}>
        <span style={thinkingPulseStyle} aria-hidden />
        {tr("MahAcharya is working")}
      </div>
      {recent.length > 0 ? (
        <div style={thinkingStepsStyle}>
          {recent.map((item) => (
            <span
              key={`${item.ts}-${item.label}`}
              style={{
                ...thinkingStepStyle,
                ...(item.event === "tool-error" ? thinkingStepErrorStyle : {}),
              }}
            >
              {item.detail ? `${item.label} · ${item.detail}` : item.label}
            </span>
          ))}
        </div>
      ) : (
        <span style={thinkingStepStyle}>{tr("Waiting for live progress…")}</span>
      )}
    </div>
  );
}

// Auto-grow the textarea up to MAX_LINES line-heights, then scroll. Reads the
// computed line-height so it tracks the CSS var(--sans) styling rather than
// hardcoding a pixel height. Keeps the box at one line when empty/short.
const MAX_LINES = 3;
function resizeTextarea(el: HTMLTextAreaElement | null): void {
  if (!el) return;
  // Collapse first so scrollHeight reflects the content, not the prior height.
  el.style.height = "auto";
  const cs = window.getComputedStyle(el);
  const lineHeight = parseFloat(cs.lineHeight) || 20;
  const padV = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  const borderV = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
  const maxH = lineHeight * MAX_LINES + padV + borderV;
  const next = Math.min(el.scrollHeight + borderV, maxH);
  el.style.height = `${next}px`;
  // Scroll only once content exceeds the cap; below it, never show a scrollbar.
  el.style.overflowY = el.scrollHeight + borderV > maxH ? "auto" : "hidden";
}

export function Thread({
  messages,
  activity = [],
  draft,
  onDraftChange,
  onSend,
  onStop,
  sending,
  onConfirmAct,
  onNavigate,
  onSubmitNeedFields,
  onShowMe,
  onChip,
  voiceMode = false,
  onToggleVoice,
  voicePhase = "idle",
  listening = false,
  transcribing = false,
  hearingText = "",
  speechSupported = false,
  speechError = null,
  voiceConnecting = false,
  onVoiceMicStart,
  onVoiceMicStop,
  onVoiceMicCancel,
  voiceMicDisabled = false,
  voiceMicRecording = false,
  voiceMicSpeaking = false,
  attachments = [],
  uploadingDocs = false,
  onUploadDocs,
  onRemoveDoc,
}: ThreadProps) {
  const tr = useTr();
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [docDragOver, setDocDragOver] = useState(false);
  const docDragDepthRef = useRef(0);

  function resetDocDrag() {
    docDragDepthRef.current = 0;
    setDocDragOver(false);
  }

  function handleDocDragEnter(e: DragEvent) {
    if (!onUploadDocs || sending) return;
    if (![...e.dataTransfer.types].includes("Files")) return;
    e.preventDefault();
    e.stopPropagation();
    docDragDepthRef.current += 1;
    setDocDragOver(true);
  }

  function handleDocDragOver(e: DragEvent) {
    if (!onUploadDocs || sending) return;
    if (![...e.dataTransfer.types].includes("Files")) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  }

  function handleDocDragLeave(e: DragEvent) {
    if (!onUploadDocs || sending) return;
    e.preventDefault();
    e.stopPropagation();
    docDragDepthRef.current = Math.max(0, docDragDepthRef.current - 1);
    if (docDragDepthRef.current === 0) setDocDragOver(false);
  }

  function handleDocDrop(e: DragEvent) {
    if (!onUploadDocs || sending) return;
    e.preventDefault();
    e.stopPropagation();
    resetDocDrag();
    const { allowed, rejected } = partitionDocFiles(Array.from(e.dataTransfer.files || []));
    toastUnsupportedFiles(rejected);
    if (attachments.length >= MAX_DOCS) {
      toastDocLimitReached();
      return;
    }
    const room = MAX_DOCS - attachments.length;
    if (allowed.length > room && room > 0) {
      emitToast(`Only ${room} more document${room === 1 ? "" : "s"} can be added.`);
    }
    const batch = allowed.slice(0, room);
    if (batch.length) onUploadDocs(batch);
  }

  // Keep the composer focused whenever the widget is open, unless voice
  // recording is actively holding the mic.
  useEffect(() => {
    if (voiceMode && voiceMicRecording) return;
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [voiceMode, voiceMicRecording, sending]);

  // Keep the latest turn in view as content streams in. Depends on the tail
  // content too (not just length) so token-by-token growth pins to bottom.
  const lastContent = messages.length ? messages[messages.length - 1].content : "";
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, lastContent, activity.length, hearingText, listening, transcribing]);

  const showVoicePending =
    voiceMode &&
    (voiceMicRecording || transcribing || hearingText.trim().length > 0);
  const consumedProposals = useMahacharyaStore(selectConsumedProposals);
  const renderedProposalKeys = new Set<string>();
  const markMatchingProposalsDone = (signature: string, primaryTs: number) => {
    // Durable record FIRST: rewriting the messages below only retires the copies
    // currently in the store, and a later hydrate / conversation switch / second
    // tab can bring the original fenced block back (retest bug 2). The signature
    // outlives all of those, so the card stays retired either way.
    mahacharyaActions.markProposalConsumed(signature);
    mahacharyaActions.markActDone(primaryTs);
    for (const other of messages) {
      if (other.ts === primaryTs || other.role !== "assistant") continue;
      const { proposal: otherProposal } = parseAssistantTurn(other.content);
      if (otherProposal && proposalSignature(otherProposal) === signature) {
        mahacharyaActions.markActDone(other.ts);
      }
    }
  };

  const voicePendingDisplay = hearingText.trim()
    ? hearingText.trim()
    : voiceMicRecording
      ? "Listening…"
      : transcribing
        ? "MahAcharya is thinking…"
        : "";

  // ── "@" action picker ──────────────────────────────────────────────────────
  // When the user types "@" at the start of a word, an autocomplete listbox of
  // the SAME quick actions opens. Selecting one fires the same onChip handler
  // the chips call, and the typed "@token" is stripped from the draft.
  const [atQuery, setAtQuery] = useState<string | null>(null); // null = picker closed
  const [atStart, setAtStart] = useState<number>(-1); // index of the "@" in draft
  const [atHighlight, setAtHighlight] = useState(0);

  // Detect an active "@token" at the caret and update picker state. The "@" must
  // sit at the start of a word (string start or preceded by whitespace) and the
  // token between "@" and the caret must be label-like (no spaces).
  function syncPicker(value: string, caret: number) {
    const upToCaret = value.slice(0, caret);
    const at = upToCaret.lastIndexOf("@");
    if (at === -1) {
      setAtQuery(null);
      return;
    }
    const before = at === 0 ? "" : upToCaret[at - 1];
    const token = upToCaret.slice(at + 1);
    if ((at !== 0 && !/\s/.test(before)) || /\s/.test(token)) {
      setAtQuery(null);
      return;
    }
    setAtStart(at);
    setAtQuery(token);
    setAtHighlight(0);
  }

  // Filter the shared quick-action list by the typed token (case-insensitive).
  const filteredActions = useMemo(() => {
    if (atQuery === null) return [];
    const q = atQuery.trim().toLowerCase();
    return q
      ? QUICK_ACTIONS.filter((a) => a.label.toLowerCase().includes(q))
      : QUICK_ACTIONS;
  }, [atQuery]);

  // Clamp the highlight if the filtered list shrinks below it.
  useEffect(() => {
    if (atQuery !== null && atHighlight >= filteredActions.length) setAtHighlight(0);
  }, [atQuery, atHighlight, filteredActions.length]);

  function closePicker() {
    setAtQuery(null);
    setAtStart(-1);
    setAtHighlight(0);
  }

  // Perform a picked action: remove the "@token" from the draft, then invoke the
  // SAME onChip handler the chips use (so behaviour is identical — prefill or
  // auto-send). The chip handler overwrites the draft, so the strip is only
  // cosmetic for the brief moment before onChip runs; we still strip so a
  // submit:false action seeds cleanly without a stray "@token".
  function pickAction(action: (typeof QUICK_ACTIONS)[number]) {
    if (atStart >= 0) {
      // Recompute the caret-side token boundary at fire time (the draft may have
      // grown since the picker opened). Strip from "@" up to the next whitespace.
      const after = draft.slice(atStart + 1);
      const tokenEnd = after.search(/\s/);
      const end = tokenEnd === -1 ? draft.length : atStart + 1 + tokenEnd;
      const stripped = draft.slice(0, atStart) + draft.slice(end);
      onDraftChange(stripped);
    }
    closePicker();
    onChip(action.prompt, action.submit);
    // Return focus to the composer after a chip-equivalent fire.
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  // Auto-grow the textarea whenever the draft changes (incl. chip prefills).
  useLayoutEffect(() => {
    resizeTextarea(textareaRef.current);
  }, [draft]);

  function handleDraftChange(value: string) {
    onDraftChange(value);
    const el = textareaRef.current;
    syncPicker(value, el ? el.selectionStart : value.length);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // When the picker is open, arrows/Enter/Tab/Esc drive it instead of the
    // composer so the user can select an action without sending.
    if (atQuery !== null && filteredActions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setAtHighlight((h) => (h + 1) % filteredActions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setAtHighlight((h) => (h - 1 + filteredActions.length) % filteredActions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pickAction(filteredActions[atHighlight]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        closePicker();
        return;
      }
    }
    // Esc also closes a picker that has no matches (so it isn't trapped open).
    if (atQuery !== null && e.key === "Escape") {
      e.preventDefault();
      closePicker();
      return;
    }
    // Enter sends; Shift+Enter inserts a newline. Matches the comment composer.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!sending && (draft.trim() || attachments.length > 0)) onSend();
    }
  }

  const canSend = !sending && (draft.trim().length > 0 || attachments.length > 0);
  const pickerOpen = atQuery !== null && filteredActions.length > 0;
  // Quick-action chips only on a fresh chat: hide while typing; after the first
  // message is sent they stay gone for that conversation.
  const showQuickActionChips = messages.length === 0 && draft.trim().length === 0;

  const voiceBarLabel = voiceConnecting
    ? "Connecting…"
    : voicePhase === "thinking" || (transcribing && !voiceMicRecording)
      ? "MahAcharya is thinking…"
      : voicePhase === "speaking"
        ? "MahAcharya is speaking…"
        : voiceMode && !voiceMicRecording && !hearingText.trim()
          ? "Hold the mic to talk"
          : "";

  return (
    <div
      style={{
        ...wrapStyle,
        ...(docDragOver && onUploadDocs
          ? { boxShadow: "inset 0 0 0 2px var(--green-deep)" }
          : null),
      }}
      onDragEnter={handleDocDragEnter}
      onDragOver={handleDocDragOver}
      onDragLeave={handleDocDragLeave}
      onDrop={handleDocDrop}
    >
      {docDragOver && onUploadDocs ? (
        <div style={dropOverlayStyle} aria-hidden>
          <span style={dropOverlayLabelStyle}>{tr("Drop documents to attach")}</span>
        </div>
      ) : null}
      <div ref={scrollRef} style={listStyle}>
        {messages.length === 0 && !showVoicePending ? (
          <div style={emptyStyle}>
            {tr("Ask MahAcharya about your leads, tasks, or how something works.")}
          </div>
        ) : (
          <>
          {messages.map((m, i) => {
            if (m.role !== "assistant") {
              // stripFillSubmission first: the guided-card payload is machine-only
              // and must never be rendered. parseUserMessage deliberately leaves
              // it alone, because the request body is built through that same
              // function and needs the payload intact.
              const { text: userText, attachments: msgAttachments } = parseUserMessage(
                stripFillSubmission(m.content),
              );
              // Synthetic need-fields / guided-form relays are for the model only
              // ("Continue create_task. My choices: …"). Do not show them as green
              // user bubbles — the card already shows Submitted / Details sent.
              if (isSyntheticContinueUserTurn(userText) && msgAttachments.length === 0) {
                return null;
              }
              return (
                <div key={i} style={userRowStyle}>
                  <div style={userBubbleStyle}>
                    {msgAttachments.length > 0 ? (
                      <MessageAttachmentsBubble attachments={msgAttachments} />
                    ) : null}
                    {userText ? <CollapsibleText text={userText} style={userTextStyle} /> : null}
                  </div>
                </div>
              );
            }
            const { text: rawText, proposal, needFields, nav, trace: liveTrace } = parseAssistantTurn(m.content);
            const text = stripConfirmLeadIn(rawText);
            // Live turns carry trace in a streamed fence; reloaded turns may
            // carry it on the persisted message row (m.trace).
            const trace = liveTrace ?? ((m as { trace?: unknown }).trace as Trace | null) ?? null;
            const cardStale = hasLaterRealUserMessage(messages, i);
            const proposalKey = proposal ? proposalSignature(proposal) : "";
            const duplicateProposal = !!proposal && renderedProposalKeys.has(proposalKey);
            // Already confirmed on this machine — see selectConsumedProposals.
            // This is what stops the resurrected card in retest bug 2: the block
            // is back in the message, but the proposal it describes is spent.
            //
            // The timestamp comparison is what keeps this from over-reaching. A
            // signature is an intent, so asking for the identical thing twice
            // produces the identical signature; only a message OLDER than the
            // confirm can be the resurrected copy, and a genuinely new proposal
            // is newer and still renders.
            const consumedAt = proposal ? consumedProposals[proposalKey] : undefined;
            const proposalConsumed = consumedAt !== undefined && m.ts <= consumedAt;
            if (proposal && !duplicateProposal && !cardStale && !proposalConsumed) {
              renderedProposalKeys.add(proposalKey);
            }
            // Hide confirm/picker cards after the user keeps chatting (change
            // project, cancel, etc.) so they don't create on the wrong board.
            const visibleProposal =
              !cardStale && !duplicateProposal && !proposalConsumed ? proposal : null;
            // Need-fields also go stale once the next assistant turn arrives
            // (Continue → next step), even though that Continue is synthetic
            // and must NOT invalidate confirm cards mid-flow.
            const visibleNeedFields =
              !cardStale && !hasLaterAssistantMessage(messages, i) ? needFields : null;
            // The user turn that triggered this assistant reply — shown inside
            // the need-fields card as the restated request.
            const rawPriorUser = i > 0 && messages[i - 1]?.role === "user" ? messages[i - 1].content : undefined;
            // Don't echo our own synthetic "Continue …" answer-relay as the card's
            // restated request — only a genuine user message.
            const priorUser = rawPriorUser && !rawPriorUser.startsWith("Continue ") ? rawPriorUser : undefined;
            // The last bubble is "in flight" while the parent is sending — its
            // content is still growing, so don't offer feedback on it yet.
            const isLast = i === messages.length - 1;
            const streaming = isLast && sending;
            // Show the prose bubble only when there's text, OR while this turn is
            // actively streaming (the "thinking…" placeholder). A leftover EMPTY
            // bubble (aborted/old turn) is hidden, not left spinning forever.
            // Keep the acknowledge/restate prose visible above a need-fields card
            // (Shubham wants the restate shown); only the thumbs are suppressed.
            const showBubble = !!text || streaming;
            // Offer feedback on a finished, non-empty prose answer only. Proposal
            // cards carry their own completed_action signal on confirm, so a
            // proposal-only turn (no prose) shows no thumbs.
            // ...and never on a line the assistant did not actually author —
            // rating "Stopped." or a network error as Helpful / Not helpful is
            // noise in the feedback table and reads as a bug to the user.
            const showFeedback =
              !!text && !streaming && !visibleNeedFields && !isNonAnswerLine(text);
            // A card child (need-fields / confirm) is width:100% + a query
            // container — it needs a DEFINITE column width or the shrink-to-fit
            // bubble column collapses to min-content (one word per line). Give
            // card-bearing turns a full-width column; text stays a normal bubble.
            const hasCard = !!visibleNeedFields || !!visibleProposal;
            return (
              <div key={i} style={assistantRowStyle}>
                <div style={hasCard ? assistantCardColStyle : assistantColStyle}>
                  <TraceDisclosure trace={trace} />
                  {showBubble && (
                    <div style={assistantBubbleStyle}>
                      {text ? (
                        <Markdown source={text} />
                      ) : (
                        <ThinkingIndicator activity={activity} />
                      )}
                    </div>
                  )}
                  {/*
                    Answers arrive after a long, silent wait and nothing moves
                    focus, so a screen reader would never mention them. Announce
                    the FINISHED answer only: this holds "" while streaming, so
                    the single change on completion is what gets read — token-by
                    -token updates would be unusable.
                  */}
                  <div aria-live="polite" aria-atomic="true" style={srOnlyStyle}>
                    {!streaming && text ? text : ""}
                  </div>
                  {showFeedback && <FeedbackBar disabled={false} />}
                  {visibleNeedFields && (
                    <NeedFieldsCard
                      payload={visibleNeedFields}
                      userMessage={priorUser}
                      onSubmit={onSubmitNeedFields}
                    />
                  )}
                  {nav && <NavChip nav={nav} msgTs={m.ts} onNavigate={onNavigate} />}
                  {visibleProposal && visibleProposal.action === "create_project" && (
                    <MultiItemConfirmCard
                      proposal={visibleProposal}
                      onConfirm={async (p) => {
                        const r = await onConfirmAct(p);
                        markMatchingProposalsDone(proposalKey, m.ts);
                        void postFeedback(1, "completed_action");
                        return r;
                      }}
                    />
                  )}
                  {visibleProposal && visibleProposal.needsSelection && (
                    <TeamProjectSelectCard
                      proposal={visibleProposal}
                      onConfirm={async (p) => {
                        const r = await onConfirmAct(p);
                        markMatchingProposalsDone(proposalKey, m.ts);
                        void postFeedback(1, "completed_action");
                        return r;
                      }}
                    />
                  )}
                  {visibleProposal && !visibleProposal.needsSelection && visibleProposal.action !== "create_project" && (
                    <ConfirmCard
                      proposal={visibleProposal}
                      voiceMode={voiceMode}
                      onConfirm={async (p) => {
                        const r = await onConfirmAct(p);
                        // The act completed. Durably mark this proposal as done
                        // in the store so the card never re-renders actionable
                        // after a re-render or reload (Bug 1 fix).
                        markMatchingProposalsDone(proposalKey, m.ts);
                        // Record a positive completed-action signal for the
                        // learning loop so it can boost the relevant RAG chunks.
                        void postFeedback(1, "completed_action");
                        return r;
                      }}
                      onShowMe={(p) => {
                        // Build the step list for the walkthrough.
                        let steps = walkthroughFor(p.action);
                        // If the proposal already resolved a target board (uuid),
                        // walk STRAIGHT to that board — skip the team/project
                        // picker, which would otherwise open the first team's
                        // first project instead of the chosen one.
                        const boardId =
                          typeof p.args?.board_id === "string" ? p.args.board_id : "";
                        const isUuid =
                          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(boardId);
                        if (p.action === "create_task" && isUuid) {
                          steps = steps
                            .filter((s) => s.anchor !== "team-open" && s.anchor !== "board-open")
                            .map((s) => ({ ...s, route: `/omnipulse/boards/${boardId}` }));
                        }
                        // Extract fill values from the proposal args.
                        let fill: TaskGuidedFillValues | null = null;
                        if (p.args) {
                          const f: TaskGuidedFillValues = {};
                          if (typeof p.args.title === "string") f.title = p.args.title;
                          if (typeof p.args.priority === "string") f.priority = p.args.priority;
                          if (Array.isArray(p.args.assignee_ids)) {
                            f.assignee_ids = p.args.assignee_ids.filter(
                              (v): v is string => typeof v === "string"
                            );
                          }
                          if (typeof p.args.due_date === "string") f.due_date = p.args.due_date;
                          fill = Object.keys(f).length > 0 ? f : null;
                        }
                        // Delegate to the parent — the Walkthrough is mounted
                        // outside the chat panel so its z-index is not trapped
                        // inside the panel's stacking context (Bug 3 fix).
                        onShowMe(steps, fill);
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}
          {/* Voice hearing is shown inline in the composer header (single source of truth) — no separate bubble */}
          {null}
          </>
        )}
      </div>

      {showQuickActionChips ? (
        <div style={chipsRowStyle}>
          {QUICK_ACTIONS.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => onChip(c.prompt, c.submit)}
              disabled={sending}
              style={chipStyle}
            >
              {`@${c.label}`}
            </button>
          ))}
        </div>
      ) : null}

      {/* Voice status is shown via the composer mic + ThinkingIndicator — single "MahAcharya is thinking..." source */}
      {null}

      <div style={composerWrapperStyle}>
        <AttachmentUploadingBanner show={uploadingDocs} />
        {attachments.length > 0 && onRemoveDoc ? (
          <div style={attachmentMetaStyle}>
            <AttachmentChipList
              attachments={attachments}
              disabled={sending || (voiceMode && voiceMicRecording)}
              onRemove={onRemoveDoc}
            />
          </div>
        ) : null}
        <div style={composerStyle}>
        {onUploadDocs && onRemoveDoc ? (
          <AttachButton
            disabled={sending || (voiceMode && voiceMicRecording) || uploadingDocs}
            full={attachments.length >= MAX_DOCS}
            currentCount={attachments.length}
            onPickFiles={onUploadDocs}
          />
        ) : null}
        {/* "@" action picker — same actions as the chips, opened by typing "@". */}
        {pickerOpen && (
          <div
            id="mahacharya-action-picker"
            role="listbox"
            aria-label={tr("Quick actions")}
            style={pickerStyle}
          >
            {filteredActions.map((a, idx) => {
              const active = idx === atHighlight;
              return (
                <button
                  key={a.label}
                  id={`mahacharya-action-${idx}`}
                  type="button"
                  role="option"
                  aria-selected={active}
                  // onMouseDown (not onClick) so the pick fires before the
                  // textarea blur that a click would otherwise trigger first.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pickAction(a);
                  }}
                  onMouseEnter={() => setAtHighlight(idx)}
                  style={{
                    ...pickerItemStyle,
                    background: active ? "var(--surface-sunk)" : "transparent",
                  }}
                >
                  {`@${a.label}`}
                </button>
              );
            })}
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => handleDraftChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={closePicker}
          placeholder={
            voiceMode
              ? "Hold mic to talk · type here if needed"
              : "Message MahAcharya…"
          }
          rows={1}
          style={textareaStyle}
          disabled={voiceMode && voiceMicRecording}
          role="combobox"
          aria-expanded={pickerOpen}
          aria-controls="mahacharya-action-picker"
          // Arrow keys move `atHighlight`, but focus stays in the textarea — so
          // without this a screen reader never hears which option is current.
          aria-activedescendant={
            pickerOpen && filteredActions[atHighlight]
              ? `mahacharya-action-${atHighlight}`
              : undefined
          }
          aria-autocomplete="list"
        />
        {/* Unified mic: single hold-to-talk — auto-enables voiceMode on first hold so there's no 2-step setup. */}
        {speechSupported && onVoiceMicStart && onVoiceMicStop && onVoiceMicCancel ? (
          <button
            type="button"
            style={{
              ...micButtonStyle,
              ...(voiceMicRecording ? micButtonRecordingStyle : {}),
              ...(voiceMicSpeaking && !voiceMicRecording ? micButtonSpeakingStyle : {}),
              ...(voiceMicDisabled ? { opacity: 0.5, cursor: "not-allowed" } : {}),
            }}
            onPointerDown={(e) => {
              e.preventDefault();
              if (voiceMicDisabled) return;
              if (!voiceMode && onToggleVoice) onToggleVoice();
              // Small delay lets voiceMode flip before gemini starts; call after rAF so state settles but hold remains smooth
              requestAnimationFrame(() => onVoiceMicStart());
            }}
            onPointerUp={(e) => {
              e.preventDefault();
              if (voiceMicRecording) onVoiceMicStop();
            }}
            onPointerCancel={() => {
              if (voiceMicRecording) onVoiceMicCancel();
            }}
            onPointerLeave={(e) => {
              if (voiceMicRecording && e.buttons !== 0) onVoiceMicCancel();
            }}
            disabled={voiceMicDisabled}
            aria-label={voiceMicRecording ? "Release to send" : "Hold to talk"}
            title={voiceMicRecording ? "Release to send" : "Hold to talk"}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </button>
        ) : null}
        {sending ||
        listening ||
        transcribing ||
        voicePhase === "speaking" ||
        voicePhase === "thinking" ? (
          <button
            type="button"
            onClick={onStop}
            style={stopButtonStyle}
            aria-label={
              // One button, two jobs. Name the one that is actually running so
              // a screen-reader user is not told they are stopping a microphone
              // that was never on (or vice versa).
              listening || transcribing || voicePhase === "speaking"
                ? sending
                  ? "Stop the microphone and the assistant"
                  : "Stop the microphone"
                : "Stop generating the answer"
            }
          >
            {tr("Stop")}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              onSend();
              requestAnimationFrame(() => textareaRef.current?.focus());
            }}
            disabled={!canSend}
            style={{ ...sendButtonStyle, opacity: canSend ? 1 : 0.5, cursor: canSend ? "pointer" : "default" }}
            aria-label={tr("Send")}
          >
            {tr("Send")}
          </button>
        )}
        </div>
      </div>
      {speechError ? (
        <p style={speechErrorStyle} role="alert">
          {speechError}
        </p>
      ) : null}

    </div>
  );
}

// ─── Styles (CSS variables only) ─────────────────────────────────────────────

const wrapStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  flex: 1,
  minHeight: 0,
  position: "relative",
};
const listStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  padding: "14px 14px 6px",
  display: "flex",
  flexDirection: "column",
  gap: 10,
};
const emptyStyle: CSSProperties = {
  margin: "auto",
  textAlign: "center",
  color: "var(--ink-mute)",
  fontFamily: "var(--sans)",
  fontSize: 13,
  lineHeight: 1.5,
  padding: "0 16px",
};
const userRowStyle: CSSProperties = { display: "flex", justifyContent: "flex-end" };
const assistantRowStyle: CSSProperties = { display: "flex", justifyContent: "flex-start" };
const assistantColStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  maxWidth: "90%",
};
// Card-bearing assistant turns: a DEFINITE full-width column so a width:100%
// card (need-fields / confirm) resolves against a real width instead of
// collapsing the shrink-to-fit bubble column to min-content. minWidth:0 keeps
// it from overflowing the narrow docked widget.
const assistantCardColStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  width: "100%",
  minWidth: 0,
};
const userBubbleStyle: CSSProperties = {
  maxWidth: "85%",
  padding: "8px 11px",
  borderRadius: "var(--r-lg)",
  borderBottomRightRadius: "var(--r-sm)",
  background: "var(--green-deep)",
  color: "var(--page)",
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
};
const voicePendingBubbleStyle: CSSProperties = {
  ...userBubbleStyle,
  opacity: 0.9,
  outlineWidth: 1,
  outlineStyle: "dashed",
  outlineColor: "var(--page)",
  outlineOffset: -1,
};
const assistantBubbleStyle: CSSProperties = {
  maxWidth: "90%",
  padding: "8px 11px",
  borderRadius: "var(--r-lg)",
  borderBottomLeftRadius: "var(--r-sm)",
  background: "var(--surface-sunk)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  color: "var(--ink)",
};
const userTextStyle: CSSProperties = {
  fontFamily: "var(--sans)",
  fontSize: 13,
  lineHeight: 1.5,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};
const typingStyle: CSSProperties = {
  fontFamily: "var(--sans)",
  fontSize: 13,
  color: "var(--ink-mute)",
  fontStyle: "italic",
};
const thinkingWrapStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  fontFamily: "var(--sans)",
};
const thinkingTitleStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  fontSize: 13,
  color: "var(--ink)",
  fontWeight: 600,
};
const thinkingPulseStyle: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
  background: "var(--green)",
  boxShadow: "0 0 0 0 rgba(32, 125, 79, 0.35)",
  animation: "mahacharya-thinking-pulse 1.4s ease-out infinite",
};
const thinkingStepsStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};
const thinkingStepStyle: CSSProperties = {
  fontSize: 11,
  color: "var(--ink-mute)",
  transition: "color 160ms ease",
};
const thinkingStepErrorStyle: CSSProperties = {
  color: "var(--crit)",
};
const feedbackRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginTop: 4,
  paddingLeft: 2,
};
const feedbackBtnStyle: CSSProperties = {
  padding: "2px 8px",
  fontFamily: "var(--sans)",
  fontSize: 11,
  fontWeight: 500,
  color: "var(--ink-mute)",
  background: "transparent",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
};
const feedbackThanksStyle: CSSProperties = {
  fontFamily: "var(--sans)",
  fontSize: 11,
  color: "var(--ink-mute)",
  fontStyle: "italic",
};
const chipsRowStyle: CSSProperties = {
  display: "flex",
  gap: 6,
  // Comfortable padding-bottom so the chips row breathes above the composer
  // instead of sitting flush on the input.
  padding: "8px 12px 10px",
  // Chips scroll within their own row so they never force horizontal page
  // (panel) scroll on narrow widths.
  overflowX: "auto",
  flexWrap: "nowrap",
};
const chipStyle: CSSProperties = {
  flex: "0 0 auto",
  padding: "5px 11px",
  fontFamily: "var(--sans)",
  fontSize: 12,
  fontWeight: 500,
  color: "var(--ink-soft)",
  background: "var(--surface-sunk)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
  whiteSpace: "nowrap",
};
const composerWrapperStyle: CSSProperties = {
  borderTopWidth: 1,
  borderTopStyle: "solid",
  borderTopColor: "var(--rule)",
  background: "var(--surface)",
};
const attachmentMetaStyle: CSSProperties = {
  padding: "14px 14px 0 12px",
};
const dropOverlayStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 30,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  pointerEvents: "none",
  // green-wash #dde5cb at 60% opacity
  background: "rgba(221, 229, 203, 0.6)",
};
const dropOverlayLabelStyle: CSSProperties = {
  padding: "8px 14px",
  borderRadius: "var(--r-sm)",
  background: "var(--page)",
  border: "1px solid var(--green-deep)",
  fontFamily: "var(--mono)",
  fontSize: 11,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--green-deep)",
  boxShadow: "var(--shadow-md)",
};
const composerStyle: CSSProperties = {
  // position:relative anchors the "@" action picker (position:absolute) to the
  // composer so it floats just above the textarea.
  position: "relative",
  display: "flex",
  alignItems: "flex-end",
  gap: 8,
  padding: "10px 12px",
};
const pickerStyle: CSSProperties = {
  // Floats above the composer, anchored to its left/right padding edges. Sits
  // above the panel content; matches the popover convention used elsewhere.
  position: "absolute",
  left: 12,
  right: 12,
  bottom: "calc(100% - 1px)",
  zIndex: 10,
  marginBottom: 6,
  padding: 4,
  background: "var(--surface)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  borderRadius: "var(--r-sm)",
  boxShadow: "var(--shadow-md)",
  display: "flex",
  flexDirection: "column",
  gap: 2,
  maxHeight: 180,
  overflowY: "auto",
};
const pickerItemStyle: CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "7px 9px",
  fontFamily: "var(--sans)",
  fontSize: 12,
  fontWeight: 500,
  color: "var(--ink)",
  borderWidth: 0,
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
  whiteSpace: "nowrap",
};
const textareaStyle: CSSProperties = {
  flex: 1,
  // Let the textarea shrink inside the flex row. Without this, a flex item's
  // default min-width:auto keeps it at its intrinsic (cols-based) width, so it
  // overflows the panel and iOS Safari paints a horizontal scrollbar.
  minWidth: 0,
  boxSizing: "border-box",
  resize: "none",
  // Height + overflowY are managed imperatively by resizeTextarea(): the box
  // starts at one line, grows to MAX_LINES (3) line-heights, then scrolls.
  // Never scrolls horizontally.
  overflowX: "hidden",
  overflowY: "hidden",
  padding: "8px 10px",
  fontFamily: "var(--sans)",
  fontSize: 13,
  lineHeight: 1.5,
  color: "var(--ink)",
  background: "var(--page)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  borderRadius: "var(--r-sm)",
  outline: "none",
};
const voiceBarStyle: CSSProperties = {
  padding: "6px 12px",
  fontFamily: "var(--sans)",
  fontSize: 12,
  color: "var(--ink-soft)",
  background: "var(--surface-sunk)",
  borderTopWidth: 1,
  borderTopStyle: "solid",
  borderTopColor: "var(--rule)",
};
const micButtonStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  width: 36,
  height: 36,
  padding: 0,
  color: "var(--ink-soft)",
  background: "var(--surface-sunk)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  borderRadius: "var(--r-sm)",
};
// Voice conversation toggle — lives beside the composer (moved out of the header
// so voice sits next to the message, like ChatGPT / Gemini). Highlights when on.
const voiceToggleStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  width: 36,
  height: 36,
  padding: 0,
  color: "var(--ink-soft)",
  background: "var(--surface-sunk)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
};
const voiceToggleActiveStyle: CSSProperties = {
  color: "var(--page)",
  background: "var(--ochre)",
  borderColor: "var(--ochre)",
};
const micButtonRecordingStyle: CSSProperties = {
  color: "#fff",
  background: "var(--crit)",
  borderColor: "var(--crit)",
  animation: "mic-pulse 1.4s ease-out infinite",
};
const micButtonSpeakingStyle: CSSProperties = {
  color: "#fff",
  background: "var(--green)",
  borderColor: "var(--green)",
};
const speechErrorStyle: CSSProperties = {
  margin: 0,
  padding: "0 12px 8px",
  fontFamily: "var(--sans)",
  fontSize: 12,
  color: "var(--crit)",
};
const sendButtonStyle: CSSProperties = {
  padding: "8px 14px",
  fontFamily: "var(--sans)",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--page)",
  background: "var(--green-deep)",
  borderWidth: 0,
  borderRadius: "var(--r-sm)",
  whiteSpace: "nowrap",
};
const stopButtonStyle: CSSProperties = {
  padding: "8px 14px",
  fontFamily: "var(--sans)",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--ink-soft)",
  background: "var(--surface-sunk)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule-strong)",
  borderRadius: "var(--r-sm)",
  whiteSpace: "nowrap",
  cursor: "pointer",
};
