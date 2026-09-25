"use client";

/**
 * Singleton Tavus session for the (app) subtree — the video counterpart to
 * `VoiceSessionProvider`, and mounted beside it for the same reason.
 *
 * WHY A SINGLETON AND NOT A HOOK PER SCREEN. Two `useTavusSession` instances
 * would be two BILLABLE conversations holding two concurrency slots, and the
 * home card and the acharya board both need to draw the control. So one session
 * lives here and each screen REGISTERS what it should be bound to — the board's
 * merged tool handlers, or home's nav handlers — exactly the way
 * `useVoiceScreenContext` registers a Gemini context.
 *
 * The binding is read through a getter at start time rather than passed down, so
 * a screen rebuilding its handler object every render (which AcharyaShell does)
 * never churns the session.
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
} from "react";
import {
  useTavusSession,
  type TavusBinding,
  type TavusSession,
} from "@/hooks/useTavusSession";
import type { ToolHandlers } from "@/hooks/useGeminiLiveSession";

interface TavusContextValue extends TavusSession {
  /** Registered by the screen currently showing the control. */
  register: (binding: TavusBinding | null) => void;
  /** Set by whoever owns the mic, so a starting call can stand it down. */
  setMicStandDown: (fn: (() => void) | null) => void;
}

const TavusContext = createContext<TavusContextValue | null>(null);

export function TavusSessionProvider({ children }: { children: ReactNode }) {
  const bindingRef = useRef<TavusBinding | null>(null);
  const micStandDownRef = useRef<(() => void) | null>(null);

  const getBinding = useCallback(() => bindingRef.current, []);

  const session = useTavusSession({
    getBinding,
    onLive: () => {
      // One live agent, one microphone. Two capture graphs is a correctness
      // problem, so the mic stands down when the video is really up rather than
      // optimistically at tap time.
      micStandDownRef.current?.();
    },
  });

  const register = useCallback((binding: TavusBinding | null) => {
    bindingRef.current = binding;
  }, []);

  const setMicStandDown = useCallback((fn: (() => void) | null) => {
    micStandDownRef.current = fn;
  }, []);

  const value = useMemo<TavusContextValue>(
    () => ({ ...session, register, setMicStandDown }),
    [session, register, setMicStandDown],
  );

  return (
    <TavusContext.Provider value={value}>
      {/*
        The PAL's voice. `createCallObject()` — unlike the prebuilt iframe —
        creates NO media elements, so remote audio is silent unless we render it
        ourselves. It lives HERE, not next to the video, because the video moves
        between surfaces (home card, acharya header, pip) and the audio must not
        cut out when one of them unmounts mid-sentence.
      */}
      <TavusReplicaAudio track={session.replicaAudioTrack} />
      {children}
    </TavusContext.Provider>
  );
}

/** Hidden <audio> bound to the PAL's track. Never muted — this IS the voice. */
function TavusReplicaAudio({ track }: { track: MediaStreamTrack | null }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!track) { el.srcObject = null; return; }
    el.srcObject = new MediaStream([track]);
    // Autoplay for AUDIO needs a prior user gesture; starting a call is one, so
    // this normally resolves. If a browser still refuses, log it rather than
    // failing silently — silence with a visible video is indistinguishable from
    // a broken avatar.
    void el.play().catch((err) => {
      console.warn("[tavus] replica audio could not autoplay", err);
    });
  }, [track]);
  return <audio ref={ref} autoPlay playsInline style={{ display: "none" }} />;
}

/** Read the session. Null when the provider is absent (e.g. auth screens). */
export function useTavus(): TavusContextValue | null {
  return useContext(TavusContext);
}

/**
 * Register this screen's acharya + tool handlers with the shared session.
 *
 * `active` exists because two screens can be mounted at once — the home guide
 * lives in the layout and stays mounted underneath an acharya board — and only
 * the one actually showing the control may own the binding.
 */
export function useTavusBinding(opts: {
  acharyaSlug: string;
  handlers: ToolHandlers;
  active?: boolean;
}): TavusContextValue | null {
  const { acharyaSlug, handlers, active = true } = opts;
  const tavus = useTavus();
  const register = tavus?.register;

  // Handlers are read through this ref by the session at START time, so an object
  // rebuilt on every render costs nothing and must NOT be an effect dependency.
  const handlersRef = useRef(handlers);
  useEffect(() => { handlersRef.current = handlers; }, [handlers]);

  useEffect(() => {
    if (!register || !active || !acharyaSlug) return;
    register({ acharyaSlug, get handlers() { return handlersRef.current; } });
    return () => register(null);
  }, [register, active, acharyaSlug]);

  return tavus;
}

/**
 * Is the video avatar offered to THIS viewer for THIS acharya?
 *
 * Both halves of the gate — the acharya allowlist and founder/admin — are decided
 * server-side; this only asks. A probe failure resolves to false and is never
 * surfaced: a karigar who is not meant to know the feature exists must not see it
 * fail either.
 */
export function useTavusAvailable(acharyaSlug: string | null | undefined): boolean {
  // Keyed by slug so a stale answer can never be read for a different acharya,
  // and so "no slug yet" is the absence of an entry rather than a setState.
  const [availableFor, setAvailableFor] = useState<string | null>(null);
  useEffect(() => {
    if (!acharyaSlug) return;
    let cancelled = false;
    const setAvailable = (ok: boolean) => {
      if (cancelled) return;
      setAvailableFor(ok ? acharyaSlug : null);
    };
    fetch(`/api/work/tavus/availability?acharya=${encodeURIComponent(acharyaSlug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { available?: boolean } | null) => setAvailable(d?.available === true))
      .catch(() => setAvailable(false));
    return () => { cancelled = true; };
  }, [acharyaSlug]);
  return !!acharyaSlug && availableFor === acharyaSlug;
}
