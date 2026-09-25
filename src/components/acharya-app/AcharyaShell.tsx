"use client";

/**
 * Persistent acharya shell. Mounted ONCE by the acharya server layout
 * (`app/(app)/acharyas/[slug]/layout.tsx`), it wraps the board, task-detail and
 * learn screens — which are nested routes under `[slug]`. Because Next only
 * persists a LAYOUT across nested routes, the header + voice session live here
 * and survive navigation between those screens: only `{children}` remounts.
 *
 * - Registers the per-acharya voice session ONCE via useVoiceScreenContext
 *   (screen "acharya", keyed on acharyaSlug). Handler identity churn does not
 *   re-mint (the hook reads handlers from a ref); the acharya key is the only
 *   thing that would. Children swap their screen tools via setScreenHandlers
 *   and push context notes via notify() — neither re-mints. Overlays (proof/
 *   break/complete sheets) use the separate setOverlayHandlers slot instead,
 *   so an open sheet layers its tools on top of the screen's without
 *   clobbering them (see mergedHandlers below).
 * - Header text is shell STATE: children call setHeader() to change
 *   eyebrow/contextLine/chips/back-target without the header remounting.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";
import { useLang, useStrings } from "@/lib/i18n/useLang";
import AcharyaHeader, { type AcharyaHeaderChip } from "@/components/AcharyaHeader";
import { BoardAcharyaChat } from "@/components/BoardAcharyaChat";
import { ghostIconButtonStyle } from "@/components/ghost-icon-button";
import { DraggableDock } from "@/components/voice/DraggableDock";
import { AcharyaPip } from "@/components/voice/AcharyaPip";
import { useTavusBinding, useTavusAvailable } from "@/components/voice/TavusSessionProvider";
import {
  useVoiceScreenContext,
  type VoiceScreenHandle,
} from "@/components/voice/VoiceSessionProvider";
import { useInstantNav } from "@/components/instant-nav";
import { buildScreenNavHandlers } from "@/components/voice/voice-nav-actions";
import { buildSearchMemoryHandler } from "@/lib/voice/search-memory-handler";
import type { ToolHandlers, VoiceStatus } from "@/hooks/useGeminiLiveSession";

export type AcharyaShellHeader = {
  eyebrow?: string;
  contextLine?: string;
  chips?: AcharyaHeaderChip[];
  /** true on a child screen (task/learn) → back returns to the board; false on
   * the board → back returns to the acharyas home list. */
  showBack?: boolean;
};

type ActiveTaskContext = {
  taskId: string;
  chatHref: string;
  taskTitle?: string;
};

export type AcharyaShellContextValue = {
  setHeader: (header: AcharyaShellHeader) => void;
  setScreenHandlers: (handlers: ToolHandlers | null) => void;
  /** Overlay/bottom-sheet tools (proof sheets) — layered ON TOP of the screen's
   * own handlers so an open sheet never clobbers the screen's tools (and
   * vice-versa). See setScreenHandlers vs setOverlayHandlers merge in the shell body. */
  setOverlayHandlers: (handlers: ToolHandlers | null) => void;
  setActiveTaskContext: (task: ActiveTaskContext | null) => void;
  notify: (text: string) => void;
  /**
   * Empty board hosts chat inline — tell the shell so the caption focuses
   * that composer instead of opening a modal sheet.
   */
  setBoardChatInline: (active: boolean) => void;
  acharyaSlug: string;
  acharyaName: string;
  acharyaAvatarUrl: string | null;
  acharyaPersonaSummary: string | null;
  /** Same live session as the header mic — for overlays that cover the header (proof sheets). */
  voiceStatus: VoiceStatus;
  startVoice: () => Promise<void>;
  endVoice: () => void;
};

const AcharyaShellContext = createContext<AcharyaShellContextValue | null>(null);

export function useAcharyaShell(): AcharyaShellContextValue {
  const ctx = useContext(AcharyaShellContext);
  if (!ctx) throw new Error("useAcharyaShell must be used within <AcharyaShell>");
  return ctx;
}

/** Safe outside the shell (returns null) — proof sheets may mount without shell. */
export function useOptionalAcharyaShell(): AcharyaShellContextValue | null {
  return useContext(AcharyaShellContext);
}

/** Plain, serialisable acharya data the server layout hands down. */
export type AcharyaShellData = {
  slug: string;
  displayName: string;
  avatarUrl: string | null;
  personaSummary: string | null;
  /** Primary avatar + persona_meta extras, cross-faded while the mic is live. */
  portraits?: string[];
};

export function AcharyaShell({
  acharya,
  children,
}: {
  acharya: AcharyaShellData;
  children: ReactNode;
}) {
  const nav = useInstantNav();
  const lang = useLang();
  const s = useStrings();

  const [header, setHeaderState] = useState<AcharyaShellHeader>({
    contextLine: acharya.personaSummary ?? undefined,
    showBack: false,
  });
  const [screenHandlers, setScreenHandlersState] = useState<ToolHandlers | null>(null);
  const [overlayHandlers, setOverlayHandlersState] = useState<ToolHandlers | null>(null);
  const [activeTaskContext, setActiveTaskContextState] = useState<ActiveTaskContext | null>(null);
  const [chatSheetOpen, setChatSheetOpen] = useState(false);
  const [boardChatInline, setBoardChatInlineState] = useState(false);

  // The live voice handle is captured in a ref so the base handlers (defined
  // before the hook runs) can reach notify()/end() at tool-call time.
  const voiceRef = useRef<VoiceScreenHandle | null>(null);
  const openChatRef = useRef<() => void>(() => {});
  const nestedRef = useRef(false);
  nestedRef.current = Boolean(header.showBack);

  // Hoisted above baseHandlers: the shared Profile/Settings handlers need it at
  // build time, and it is also what the shell context publishes.
  const notify = useCallback((text: string) => voiceRef.current?.notify(text), []);

  const baseHandlers = useMemo<ToolHandlers>(
    () => ({
      open_task: async (args) => {
        const taskId = args.task_id != null ? String(args.task_id) : "";
        if (!taskId) return { ok: false, error: "unknown task" };
        nav.push(`/acharyas/${acharya.slug}/tasks/${encodeURIComponent(taskId)}`);
        voiceRef.current?.notify("(context: opened a task)");
        return { ok: true };
      },

      /**
       * Board-level fallbacks for tools whose REAL handlers live on a task
       * screen (TaskDetailClient / LearnPageClient register them as screen
       * handlers, and layer over these).
       *
       * Gemini binds tools per-context at mint, so on a board it is simply never
       * offered `start_task`. A Tavus PAL advertises ALL its tools on every
       * screen — static org-level config, no per-screen set — so the model WILL
       * call these from a board, and without a fallback it gets `unhandled` and
       * stalls. Opening the task is the honest interpretation of "start it" when
       * no task is on screen: it puts the karigar one tap from starting, and the
       * screen's own handler takes over from there.
       */
      start_task: async (args) => {
        const taskId = args.task_id != null ? String(args.task_id) : "";
        if (!taskId) {
          return { ok: false, error: "no_task_on_screen", say: "Open a task first and I can start it." };
        }
        nav.push(`/acharyas/${acharya.slug}/tasks/${encodeURIComponent(taskId)}`);
        voiceRef.current?.notify("(context: opened a task, ready to start)");
        return { ok: true, opened: true, note: "task opened — tell them to tap Start, or ask again now that it is on screen" };
      },
      open_learn: async (args) => {
        const taskId = args.task_id != null ? String(args.task_id) : "";
        if (!taskId) {
          return { ok: false, error: "no_task_on_screen", say: "Open a task first and I can show its learning material." };
        }
        nav.push(`/acharyas/${acharya.slug}/tasks/${encodeURIComponent(taskId)}/learn`);
        voiceRef.current?.notify("(context: opened learn for a task)");
        return { ok: true };
      },

      /**
       * Open another acharya's board. The karigar asked for "the tasks page" and
       * nothing could take them there: a board is where tasks live, and no tool
       * addressed it.
       */
      open_acharya: async (args) => {
        const slug = args.slug != null ? String(args.slug).trim().toLowerCase() : "";
        if (!slug) {
          nav.push("/acharyas");
          voiceRef.current?.notify("(context: opened the acharya list)");
          return { ok: true, opened: "home" };
        }
        nav.push(`/acharyas/${encodeURIComponent(slug)}`);
        voiceRef.current?.notify(`(context: opened ${slug}'s board)`);
        return { ok: true, opened: slug };
      },

      /**
       * `end_call` is a Tavus SYSTEM tool, attached to every PAL automatically and
       * delivered as an app message like any other. It had no handler, so the one
       * thing the model does at the end of every conversation — hang up — came
       * back `unhandled`.
       */
      end_call: async () => {
        voiceRef.current?.end();
        return { ok: true };
      },
      create_quiz: async (args) => {
        const requestedTaskId = args.task_id != null ? String(args.task_id) : "";
        const taskId = requestedTaskId || activeTaskContext?.taskId || "";
        if (!taskId) return { ok: false, error: "task_required" };

        const taskPath = `/acharyas/${acharya.slug}/tasks/${encodeURIComponent(taskId)}`;
        if (typeof window !== "undefined" && window.location.pathname.startsWith(taskPath)) {
          window.dispatchEvent(
            new CustomEvent("acharya:create-quiz", {
              detail: { taskId },
            }),
          );
          return { ok: true };
        }

        nav.push(`${taskPath}/learn?tab=quiz&startQuiz=1`);
        voiceRef.current?.notify("(context: opened quiz)");
        return { ok: true };
      },
      go_home: async () => {
        nav.push("/acharyas");
        voiceRef.current?.notify(
          "(context: now on the app Home — the list of all Acharyas, not this task board)",
        );
        return { ok: true };
      },
      go_back: async () => {
        if (nestedRef.current) {
          nav.push(`/acharyas/${acharya.slug}`);
          voiceRef.current?.notify(
            "(context: back on this Acharya's task list — this is NOT the app Home)",
          );
          return { ok: true };
        }
        nav.push("/acharyas");
        voiceRef.current?.notify("(context: now on the app Home — the list of all Acharyas)");
        return { ok: true };
      },
      open_chat: async () => {
        openChatRef.current();
        voiceRef.current?.notify("(context: opened Chat)");
        return { ok: true };
      },
      switch_tab: async (args) => {
        const tab = args.tab != null ? String(args.tab).trim().toLowerCase() : "";
        if (tab === "chat") {
          openChatRef.current();
          voiceRef.current?.notify("(context: opened Chat)");
          return { ok: true };
        }
        const taskId = activeTaskContext?.taskId;
        if (!taskId) return { ok: false, error: "open_a_task_first" };
        const taskPath = `/acharyas/${acharya.slug}/tasks/${encodeURIComponent(taskId)}`;
        if (tab === "task") {
          nav.push(taskPath);
          return { ok: true };
        }
        if (tab === "comments") {
          nav.push(`${taskPath}?tab=comments`);
          voiceRef.current?.notify("(context: opened Comments)");
          return { ok: true };
        }
        if (tab === "quiz" || tab === "learn") {
          nav.push(`${taskPath}/learn?tab=${tab}`);
          return { ok: true };
        }
        return { ok: false, error: "unknown_tab" };
      },
      take_break: async () => {
        if (typeof window !== "undefined" && window.location.pathname.endsWith("/active")) {
          window.dispatchEvent(new CustomEvent("acharya:voice-take-break"));
          return { ok: true };
        }
        return { ok: false, error: "not_in_active_session" };
      },
      open_complete: async () => {
        if (typeof window !== "undefined" && window.location.pathname.endsWith("/active")) {
          window.dispatchEvent(new CustomEvent("acharya:voice-open-complete"));
          return { ok: true };
        }
        return { ok: false, error: "not_in_active_session" };
      },
      end_conversation: async () => {
        voiceRef.current?.end();
        return { ok: true };
      },

      // Profile + Settings, the same handlers the home guide binds. The home
      // guide is `active: false` on every /acharyas/<slug> route — this shell
      // owns the mic here — and the `acharya` tool set had neither tool, so the
      // whole of Profile and Settings was unreachable from any board. "Change my
      // language" reached a model with nothing to call, and the only thing left
      // to say was that it could not help: both settings findings on the #154
      // re-test. See voice-nav-actions.ts.
      // `notify` reads voiceRef, so the rule flags handing it to a function
      // during render. It is never CALLED during render — only from inside an
      // async tool handler, which is the same contract every handler above has.
      // eslint-disable-next-line react-hooks/refs
      ...buildScreenNavHandlers({ nav, notify }),

      // Retrieval over this Acharya's Memory store. Shared with the home
      // navigator (HomeMahAcharyaGuide), which binds the same tool — see the
      // factory for why binding and handling must stay one decision.
      ...buildSearchMemoryHandler(acharya.slug),

      // Quiz answering belongs to the screen showing the quiz — TaskDetailClient
      // layers the real handlers over these. They exist so a call from anywhere
      // else ANSWERS the model instead of returning "unhandled", which is the
      // dead end the quiz stalled on.
      answer_quiz: async () => ({ ok: false, error: "no_quiz_on_screen" }),
      next_quiz_question: async () => ({ ok: false, error: "no_quiz_on_screen" }),
    }),
    [nav, acharya.slug, activeTaskContext, notify],
  );

  // Base tools are always present; the active screen's tools layer on top, and
  // an open overlay (proof/break/complete sheet) layers on top of THAT — its
  // own slot so the sheet can never clobber the screen's handlers (or vice
  // versa) the way a single shared slot did. The object is rebuilt each
  // render, but useVoiceScreenContext reads it from a ref and the bind key
  // (screen + acharyaSlug + lang) is unchanged → NO re-mint.
  const mergedHandlers: ToolHandlers = {
    ...baseHandlers,
    ...(screenHandlers ?? {}),
    ...(overlayHandlers ?? {}),
  };

  const voice = useVoiceScreenContext({
    screen: "acharya",
    acharyaSlug: acharya.slug,
    // Session key is acharya slug only — do not bind taskId or opening a task remints.
    handlers: mergedHandlers,
    lang,
  });

  useEffect(() => {
    voiceRef.current = voice;
  }, [voice]);

  /**
   * Tavus live video — MahAcharya'ji, founders/admins only, gated SERVER-side by
   * /api/work/tavus/availability. Owned here rather than by a screen because the
   * shell is what persists across board -> task -> learn: the call survives
   * navigation for the same reason the Gemini session does.
   *
   * It is handed `mergedHandlers` VERBATIM. That is the whole point of the
   * feature — every tool the mic can drive, the video drives, through one
   * implementation including the base/screen/overlay precedence resolved above.
   */
  const videoAvailable = useTavusAvailable(acharya.slug);

  /**
   * The PAL speaks en + hi only (confirmed against Tavus: pal p5b24a6d76af
   * reports `languages: ["en","hi"]`). Said once as the call opens and gone on
   * its own — a fact about the call, not something to acknowledge, and nothing
   * that should need dismissing one-handed mid-conversation.
   */
  const [showVideoLangNote, setShowVideoLangNote] = useState(false);

  // Registers THIS acharya + its merged handlers with the shared session in the
  // (app) layout. One session app-wide: two would be two billable conversations.
  const tavus = useTavusBinding({ acharyaSlug: acharya.slug, handlers: mergedHandlers });

  // The mic stands down when the video is really up, not at tap time.
  useEffect(() => {
    tavus?.setMicStandDown(() => {
      voiceRef.current?.end();
      setShowVideoLangNote(true);
    });
    return () => tavus?.setMicStandDown(null);
  }, [tavus]);

  // Only show video for OUR acharya — the session is shared, and home may have
  // started a call with someone else.
  const tavusMine = tavus?.liveSlug === acharya.slug;
  const tavusLive = tavus?.status === "live" && tavusMine;
  const tavusBusy = (tavus?.status === "starting" || tavus?.status === "connecting") && tavusMine;

  useEffect(() => {
    if (!showVideoLangNote) return;
    const t = window.setTimeout(() => setShowVideoLangNote(false), 5_000);
    return () => window.clearTimeout(t);
  }, [showVideoLangNote]);

  const setHeader = useCallback((next: AcharyaShellHeader) => setHeaderState(next), []);
  const setScreenHandlers = useCallback(
    (next: ToolHandlers | null) => setScreenHandlersState(next),
    [],
  );
  const setOverlayHandlers = useCallback(
    (next: ToolHandlers | null) => setOverlayHandlersState(next),
    [],
  );
  const setActiveTaskContext = useCallback(
    (next: ActiveTaskContext | null) => setActiveTaskContextState(next),
    [],
  );
  const startVoice = useCallback(async () => {
    await voiceRef.current?.start();
  }, []);
  const endVoice = useCallback(() => {
    voiceRef.current?.end();
  }, []);
  const setBoardChatInline = useCallback((active: boolean) => {
    setBoardChatInlineState(active);
    if (active) setChatSheetOpen(false);
  }, []);

  useEffect(() => {
    const setAppHeight = () => {
      const height = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty("--acharya-app-height", `${height}px`);
    };
    setAppHeight();
    window.addEventListener("resize", setAppHeight);
    window.visualViewport?.addEventListener("resize", setAppHeight);
    window.visualViewport?.addEventListener("scroll", setAppHeight);
    return () => {
      window.removeEventListener("resize", setAppHeight);
      window.visualViewport?.removeEventListener("resize", setAppHeight);
      window.visualViewport?.removeEventListener("scroll", setAppHeight);
      document.documentElement.style.removeProperty("--acharya-app-height");
    };
  }, []);

  const ctxValue = useMemo<AcharyaShellContextValue>(
    () => ({
      setHeader,
      setScreenHandlers,
      setOverlayHandlers,
      setActiveTaskContext,
      notify,
      setBoardChatInline,
      acharyaSlug: acharya.slug,
      acharyaName: acharya.displayName,
      acharyaAvatarUrl: acharya.avatarUrl,
      acharyaPersonaSummary: acharya.personaSummary,
      voiceStatus: voice.status,
      startVoice,
      endVoice,
    }),
    [
      setHeader,
      setScreenHandlers,
      setOverlayHandlers,
      setActiveTaskContext,
      notify,
      setBoardChatInline,
      acharya.slug,
      acharya.displayName,
      acharya.avatarUrl,
      acharya.personaSummary,
      voice.status,
      startVoice,
      endVoice,
    ],
  );

  // The strip below is the doorway into chat and nothing else now. It used to
  // double as a live-transcript readout; while a conversation is running the
  // header shows the acharya at hero size and the dock carries the stop control,
  // text ticking under the header was the machinery of the call rather than a
  // thing the karigar could act on.
  const activeTaskId = activeTaskContext?.taskId ?? voice.context?.taskId ?? null;
  const captionLabel = s.chatWith(acharya.displayName);

  const openChatFromCaption = useCallback(() => {
    if (activeTaskContext) {
      const taskPath = `/acharyas/${acharya.slug}/tasks/${activeTaskContext.taskId}`;
      const path = typeof window !== "undefined" ? window.location.pathname : "";
      const onActive = path.endsWith("/active");
      const onTaskDetail = path === taskPath || path === `${taskPath}/`;
      // /active also starts with the task path — dispatching chat there is a
      // no-op because TaskDetailClient is unmounted. Navigate instead.
      if (onTaskDetail && !onActive) {
        window.dispatchEvent(
          new CustomEvent("acharya:open-task-chat", {
            detail: { taskId: activeTaskContext.taskId },
          }),
        );
        return;
      }
      if (onActive) {
        nav.push(`${taskPath}?tab=chat`);
        return;
      }
      nav.push(activeTaskContext.chatHref);
      return;
    }
    // Empty board already shows chat inline — focus that composer, no modal.
    if (boardChatInline) {
      window.dispatchEvent(new CustomEvent("acharya:focus-board-chat"));
      return;
    }
    setChatSheetOpen(true);
  }, [activeTaskContext, acharya.slug, boardChatInline, nav]);

  useEffect(() => {
    openChatRef.current = openChatFromCaption;
  }, [openChatFromCaption]);

  // Board vs a nested task/learn/active screen. Children already report this
  // through setHeader({ showBack }), so no pathname parsing needed.
  const onBoard = !header.showBack;

  return (
    <AcharyaShellContext.Provider value={ctxValue}>
      <div
        data-acharya={acharya.slug}
        style={{
          display: "flex",
          flexDirection: "column",
          height: "var(--acharya-app-height, 100svh)",
          minHeight: "var(--acharya-app-height, 100svh)",
        }}
      >
        <AcharyaHeader
          // The board gets the landscape hero (portrait + gradient, like home);
          // a task / learn / timer screen gets the compact row — the work below
          // it needs the vertical space more than the photo does.
          variant={onBoard ? "board" : "task"}
          name={acharya.displayName}
          slug={acharya.slug}
          avatarUrl={acharya.avatarUrl}
          portraits={acharya.portraits}
          live={voice.status === "live" || tavusLive || tavusBusy}
          videoTrack={tavusLive ? tavus?.replicaTrack ?? null : null}
          eyebrow={header.eyebrow}
          description={acharya.personaSummary}
          contextLine={header.contextLine}
          chips={header.chips}
          onBack={() => {
            const target = header.showBack ? `/acharyas/${acharya.slug}` : "/acharyas";
            // A real history back when the target is the entry we came from —
            // Next restores it from the router cache, so returning to the board
            // is instant instead of re-running its force-dynamic fetch behind a
            // 4–5s skeleton. Anything else replaces, so one tap still leaves a
            // nested task/learn/active screen without stacking history.
            nav.back(target);
          }}
          // The toggle is ALWAYS the floating dock below — on the board and on
          // task / learn / timer. It used to be pinned in the header here on
          // nested screens, where it could not be moved at all (QA: "the pill is
          // confined near the tab row and cannot be dropped onto the task card
          // below"). The dock's per-surface default keeps it clear of the proof
          // / session CTAs that own the bottom edge of those screens.
          trailing={null}
        />

        {/*
          A flex ROW, not a button with things floating over it. The controls used
          to be absolutely positioned against whatever ancestor happened to be
          positioned, which is why they could vanish entirely. Siblings in a row
          cannot overlap the chevron and cannot escape the strip.
        */}
        <div style={stripRow}>
        <button
          type="button"
          onClick={openChatFromCaption}
          className="press"
          aria-label={activeTaskContext ? "Open task chat" : "Open Acharya chat"}
          style={{
            flex: 1,
            minWidth: 0,
            margin: 0,
            padding: "7px 16px",
            fontFamily: "var(--sans)",
            fontSize: 12,
            fontWeight: 650,
            color: "var(--green-deep)",
            border: "none",
            background: "transparent",
            textAlign: "left",
            cursor: "pointer",
            lineHeight: 1.45,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span
              style={{
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {captionLabel}
            </span>
            <ArrowIcon />
          </span>
        </button>

          {/*
            Idle: mic + video live here on EVERY shell screen. They were board-only
            and absolutely positioned, and on a nested screen that left the acharya
            with no visible control at all.
          */}
          {voice.status !== "live" && !tavusLive && !tavusBusy ? (
            <>
              <StripIconButton
                label={voice.status === "idle" ? s.startConversation : s.connecting}
                onClick={voice.start}
                disabled={voice.status === "minting" || voice.status === "connecting" || voice.status === "reminting"}
                tone="mic"
              />
              {videoAvailable ? (
                <StripIconButton label={s.videoAvatarOpen} onClick={() => tavus?.start()} tone="video" />
              ) : null}
            </>
          ) : null}
        </div>

        {chatSheetOpen ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={activeTaskId ? "Task chat" : "Acharya chat"}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 70,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              background: "color-mix(in srgb, var(--ink) 34%, transparent)",
            }}
          >
            <button
              type="button"
              aria-label="Close chat"
              onClick={() => setChatSheetOpen(false)}
              style={{
                position: "absolute",
                inset: 0,
                border: "none",
                background: "transparent",
                cursor: "pointer",
              }}
            />
            <section
              style={{
                position: "relative",
                width: "100%",
                maxWidth: 560,
                height: "72dvh",
                maxHeight: "calc(100dvh - 88px)",
                minHeight: 420,
                display: "flex",
                flexDirection: "column",
                borderTopLeftRadius: "var(--r-md)",
                borderTopRightRadius: "var(--r-md)",
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: "var(--rule)",
                background: "var(--surface)",
                boxShadow: "0 -16px 48px color-mix(in srgb, var(--ink) 18%, transparent)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "10px 16px",
                  borderBottomWidth: 1,
                  borderBottomStyle: "solid",
                  borderBottomColor: "var(--rule)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      fontFamily: "var(--mono)",
                      fontSize: 10,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "var(--green-deep)",
                    }}
                  >
                    Chat
                  </p>
                  <p
                    style={{
                      margin: "2px 0 0",
                      fontSize: 12,
                      color: "var(--ink-mute)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {`Conversation with ${acharya.displayName}`}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close chat"
                  onClick={() => setChatSheetOpen(false)}
                  className="press"
                  style={{ ...ghostIconButtonStyle, width: 36, height: 36, color: "var(--ink)" }}
                >
                  <CloseIcon />
                </button>
              </div>
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: "flex",
                  flexDirection: "column",
                  background: "var(--page)",
                }}
              >
                {/*
                  Board chat used to append locally and never call /api/work/chat —
                  Send looked alive but no assistant reply ever arrived (Lakshya
                  boards with tasks hit this sheet; empty boards already used
                  BoardAcharyaChat inline). Reuse the working stream path.
                */}
                <BoardAcharyaChat
                  acharyaSlug={acharya.slug}
                  acharyaName={acharya.displayName}
                  acharyaAvatarUrl={acharya.avatarUrl}
                />
              </div>
            </section>
          </div>
        ) : null}

        {/* Each screen owns its own scroll (board list / learn chat / task main)
            so this container just claims the remaining height and clips.
            Page fill avoids a white hole if children briefly unmount on back. */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            background: "var(--page)",
          }}
        >
          {children}
        </div>

        {/* Start / End conversation — on EVERY screen of the shell, always
            draggable, including over task cards (the wrapper is
            pointer-events: none, so the card underneath stays tappable).
            Board: starts docked bottom-centre, the placement the MahAcharya pill
            had on home. Task / learn / timer: starts on the right edge, clear of
            the session strip above and the proof / session CTAs below, and the
            karigar drags it wherever they want from there. Each surface
            remembers its own spot. z-index stays under the chat sheet (70) so an
            open sheet covers it. */}
        {/*
          LIVE on ANY acharya screen -> a compact End disc, never the pip card.
          The header is already showing the acharya at hero size (video when a
          Tavus call is running, portrait otherwise), so a 78x98 card of the same
          face is the same person twice on one screen.

          It is NOT nothing, though: a live session with no stop control anywhere
          is the home-stage bug, and this is the smallest thing that still ends
          the call. The full pip belongs to Profile / Settings, where nothing else
          shows the acharya — the home guide owns those.

          IDLE: the controls live in the chat strip above.
        */}
        {voice.status === "live" || tavusLive || tavusBusy ? (
          <DraggableDock
            surface={onBoard ? "board" : "task"}
            placement={onBoard ? "bottom-center" : "right-center"}
            ariaLabel={s.moveConversationPill}
          >
            <VideoCallToggle
              active
              busy={tavusBusy}
              label={s.endVideoCall}
              onClick={tavusLive || tavusBusy ? () => tavus?.end() : voice.end}
            />
          </DraggableDock>
        ) : null}

        {tavus?.status === "error" && tavus.error ? (
          <div style={videoErrorBar} role="alert">{tavus.error}</div>
        ) : null}

        {showVideoLangNote ? (
          <div style={videoLangToast} role="status">{s.videoAvatarLanguageNote}</div>
        ) : null}

        {/* Leaving the tab mid-conversation keeps the acharya on screen in a
            picture-in-picture window (where the browser supports it). */}
        <AcharyaPip
          live={voice.status === "live"}
          slug={acharya.slug}
          name={acharya.displayName}
          avatarUrl={acharya.avatarUrl}
          onEnd={voice.end}
        />
      </div>
    </AcharyaShellContext.Provider>
  );
}

/**
 * Start / end the video call. Deliberately NOT the mic disc: while the video is
 * running the acharya's face is in the header, so this is only ever the exit —
 * and while idle it sits beside the mic as a clearly different thing.
 */
/**
 * `active` = this control now ENDS the call, which is the only state that earns
 * `--crit`. Idle it is the quieter of the pair beside the mic.
 */
function VideoCallToggle({
  label,
  onClick,
  busy = false,
  active = false,
}: {
  label: string;
  onClick: () => void;
  busy?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className="press"
      onClick={busy ? undefined : onClick}
      disabled={busy}
      aria-label={label}
      title={label}
      style={{
        width: 60,
        height: 60,
        borderRadius: 999,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: busy ? "var(--rule)" : active ? "var(--crit)" : "var(--rule)",
        background: busy ? "var(--surface-sunk)" : active ? "var(--crit)" : "var(--surface)",
        color: busy ? "var(--ink-mute)" : active ? "#f4efdf" : "var(--ink-soft)",
        boxShadow: active ? "0 6px 18px rgba(0,0,0,0.22)" : "0 2px 8px rgba(0,0,0,0.10)",
        cursor: busy ? "default" : "pointer",
      }}
    >
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="2.5" y="6" width="13" height="12" rx="2.5" />
        <path d="m15.5 10.5 5-2.6v8.2l-5-2.6z" />
      </svg>
    </button>
  );
}

const videoLangToast: CSSProperties = {
  position: "fixed",
  left: "50%",
  transform: "translateX(-50%)",
  bottom: "max(env(safe-area-inset-bottom), 88px)",
  zIndex: 71,
  maxWidth: "calc(100% - 32px)",
  padding: "10px 16px",
  borderRadius: 999,
  background: "rgba(20,17,12,0.92)",
  color: "#f4efdf",
  fontFamily: "var(--sans)",
  fontSize: 13,
  lineHeight: 1.35,
  textAlign: "center",
  boxShadow: "0 8px 24px rgba(0,0,0,0.32)",
  pointerEvents: "none",
};

const videoErrorBar: CSSProperties = {
  position: "fixed",
  left: "50%",
  transform: "translateX(-50%)",
  bottom: "max(env(safe-area-inset-bottom), 88px)",
  zIndex: 71,
  maxWidth: "calc(100% - 32px)",
  padding: "10px 16px",
  borderRadius: 999,
  background: "var(--crit)",
  color: "#f4efdf",
  fontFamily: "var(--sans)",
  fontSize: 13,
  textAlign: "center",
  boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
};

/** Compact mic / video control for the board's chat strip. */
function StripIconButton({
  label,
  onClick,
  tone,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  tone: "mic" | "video";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="press"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      style={{
        width: 32,
        height: 32,
        borderRadius: 999,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        borderWidth: 1,
        borderStyle: "solid",
        // Mic is the primary and stays filled; video is the rarer, secondary
        // action and is outlined. Two filled discs of equal weight competed with
        // each other and with the strip they sit in. `--crit` is reserved for
        // ending a call — it must not label a control that STARTS one.
        borderColor: tone === "video" ? "var(--rule)" : "var(--green-deep)",
        background: tone === "video" ? "var(--surface)" : "var(--green-deep)",
        color: tone === "video" ? "var(--ink-soft)" : "var(--surface)",
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "default" : "pointer",
        flexShrink: 0,
      }}
    >
      {tone === "video" ? (
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="2.5" y="6" width="13" height="12" rx="2.5" />
          <path d="m15.5 10.5 5-2.6v8.2l-5-2.6z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
        </svg>
      )}
    </button>
  );
}

/** Floats over the right end of the chat strip, which is a full-width button. */
const stripRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexShrink: 0,
  padding: "0 12px 0 0",
  borderBottomWidth: 1,
  borderBottomStyle: "solid",
  borderBottomColor: "var(--rule)",
  background: "var(--surface)",
};

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}
