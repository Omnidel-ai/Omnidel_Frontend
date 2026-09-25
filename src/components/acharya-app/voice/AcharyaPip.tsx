"use client";

/**
 * Picture-in-picture for a live Acharya conversation.
 *
 * Leave the tab mid-conversation and the Acharya follows you out in a small
 * always-on-top window — the karigar's face card, the live mic meter and an End
 * button — the same shape YouTube/Meet use when you switch away.
 *
 * How the auto part works (and where it doesn't):
 *  - `documentPictureInPicture.requestWindow()` needs transient user activation,
 *    so opening it straight from `visibilitychange` is normally refused. The
 *    supported path is Media Session's **enterpictureinpicture** action, which
 *    Chrome fires FOR us when the user switches away while the page is capturing
 *    the microphone — which is exactly our case during a live session.
 *  - We still try the direct call on `visibilitychange` as a fallback; if the
 *    browser refuses, it throws and we stay silent rather than nagging.
 *  - Anything without Document PiP (Safari, Firefox, Chrome on Android) simply
 *    never opens a window. The conversation itself is untouched either way —
 *    Web Audio keeps streaming in a hidden tab, so PiP is a window onto the
 *    session, never the thing keeping it alive.
 *
 * Coming back to the tab closes the window, so the karigar is never talking to
 * two copies of the same acharya.
 */

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import AcharyaAvatar from "@/components/acharya-avatar";
import { VoiceWaveform } from "@/components/voice/VoiceWaveform";
import { useStrings } from "@/lib/i18n/useLang";

interface Props {
  /** Only a LIVE session gets a PiP window. */
  live: boolean;
  slug: string;
  name: string;
  avatarUrl: string | null;
  /** Ends the conversation from inside the PiP window. */
  onEnd: () => void;
}

/** Minimal shape of the Document Picture-in-Picture API (no TS lib types yet). */
type DocumentPipApi = {
  requestWindow: (options?: {
    width?: number;
    height?: number;
    disallowReturnToOpener?: boolean;
  }) => Promise<Window>;
  window: Window | null;
};

function documentPip(): DocumentPipApi | null {
  if (typeof window === "undefined") return null;
  const api = (window as unknown as { documentPictureInPicture?: DocumentPipApi })
    .documentPictureInPicture;
  return api && typeof api.requestWindow === "function" ? api : null;
}

/**
 * The PiP document starts empty — no <head>, no stylesheets — so every CSS
 * custom property the app's components read (--ink, --surface, --serif …) is
 * undefined until we copy the sheets across. Cloning beats re-authoring the
 * palette here: the window then tracks the app's theme for free.
 */
function copyStyles(target: Window) {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const rules = Array.from(sheet.cssRules)
        .map((r) => r.cssText)
        .join("\n");
      const style = target.document.createElement("style");
      style.textContent = rules;
      target.document.head.appendChild(style);
    } catch {
      // Cross-origin sheet — re-link it instead of reading its rules.
      const href = sheet.href;
      if (!href) continue;
      const link = target.document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      target.document.head.appendChild(link);
    }
  }
}

export function AcharyaPip({ live, slug, name, avatarUrl, onEnd }: Props) {
  const s = useStrings();
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  // Mirror of the state for callbacks that must not close over a stale render
  // (media-session handler, effect cleanups).
  const pipRef = useRef<Window | null>(null);
  const liveRef = useRef(live);
  const openingRef = useRef(false);
  useEffect(() => {
    liveRef.current = live;
  }, [live]);

  const closePip = useCallback(() => {
    const win = pipRef.current;
    pipRef.current = null;
    try {
      win?.close();
    } catch {
      /* already gone */
    }
    setPipWindow(null);
  }, []);

  const openPip = useCallback(async () => {
    const api = documentPip();
    if (!api || openingRef.current || api.window) return;
    openingRef.current = true;
    try {
      const win = await api.requestWindow({ width: 288, height: 168 });
      copyStyles(win);
      win.document.body.style.margin = "0";
      win.document.body.style.background = "var(--page, #f4efdf)";
      // Closed from the window's own chrome — drop our reference so the next
      // tab switch can open a fresh one.
      win.addEventListener(
        "pagehide",
        () => {
          pipRef.current = null;
          setPipWindow(null);
        },
        { once: true },
      );
      pipRef.current = win;
      setPipWindow(win);
    } catch {
      // Refused (no user activation) or unsupported — the session is unaffected.
    } finally {
      openingRef.current = false;
    }
  }, []);

  // Chrome's auto-PiP hook: fired when the user switches away while the mic is
  // captured. Registered only while live, so a browser that surfaces a PiP
  // affordance never offers one for a session that isn't running.
  useEffect(() => {
    if (!live || typeof navigator === "undefined" || !navigator.mediaSession) return;
    const media = navigator.mediaSession as MediaSession & {
      setActionHandler: (action: string, handler: (() => void) | null) => void;
    };
    try {
      media.setActionHandler("enterpictureinpicture", () => {
        void openPip();
      });
    } catch {
      // Action unsupported in this browser — the visibility fallback remains.
      return;
    }
    return () => {
      try {
        media.setActionHandler("enterpictureinpicture", null);
      } catch {
        /* ignore */
      }
    };
  }, [live, openPip]);

  // Fallback + the return trip: hidden → try to open, visible → close.
  useEffect(() => {
    if (!live) return;
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        if (liveRef.current) void openPip();
      } else {
        closePip();
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [live, openPip, closePip]);

  // Tear the window down when the session stops — by voice tool, by the End
  // button, by navigation, or by this host unmounting. Cleanup rather than a
  // `if (!live) close()` body, so the close is tied to the end of the live
  // period instead of firing on every render where live is already false.
  useEffect(() => {
    if (!live) return;
    return () => closePip();
  }, [live, closePip]);

  if (!pipWindow) return null;

  return createPortal(
    <div style={pipWrap}>
      <AcharyaAvatar slug={slug} name={name} imageUrl={avatarUrl} size={52} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={pipName}>{name}</p>
        <span style={pipStatus}>
          <VoiceWaveform bars={4} height={12} width={2.5} gap={2.5} color="var(--crit)" />
          {s.youSpeaker}
        </span>
        <button type="button" onClick={onEnd} style={pipEndBtn}>
          {s.endConversation}
        </button>
      </div>
    </div>,
    pipWindow.document.body,
  );
}

const pipWrap: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: 14,
  height: "100%",
  boxSizing: "border-box",
  background: "var(--page)",
  fontFamily: "var(--font-sans)",
};

const pipName: CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontStyle: "italic",
  fontSize: 18,
  fontWeight: 500,
  color: "var(--ink)",
  margin: 0,
  lineHeight: 1.15,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const pipStatus: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  margin: "6px 0 0",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--ink-mute)",
};

const pipEndBtn: CSSProperties = {
  display: "block",
  marginTop: 10,
  minHeight: 34,
  padding: "0 14px",
  borderRadius: 999,
  border: "none",
  background: "var(--crit)",
  color: "#f4efdf",
  fontFamily: "var(--font-sans)",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};
