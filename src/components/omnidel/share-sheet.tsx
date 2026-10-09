"use client";

import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
import type { IconifyIcon } from "@iconify/types";
import { emitToast } from "@/components/omnidel/toaster";
import { useIsMobile } from "@/lib/client/use-is-mobile";
import {
  SHARE_TARGETS,
  textWithUrl,
  type ShareContent,
  type ShareTarget,
} from "@/lib/share-targets";

// Reusable share sheet — the Instagram-style "send to" surface, driven by the
// SHARE_TARGETS registry in src/lib/share-targets.ts. Add a channel there and
// it appears here; nothing in this file enumerates channels.
//
// Two layers:
//   ShareButton — the trigger + sheet, what callers normally use.
//   ShareSheet  — the sheet alone, when the caller owns the trigger.
//
// On a device with a native share sheet (all mobile browsers, Chrome/Edge on
// Windows) the primary action hands off to the OS via navigator.share, which
// reaches every installed app — Slack, Signal, Gmail, AirDrop. The channel grid
// is the fallback that always works, including desktop Firefox/Safari.

export function ShareButton({
  content,
  note,
  buttonStyle,
  buttonLabel = "Share",
  iconOnly = false,
  disabled = false,
}: {
  content: ShareContent;
  /** One-line caveat under the link, e.g. who can actually open it. */
  note?: string;
  buttonStyle?: CSSProperties;
  buttonLabel?: string;
  iconOnly?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        aria-label={iconOnly ? buttonLabel : undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={buttonLabel}
        style={{
          ...(iconOnly ? iconBtnStyle : triggerBtnStyle),
          ...(disabled ? { opacity: 0.5, cursor: "default" } : null),
          ...buttonStyle,
        }}
      >
        <ShareIcon />
        {!iconOnly && <span>{buttonLabel}</span>}
      </button>
      <ShareSheet open={open} onClose={() => setOpen(false)} content={content} note={note} />
    </>
  );
}

export function ShareSheet({
  open,
  onClose,
  content,
  note,
}: {
  open: boolean;
  onClose: () => void;
  content: ShareContent;
  note?: string;
}) {
  const isMobile = useIsMobile();
  const [canNativeShare, setCanNativeShare] = useState(false);

  // Feature-detect after mount: reading navigator during render would make the
  // server and client markup disagree.
  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  // Escape closes the sheet only. stopPropagation + capture keeps the host
  // modal (task modal listens for Escape too) from closing underneath us.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  const copy = useCallback(async (text: string, done: string) => {
    if (await copyText(text)) emitToast(done, "success");
    else emitToast("Could not copy — select the link and copy it manually");
  }, []);

  const openTarget = useCallback((target: ShareTarget) => {
    const href = target.href(content);
    if (target.newTab) window.open(href, "_blank", "noopener,noreferrer");
    else window.location.href = href;
    onClose();
  }, [content, onClose]);

  const nativeShare = useCallback(async () => {
    try {
      await navigator.share({ title: content.title, text: content.text, url: content.url });
      onClose();
    } catch {
      // AbortError when the user dismisses the OS sheet — leave ours open so
      // they can pick a channel instead.
    }
  }, [content, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Share"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: "var(--z-share-sheet)",
        background: "var(--overlay)",
        display: "flex",
        alignItems: isMobile ? "flex-end" : "center",
        justifyContent: "center",
        padding: isMobile ? 0 : 20,
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--rule)",
          borderRadius: isMobile ? "var(--r-lg) var(--r-lg) 0 0" : "var(--r-lg)",
          boxShadow: "var(--shadow-md)",
          width: "100%",
          maxWidth: isMobile ? "none" : 420,
          maxHeight: isMobile ? "88vh" : "86vh",
          overflowY: "auto",
          padding: isMobile ? "18px 16px 22px" : "20px",
        }}
        className="themed-scroll-y"
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={eyebrowStyle}>SHARE</div>
            <h3 style={sheetTitleStyle} title={content.title}>{content.title}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={closeBtnStyle}>×</button>
        </div>

        {canNativeShare && (
          <button type="button" onClick={nativeShare} style={nativeBtnStyle}>
            <ShareIcon />
            <span>Share to an app…</span>
          </button>
        )}

        <div style={gridStyle}>
          {SHARE_TARGETS.map((target) => (
            <button
              key={target.id}
              type="button"
              onClick={() => openTarget(target)}
              style={tileStyle}
              title={`Share on ${target.label}`}
            >
              <span
                aria-hidden="true"
                style={{ ...tileIconStyle, background: target.tint.bg, color: target.tint.fg }}
              >
                <TargetMark mark={target.mark} />
              </span>
              <span style={tileLabelStyle}>{target.label}</span>
            </button>
          ))}
        </div>

        <div style={linkRowStyle}>
          <span style={linkTextStyle} title={content.url}>{content.url}</span>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <button type="button" onClick={() => copy(content.url, "Link copied")} style={secondaryBtnStyle}>
            Copy link
          </button>
          <button
            type="button"
            onClick={() => copy(textWithUrl(content), "Details copied")}
            style={secondaryBtnStyle}
          >
            Copy details
          </button>
        </div>

        {note && <p style={noteStyle}>{note}</p>}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Clipboard write with a fallback for browsers that refuse navigator.clipboard
 * (older Safari, any non-secure origin). Returns whether the copy landed.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the textarea path
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/* ── Icons ──────────────────────────────────────────────────────────────────
   ShareIcon is house style: 24×24, currentColor, stroked.

   The channel tiles are NOT. Their marks come from the Iconify library, carried
   as an icon object on each SHARE_TARGETS entry (see share-targets.ts for which
   sets, and the trademark note) and rendered solid, because a logo is a shape
   people recognise before they read the label under it — a 1.8px stroked
   approximation of the WhatsApp bubble is just a bubble. */

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function ShareIcon() {
  return (
    <Svg>
      <path d="M12 3v11" />
      <path d="M8 7l4-4 4 4" />
      <path d="M5 13v5a3 3 0 003 3h8a3 3 0 003-3v-5" />
    </Svg>
  );
}

/**
 * 20px inside the 40px tile, not the 18px the stroked icons used: a solid glyph
 * carries more ink per pixel, so matching them by number would have left the
 * logos looking shrunken in their circles.
 *
 * Iconify's `Icon` is given the icon OBJECT, never a name string. With a name it
 * resolves over the network from api.iconify.design, which renders nothing on
 * first paint, disagrees with the markup the server sent, and shows five blank
 * circles to anyone on a bad connection. Given the object it is a pure,
 * synchronous render of data bundled at build time.
 */
function TargetMark({ mark }: { mark: IconifyIcon }) {
  return <Icon icon={mark} width={20} height={20} aria-hidden="true" />;
}

/* ── Styles ─────────────────────────────────────────────────────────────── */

const triggerBtnStyle: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "7px 12px", fontSize: 12, fontWeight: 500,
  background: "var(--surface)", color: "var(--ink-soft)",
  border: "1px solid var(--rule-strong)", borderRadius: "var(--r-sm)",
  cursor: "pointer", fontFamily: "var(--sans)",
};

const iconBtnStyle: CSSProperties = {
  width: 32, height: 32, padding: 0,
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  background: "transparent", color: "var(--ink-soft)",
  border: "1px solid var(--rule)", borderRadius: "var(--r-sm)",
  cursor: "pointer", fontFamily: "var(--sans)",
};

const eyebrowStyle: CSSProperties = {
  fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.08em",
  color: "var(--ink-mute)", marginBottom: 4,
};

const sheetTitleStyle: CSSProperties = {
  fontFamily: "var(--serif)", fontSize: 16, margin: 0, color: "var(--ink)",
  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
};

const closeBtnStyle: CSSProperties = {
  width: 28, height: 28, flexShrink: 0, padding: 0,
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  background: "transparent", color: "var(--ink-soft)",
  border: "1px solid var(--rule)", borderRadius: "var(--r-sm)",
  cursor: "pointer", fontSize: 16, fontFamily: "var(--sans)",
};

const nativeBtnStyle: CSSProperties = {
  width: "100%", marginBottom: 14,
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
  padding: "10px 14px", fontSize: 13, fontWeight: 500,
  background: "var(--green-deep)", color: "var(--avatar-fg)",
  border: "1px solid var(--green-deep)", borderRadius: "var(--r-sm)",
  cursor: "pointer", fontFamily: "var(--sans)",
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(64px, 1fr))",
  gap: 8,
};

const tileStyle: CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
  padding: "10px 4px",
  background: "transparent", border: "1px solid transparent",
  borderRadius: "var(--r-md)", cursor: "pointer", fontFamily: "var(--sans)",
};

const tileIconStyle: CSSProperties = {
  width: 40, height: 40, borderRadius: "50%",
  display: "inline-flex", alignItems: "center", justifyContent: "center",
};

const tileLabelStyle: CSSProperties = {
  fontSize: 11, color: "var(--ink-soft)", textAlign: "center", lineHeight: 1.2,
};

const linkRowStyle: CSSProperties = {
  marginTop: 14, padding: "8px 10px",
  background: "var(--page)", border: "1px solid var(--rule)",
  borderRadius: "var(--r-sm)", overflow: "hidden",
};

const linkTextStyle: CSSProperties = {
  display: "block", fontFamily: "var(--mono)", fontSize: 11,
  color: "var(--ink-mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
};

const secondaryBtnStyle: CSSProperties = {
  padding: "7px 12px", fontSize: 12, fontWeight: 500,
  background: "var(--surface)", color: "var(--ink-soft)",
  border: "1px solid var(--rule-strong)", borderRadius: "var(--r-sm)",
  cursor: "pointer", fontFamily: "var(--sans)",
};

const noteStyle: CSSProperties = {
  margin: "12px 0 0", fontSize: 11, lineHeight: 1.45,
  color: "var(--ink-mute)", fontFamily: "var(--sans)",
};
