"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import {
  useGeminiLiveSession,
  type GeminiLiveSession,
  type ToolHandlers,
  type VoiceContext,
  type VoiceContextKind,
} from "@/hooks/useGeminiLiveSession";

/**
 * Singleton voice session for an app subtree. Mount ONCE (e.g. in the
 * authenticated layout) so the session survives client-side navigation between
 * screens; each screen registers its context + tools via useVoiceScreenContext.
 */

const VoiceSessionContext = createContext<GeminiLiveSession | null>(null);

export function VoiceSessionProvider({ children }: { children: React.ReactNode }) {
  const session = useGeminiLiveSession();
  return <VoiceSessionContext.Provider value={session}>{children}</VoiceSessionContext.Provider>;
}

/** Read the raw session (status + controls). Must be inside VoiceSessionProvider. */
export function useVoiceSession(): GeminiLiveSession {
  const ctx = useContext(VoiceSessionContext);
  if (!ctx) throw new Error("useVoiceSession must be used within <VoiceSessionProvider>");
  return ctx;
}

export type VoiceScreenOptions = {
  screen: VoiceContextKind;
  acharyaSlug?: string;
  taskId?: string;
  workspace?: string;
  /** Override mint URL (e.g. public register help). */
  tokenEndpoint?: string;
  /** Extra fields merged into the mint POST body (e.g. home availableAcharyas). */
  tokenBody?: Record<string, unknown>;
  handlers: ToolHandlers;
  lang?: string;
  /** When false, the screen does not register (no context swap / no remint). */
  active?: boolean;
};

export type VoiceScreenHandle = {
  status: GeminiLiveSession["status"];
  error: string;
  context: GeminiLiveSession["context"];
  acharya: GeminiLiveSession["acharya"];
  inputText: string;
  outputText: string;
  /** Start (or retry) a session bound to THIS screen's context + handlers. */
  start: () => Promise<void>;
  /** Push a context note to the live model without re-minting (e.g. on manual nav). */
  notify: (text: string) => void;
  end: () => void;
};

/**
 * Per-screen binding. On mount / context-param change it calls setContext, so
 * navigating between screens while a session is live re-mints against the new
 * screen's prompt + tools. Handler identity churn does NOT retrigger the effect
 * (handlers are read from a ref), only the context key + lang + active do.
 */
export function useVoiceScreenContext(opts: VoiceScreenOptions): VoiceScreenHandle {
  const session = useVoiceSession();
  const {
    screen,
    acharyaSlug,
    taskId,
    workspace,
    tokenEndpoint,
    tokenBody,
    handlers,
    lang,
    active = true,
  } = opts;

  const handlersRef = useRef<ToolHandlers>(handlers);
  const tokenBodyRef = useRef(tokenBody);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    tokenBodyRef.current = tokenBody;
  }, [tokenBody]);

  const ctx: VoiceContext = useMemo(
    () => ({
      context: screen,
      acharyaSlug,
      taskId,
      workspace,
      tokenEndpoint,
      tokenBody,
      // Bound into session key so UI language change remints with bn-IN / hi-IN.
      speechLang: lang,
    }),
    [screen, acharyaSlug, taskId, workspace, tokenEndpoint, tokenBody, lang],
  );

  // tokenBody identity can churn; key on a stable digest when provided.
  const tokenBodyKey =
    tokenBody && typeof tokenBody === "object"
      ? JSON.stringify(tokenBody)
      : "";
  const bindKey = `${screen}|${acharyaSlug ?? ""}|${taskId ?? ""}|${workspace ?? ""}|${tokenEndpoint ?? ""}|${tokenBodyKey}|${lang ?? ""}|${active}`;

  // Re-bind when the screen key changes (may remint if acharya key changes).
  useEffect(() => {
    if (!active) return;
    session.setContext(
      { ...ctx, tokenBody: tokenBodyRef.current },
      handlersRef.current,
      lang,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bindKey]);

  // Screen tools layer (setScreenHandlers / proof tabs) must reach the live
  // session's handlersRef even when bindKey is unchanged — otherwise those
  // tools stay "unhandled" until the next remint. setHandlers is ref-only.
  useEffect(() => {
    if (!active) return;
    if (process.env.NODE_ENV !== "production") {
      console.debug("[voice-tools] screen bind", {
        screen,
        acharyaSlug,
        toolNames: Object.keys(handlers),
      });
    }
    session.setHandlers(handlers);
  }, [session, handlers, active, screen, acharyaSlug]);

  const start = useCallback(
    () =>
      session.start(
        { ...ctx, tokenBody: tokenBodyRef.current },
        handlersRef.current,
        lang,
      ),
    [session, ctx, lang],
  );

  return {
    status: session.status,
    error: session.error,
    context: session.context,
    acharya: session.acharya,
    inputText: session.inputText,
    outputText: session.outputText,
    start,
    notify: session.notify,
    end: session.end,
  };
}
