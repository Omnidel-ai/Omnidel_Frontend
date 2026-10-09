"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname } from "next/navigation";
import { MultiItemConfirmCard } from "@/components/omnidel/mahacharya/MultiItemConfirmCard";
import {
  NeedFieldsCard,
  type NeedFieldsCardPayload,
} from "@/components/omnidel/mahacharya/NeedFieldsCard";
import { CreateBoardModal } from "@/components/omnidel/create-board-modal";
import { Markdown } from "@/components/omnidel/markdown";
import type { ActProposal } from "@/components/omnidel/mahacharya/ConfirmCard";
import {
  parseAssistantTurn,
  extractProgressFrames,
  visibleProgressRemainder,
  stripProgressFrames,
} from "@/lib/client/mahacharya-parse";
import { useIsMobile } from "@/lib/client/use-is-mobile";
import { getProjectSetupSurface } from "@/lib/client/project-setup-surface";
import { useTr } from "@/lib/client/language";

// ============================================================================
// ProjectSetupModal — a dedicated, self-contained chat for spinning up a new
// project (board). It owns its OWN chat state (NOT the mahacharya store) so it
// can live anywhere — the boards landing page or inside the task-create modal —
// without bleeding into the global assistant conversation.
//
// Flow:
//   1. Open → seed one neutral greeting.
//   2. User describes the project → POST /api/mahacharya/chat with
//      mode:"project_setup" → assistant streams back a plan + a fenced
//      ```mahacharya-act``` create_project proposal.
//   3. We parse the proposal per assistant message and render the shared
//      MultiItemConfirmCard checklist below the bubble.
//   4. Confirm → POST { confirmedAct } → success line is appended + the route
//      refreshed so the new project shows up in the grid.
//
// A footer link drops the user into the manual CreateBoardModal form if they'd
// rather not chat. The modal renders via a portal at z-index ~1200 so it sits
// above other modals (e.g. the task-create modal that may have opened it).
//
// Layout: the dialog is a fixed-height flex column with ONE internal scroll
// region (the message list). Header is pinned on top, the composer + manual
// link are pinned at the bottom — both flex siblings of the scroll area (never
// sticky inside it), mirroring task-create-modal so the primary action is
// always in view. On small viewports (narrow OR short) it fills the screen with
// a thin inset so the whole flow is usable one-handed.
// ============================================================================

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const GREETING =
  "Hi! I'll help you set up a project the right way. First, tell me a bit about it — what's this project for, and how does the work usually flow? I'll ask a couple of questions, then suggest a structure tailored to it.";

// Opened from a team page, the team is already settled — say so, so the user
// isn't asked to re-pick it and knows where the project will land.
function greetingFor(teamName?: string): string {
  if (!teamName?.trim()) return GREETING;
  return `Hi! I'll help you set up a project in ${teamName.trim()}. Tell me a bit about it — what's it for, and how does the work usually flow? I'll ask a couple of questions, then suggest columns, labels and a few starter tasks tailored to it.`;
}

interface Props {
  open: boolean;
  onClose: () => void;
  // When set, the create flow is pre-scoped to this team: the guided chat is
  // skipped and the manual CreateBoardModal opens with the team pre-selected
  // and its Team picker locked (the caller already chose the team).
  presetWorkspaceId?: string;
  presetWorkspaceName?: string;
}

export function ProjectSetupModal({ open, onClose, presetWorkspaceId, presetWorkspaceName }: Props) {
  const tr = useTr();
  const router = useRouter();
  const pathname = usePathname();
  // Compact when the viewport is narrow OR short — either way the fixed-ish
  // dialog would otherwise squeeze the scroll region to a sliver, so we switch
  // to a near-full-screen sheet.
  const compact = useIsMobile("(max-width: 640px), (max-height: 900px)");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [mounted, setMounted] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  // Tracks whether an abort was user-initiated (Stop button) vs the 60s timeout.
  const stopFlagRef = useRef(false);
  // Pins every turn of this modal's session to ONE server conversation — set on
  // the first send (via ensureConversationId) and reused for every subsequent
  // send, including the synthetic "Continue …" turns from submitNeedFields and
  // the confirmedAct write. Without this each POST created its own conversation
  // (getOrCreateActiveThread defaults to a new one when conversationId is
  // absent), so a single setup flow fragmented into N "recent chats". Reset to
  // null on each open so a fresh modal open starts a fresh conversation.
  const conversationIdRef = useRef<string | null>(null);
  // Carry buffer for partial \u001eMAHACHARYA_PROGRESS frames across chunks.
  const progressCarryRef = useRef("");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Seed the greeting + reset on each open.
  useEffect(() => {
    if (!open) return;
    setMessages([{ role: "assistant", content: greetingFor(presetWorkspaceName) }]);
    setDraft("");
    setSending(false);
    setShowManual(false);
    conversationIdRef.current = null;
    setTimeout(() => textareaRef.current?.focus(), 50);
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [open, presetWorkspaceName]);

  // Mint (once) or reuse the server conversation id for this modal session.
  // Mirrors ChatWidget's ensureConversationId so the setup flow's whole
  // choreography — real turns, synthetic "Continue …" turns, and the final
  // confirmedAct write — all land in the SAME thread.
  const ensureConversationId = useCallback(async (): Promise<string | null> => {
    if (conversationIdRef.current) return conversationIdRef.current;
    try {
      const r = await fetch("/api/mahacharya/thread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!r.ok) return null;
      const data = (await r.json()) as { conversationId?: string };
      if (typeof data.conversationId === "string" && data.conversationId) {
        conversationIdRef.current = data.conversationId;
        return data.conversationId;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  // Esc closes (only the top-level modal — when the manual form is open, let it
  // own Escape).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !showManual) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, showManual]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [open]);

  // Auto-scroll the message list as content streams in.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // ── Stream a user turn through the project_setup chat route ────────────────
  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;

      // Build the outgoing history from current messages + the new user turn
      // (drop the seeded greeting / any empty placeholders), capped to last 10.
      const history: ChatMessage[] = [
        ...messages,
        { role: "user" as const, content: trimmed },
      ]
        .filter((m) => !(m.role === "assistant" && m.content === ""))
        .slice(-10);

      // Optimistically append the user msg + an empty assistant bubble to stream
      // into.
      setMessages((prev) => [
        ...prev,
        { role: "user", content: trimmed },
        { role: "assistant", content: "" },
      ]);
      setDraft("");
      setSending(true);

      const conversationId = await ensureConversationId();

      const controller = new AbortController();
      abortRef.current = controller;
      const timeout = setTimeout(() => controller.abort(), 60_000);
      let acc = "";
      progressCarryRef.current = "";
      let stoppedByUser = false;
      const wasAborted = () => controller.signal.aborted;

      const finalizeVisible = (raw: string) =>
        stripProgressFrames(raw + visibleProgressRemainder(progressCarryRef.current));

      try {
        const res = await fetch("/api/mahacharya/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            messages: history.map((m) => ({ role: m.role, content: m.content })),
            mode: "project_setup",
            pathname,
            module: "omnipulse",
            conversationId: conversationId ?? undefined,
            // The caller already chose the team, so the assistant should skip
            // asking for one. Only a NAME goes over the wire, and the server
            // matches it against the caller's own managed teams before using
            // it — an unmatched name is ignored, so this can't widen access.
            presetTeamName: presetWorkspaceName?.trim() || undefined,
          }),
        });

        if (!res.ok || !res.body) {
          setMessages((prev) =>
            replaceLastAssistant(
              prev,
              res.status === 429
                ? "I'm getting a lot of messages right now — give me a moment and try again."
                : "Sorry, I couldn't respond just now. Please try again.",
            ),
          );
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        // The route interleaves out-of-band MAHACHARYA_PROGRESS frames into this
        // same stream. They are activity telemetry, not prose — without this the
        // raw frames render as debug text in the bubble. We have no ticker UI
        // here, so the parsed events are intentionally discarded; only `visible`
        // is kept. `carry` holds a frame split across two chunks.
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const parsed = extractProgressFrames(chunk, progressCarryRef.current);
          progressCarryRef.current = parsed.carry;
          if (parsed.visible) acc += parsed.visible;
          // Never paint raw progress frames — keep Thinking… until prose/card.
          setMessages((prev) => replaceLastAssistant(prev, finalizeVisible(acc)));
        }
        acc += decoder.decode();
        // Flush any leftover carry that isn't a partial progress prefix.
        const tail = visibleProgressRemainder(progressCarryRef.current);
        progressCarryRef.current = "";
        if (tail) acc += tail;
        const finalText = stripProgressFrames(acc);
        setMessages((prev) =>
          replaceLastAssistant(
            prev,
            finalText.trim() ? finalText : "Sorry, I couldn't respond just now. Please try again.",
          ),
        );
      } catch {
        // abortRef tracks user-initiated stops via the Stop button (sets the
        // flag right before calling abort()).
        stoppedByUser = stopFlagRef.current;
        const visible = finalizeVisible(acc);
        progressCarryRef.current = "";
        setMessages((prev) =>
          replaceLastAssistant(
            prev,
            wasAborted()
              ? stoppedByUser
                ? visible.trim()
                  ? visible
                  : "Stopped."
                : "That took too long — please try again."
              : visible.trim()
                ? visible
                : "Sorry, the connection dropped. Please try again.",
          ),
        );
      } finally {
        clearTimeout(timeout);
        abortRef.current = null;
        stopFlagRef.current = false;
        progressCarryRef.current = "";
        setSending(false);
      }
    },
    [messages, sending, pathname, ensureConversationId, presetWorkspaceName],
  );

  const stop = useCallback(() => {
    stopFlagRef.current = true;
    abortRef.current?.abort();
  }, []);

  // ── Confirm the create_project proposal ────────────────────────────────────
  const confirmAct = useCallback(
    async (proposal: ActProposal): Promise<string> => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);
      try {
        const res = await fetch("/api/mahacharya/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            confirmedAct: {
              action: proposal.action,
              args: proposal.args ?? {},
            },
            conversationId: conversationIdRef.current ?? undefined,
          }),
        });
        const line =
          (await res.text().catch(() => "")).trim() ||
          (res.ok ? "Project created." : "Sorry, that didn't go through. Please try again.");
        if (!res.ok) throw new Error(line);
        // Success: surface the line, refresh so the new project shows in the
        // grid, then close the modal (the work is done — don't leave it open).
        setMessages((prev) => [...prev, { role: "assistant", content: line }]);
        router.refresh();
        setTimeout(() => onClose(), 900);
        return line;
      } finally {
        clearTimeout(timeout);
      }
    },
    [router, onClose],
  );

  // Guided need-fields card submit → synthetic user turn re-POSTed through the
  // same project_setup route so the flow advances (next card or the proposal).
  const submitNeedFields = useCallback(
    async (
      payload: NeedFieldsCardPayload,
      values: Record<string, string>,
      displayValues: Record<string, string>,
    ) => {
      const action = typeof payload.action === "string" && payload.action ? payload.action : "the setup";
      const lines = payload.fields.map((f) => {
        const shown = displayValues?.[f.field]?.trim() || values[f.field]?.trim() || "";
        return `- ${f.label}: ${shown}`;
      });
      await send(`Continue ${action}. My choices:\n${lines.join("\n")}`);
    },
    [send],
  );

  function onTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(draft);
    }
  }

  const surface = getProjectSetupSurface({ open, mounted, showManual });
  if (surface === "closed") return null;

  // The manual form replaces the assistant surface instead of stacking another
  // active dialog over it. Cancelling always restores the assistant session —
  // the form is now only ever reached by the user asking for it, so backing out
  // of it means "go back to the chat", never "abandon the whole flow".
  if (surface === "manual") {
    return createPortal(
      <CreateBoardModal
        open
        onClose={() => {
          setShowManual(false);
          setTimeout(() => textareaRef.current?.focus(), 50);
        }}
        onCreated={() => onClose()}
        presetWorkspaceId={presetWorkspaceId}
        presetWorkspaceName={presetWorkspaceName}
      />,
      document.body,
    );
  }

  const overlay = (
    <div
      style={{ ...overlayStyle, padding: compact ? 16 : "24px 16px" }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !showManual) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="psm"
        style={{
          ...dialogStyle,
          maxWidth: compact ? "100%" : 560,
          minWidth: compact ? undefined : 560,
          height: compact ? "calc(100dvh - 32px)" : undefined,
          maxHeight: compact ? "calc(100dvh - 32px)" : "90vh",
          minHeight: compact ? undefined : "60vh",
        }}
      >
        <style>{PSM_CSS}</style>
        <button onClick={onClose} aria-label={tr("Close")} className="psm-close" style={closeBtnStyle}>
          ×
        </button>

        {/* Header — pinned (flex sibling of the scroll region, never scrolls). */}
        <div style={headerStyle}>
          <h2 style={titleStyle}>{tr("Set up a project")}</h2>
        </div>

        {/* Message list — the ONE internal scroll region (flex:1, min-height:0). */}
        <div ref={listRef} style={listStyle}>
          {messages.map((m, i) => {
            if (m.role === "user") {
              return (
                <div key={i} style={userRowStyle}>
                  <div style={userBubbleStyle}>{m.content}</div>
                </div>
              );
            }
            const { text, proposal, needFields } = parseAssistantTurn(m.content);
            const rawPriorUser = i > 0 && messages[i - 1]?.role === "user" ? messages[i - 1].content : undefined;
            const priorUser = rawPriorUser && !rawPriorUser.startsWith("Continue ") ? rawPriorUser : undefined;
            // Hide a guided need-fields card once the flow has moved on (a later
            // assistant turn exists — typically after the user hit Continue).
            // Without this, step-2 "Continue"/"Submitting…" stays on screen
            // above the create_project confirm card.
            const needFieldsStale = messages.slice(i + 1).some((later) => later.role === "assistant");
            // Project-setup modal only runs the create_project choreography —
            // ignore a leaked create_tasks (or other) need-fields card from a
            // prior short-circuit / model mistake.
            const setupNeedFields =
              needFields &&
              (!needFields.action || needFields.action === "create_project")
                ? needFields
                : null;
            const visibleNeedFields = needFieldsStale ? null : setupNeedFields;
            // "Thinking…" while the last bubble is still empty (incl. while only
            // a fenced block has streamed so far — text stripped, card not ready).
            const isLast = i === messages.length - 1;
            const showThinking = sending && isLast && !text && !proposal && !visibleNeedFields;
            return (
              <div key={i} style={assistantRowStyle}>
                {(text || showThinking) && (
                  <div style={assistantBubbleStyle}>
                    {showThinking ? (
                      <span style={{ color: "var(--ink-mute)" }}>{tr("Thinking…")}</span>
                    ) : (
                      <Markdown source={text} />
                    )}
                  </div>
                )}
                {visibleNeedFields && (
                  <NeedFieldsCard
                    payload={visibleNeedFields}
                    userMessage={priorUser}
                    onSubmit={submitNeedFields}
                  />
                )}
                {proposal && proposal.action === "create_project" && (
                  <MultiItemConfirmCard proposal={proposal} onConfirm={confirmAct} />
                )}
              </div>
            );
          })}
        </div>

        {/* Composer + manual fallback — pinned at the bottom as one flex sibling
            of the scroll region, so the input and the primary path stay in view
            no matter how long the conversation runs. */}
        <div style={footerStyle}>
          <div style={composerStyle}>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onTextareaKeyDown}
              placeholder={tr("Describe your project…")}
              rows={2}
              className="psm-textarea"
              style={textareaStyle}
            />
            {sending ? (
              <button type="button" onClick={stop} className="psm-stop" style={stopBtnStyle}>
                {tr("Stop")}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void send(draft)}
                disabled={!draft.trim()}
                className="psm-send"
                style={{ ...sendBtnStyle, opacity: draft.trim() ? 1 : 0.6 }}
              >
                {tr("Send")}
              </button>
            )}
          </div>
          <button type="button" onClick={() => setShowManual(true)} className="psm-manual" style={manualLinkStyle}>
            {tr("Prefer a form? Create manually →")}
          </button>
        </div>
      </div>

    </div>
  );

  return createPortal(overlay, document.body);
}

// Replace the trailing assistant bubble's content (the placeholder we appended).
function replaceLastAssistant(prev: ChatMessage[], content: string): ChatMessage[] {
  const next = [...prev];
  for (let i = next.length - 1; i >= 0; i--) {
    if (next[i].role === "assistant") {
      next[i] = { ...next[i], content };
      break;
    }
  }
  return next;
}

// Hover / focus / reduced-motion deltas that inline styles can't express. Base
// appearance stays inline (the codebase idiom); this only layers interaction
// states, scoped by the `psm-` class prefix.
const PSM_CSS = `
.psm-send, .psm-stop, .psm-close, .psm-manual { transition: background-color .12s ease, filter .12s ease, color .12s ease; }
.psm-send:hover:not(:disabled) { filter: brightness(1.08); }
.psm-send:disabled { cursor: not-allowed; }
.psm-stop:hover { background: var(--surface-sunk); }
.psm-close:hover { background: var(--surface-sunk); color: var(--ink); }
.psm-manual:hover { filter: brightness(0.82); }
.psm-textarea:focus { outline: none; border-color: var(--green-deep); }
@media (prefers-reduced-motion: reduce) { .psm-send, .psm-stop, .psm-close, .psm-manual { transition: none; } }
`;

// ─── Styles (CSS variables only) ─────────────────────────────────────────────
const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1200,
  background: "rgba(0,0,0,0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflowY: "auto",
};
const dialogStyle: CSSProperties = {
  width: "100%",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  background: "var(--surface)",
  border: "1px solid var(--rule)",
  borderRadius: "var(--r-md)",
  boxShadow: "var(--shadow-md)",
  position: "relative",
};
const closeBtnStyle: CSSProperties = {
  position: "absolute",
  top: 12,
  right: 12,
  width: 30,
  height: 30,
  borderRadius: "var(--r-sm)",
  background: "transparent",
  borderWidth: 0,
  cursor: "pointer",
  color: "var(--ink-soft)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 18,
  lineHeight: 1,
  zIndex: 1,
};
const headerStyle: CSSProperties = {
  flexShrink: 0,
  padding: "16px 20px 12px",
  paddingRight: 44,
  borderBottom: "1px solid var(--rule)",
};
const titleStyle: CSSProperties = {
  fontFamily: "var(--serif)",
  fontSize: 22,
  fontWeight: 600,
  color: "var(--ink)",
  margin: 0,
};
const listStyle: CSSProperties = {
  flex: "1 1 auto",
  minHeight: 0,
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: 10,
  padding: "14px 20px",
};
const userRowStyle: CSSProperties = { display: "flex", justifyContent: "flex-end" };
const assistantRowStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
};
const userBubbleStyle: CSSProperties = {
  maxWidth: "82%",
  padding: "8px 12px",
  fontFamily: "var(--sans)",
  fontSize: 13,
  lineHeight: 1.5,
  color: "var(--page)",
  background: "var(--green-deep)",
  borderRadius: "var(--r-md)",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};
const assistantBubbleStyle: CSSProperties = {
  maxWidth: "92%",
  padding: "8px 12px",
  fontFamily: "var(--sans)",
  fontSize: 13,
  lineHeight: 1.5,
  color: "var(--ink)",
  background: "var(--surface-sunk)",
  borderRadius: "var(--r-md)",
  wordBreak: "break-word",
};
const footerStyle: CSSProperties = {
  flexShrink: 0,
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: "12px 20px",
  borderTop: "1px solid var(--rule)",
  background: "var(--surface)",
};
const composerStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "flex-end",
};
const textareaStyle: CSSProperties = {
  flex: 1,
  minHeight: 44,
  maxHeight: 140,
  padding: "10px 12px",
  fontFamily: "var(--sans)",
  fontSize: 13,
  color: "var(--ink)",
  background: "var(--page)",
  border: "1px solid var(--rule-strong)",
  borderRadius: "var(--r-sm)",
  resize: "vertical",
  boxSizing: "border-box",
};
const sendBtnStyle: CSSProperties = {
  padding: "10px 18px",
  fontFamily: "var(--sans)",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--page)",
  background: "var(--green-deep)",
  borderWidth: 0,
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
};
const stopBtnStyle: CSSProperties = {
  padding: "10px 18px",
  fontFamily: "var(--sans)",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--ink-soft)",
  background: "var(--surface)",
  border: "1px solid var(--rule-strong)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
};
const manualLinkStyle: CSSProperties = {
  fontFamily: "var(--sans)",
  fontSize: 12,
  color: "var(--green-deep)",
  background: "transparent",
  border: "none",
  padding: 0,
  cursor: "pointer",
  textDecoration: "underline",
  alignSelf: "flex-start",
};
