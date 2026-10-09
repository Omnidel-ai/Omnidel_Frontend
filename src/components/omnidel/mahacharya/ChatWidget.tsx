"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { usePermissions } from "@/lib/client/permissions";
import {
  useMahacharyaStore,
  mahacharyaActions,
  selectActiveMessages,
  selectActiveConversationId,
  selectConsumedProposals,
  selectConversations,
  type MahacharyaMessage,
} from "@/lib/client/mahacharya-store";
import { emitToast } from "@/components/omnidel/toaster";
import {
  MAX_DOCS,
  partitionDocFiles,
  toastDocLimitReached,
  toastUnsupportedFiles,
  uploadDocInChunks,
  type UiAttachment,
} from "@/components/omnidel/mahacharya/AttachmentBar";
import { Thread } from "@/components/omnidel/mahacharya/Thread";
import type { NeedFieldsCardPayload } from "@/components/omnidel/mahacharya/NeedFieldsCard";
import { Walkthrough } from "@/components/omnidel/mahacharya/Walkthrough";
import type { ActProposal } from "@/components/omnidel/mahacharya/ConfirmCard";
import type { WalkthroughStep } from "@/lib/client/mahacharya-walkthroughs";
import type { TaskGuidedFillValues } from "@/lib/client/task-guided-fill";
import {
  parseAssistantTurn,
  proseForSpeech,
  encodeUserMessageWithAttachments,
  parseUserMessage,
  proposalSignature,
  extractProgressFrames,
  visibleProgressRemainder,
  type ParsedNav,
  type MahacharyaProgressEvent,
} from "@/lib/client/mahacharya-parse";
import { matchVoiceConfirmIntent } from "@/lib/client/voice-intent";
import { useGeminiVoice } from "@/lib/client/use-gemini-voice";
// REMOVED: browser speech (Web Speech API, MediaRecorder+Whisper hybrid)
// Replaced with Gemini Live hold-to-talk — mic beside Send in Thread composer
import { useMahacharyaTts } from "@/lib/client/use-mahacharya-tts";
import { useTr } from "@/lib/client/language";

function voiceLangFromEnv(): "en" | "hi" | "bn" {
  const raw = process.env.NEXT_PUBLIC_MAHACHARYA_VOICE_LANG ?? "en";
  if (raw === "hi" || raw === "bn") return raw;
  return "en";
}

export type VoicePhase = "idle" | "listening" | "thinking" | "speaking";

// Frame parsing itself now lives in mahacharya-parse so every consumer of
// /api/mahacharya/chat strips frames the same way (the Project Setup modal did
// not, and leaked raw MAHACHARYA_PROGRESS lines into its bubbles).
type MahacharyaActivity = MahacharyaProgressEvent & { ts: number };

// ─────────────────────────────────────────────────────────────────────────────
// ChatWidget — floating MahAcharya assistant, mounted once in the dashboard
// shell so it persists across route changes. Because it lives above the page
// content (not inside a route segment), navigating between modules never
// unmounts it: the SAME conversation stays open the whole session.
//
// Flow:
//   • Active user is taken from the permissions context (set in the dashboard
//     layout). The store keys history by userId.
//   • On first open, hydrate from GET /api/mahacharya/thread (durable copy).
//   • Sending POSTs to /api/mahacharya/chat with the recent messages + the
//     current pathname/module for context, then streams the text response into
//     the last assistant bubble. The store persists every keystroke of the
//     stream so a mid-reply navigation keeps the partial answer.
//
// Module context: the first path segment under /(dashboard) IS the module
// (omnimart, omnipulse, omnivarsity, pipeline, …). MahAcharya uses it to scope
// its answers without the user restating where they are.
// ─────────────────────────────────────────────────────────────────────────────

function moduleFromPath(pathname: string): string {
  // "/omnipulse/board/123" → "omnipulse"; "/" or "" → "home".
  const seg = pathname.split("/").filter(Boolean)[0];
  return seg || "home";
}

/** Task id from `?task=` when a card detail modal is open on a board page. */
function contextTaskIdFromUrl(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const id = new URLSearchParams(window.location.search).get("task")?.trim();
  return id && /^[0-9a-f-]{36}$/i.test(id) ? id : undefined;
}

const TASK_MUTATION_ACTIONS = new Set([
  "create_task",
  "create_tasks",
  "update_task",
  "archive_task",
  "archive_tasks",
  "restore_task",
  "comment_on_task",
]);

const LEAD_MUTATION_ACTIONS = new Set([
  "create_lead",
  "update_lead",
  "comment_on_lead",
  "advance_lead_stage",
]);

function getPendingProposal(
  msgs: MahacharyaMessage[],
  sending: boolean,
  consumed: Record<string, number> = {},
): ActProposal | null {
  if (sending || msgs.length === 0) return null;
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m.role !== "assistant" || !m.content.trim()) continue;
    if (/\*\*(?:Created|Done|Cancelled)\*\*/.test(m.content)) continue;
    const { proposal } = parseAssistantTurn(m.content);
    if (!proposal) continue;
    // Skip a proposal already confirmed on this machine (retest bug 2) —
    // otherwise a resurrected block makes a spoken "yes" re-run a done action.
    // Compared by time, so an identical repeat request is still confirmable.
    const consumedAt = consumed[proposalSignature(proposal)];
    if (consumedAt !== undefined && m.ts <= consumedAt) continue;
    return proposal;
  }
  return null;
}

function findOpenProposalMessageTs(msgs: MahacharyaMessage[]): number | null {
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m.role !== "assistant" || !m.content.trim()) continue;
    if (/\*\*(?:Created|Done|Cancelled)\*\*/.test(m.content)) continue;
    const { proposal } = parseAssistantTurn(m.content);
    if (proposal) return m.ts;
  }
  return null;
}

function dismissOpenProposal(msgs: MahacharyaMessage[], label = "Cancelled"): void {
  const ts = findOpenProposalMessageTs(msgs);
  if (ts == null) return;
  // Retire it durably as well as in the message (retest bug 2): a cancelled or
  // superseded proposal must not come back the next time the thread is re-read
  // from the server.
  const dismissed = msgs.find((m) => m.ts === ts);
  if (dismissed) {
    const { proposal } = parseAssistantTurn(dismissed.content);
    if (proposal) mahacharyaActions.markProposalConsumed(proposalSignature(proposal));
  }
  mahacharyaActions.markActDone(ts);
}

/** Merge card display fields into confirm args so replay matches what the user saw. */
function buildConfirmArgs(proposal: ActProposal): Record<string, unknown> {
  const args = { ...(proposal.args ?? {}) };
  for (const field of proposal.fields ?? []) {
    const label = field.label.trim().toLowerCase();
    const value = field.value?.trim();
    if (!value) continue;
    if (label === "task" && !args.task_title) args.task_title = value;
    if (label === "column" && !args.list_name) args.list_name = value;
    if (label === "lead" && !args.lead_ref) args.lead_ref = value;
  }
  return args;
}

export function ChatWidget() {
  const tr = useTr();
  const { userId } = usePermissions();
  const pathname = usePathname();
  const router = useRouter();

  const open = useMahacharyaStore((s) => s.open);
  const fabSide = useMahacharyaStore((s) => s.fabSide);
  const activeUserId = useMahacharyaStore((s) => s.activeUserId);
  const messages = useMahacharyaStore(selectActiveMessages);
  const activeConversationId = useMahacharyaStore(selectActiveConversationId);
  const conversations = useMahacharyaStore(selectConversations);

  // Recent-conversations dropdown visibility (transient UI state).
  const [recentOpen, setRecentOpen] = useState(false);
  // How many conversations the Recent list reveals. Starts at one page (5) and
  // grows a page at a time via "Show more" — the list area scrolls past ~5 rows.
  const RECENT_PAGE = 5;
  const [recentVisible, setRecentVisible] = useState(RECENT_PAGE);
  // Reset the reveal count whenever the dropdown re-opens so it always starts at
  // the first page (avoids a previously-expanded list staying expanded).
  useEffect(() => {
    if (recentOpen) setRecentVisible(RECENT_PAGE);
    else setHoveredRecentIdx(null);
  }, [recentOpen]);
  // The dropdown is rendered via a portal to <body> with position:fixed,
  // positioned from the trigger's bounding rect. This is the ONLY way it can
  // escape the chat panel's overflow:hidden (which clips an absolute-positioned
  // child); the same escape pattern is used by CustomSelect and the pickers.
  const recentTriggerRef = useRef<HTMLButtonElement>(null);
  const recentMenuRef = useRef<HTMLDivElement>(null);
  const [recentPos, setRecentPos] = useState<{ top: number; left?: number; right?: number } | null>(null);
  // Drag FAB between bottom-left / bottom-right only (snap on release).
  const fabDragRef = useRef<{
    pointerId: number;
    startX: number;
    moved: boolean;
  } | null>(null);
  const [fabDragX, setFabDragX] = useState<number | null>(null);
  // Hover highlight tracked in state (not CSS :hover) because the row's
  // background is already driven by the isActive check below — same pattern as
  // CustomSelect's `highlighted` index, which avoids an inline-style/stylesheet
  // specificity fight over `background`.
  const [hoveredRecentIdx, setHoveredRecentIdx] = useState<number | null>(null);

  // Walkthrough tour state. Lives here (outside the chat panel) so the
  // Walkthrough renders outside the panel's z-index stacking context and is
  // never trapped behind modals that outrank the panel (Bug 3 fix).
  const [tourSteps, setTourSteps] = useState<WalkthroughStep[] | null>(null);
  const [tourFillValues, setTourFillValues] = useState<TaskGuidedFillValues | null>(null);

  // Draft + sending are ephemeral UI state — they don't belong in the persisted
  // store (a half-typed message shouldn't survive a reload).
  const draftRef = useRef("");
  const sendingRef = useRef(false);
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<UiAttachment[]>([]);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const progressBufferRef = useRef("");
  const [activity, setActivity] = useState<MahacharyaActivity[]>([]);
  const consumeAssistantChunk = useCallback((chunk: string): string => {
    if (!chunk) return "";
    const parsed = extractProgressFrames(chunk, progressBufferRef.current);
    progressBufferRef.current = parsed.carry;
    if (parsed.events.length > 0) {
      const now = Date.now();
      setActivity((prev) => [
        ...prev.slice(-8),
        ...parsed.events.map((event, idx) => ({ ...event, ts: now + idx })),
      ]);
    }
    return parsed.visible;
  }, []);
  const flushAssistantProgress = useCallback((): string => {
    const visible = visibleProgressRemainder(progressBufferRef.current);
    progressBufferRef.current = "";
    return visible;
  }, []);
  // Abort support: lets us time out a hung request and lets the user Stop a
  // slow reply — without this a dropped stream leaves the bubble spinning.
  const abortRef = useRef<AbortController | null>(null);
  const stoppedByUserRef = useRef(false);
  const [voiceMode, setVoiceMode] = useState(false);
  // Expanded (centered, larger) vs the default docked bottom-right panel.
  const [expanded, setExpanded] = useState(false);
  // Ref on the panel so an outside click can distinguish inside vs outside.
  const panelRef = useRef<HTMLDivElement>(null);
  const [voicePhase, setVoicePhase] = useState<VoicePhase>("idle");
  const voiceModeRef = useRef(false);
  const voicePhaseRef = useRef<VoicePhase>("idle");
  useEffect(() => {
    voiceModeRef.current = voiceMode;
  }, [voiceMode]);
  useEffect(() => {
    voicePhaseRef.current = voicePhase;
  }, [voicePhase]);

  const [voiceHearingText, setVoiceHearingText] = useState("");
  const [voiceSubtitle, setVoiceSubtitle] = useState("");

  const processVoiceUtteranceRef = useRef<(text: string) => Promise<string | null>>(
    async () => null,
  );

  const confirmActRef = useRef<
    (p: ActProposal, opts?: { skipTts?: boolean }) => Promise<string>
  >(async () => "Done.");

  const ttsRef = useRef<ReturnType<typeof useMahacharyaTts> | null>(null);

  const geminiVoice = useGeminiVoice({
    lang: voiceLangFromEnv(),
    onLiveText: (text) => setVoiceHearingText(text),
    onUtterance: (text) => processVoiceUtteranceRef.current(text),
    onEmpty: () => {
      setVoiceHearingText("");
    },
    onSpeakFallback: async (text) => {
      setVoicePhase("speaking");
      await ttsRef.current?.speak(text);
      if (!geminiVoiceRef.current?.speaking) setVoicePhase("idle");
    },
  });
  const geminiVoiceRef = useRef(geminiVoice);
  geminiVoiceRef.current = geminiVoice;

  const speechSupported = geminiVoice.supported;
  const listening = geminiVoice.listening;
  const refining = geminiVoice.refining;
  const transcribing = geminiVoice.transcribing;
  const speechError = geminiVoice.error;

  useEffect(() => {
    const t = (geminiVoice.liveText || voiceHearingText).trim();
    if (t) setVoiceSubtitle(t);
  }, [geminiVoice.liveText, voiceHearingText]);

  useEffect(() => {
    if (geminiVoice.phase === "idle" && !geminiVoice.speaking && !sendingRef.current) {
      setVoiceSubtitle("");
    }
  }, [geminiVoice.phase, geminiVoice.speaking]);

  useEffect(() => {
    if (geminiVoice.phase === "recording") setVoicePhase("listening");
    else if (geminiVoice.phase === "processing") setVoicePhase("thinking");
    else if (geminiVoice.phase === "speaking") setVoicePhase("speaking");
    else if (geminiVoice.phase === "connecting") setVoicePhase("listening");
    else if (geminiVoice.phase === "idle" && !sendingRef.current) setVoicePhase("idle");
  }, [geminiVoice.phase]);

  const tts = useMahacharyaTts((speaking) => {
    if (!voiceModeRef.current) return;
    if (speaking) setVoicePhase("speaking");
    else if (voicePhaseRef.current === "speaking") setVoicePhase("idle");
  });
  ttsRef.current = tts;

  // Force re-render hook for the ephemeral refs above.
  const [, force] = useForce();

  // Bind the active user once the permission context resolves. The widget only
  // renders for signed-in users (it's mounted inside the authed dashboard), so
  // userId is non-empty by the time this runs.
  useEffect(() => {
    if (userId && userId !== activeUserId) mahacharyaActions.setActiveUser(userId);
  }, [userId, activeUserId]);

  useEffect(() => {
    let cancelled = false;
    if (!activeConversationId) {
      setAttachments([]);
      return () => {
        cancelled = true;
      };
    }
    fetch(
      `/api/mahacharya/attachments?conversationId=${encodeURIComponent(activeConversationId)}&composer=1`,
    )
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((j) => {
        if (cancelled) return;
        const items = (j.items ?? []) as UiAttachment[];
        const hasUserChat = selectActiveMessages(useMahacharyaStore.getState()).some(
          (m) => m.role === "user",
        );
        // Open chat = empty composer (ChatGPT). Commit any leftover staged rows.
        if (hasUserChat) {
          setAttachments([]);
          if (items.length > 0) {
            void fetch("/api/mahacharya/attachments", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ conversationId: activeConversationId }),
            }).catch(() => {});
          }
          return;
        }
        setAttachments(items);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeConversationId]);

  const uploadDocs = useCallback(async (files: File[]) => {
    const { allowed, rejected } = partitionDocFiles(files);
    toastUnsupportedFiles(rejected);
    if (allowed.length === 0) return;

    // Cap against the live chip count so a concurrent pick can't exceed the limit.
    let room = MAX_DOCS - attachments.length;
    if (room <= 0) {
      toastDocLimitReached();
      return;
    }
    if (allowed.length > room) {
      emitToast(`Only ${room} more document${room === 1 ? "" : "s"} can be added.`);
    }
    const batch = allowed.slice(0, room).filter((f) => {
      if (f.size <= 0) {
        emitToast(`"${f.name}" is empty.`);
        return false;
      }
      if (f.size > 10 * 1024 * 1024) {
        emitToast(`"${f.name}" exceeds the 10 MB limit.`);
        return false;
      }
      return true;
    });
    if (batch.length === 0) return;

    setUploadingDocs(true);
    let threadId = activeConversationId;
    try {
      for (const file of batch) {
        try {
          // Chunked upload persists to Blob + DB first; chat later reads from server.
          const { item, conversationId } = await uploadDocInChunks(file, threadId);
          if (!threadId && conversationId) {
            threadId = conversationId;
            mahacharyaActions.setConversationId(null, conversationId);
          }
          setAttachments((prev) => {
            if (prev.some((a) => a.id === item.id)) return prev;
            return [...prev, item];
          });
          room -= 1;
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Upload failed";
          emitToast(msg);
        }
      }
    } finally {
      setUploadingDocs(false);
    }
  }, [activeConversationId, attachments.length]);

  const removeDoc = useCallback(async (id: string) => {
    const res = await fetch(`/api/mahacharya/attachments/${id}`, { method: "DELETE" });
    if (res.ok) setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Hydrate from the server when the panel opens and we have a bound user. One
  // round-trip returns the recent-conversations list + the most-recent
  // conversation's messages. setConversations merges the recent list without
  // clobbering the active (possibly unsaved/in-flight) conversation; hydrate()
  // keeps a non-empty local thread and only adopts the server copy on a cold one.
  // Degrades gracefully: a non-ok response (e.g. pre-migration server error) is
  // ignored and the local conversation still renders.
  const hydratedFor = useRef<string | null>(null);

  /**
   * Pull the recent-conversations list from the server. `withMessages` is only
   * true for the cold first open; a refresh must never re-hydrate the messages
   * of whatever thread the server considers most recent, or switching
   * conversations would fight it.
   *
   * Titles are derived SERVER-side on the first turn (setThreadTitleIfEmpty),
   * so the list this widget loaded when it mounted is stale the moment you send
   * anything — the conversation you are sitting in kept showing as "New chat"
   * even though GET /thread already knew its real title.
   */
  const refreshConversations = useCallback(async (withMessages: boolean) => {
    try {
      const r = await fetch("/api/mahacharya/thread");
      if (!r.ok) return;
      const data = (await r.json()) as {
        conversations?: { id: string; title: string | null; lastMessageAt: number }[];
        messages?: MahacharyaMessage[];
      };
      if (Array.isArray(data.conversations)) {
        mahacharyaActions.setConversations(
          data.conversations.map((c) => ({
            id: c.id,
            title: (c.title || "").trim() || "New chat",
            lastMessageAt: c.lastMessageAt,
          })),
        );
      }
      if (withMessages && Array.isArray(data.messages)) mahacharyaActions.hydrate(data.messages);
    } catch {
      /* offline / network — the local thread (if any) still renders */
    }
  }, []);

  useEffect(() => {
    if (!open || !userId) return;
    if (hydratedFor.current === userId) return;
    hydratedFor.current = userId;
    void refreshConversations(true);
  }, [open, userId, refreshConversations]);

  // Switch to an existing conversation: activate it, then load its messages from
  // the server (best-effort) so the panel shows that conversation's history.
  const switchConversation = useCallback(async (id: string) => {
    setRecentOpen(false);
    mahacharyaActions.setActiveConversation(id);
    try {
      const r = await fetch(`/api/mahacharya/thread?conversationId=${encodeURIComponent(id)}`);
      if (!r.ok) return;
      const data = (await r.json()) as { messages?: MahacharyaMessage[] };
      if (Array.isArray(data.messages)) mahacharyaActions.setMessages(data.messages);
    } catch {
      /* offline — keep whatever messages are already in the store */
    }
  }, []);

  // Start a brand-new conversation in the widget.
  const startNewConversation = useCallback(() => {
    setRecentOpen(false);
    // Drop the composer draft too. It is only cleared inside sendMessage (after
    // the send guard), so a half-typed message used to follow the user into the
    // new conversation.
    draftRef.current = "";
    setAttachments([]);
    mahacharyaActions.newConversation();
    force();
  }, [force]);

  // Position the portalled Recent dropdown from the trigger's rect.
  // Right-docked panel: menu aligns to trigger right edge.
  // Left-docked panel: menu aligns to trigger left edge (opens into the page).
  useLayoutEffect(() => {
    if (!recentOpen) {
      setRecentPos(null);
      return;
    }
    function updatePos() {
      const el = recentTriggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (fabSide === "left") {
        setRecentPos({ top: r.bottom + 4, left: r.left });
      } else {
        setRecentPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
      }
    }
    updatePos();
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [recentOpen, fabSide]);

  // Dismiss the Recent dropdown on an outside click. Because it's portalled to
  // <body> (outside the panel subtree), the click target may be in either the
  // trigger or the portalled menu — guard both before closing.
  useEffect(() => {
    if (!recentOpen) return;
    function handleClickOutside(e: MouseEvent) {
      const t = e.target as Node;
      if (recentTriggerRef.current?.contains(t)) return;
      if (recentMenuRef.current?.contains(t)) return;
      setRecentOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [recentOpen]);

  // Close the whole panel, resetting the expanded state so it reopens docked.
  const closePanel = useCallback(() => {
    setExpanded(false);
    mahacharyaActions.setOpen(false);
  }, []);

  // Dismiss the panel on an outside click — ONLY in expanded (modal) mode, where
  // a click on the dimmed backdrop is the expected way to close. The docked
  // bottom-right panel stays put so glancing at the page doesn't dismiss it.
  // Guards: the portalled Recent menu and an in-progress walkthrough must never
  // close the chat.
  useEffect(() => {
    if (!open || !expanded) return;
    function handleOutside(e: MouseEvent) {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (recentMenuRef.current?.contains(t)) return;
      // CustomSelect (Team/Project dropdowns on TeamProjectSelectCard,
      // NeedFieldsCard, …) escapes the panel's overflow:hidden via a
      // document.body portal, same as the Recent-conversations menu above —
      // without this it reads as "outside" and the whole panel closes the
      // instant the dropdown opens (bug: expanded panel unusable for any
      // Team/Project selection).
      if ((t as HTMLElement).closest?.(".custom-select-dropdown")) return;
      // A running walkthrough owns the screen — never close the chat under it.
      if (tourSteps && tourSteps.length > 0) return;
      closePanel();
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open, expanded, tourSteps, closePanel]);

  // Ensure the active conversation has a server id BEFORE the first send, so
  // every turn of a fresh chat pins to a stable conversation (no orphan threads
  // from cold sends). Creates the conversation up-front via thread POST and
  // reconciles the optimistic id:null to the returned id. Returns the id to use
  // in the chat POST body (or null if creation failed / pre-migration — the chat
  // route then falls back to single-thread persistence). */
  const ensureConversationId = useCallback(async (): Promise<string | null> => {
    if (activeConversationId) return activeConversationId;
    try {
      const r = await fetch("/api/mahacharya/thread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!r.ok) return null;
      const data = (await r.json()) as { conversationId?: string };
      if (typeof data.conversationId === "string" && data.conversationId) {
        mahacharyaActions.setConversationId(null, data.conversationId);
        return data.conversationId;
      }
      return null;
    } catch {
      return null;
    }
  }, [activeConversationId]);

  const sendMessage = useCallback(
    async (
      text: string,
      opts?: { origin?: "voice" | "typed" | "confirm"; speak?: boolean },
    ): Promise<string | undefined> => {
      const trimmed = text.trim();
      const staged = attachments;
      // Nothing to send is a legitimate no-op — the Send button is disabled for
      // it and the user has no reason to expect anything.
      if (!trimmed && staged.length === 0) return undefined;
      // The other two are NOT. This used to return here silently: the message
      // never appeared, no request went out, no error showed — QA saw a send
      // simply vanish and could only describe it as "I typed and it ignored
      // me". Say something, and keep the draft so the text is not lost.
      if (sendingRef.current) {
        emitToast("Still answering the last message — one moment.");
        return undefined;
      }
      if (!userId) {
        emitToast("I couldn't tell who you are — please reload the page.");
        return undefined;
      }

      const useGeminiTts = voiceModeRef.current && opts?.origin === "voice";
      const useBrowserTts =
        (opts?.speak ?? (voiceModeRef.current && opts?.origin !== "typed")) && !useGeminiTts;

      const userContent = encodeUserMessageWithAttachments(trimmed, staged);
      const now = Date.now();
      mahacharyaActions.append({ role: "user", content: userContent, ts: now });
      mahacharyaActions.append({ role: "assistant", content: "", ts: now + 1 });
      draftRef.current = "";
      // ChatGPT-style: move attachments into the bubble and clear composer immediately.
      setAttachments([]);
      sendingRef.current = true;
      progressBufferRef.current = "";
      setActivity([]);
      setSending(true);
      setVoiceSubtitle("");
      if (useGeminiTts || useBrowserTts) {
        setVoicePhase("thinking");
      }
      force();

      const conversationId = await ensureConversationId();
      if (conversationId && staged.length > 0) {
        void fetch("/api/mahacharya/attachments", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId }),
        }).catch(() => {});
      }

      const history = selectActiveMessages(useMahacharyaStore.getState())
        .filter((m) => !(m.role === "assistant" && m.content === ""))
        .slice(-10)
        .map((m) => {
          if (m.role !== "user") return { role: m.role, content: m.content };
          const { text } = parseUserMessage(m.content);
          return {
            role: m.role,
            content: text || "What can you tell me about these attachments?",
          };
        });

      const controller = new AbortController();
      abortRef.current = controller;
      stoppedByUserRef.current = false;
      const timeout = setTimeout(() => controller.abort(), 60_000);
      let acc = "";
      let spokenOut: string | undefined;
      try {
        const res = await fetch("/api/mahacharya/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            messages: history,
            pathname,
            module: moduleFromPath(pathname),
            conversationId: conversationId ?? undefined,
            contextTaskId: contextTaskIdFromUrl(),
            source: useGeminiTts ? "voice" : undefined,
          }),
        });

        if (!res.ok || !res.body) {
          const detail = await res.text().catch(() => "");
          let serverMessage = detail.trim();
          if (serverMessage.startsWith("{")) {
            try {
              const parsed = JSON.parse(serverMessage) as { error?: string };
              serverMessage = parsed.error || serverMessage;
            } catch {
              /* keep raw text */
            }
          }
          const errMsg =
            res.status === 429
              ? "I'm getting a lot of messages right now — give me a moment and try again."
              : serverMessage
                ? serverMessage
                : res.status
                  ? `Sorry, I couldn't reach MahAcharya (error ${res.status}). Please try again in a moment.`
                  : "Sorry, I couldn't respond just now. Please try again.";
          mahacharyaActions.updateLastAssistant(errMsg);
          if (useGeminiTts && !stoppedByUserRef.current) {
            spokenOut = errMsg;
          } else if (useBrowserTts && !stoppedByUserRef.current) {
            setVoicePhase("speaking");
            await tts.speak(errMsg);
          }
          return spokenOut;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const visible = consumeAssistantChunk(chunk);
          if (visible) {
            acc += visible;
            mahacharyaActions.updateLastAssistant(acc);
          }
        }
        const tail = consumeAssistantChunk(decoder.decode()) + flushAssistantProgress();
        if (tail) acc += tail;
        // Empty stream = model/provider returned no visible text (not a task-create
        // validation error). Surface a clearer recovery hint than a blank bubble.
        const final = acc.trim()
          ? acc
          : "I didn't get a full reply back (the assistant stream was empty). Please try again — for many cards, paste the list and say \"create these tasks\".";
        mahacharyaActions.updateLastAssistant(final);
        if (!stoppedByUserRef.current) {
          const spoken = proseForSpeech(final);
          if (spoken) {
            if (useGeminiTts) {
              spokenOut = spoken;
            } else if (useBrowserTts) {
              setVoicePhase("speaking");
              await tts.speak(spoken);
            }
          }
        }
      } catch {
        if (controller.signal.aborted) {
          mahacharyaActions.updateLastAssistant(
            stoppedByUserRef.current
              ? acc.trim()
                ? acc
                : "Stopped."
              : "That took too long — please try again.",
          );
        } else {
          mahacharyaActions.updateLastAssistant(
            acc.trim()
              ? acc
              : "Sorry, the connection to MahAcharya dropped. Check your network and try again.",
          );
        }
      } finally {
        clearTimeout(timeout);
        abortRef.current = null;
        sendingRef.current = false;
        setSending(false);
        if (!geminiVoice.speaking) setVoicePhase("idle");
        force();
        // The server names a fresh thread from its first user turn, so this is
        // the moment the Recent list stops saying "New chat" for it.
        void refreshConversations(false);
      }
      return spokenOut;
    },
    [
      userId,
      pathname,
      force,
      refreshConversations,
      ensureConversationId,
      tts,
      geminiVoice,
      consumeAssistantChunk,
      flushAssistantProgress,
    ],
  );

  const send = useCallback(() => {
    void sendMessage(draftRef.current, { origin: "typed" });
  }, [sendMessage]);

  // Guided need-fields card submit → deterministic synthetic user turn. The
  // model reads the human-readable answers and advances the flow (next card or
  // the create_project proposal). Team is echoed by NAME (displayValue), never
  // an id — the model then passes it as team_name for the confirm card to
  // pre-select, keeping ids entirely off the model.
  // Server-authoritative navigation. Given a re-resolution token (target_id +
  // optional entity_id/params — from a ```mahacharya-nav block or a
  // disambiguation pick), ask the server to rebuild the CANONICAL path from the
  // catalog and push that. The model's own `path` is never trusted, so a
  // fabricated block can only self-correct or safely refuse. The returned path
  // is still validated as a same-app relative route (no "//host") before push.
  const resolveAndPush = useCallback(
    async (req: { target_id: string; entity_id?: string; params?: Record<string, string> }) => {
      try {
        const res = await fetch("/api/mahacharya/nav-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(req),
        });
        if (!res.ok) {
          emitToast("I couldn't open that — try naming it again.");
          return;
        }
        const { path } = (await res.json()) as { path?: string };
        if (
          typeof path === "string" &&
          path.startsWith("/") &&
          !path.startsWith("//") &&
          /^[\w\-/?&=%.]*$/.test(path)
        ) {
          router.push(path);
        } else {
          emitToast("I couldn't open that — try naming it again.");
        }
      } catch {
        emitToast("I couldn't open that — try naming it again.");
      }
    },
    [router],
  );

  const submitNeedFields = useCallback(
    async (
      payload: NeedFieldsCardPayload,
      values: Record<string, string>,
      displayValues: Record<string, string>,
    ) => {
      const action = typeof payload.action === "string" && payload.action ? payload.action : "the setup";
      // Navigation disambiguation: each option's value is a re-resolution token
      // {target_id, entity_id?, params?}. The pick resolves server-side and
      // routes instantly — no model round-trip, no model- or client-built path.
      if (action === "navigate") {
        const dest = values.destination ?? Object.values(values)[0] ?? "";
        try {
          const tok = JSON.parse(dest) as { target_id?: string; entity_id?: string; params?: Record<string, string> };
          if (tok && typeof tok.target_id === "string") {
            await resolveAndPush({ target_id: tok.target_id, entity_id: tok.entity_id, params: tok.params });
            return;
          }
        } catch {
          /* not a token — fall through to the normal synthetic-turn path */
        }
      }
      const lines = payload.fields.map((f) => {
        const shown = displayValues?.[f.field]?.trim() || values[f.field]?.trim() || "";
        return `- ${f.label}: ${shown}`;
      });
      // Preserve Simple Task intent across need-fields Continue turns (the form
      // only asks for missing fields like Title, so the model would otherwise
      // forget simple:true and create a normal task).
      const known = payload.args ?? {};
      const isSimple =
        known.simple === true ||
        (typeof known.task_type === "string" &&
          /simple/i.test(known.task_type.trim()));
      if (isSimple) {
        lines.unshift("- Task type: Simple (simple: true)");
      }
      // Carry the RAW values, not just the labels the lines above show.
      //
      // Retest bug 4 / NEW-3: `lines` prefers displayValues, so what actually
      // reached the server for a Project pick was the human label
      // ("ertyuiop (Design)") and the real board id the dropdown had resolved
      // was thrown away. The model then had to guess an id back out of a name —
      // that is how a confirm ended up carrying "board_id":"Design", and why
      // "create 4 tasks" stalled forever on "Details sent." after the project
      // was submitted. This fence keeps the ids the card resolved so the route
      // can finish the act deterministically; the prose above it stays for the
      // model on flows that still go through it (project setup).
      const fill = JSON.stringify({
        action,
        values,
        args: payload.args ?? {},
      });
      const message =
        `Continue ${action}. My choices:\n${lines.join("\n")}\n\n` +
        "```mahacharya-fill\n" +
        `${fill}\n` +
        "```";
      await sendMessage(message, { origin: "typed" });
    },
    [sendMessage, router, resolveAndPush],
  );

  const processVoiceUtterance = useCallback(
    async (raw: string): Promise<string | null> => {
      const text = raw.trim();
      if (!text || sendingRef.current) return null;

      setVoiceHearingText("");
      stoppedByUserRef.current = false;
      setVoiceSubtitle("");

      const msgs = selectActiveMessages(useMahacharyaStore.getState());
      const pending = getPendingProposal(
        msgs,
        sendingRef.current,
        selectConsumedProposals(useMahacharyaStore.getState()),
      );

      if (pending) {
        const intent = matchVoiceConfirmIntent(text);
        if (intent === "confirm") {
          const proposalTs = findOpenProposalMessageTs(msgs);
          try {
            sendingRef.current = true;
            setSending(true);
            setVoicePhase("thinking");
            setVoiceSubtitle("");
            mahacharyaActions.append({ role: "user", content: text, ts: Date.now() });
            force();
            await confirmActRef.current(pending);
            // Same durable retire as the button path (retest bug 2) — a spoken
            // "yes" consumes the proposal just as much as a click does.
            mahacharyaActions.markProposalConsumed(proposalSignature(pending));
            if (proposalTs != null) mahacharyaActions.markActDone(proposalTs);
          } catch {
            if (stoppedByUserRef.current) return null;
            const after = selectActiveMessages(useMahacharyaStore.getState());
            const last = after[after.length - 1];
            return last?.role === "assistant" ? proseForSpeech(last.content) : null;
          } finally {
            sendingRef.current = false;
            setSending(false);
            setVoicePhase("idle");
            force();
          }
          return null;
        }
        if (intent === "cancel") {
          dismissOpenProposal(msgs, "Cancelled");
          const ack = "Okay, I won't do that.";
          mahacharyaActions.append({ role: "user", content: text, ts: Date.now() });
          mahacharyaActions.append({ role: "assistant", content: ack, ts: Date.now() + 1 });
          force();
          return stoppedByUserRef.current ? null : ack;
        }
        // New command while a card is still open — close the stale proposal and continue.
        dismissOpenProposal(msgs, "Cancelled");
      }

      return (await sendMessage(text, { origin: "voice" })) ?? null;
    },
    [sendMessage, force],
  );

  processVoiceUtteranceRef.current = processVoiceUtterance;

  // Stop an in-flight reply — abort the fetch; the stream loop unwinds and the
  // partial answer (or "Stopped.") is kept.
  const stop = useCallback(() => {
    stoppedByUserRef.current = true;
    abortRef.current?.abort();
    sendingRef.current = false;
    setSending(false);
    tts.stop();
    geminiVoice.stopSession();
    setVoiceHearingText("");
    setVoiceSubtitle("");
    setVoicePhase("idle");
    force();
  }, [tts, geminiVoice, force]);

  // "Show me how" — start the guided walkthrough. The Walkthrough is mounted
  // here (outside the chat panel div) so it isn't subject to the panel's
  // z-index stacking context and will always render above modals (Bug 3 fix).
  const handleShowMe = useCallback(
    (steps: WalkthroughStep[], fillValues: TaskGuidedFillValues | null) => {
      // The create_task tour walks the hierarchy: team-open (Teams page) →
      // board-open (a team's projects) → task-add (board detail). Start it at the
      // level matching where the user already is, so it never navigates BACKWARD
      // (which would drag them off their board and hang the tour):
      //   • inside a board (/omnipulse/boards/<id>) → skip team-open + board-open
      //   • on a team's projects view (/omnipulse/boards?workspace=…) → skip team-open
      //   • on the Teams page → run all steps
      let effective = steps;
      if (steps[0]?.anchor === "team-open") {
        const onBoardDetail = /\/omnipulse\/boards\/[0-9a-f-]{8,}/i.test(pathname);
        const onProjectsView =
          pathname === "/omnipulse/boards" &&
          typeof window !== "undefined" &&
          new URLSearchParams(window.location.search).has("workspace");
        if (onBoardDetail) {
          effective = steps.filter((s) => s.anchor !== "team-open" && s.anchor !== "board-open");
        } else if (onProjectsView) {
          effective = steps.filter((s) => s.anchor !== "team-open");
        }
      }
      setTourSteps(effective);
      setTourFillValues(fillValues);
    },
    [pathname],
  );

  // "Do it for me" — confirm an act proposal. Re-invokes the chat route with a
  // confirmation turn carrying the proposal so the server's act tool runs the
  // write under the user's session (confirmed:true). The model's follow-up
  // (a short success/failure line) streams into a fresh assistant bubble, so the
  // conversation reads naturally after the card. Resolves to a status string the
  // ConfirmCard shows inline; rejects so the card can render the failure.
  const confirmAct = useCallback(
    async (proposal: ActProposal, options?: { skipTts?: boolean }): Promise<string> => {
      if (!userId) throw new Error("Not signed in.");

      // navigate_to_project is a CLIENT-ONLY action: no server write / no
      // confirmedAct round-trip — the board id was already resolved server-side
      // when the proposal was built. Just route the browser to the board page.
      if (proposal.action === "navigate_to_project") {
        const boardId = typeof proposal.args?.board_id === "string" ? proposal.args.board_id : "";
        const boardName =
          typeof proposal.args?.board_name === "string" ? proposal.args.board_name : "";
        if (!boardId) throw new Error("I couldn't work out which project to open.");
        router.push(`/omnipulse/boards/${boardId}`);
        return boardName ? `Opening "${boardName}"…` : "Opening the project…";
      }

      const useGeminiTts = voiceModeRef.current;
      const useBrowserTts = false;
      if (useGeminiTts) {
        setVoicePhase("thinking");
      }
      sendingRef.current = true;
      progressBufferRef.current = "";
      setActivity([]);
      setSending(true);
      setVoiceSubtitle("");

      const conversationId = await ensureConversationId();

      mahacharyaActions.append({ role: "assistant", content: "", ts: Date.now() });
      force();

      const history = selectActiveMessages(useMahacharyaStore.getState())
        .filter((m) => !(m.role === "assistant" && m.content === ""))
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));

      const controller = new AbortController();
      abortRef.current = controller;
      const timeout = setTimeout(() => controller.abort(), 120_000);
      let acc = "";
      try {
        const res = await fetch("/api/mahacharya/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            messages: history,
            currentPath: pathname,
            module: moduleFromPath(pathname),
            conversationId: conversationId ?? undefined,
            contextTaskId: contextTaskIdFromUrl(),
            source: useGeminiTts ? "voice" : undefined,
            confirmedAct: {
              action: proposal.action,
              args: buildConfirmArgs(proposal),
              confirmed: true,
              // Per-click idempotency key minted by the ConfirmCard — the
              // server's run_action path executes each id at most once.
              client_action_id: proposal.clientActionId,
            },
          }),
        });

        if (!res.ok || !res.body) {
          const reason =
            (await res.text().catch(() => "")).trim() ||
            "Sorry, I couldn't complete that. Please try again.";
          // Drop the placeholder bubble rather than filling it with `reason` —
          // the thrown Error below already surfaces this same text inline on
          // the ConfirmCard itself (its errorStyle block), so filling the
          // bubble too printed the identical failure message twice.
          mahacharyaActions.removeLastAssistant();
          if (useGeminiTts && !stoppedByUserRef.current && !options?.skipTts) {
            const spoken = proseForSpeech(reason);
            if (spoken) {
              const spoke = await geminiVoice.speakText(spoken);
              if (!spoke) {
                setVoicePhase("speaking");
                await tts.speak(spoken);
              }
            }
          } else if (useBrowserTts && !stoppedByUserRef.current) {
            setVoicePhase("speaking");
            await tts.speak(reason);
          }
          throw new Error(reason);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const visible = consumeAssistantChunk(chunk);
          if (visible) {
            acc += visible;
            mahacharyaActions.updateLastAssistant(acc);
          }
        }
        const tail = consumeAssistantChunk(decoder.decode()) + flushAssistantProgress();
        if (tail) acc += tail;
        const finalText = acc.trim() ? acc : "Done.";
        mahacharyaActions.updateLastAssistant(finalText);

        // A confirm that came back still needing a field did NOT run. The reply
        // carries a fresh "Fill these fields" card (retest NEW-3 — that used to
        // be a wall of raw JSON), and the bubble above keeps it so the user can
        // finish the flow. But the caller must not read this as success: the
        // Thread's onConfirm would mark the proposal consumed and log a positive
        // completed_action for a write that never happened, and the card would
        // show "I still need a few details" in success green. Throw with the
        // clean sentence so the card shows a failure and the proposal stays live.
        const confirmReply = parseAssistantTurn(finalText);
        if (confirmReply.needFields) {
          throw new Error(
            confirmReply.text.trim() || "I still need a few details before I can do that.",
          );
        }

          if (useGeminiTts && !stoppedByUserRef.current && !options?.skipTts) {
            const spoken = proseForSpeech(finalText);
            if (spoken) {
              const spoke = await geminiVoice.speakText(spoken);
              if (!spoke) {
                setVoicePhase("speaking");
                await tts.speak(spoken);
              }
            }
          }

        if (TASK_MUTATION_ACTIONS.has(proposal.action)) {
          window.dispatchEvent(
            new CustomEvent("omnidel:tasks-mutated", {
              detail: { source: "mahacharya", action: proposal.action },
            }),
          );
          router.refresh();
        }
        if (LEAD_MUTATION_ACTIONS.has(proposal.action)) {
          window.dispatchEvent(
            new CustomEvent("omnidel:leads-mutated", {
              detail: { source: "mahacharya", action: proposal.action },
            }),
          );
          router.refresh();
        }

        return "Done.";
      } catch (err) {
        const aborted = controller.signal.aborted;
        if (aborted && TASK_MUTATION_ACTIONS.has(proposal.action)) {
          window.dispatchEvent(
            new CustomEvent("omnidel:tasks-mutated", {
              detail: { source: "mahacharya", action: proposal.action },
            }),
          );
          router.refresh();
          const line =
            "The board may already be updated — refresh if the cards are gone. The action can finish on the server after this message.";
          mahacharyaActions.updateLastAssistant(line);
          return line;
        }
        throw err;
      } finally {
        clearTimeout(timeout);
        abortRef.current = null;
        sendingRef.current = false;
        setSending(false);
        if (useGeminiTts && !geminiVoice.speaking) setVoicePhase("idle");
        force();
      }
    },
    [
      userId,
      pathname,
      force,
      ensureConversationId,
      tts,
      geminiVoice,
      router,
      consumeAssistantChunk,
      flushAssistantProgress,
    ],
  );

  confirmActRef.current = confirmAct;

  // The Thread auto-executes a nav block exactly once and hands the parsed
  // payload here; we re-resolve by target_id (never the model's path).
  const handleNavigate = useCallback(
    (nav: ParsedNav) => {
      void resolveAndPush({ target_id: nav.target_id, entity_id: nav.entity_id, params: nav.params });
    },
    [resolveAndPush],
  );

  const exitVoiceMode = useCallback(() => {
    geminiVoice.stopSession();
    tts.stop();
    setVoiceHearingText("");
    setVoicePhase("idle");
    setVoiceMode(false);
  }, [geminiVoice, tts]);

  const toggleVoiceMode = useCallback(() => {
    setVoiceMode((on) => {
      const next = !on;
      if (next) {
        stoppedByUserRef.current = false;
        void geminiVoice.warmPlayback();
        void geminiVoice.connectSession();
      } else {
        geminiVoice.stopSession();
        tts.stop();
        setVoiceHearingText("");
        setVoicePhase("idle");
      }
      return next;
    });
  }, [geminiVoice, tts]);

  const prevVoiceModeRef = useRef(false);
  useEffect(() => {
    if (!voiceMode && prevVoiceModeRef.current) {
      geminiVoice.stopSession();
      tts.stop();
      setVoicePhase("idle");
    }
    prevVoiceModeRef.current = voiceMode;
  }, [voiceMode, geminiVoice, tts]);

  // Quick-action chip tap: prefill the composer with a starter prompt the user
  // completes (default), or — for a complete prompt — set it and send straight
  // away. The Thread renders the chips and calls this with the prompt + submit
  // flag.
  const handleChip = useCallback(
    (prompt: string, submit: boolean) => {
      draftRef.current = prompt;
      force();
      if (submit) {
        void send();
      }
    },
    [force, send],
  );

  // Dedupe + order the conversations before rendering (Bug 2 fix). The store can
  // briefly hold the SAME id twice — an optimistic just-created thread plus the
  // server copy from a hydrate that raced the id reconciliation — which produced
  // a React duplicate-key warning AND a double highlight. Collapse by id (keeping
  // the freshest by lastMessageAt), keep at most ONE id:null fresh chat, and sort
  // most-recent first so the list is stable and key-unique.
  const recentConversations = useMemo(() => {
    const byId = new Map<string, (typeof conversations)[number]>();
    let freshNull: (typeof conversations)[number] | null = null;
    for (const c of conversations) {
      if (c.id === null) {
        // Keep only the most-recent unsaved (id:null) chat — never two.
        if (!freshNull || c.lastMessageAt > freshNull.lastMessageAt) freshNull = c;
        continue;
      }
      const existing = byId.get(c.id);
      if (!existing || c.lastMessageAt > existing.lastMessageAt) byId.set(c.id, c);
    }
    const deduped = [...byId.values()];
    if (freshNull) deduped.push(freshNull);
    return deduped.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  }, [conversations]);
  const visibleConversations = recentConversations.slice(0, recentVisible);
  const hasMoreConversations = recentConversations.length > recentVisible;

  // FAB drag: free X while dragging, snap to left/right bottom corner on release.
  // Clicks (no significant move) still open the panel.
  const onFabPointerDown = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    fabDragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      moved: false,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  const onFabPointerMove = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = fabDragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (Math.abs(e.clientX - d.startX) > 6) d.moved = true;
    if (!d.moved) return;
    const half = 70; // approx half FAB width so it stays on-screen while dragging
    const x = Math.min(window.innerWidth - half, Math.max(half, e.clientX));
    setFabDragX(x);
  }, []);

  const onFabPointerUp = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = fabDragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    fabDragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (d.moved) {
      const side = e.clientX < window.innerWidth / 2 ? "left" : "right";
      mahacharyaActions.setFabSide(side);
      setFabDragX(null);
      return;
    }
    setFabDragX(null);
    mahacharyaActions.setOpen(true);
  }, []);

  const onFabPointerCancel = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    if (fabDragRef.current?.pointerId === e.pointerId) {
      fabDragRef.current = null;
      setFabDragX(null);
    }
  }, []);

  // Docked panel/FAB: right edge → panel grows left; left edge → grows right.
  // Always set BOTH left and right (and transform) so a mid-drag `left`/`transform`
  // never sticks and squeezes the pill to a few px (wrapped "Ask" / "MahAcharya").
  const dockEdgeStyle: CSSProperties =
    fabSide === "left"
      ? { left: 20, right: "auto", transform: "none" }
      : { right: 20, left: "auto", transform: "none" };

  const fabLiveStyle: CSSProperties =
    fabDragX != null
      ? {
          ...fabStyle,
          left: fabDragX,
          right: "auto",
          transform: "translateX(-50%)",
          cursor: "grabbing",
          transition: "none",
        }
      : {
          ...fabStyle,
          ...dockEdgeStyle,
          cursor: "grab",
        };

  const panelLiveStyle: CSSProperties = expanded
    ? { ...panelStyle, ...expandedPanelStyle }
    : { ...panelStyle, ...dockEdgeStyle };

  // Render nothing until a user is bound (avoids a flash of the button on the
  // auth boundary / before the context resolves).
  if (!userId) return null;

  // Portal FAB + panel to <body> so board overflow / transformed ancestors
  // cannot clip the fixed pill (half-pill + stacked "Ask" / "MahAcharya").
  const widgetTree = (
    <>
      {!open && (
        <button
          type="button"
          onPointerDown={onFabPointerDown}
          onPointerMove={onFabPointerMove}
          onPointerUp={onFabPointerUp}
          onPointerCancel={onFabPointerCancel}
          style={fabLiveStyle}
          aria-label={tr("Open MahAcharya assistant. Drag left or right to move.")}
          title={tr("Drag to bottom-left or bottom-right corner")}
        >
          <span style={fabTextStyle}>{tr("Ask MahAcharya")}</span>
        </button>
      )}

      {open && (
        <>
          {expanded && <div style={backdropStyle} aria-hidden />}
          <div
            ref={panelRef}
            style={panelLiveStyle}
            role="dialog"
            aria-label={tr("MahAcharya assistant")}
            aria-modal={expanded || undefined}
          >
          <div style={headerStyle}>
            <span style={titleStyle}>{tr("MahAcharya")}</span>
            <div style={headerActionsStyle}>
              <button
                type="button"
                onClick={startNewConversation}
                style={headerBtnStyle}
                aria-label={tr("Start a new conversation")}
              >
                {tr("New chat")}
              </button>
              <div style={recentWrapStyle}>
                <button
                  ref={recentTriggerRef}
                  type="button"
                  onClick={() => {
                    // Re-read on open: titles are minted server-side on the
                    // first turn, so a list fetched at mount is already stale.
                    if (!recentOpen) void refreshConversations(false);
                    setRecentOpen((v) => !v);
                  }}
                  style={headerBtnStyle}
                  aria-haspopup="menu"
                  aria-expanded={recentOpen}
                  aria-label={tr("Recent conversations")}
                >
                  {tr("Recent")}
                </button>
                {recentOpen && recentPos && typeof document !== "undefined" &&
                  createPortal(
                    <div
                      ref={recentMenuRef}
                      role="menu"
                      style={{
                        ...recentMenuStyle,
                        top: recentPos.top,
                        ...(recentPos.left != null
                          ? { left: recentPos.left, right: "auto" }
                          : { right: recentPos.right, left: "auto" }),
                      }}
                    >
                      {recentConversations.length === 0 ? (
                        <div style={recentEmptyStyle}>{tr("No recent conversations.")}</div>
                      ) : (
                        <>
                          <div style={recentListStyle}>
                            {visibleConversations.map((c, idx) => {
                              // Exactly-one-row highlight (Bug 2): with ids now
                              // deduped and only one id:null fresh chat, this
                              // matches the SINGLE active conversation — never two.
                              const isActive =
                                c.id !== null
                                  ? c.id === activeConversationId
                                  : activeConversationId === null;
                              const isHovered = hoveredRecentIdx === idx;
                              return (
                                <button
                                  key={c.id ?? "local-fresh"}
                                  type="button"
                                  role="menuitem"
                                  title={c.title || "New chat"}
                                  onClick={() => {
                                    if (c.id) void switchConversation(c.id);
                                    else {
                                      setRecentOpen(false);
                                      mahacharyaActions.setActiveConversation(null);
                                    }
                                  }}
                                  onMouseEnter={() => setHoveredRecentIdx(idx)}
                                  onMouseLeave={() =>
                                    setHoveredRecentIdx((h) => (h === idx ? null : h))
                                  }
                                  style={{
                                    ...recentItemStyle,
                                    background: isActive
                                      ? "var(--surface-sunk)"
                                      : isHovered
                                        ? "var(--page)"
                                        : "transparent",
                                  }}
                                >
                                  <span style={recentItemLabelStyle}>{c.title || tr("New chat")}</span>
                                </button>
                              );
                            })}
                          </div>
                          {hasMoreConversations && (
                            <button
                              type="button"
                              onClick={() => setRecentVisible((n) => n + RECENT_PAGE)}
                              style={recentMoreStyle}
                            >
                              {tr("Show more")}
                            </button>
                          )}
                        </>
                      )}
                    </div>,
                    document.body,
                  )}
              </div>
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                style={iconButtonStyle}
                aria-pressed={expanded}
                aria-label={expanded ? "Collapse assistant" : "Expand assistant"}
                title={expanded ? "Collapse" : "Expand"}
              >
                {expanded ? (
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M9 9L4 4M9 9V5M9 9H5" />
                    <path d="M15 15l5 5M15 15v4M15 15h4" />
                  </svg>
                ) : (
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M15 3h6v6M21 3l-7 7M9 21H3v-6M3 21l7-7" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                onClick={closePanel}
                style={closeButtonStyle}
                aria-label={tr("Close assistant")}
              >
                ×
              </button>
            </div>
          </div>
          <Thread
            messages={messages}
            activity={activity}
            draft={draftRef.current}
            onDraftChange={(v) => {
              draftRef.current = v;
              force();
            }}
            onSend={send}
            onStop={stop}
            sending={sending}
            onConfirmAct={confirmAct}
            onNavigate={handleNavigate}
            onSubmitNeedFields={submitNeedFields}
            onShowMe={handleShowMe}
            onChip={handleChip}
            voiceMode={voiceMode}
            onToggleVoice={toggleVoiceMode}
            voicePhase={voicePhase}
            listening={listening}
            transcribing={transcribing || refining}
            hearingText={geminiVoice.liveText || voiceHearingText || voiceSubtitle}
            speechSupported={speechSupported}
            speechError={speechError}
            voiceConnecting={geminiVoice.phase === "connecting"}
            onVoiceMicStart={() => {
              stoppedByUserRef.current = false;
              void geminiVoice.startRecording();
            }}
            onVoiceMicStop={geminiVoice.stopRecording}
            onVoiceMicCancel={geminiVoice.cancelRecording}
            voiceMicDisabled={
              geminiVoice.phase === "connecting" || geminiVoice.phase === "processing"
            }
            voiceMicRecording={listening}
            voiceMicSpeaking={geminiVoice.speaking}
            attachments={attachments}
            uploadingDocs={uploadingDocs}
            onUploadDocs={uploadDocs}
            onRemoveDoc={removeDoc}
          />
          </div>
        </>
      )}

      {/* Walkthrough is mounted OUTSIDE the panel div so its position:fixed
          children are not constrained by the panel's z-index stacking context.
          This ensures the coach-mark renders above any modal (z-index 3000+
          vs the modals' 1000) regardless of where the user navigated. */}
      {tourSteps && tourSteps.length > 0 && (
        <Walkthrough
          steps={tourSteps}
          fillValues={tourFillValues ?? undefined}
          onClose={() => {
            setTourSteps(null);
            setTourFillValues(null);
          }}
          onComplete={() => {
            // Best-effort positive signal for the learning loop on walkthrough
            // completion — same signal Thread fires on "Do it for me" confirm.
            void fetch("/api/mahacharya/feedback", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ rating: 1, outcome: "completed_action" }),
            }).catch(() => {});
          }}
        />
      )}
    </>
  );

  if (typeof document === "undefined") return widgetTree;
  return createPortal(widgetTree, document.body);
}

// Minimal force-update hook for the two ephemeral refs (draft + sending). Avoids
// pulling a state library slice into the persisted store for transient UI.
function useForce(): [number, () => void] {
  const [n, dispatch] = useReducer((x: number) => x + 1, 0);
  return [n, dispatch];
}

// ─── Styles (CSS variables only) ─────────────────────────────────────────────

const fabStyle: CSSProperties = {
  position: "fixed",
  // left/right applied from fabSide (bottom corners only)
  bottom: 20,
  zIndex: "var(--z-widget)",
  padding: "12px 18px",
  background: "var(--green-deep)",
  color: "var(--page)",
  borderWidth: 0,
  borderStyle: "solid",
  borderColor: "transparent",
  borderRadius: 999,
  boxShadow: "var(--shadow-md)",
  cursor: "grab",
  touchAction: "none",
  userSelect: "none",
  // Never collapse the pill — wrapping was the "Ask / MahAcharya" stacked bug.
  whiteSpace: "nowrap",
  width: "auto",
  maxWidth: "none",
  minWidth: "max-content",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  transition: "left 0.18s ease, right 0.18s ease, transform 0.18s ease",
};
const fabTextStyle: CSSProperties = {
  fontFamily: "var(--sans)",
  fontSize: 14,
  fontWeight: 600,
  whiteSpace: "nowrap",
  display: "inline-block",
  lineHeight: 1.2,
};
const panelStyle: CSSProperties = {
  position: "fixed",
  // left/right applied from fabSide so the panel opens into the page
  bottom: 20,
  zIndex: "var(--z-widget)",
  width: "min(380px, calc(100vw - 32px))",
  height: "min(560px, calc(100vh - 96px))",
  display: "flex",
  flexDirection: "column",
  background: "var(--surface)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  borderRadius: "var(--r-lg)",
  boxShadow: "var(--shadow-md)",
  overflow: "hidden",
};
// Expanded overrides: centered in the viewport and much larger, for reading /
// working in a bigger surface (like ChatGPT's expanded chat).
const expandedPanelStyle: CSSProperties = {
  right: "auto",
  bottom: "auto",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "min(760px, calc(100vw - 48px))",
  height: "min(85vh, calc(100vh - 48px))",
};
// Dimmed scrim behind the expanded panel (matches .modal-overlay's rgba scrim).
// Same z-index as the panel but rendered BEFORE it, so the panel (later sibling)
// paints on top. Being outside the panel ref, a backdrop click closes the panel.
const backdropStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: "var(--z-widget)",
  background: "rgba(0,0,0,0.3)",
};
const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 14px",
  borderBottomWidth: 1,
  borderBottomStyle: "solid",
  borderBottomColor: "var(--rule)",
  background: "var(--surface)",
};
const titleStyle: CSSProperties = {
  fontFamily: "var(--serif)",
  fontSize: 16,
  color: "var(--ink)",
};
const headerActionsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
};
const headerBtnStyle: CSSProperties = {
  padding: "4px 9px",
  fontFamily: "var(--sans)",
  fontSize: 11,
  fontWeight: 500,
  color: "var(--ink-soft)",
  background: "transparent",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
  whiteSpace: "nowrap",
};
// Square icon button (Expand / Collapse) sized to sit alongside the text
// header buttons without crowding them.
const iconButtonStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 26,
  height: 26,
  color: "var(--ink-soft)",
  background: "transparent",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
};
const recentWrapStyle: CSSProperties = {
  position: "relative",
  display: "inline-flex",
};
const recentMenuStyle: CSSProperties = {
  // position:fixed + portalled to <body> so the menu escapes the chat panel's
  // overflow:hidden clipping; top/right are supplied per-render from the
  // trigger's measured rect. zIndex sits above the panel (var(--z-widget)),
  // matching the portal popover convention used by CustomSelect (2000).
  position: "fixed",
  zIndex: 2000,
  minWidth: 200,
  maxWidth: 260,
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
};
// Fixed row height (+ its gap) so the list's maxHeight below is an EXACT
// multiple of a row's rendered height — otherwise a maxHeight that doesn't
// land on a row boundary clips the next row mid-text at the bottom of the
// scroll area instead of hiding it cleanly behind the scrollbar.
const RECENT_ROW_HEIGHT = 32;
const RECENT_ROW_GAP = 2;
const recentListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: RECENT_ROW_GAP,
  // Exactly RECENT_PAGE (5) rows tall so a longer list scrolls past a clean row
  // boundary instead of showing a half-cut 6th row; "Show more" stays pinned
  // below it.
  maxHeight: 5 * RECENT_ROW_HEIGHT + 4 * RECENT_ROW_GAP,
  overflowY: "auto",
};
const recentMoreStyle: CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "center",
  marginTop: 2,
  padding: "6px 9px",
  fontFamily: "var(--sans)",
  fontSize: 11,
  fontWeight: 500,
  color: "var(--ink-soft)",
  background: "transparent",
  borderTopWidth: 1,
  borderTopStyle: "solid",
  borderTopColor: "var(--rule)",
  borderRadius: 0,
  cursor: "pointer",
};
const recentItemStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  width: "100%",
  height: RECENT_ROW_HEIGHT,
  flexShrink: 0,
  boxSizing: "border-box",
  textAlign: "left",
  padding: "0 9px",
  fontFamily: "var(--sans)",
  fontSize: 12,
  color: "var(--ink)",
  borderWidth: 0,
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
};
// Inner label carries the truncation — a single flex-min-width:0 child so the
// ellipsis clips against the row's fixed width instead of the row itself
// growing/wrapping when the title is long.
const recentItemLabelStyle: CSSProperties = {
  display: "block",
  minWidth: 0,
  width: "100%",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};
const recentEmptyStyle: CSSProperties = {
  padding: "8px 9px",
  fontFamily: "var(--sans)",
  fontSize: 12,
  color: "var(--ink-mute)",
};
const closeButtonStyle: CSSProperties = {
  width: 28,
  height: 28,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 22,
  lineHeight: 1,
  color: "var(--ink-mute)",
  background: "transparent",
  borderWidth: 0,
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
};
