"use client";

/**
 * App-wide MahAcharya guide: text chat sheet + open-mic Gemini Live with nav
 * tools. Session key = mahacharya (distinct from per-slug AcharyaShell boards).
 *
 * Near-headless: no persistent controls of its own — the chat sheet, an error
 * strip, and the floating LiveAcharyaPip while a conversation runs. The mic
 * button itself is published through MahAcharyaMicProvider and drawn by whichever
 * screen hosts it (the feature-acharya card on home and on the work list). There
 * used to be a fixed pill bottom-centre on every (app) screen; it was removed on
 * request.
 *
 * Starting the mic no longer opens a full-screen stage (`MahAcharyaStage`,
 * deleted 2026-08-31). It covered the board the conversation was ABOUT, so the
 * karigar had a screen to escape before acting on anything they were told. The
 * header already expands to a hero portrait while live and the PiP carries
 * presence plus the stop control — the conversation reads without displacing
 * the work.
 *
 * Mounted ONCE in (app)/layout.tsx — NOT per page. /acharyas and /profile are
 * sibling routes, so a page-level mount remounts (and killed the session) on
 * every navigation; only the shared layout survives crossing them. See
 * [[persistent-acharya-shell-voice]] §1.
 *
 * Consequences of living in the layout:
 *  - Navigation must NOT end the mic. Voice tools push the route and send a
 *    `notify()` context note instead — same "no re-mint on nav" rule the
 *    per-acharya shell follows. Opening an Acharya board remints the singleton
 *    onto that board (mic stays open) instead of ending the conversation.
 *  - `chatOpen` lives in the persisted store, so the sheet survives both
 *    navigation and a page reload.
 *  - HIDDEN_PREFIXES keeps the home mic off screens that own their own voice
 *    chrome (per-acharya boards) or are deliberately immersive (the 45-min
 *    timer). When hidden, `active: false` so this guide does NOT keep calling
 *    setHandlers on the shared session. A live Acharya conversation is left
 *    running; coming back to Home shows a "still talking" bar instead of killing it.
 *  - Hidden is not the same as over. A per-acharya board TAKES the session over
 *    (`handsVoiceOver`) — same mic, reminted against that acharya — so the guide
 *    steps back without ending anything. Only a hidden screen with no owner gets
 *    the session ended.
 */

import { useCallback, useEffect, useMemo, useRef, type CSSProperties } from "react";
import { usePathname } from "next/navigation";
import { useInstantNav } from "@/components/instant-nav";
import { HomeMahAcharyaChat } from "@/components/HomeMahAcharyaChat";
import { AcharyaPip } from "@/components/voice/AcharyaPip";
import { LiveAcharyaPip } from "@/components/voice/LiveAcharyaPip";
import { DraggableDock } from "@/components/voice/DraggableDock";
import {
  useVoiceScreenContext,
  useVoiceSession,
  type VoiceScreenHandle,
} from "@/components/voice/VoiceSessionProvider";
import {
  useMahAcharyaMic,
  type MahAcharyaMicApi,
} from "@/components/voice/MahAcharyaMic";
import type { ToolHandlers } from "@/hooks/useGeminiLiveSession";
import { useLang, useStrings } from "@/lib/i18n/useLang";
import { useStore } from "@/lib/store";
import { buildScreenNavHandlers } from "@/components/voice/voice-nav-actions";
import { buildSearchMemoryHandler } from "@/lib/voice/search-memory-handler";
import { useTavusBinding } from "@/components/voice/TavusSessionProvider";

// Screens that own their own voice session (per-acharya AcharyaShell) or are
// deliberately immersive (the 45-min timer). Two live Gemini sessions at once
// would fight over the mic.
const HIDDEN_PREFIXES = ["/acharyas/"];
const HIDDEN_SUFFIXES = ["/active"];

function isHiddenPath(pathname: string | null): boolean {
  if (!pathname) return false;
  if (HIDDEN_SUFFIXES.some((suffix) => pathname.endsWith(suffix))) return true;
  // "/acharyas" (home) must stay visible; only its per-slug children are hidden.
  return HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Hidden screens that TAKE THE SESSION OVER rather than needing it ended.
 *
 * Every `/acharyas/<slug>` screen sits inside AcharyaShell, which registers the
 * same singleton session under its own acharya key — that is a remint (new
 * prompt + tools, same mic and AudioContext), so the conversation follows the
 * karigar in. Ending it on the way out is what made a voice navigation land on a
 * board with the mic off (QA BUG-01): the karigar asked to be taken to another
 * Acharya and arrived unable to say anything else. A hidden path with no owner
 * — the legacy `/tasks/<id>/active` timer — still gets the session ended, or a
 * live mic would sit on a screen with nothing to control it.
 */
function handsVoiceOver(pathname: string | null): boolean {
  return pathname?.startsWith("/acharyas/") ?? false;
}

type Props = {
  mahacharya: {
    slug: string;
    displayName: string;
    avatarUrl: string | null;
  };
  availableAcharyas: Array<{ slug: string; displayName: string }>;
};

export function HomeMahAcharyaGuide({ mahacharya, availableAcharyas }: Props) {
  const nav = useInstantNav();
  const pathname = usePathname();
  const s = useStrings();
  const lang = useLang();
  // Persisted so the sheet survives navigation AND reload (see file header).
  const chatOpen = useStore((st) => st.guideOpen);
  const setChatOpen = useStore((st) => st.setGuideOpen);
  const voiceRef = useRef<VoiceScreenHandle | null>(null);

  const allowedSlugs = useMemo(
    () => new Set(availableAcharyas.map((a) => a.slug.trim().toLowerCase())),
    [availableAcharyas],
  );

  const acharyaListKey = availableAcharyas.map((a) => `${a.slug}:${a.displayName}`).join("|");
  const tokenBody = useMemo(
    () => ({ availableAcharyas }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on acharyaListKey
    [acharyaListKey],
  );

  // Stable, and defined outside the handlers memo: the shared Profile/Settings
  // builder takes it as an argument.
  const notify = useCallback((text: string) => voiceRef.current?.notify(text), []);

  const handlers = useMemo<ToolHandlers>(() => {
    return {
      // open_profile / open_settings / open_msme_requests — shared verbatim with
      // AcharyaShell so a destination reachable from home is reachable from a
      // board too. See voice-nav-actions.ts for why that had to stop being two
      // copies.
      // See the same call in AcharyaShell: `notify` reads voiceRef but is only
      // ever invoked from inside an async tool handler, never during render.
      // eslint-disable-next-line react-hooks/refs
      ...buildScreenNavHandlers({ nav, notify }),
      // The home navigator IS MahAcharya'ji, and his Memory is bound at this
      // mint like it is on his board, so the tool needs a handler HERE too — a
      // tool bound at mint with nothing to answer it is what made him stall and
      // invent calls the last time. Same factory AcharyaShell uses.
      ...buildSearchMemoryHandler(mahacharya.slug || "mahacharya"),
      open_acharya: async (args) => {
        const slug = args.slug != null ? String(args.slug).trim().toLowerCase() : "";
        if (!slug || !allowedSlugs.has(slug)) {
          return { ok: false, error: "unknown_acharya" };
        }
        // Do NOT end the mic. AcharyaShell takes over the same singleton
        // session (remint to that Acharya's tools/persona, mic stays open).
        nav.replaceQuery(`/acharyas/${slug}`);
        notify(`(context: opened ${slug}'s board — keep speaking, do not re-greet)`);
        return { ok: true };
      },
      go_home: async () => {
        nav.push("/acharyas");
        return { ok: true };
      },
      go_back: async () => {
        nav.push("/acharyas");
        return { ok: true };
      },
      end_conversation: async () => {
        voiceRef.current?.end();
        return { ok: true };
      },
      // Tavus attaches `end_call` to every PAL as a system tool and delivers it
      // like any other. Without this the model's way of hanging up came back
      // `unhandled` — on home as well as on a board.
      end_call: async () => {
        voiceRef.current?.end();
        return { ok: true };
      },
    };
  }, [allowedSlugs, nav, notify, mahacharya.slug]);

  const session = useVoiceSession();
  const hidden = isHiddenPath(pathname);
  // A live per-Acharya conversation must survive Home. If we register home_nav
  // tools while that session is live, setContext remints and the talk dies.
  const foreignLive =
    (session.status === "live" ||
      session.status === "connecting" ||
      session.status === "minting" ||
      session.status === "reminting") &&
    session.context?.context !== "home_nav";
  const handsOver = handsVoiceOver(pathname);

  /**
   * Home registers its OWN nav handlers with the shared Tavus session, so a call
   * started from the feature card can drive `open_acharya` / `open_profile` the
   * same way the mic does. Inactive while `hidden` — an AcharyaShell owns the
   * binding on its own screens, and two registrations would clobber each other.
   */
  const voice = useVoiceScreenContext({
    screen: "home_nav",
    acharyaSlug: mahacharya.slug || "mahacharya",
    tokenBody,
    handlers,
    lang,
    active: !hidden && !foreignLive,
  });

  useEffect(() => {
    voiceRef.current = voice;
  }, [voice]);

  // NOTE: deliberately NO end-on-unmount here. This component now unmounts only
  // when the whole (app) tree does (sign-out / full reload), and an unmount
  // cleanup keyed on `voice.end` would fire on identity churn and kill a live
  // mic mid-sentence. Explicit ends: the mic toggle, end_conversation, and
  // handing off to a per-acharya board.
  const endVoice = voice.end;

  // End-on-hidden is GUARDED below. Entering /active used to end MahAcharya
  // unconditionally, and that also killed a handed-off Acharya session because
  // both share one singleton. AcharyaShell owns the mic on /acharyas/* routes.
  //
  // INTEGRATION NOTE: this commit wrote `hidden && !handsOver`. That guard ALONE
  // reintroduces the bug named above -- /tasks/<id>/active is not an /acharyas/
  // path, so handsOver is false there and a live handed-off session would be torn
  // down. Resolved as the conjunction with dev's foreignLive. See the PR body.
  useEffect(() => {
    if (hidden && !handsOver && !foreignLive) endVoice();
  }, [hidden, handsOver, foreignLive, endVoice]);

  // ── "Always open Ask MahAcharya" (Settings, off by default) ───────────────
  // Fires at most once per app open, not once per screen: this component is
  // mounted in (app)/layout.tsx and survives navigation, so one mount == one
  // app open. The ref — not the store — is what makes it once-only, so closing
  // the sheet and walking around the app does not spring it open again.
  //
  // When the karigar deep-links straight onto a hidden screen (a per-acharya
  // board, the 45-min timer) we hold rather than mark it done: those screens own
  // the mic, and the sheet opens the moment they step off one.
  const autoStart = useStore((st) => st.guideAutoStart);
  const autoStartFired = useRef(false);
  useEffect(() => {
    if (autoStartFired.current || !autoStart || hidden) return;
    autoStartFired.current = true;
    setChatOpen(true);
  }, [autoStart, hidden, setChatOpen]);

  const live = voice.status === "live";
  const busy =
    voice.status === "minting" ||
    voice.status === "connecting" ||
    voice.status === "reminting";

  // ── Full-screen stage ─────────────────────────────────────────────────────
  // Starting the mic promotes the feature acharya from their card to the whole
  // screen. State is the SCREEN the stage belongs to, not a boolean: voice tools
  // navigate ("open my profile", "show MSME requests"), and a stage covering the
  // screen would hide the very thing the karigar just asked to see. Comparing
  // against the live pathname collapses it on any route change — derived, so no
  // effect has to chase the router. The conversation stays live underneath.

  const openChat = useCallback(() => {
    if (live || busy) endVoice();
    setChatOpen(true);
  }, [live, busy, endVoice, setChatOpen]);

  const startVoice = voice.start;
  const toggleMic = useCallback(() => {
    if (busy) return;
    if (live) {
      endVoice();
      return;
    }
    // Mic must not open the text chat sheet.
    setChatOpen(false);
    // NO full-screen stage. Starting the mic used to take over the whole screen,
    // which hid the very thing the conversation is about — the acharya's board
    // and their tasks — and gave the karigar a screen to get out of before they
    // could act on anything they were told. The header already expands to a hero
    // portrait while live, and LiveAcharyaPip carries presence plus the stop
    // control, so the conversation is legible without displacing the work.
    void startVoice();
  }, [busy, live, endVoice, setChatOpen, startVoice]);

  const micLabel =
    voice.status === "idle"
      ? s.talkMahAcharyaAria(mahacharya.displayName)
      : voice.status === "live"
        ? s.endConversation
        : voice.status === "error"
          ? s.retry
          : s.connecting;

  const chatLabel = s.askMahAcharyaCta(mahacharya.displayName);

  // Publish the control surface. This is the ONLY way to reach voice/chat now —
  // the floating dock is gone, so the mic lives in the feature-acharya card's
  // bottom-right corner (home and the work list both draw that card).
  // Deliberately keyed on status, never on transcript: captions tick constantly
  // and would re-render the whole (app) subtree through the provider.
  const micCtx = useMahAcharyaMic();
  const publishMic = micCtx?.publishMic;
  const micSlug = mahacharya.slug || "mahacharya";
  const tavus = useTavusBinding({
    acharyaSlug: micSlug,
    handlers,
    active: !hidden,
  });
  useEffect(() => {
    if (hidden) return;
    tavus?.setMicStandDown(() => { voiceRef.current?.end(); });
    return () => tavus?.setMicStandDown(null);
  }, [tavus, hidden]);

  const micApi = useMemo<MahAcharyaMicApi | null>(
    () =>
      hidden || foreignLive
        ? null
        : {
            slug: micSlug,
            status: voice.status,
            live,
            busy,
            label: micLabel,
            toggle: toggleMic,
            openChat,
            chatOpen,
            chatLabel,
          },
    [hidden, foreignLive, micSlug, voice.status, live, busy, micLabel, toggleMic, openChat, chatOpen, chatLabel],
  );

  useEffect(() => {
    if (!publishMic) return;
    publishMic(micApi);
    return () => publishMic(null);
  }, [publishMic, micApi]);

  // Hidden AFTER all hooks have run — hooks must never be conditional.
  if (hidden) return null;

  // An error still needs saying — that is the one thing the karigar cannot
  // infer from a face. The live transcript does not: while a conversation runs,
  // the floating acharya below carries presence AND the stop control, which is
  // what the minimised stage was missing entirely (the session kept running with
  // no way to end it anywhere on screen).
  const showCaption = Boolean(voice.error) && !foreignLive;
  /**
   * The pip must follow the VIDEO too, not only the mic. `live` is the Gemini
   * session alone, so a Tavus call showed no pip on home at all — and the pip is
   * exactly what keeps the acharya present once the feature card scrolls out of
   * the viewport. Guarded on `liveSlug` because the session is shared: home must
   * not draw a pip for a call belonging to a board.
   */
  const tavusMine = tavus?.liveSlug === micSlug;
  const tavusLive = tavus?.status === "live" && tavusMine;
  const tavusBusy = (tavus?.status === "starting" || tavus?.status === "connecting") && tavusMine;
  /**
   * The pip is for screens where NOTHING ELSE shows the acharya — Profile,
   * Settings and their tabs. On `/acharyas` the feature card is already showing
   * them (the live video, while a Tavus call runs), so a floating card of the
   * same face is the same person twice.
   *
   * It still has to be reachable once that card scrolls out of the viewport,
   * which is why home keeps a compact End control rather than nothing at all.
   */
  const onAcharyaHome = (pathname ?? "").startsWith("/acharyas");
  const anyLive = (live || tavusLive || tavusBusy) && !foreignLive;
  const showLivePip = anyLive && !onAcharyaHome;
  const showHomeEnd = anyLive && onAcharyaHome;
  const talkingName = session.acharya?.displayName || mahacharya.displayName;
  const talkingSlug = session.acharya?.slug || micSlug;
  const talkingAvatar = session.acharya?.avatarUrl ?? mahacharya.avatarUrl;

  return (
    <>
      {foreignLive ? (
        <div style={resumeWrap}>
          <div style={resumeBar} role="status">
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {s.stillTalkingWith(talkingName)}
            </span>
            <button
              type="button"
              className="press"
              onClick={() => nav.push(`/acharyas/${talkingSlug}`)}
              style={resumeBtn}
            >
              {s.returnToBoard}
            </button>
            <button type="button" className="press" onClick={endVoice} style={resumeBtnEnd}>
              {s.endConversation}
            </button>
          </div>
        </div>
      ) : null}


      {showCaption ? (
        <div style={captionWrap}>
          <div style={captionBar} aria-live="polite">
            <span style={{ color: "var(--crit)" }}>{voice.error}</span>
          </div>
        </div>
      ) : null}

      {/* Draggable so it can be parked off whatever it covers, and remembered
          per surface — home keeps its own spot, separate from the boards. */}
      {showLivePip ? (
        <DraggableDock
          surface="home"
          placement="bottom-center"
          ariaLabel={s.moveConversationPill}
        >
          <LiveAcharyaPip
            slug={talkingSlug}
            name={talkingName}
            avatarUrl={talkingAvatar}
            videoTrack={tavusLive ? tavus?.replicaTrack ?? null : null}
            busy={tavusBusy}
            onEnd={tavusLive || tavusBusy ? () => tavus?.end() : endVoice}
          />
        </DraggableDock>
      ) : null}

      {/* Home: the card shows the acharya, so only the way out floats — and only
          because that card scrolls out of the viewport. */}
      {showHomeEnd ? (
        <DraggableDock
          surface="home"
          placement="bottom-center"
          ariaLabel={s.moveConversationPill}
        >
          <button
            type="button"
            className="press"
            onClick={tavusLive || tavusBusy ? () => tavus?.end() : endVoice}
            disabled={tavusBusy}
            aria-label={s.endVideoCall}
            title={s.endVideoCall}
            style={homeEndBtn(tavusBusy)}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden>
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
        </DraggableDock>
      ) : null}

      {/* Switch tabs mid-conversation and MahAcharya'ji follows you out. */}
      <AcharyaPip
        live={live}
        slug={talkingSlug}
        name={talkingName}
        avatarUrl={talkingAvatar}
        onEnd={endVoice}
      />

      <HomeMahAcharyaChat
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        acharyaName={mahacharya.displayName}
        acharyaAvatarUrl={mahacharya.avatarUrl}
        availableAcharyas={availableAcharyas}
      />
    </>
  );
}

/** Only floating element left: the transient live-transcript strip. */
const captionWrap: CSSProperties = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 40,
  padding: "0 16px max(env(safe-area-inset-bottom), 12px)",
  pointerEvents: "none",
  display: "flex",
  justifyContent: "center",
};

const captionBar: CSSProperties = {
  pointerEvents: "none",
  maxWidth: 320,
  width: "100%",
  margin: "0 auto",
  padding: "8px 12px",
  borderRadius: "var(--r-md)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  background: "var(--surface)",
  boxShadow: "var(--shadow-sm)",
  fontSize: 12,
  lineHeight: 1.35,
  color: "var(--ink-soft)",
  maxHeight: 56,
  overflow: "hidden",
};

const resumeWrap: CSSProperties = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 45,
  padding: "0 12px max(env(safe-area-inset-bottom), 12px)",
  pointerEvents: "none",
  display: "flex",
  justifyContent: "center",
};

const resumeBar: CSSProperties = {
  pointerEvents: "auto",
  maxWidth: 420,
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 10px 8px 14px",
  borderRadius: "var(--r-md)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  background: "var(--surface)",
  boxShadow: "var(--shadow-sm)",
  fontSize: 13,
  fontWeight: 650,
  color: "var(--ink)",
};

const resumeBtn: CSSProperties = {
  flexShrink: 0,
  border: "none",
  borderRadius: 8,
  padding: "6px 10px",
  background: "var(--green-deep)",
  color: "var(--page)",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const resumeBtnEnd: CSSProperties = {
  ...resumeBtn,
  background: "var(--surface-sunk)",
  color: "var(--ink)",
};

function homeEndBtn(busy: boolean): CSSProperties {
  return {
    width: 56,
    height: 56,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "var(--crit)",
    background: "var(--crit)",
    color: "#f4efdf",
    boxShadow: "0 6px 18px rgba(0,0,0,0.22)",
    opacity: busy ? 0.6 : 1,
    cursor: busy ? "default" : "pointer",
  };
}
