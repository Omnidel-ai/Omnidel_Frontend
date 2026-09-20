import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { DemoAssistant, DemoAssistantMessage } from "../../data/types";
import { Spinner } from "../../components/Spinner";

export interface AskMacheProps {
  assistant: DemoAssistant;
  /** Which bottom corner the pill and panel dock to. */
  side?: "left" | "right";
  /** Start with the panel open (used by the playground's demo). */
  defaultOpen?: boolean;
}

/**
 * The assistant: a docked pill that opens a chat panel.
 *
 * Replies come from the canned set in demo.json — matched on a keyword, with a
 * short delay so the pending state is visible. There is no model call and no
 * network here; when the real assistant API lands, `answer()` is the only
 * function that changes.
 */
export function AskMache({ assistant, side = "right", defaultOpen = false }: AskMacheProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [expanded, setExpanded] = useState(false);
  const [dock, setDock] = useState<"left" | "right">(side);
  const [messages, setMessages] = useState<DemoAssistantMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the newest message in view, including while the reply is pending.
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, thinking]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (expanded) setExpanded(false);
        else setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, expanded]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  function answer(question: string): string {
    const q = question.toLowerCase();
    return assistant.replies.find((r) => q.includes(r.match.toLowerCase()))?.text ?? assistant.fallback;
  }

  function send(text: string) {
    const question = text.trim();
    if (!question || thinking) return;
    setMessages((m) => [...m, { role: "user", text: question }]);
    setDraft("");
    setThinking(true);
    timerRef.current = setTimeout(() => {
      setMessages((m) => [...m, { role: "assistant", text: answer(question) }]);
      setThinking(false);
    }, 550);
  }

  const edge: CSSProperties = dock === "right" ? { right: 20 } : { left: 20 };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ ...fabStyle, ...edge }}
        aria-label={`Ask ${assistant.name}`}
      >
        <SparkleIcon />
        <span style={{ fontFamily: "var(--sans)", fontSize: 14, fontWeight: 600 }}>
          Ask {assistant.name}
        </span>
      </button>
    );
  }

  return (
    <>
      {expanded && (
        <div
          className="shell-backdrop"
          onClick={() => setExpanded(false)}
          aria-hidden="true"
          style={{ zIndex: 1200 }}
        />
      )}
      <section
        aria-label={`${assistant.name} assistant`}
        style={{
          ...panelStyle,
          ...(expanded ? expandedPanelStyle : edge),
        }}
      >
        <header style={headerStyle}>
          <span style={{ fontFamily: "var(--serif)", fontSize: 16, color: "var(--ink)" }}>
            {assistant.name}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              type="button"
              style={headerBtnStyle}
              onClick={() => setDock((d) => (d === "right" ? "left" : "right"))}
              aria-label={`Dock ${dock === "right" ? "left" : "right"}`}
              disabled={expanded}
            >
              {dock === "right" ? "←" : "→"}
            </button>
            <button
              type="button"
              style={headerBtnStyle}
              onClick={() => setExpanded((e) => !e)}
              aria-pressed={expanded}
            >
              {expanded ? "Shrink" : "Expand"}
            </button>
            {messages.length > 0 && (
              <button type="button" style={headerBtnStyle} onClick={() => setMessages([])}>
                Clear
              </button>
            )}
            <button
              type="button"
              style={headerBtnStyle}
              onClick={() => {
                setOpen(false);
                setExpanded(false);
              }}
              aria-label="Close assistant"
            >
              ×
            </button>
          </div>
        </header>

        <div ref={threadRef} className="themed-scroll-y" style={threadStyle}>
          {messages.length === 0 && (
            <>
              <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.55 }}>
                {assistant.greeting}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 14 }}>
                {assistant.suggestions.map((s) => (
                  <button key={s} type="button" onClick={() => send(s)} style={suggestionStyle}>
                    {s}
                  </button>
                ))}
              </div>
            </>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: m.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div style={m.role === "user" ? userBubbleStyle : assistantBubbleStyle}>{m.text}</div>
            </div>
          ))}

          {thinking && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div style={{ ...assistantBubbleStyle, display: "flex", alignItems: "center", gap: 8 }}>
                <Spinner size={12} label="" />
                <span style={{ color: "var(--ink-mute)" }}>Thinking…</span>
              </div>
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
          style={composerStyle}
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends; Shift+Enter is a newline, as in the app's widget.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(draft);
              }
            }}
            rows={expanded ? 3 : 2}
            placeholder={`Ask ${assistant.name}…`}
            aria-label={`Ask ${assistant.name}`}
            className="form-textarea"
            style={{ minHeight: 0, fontSize: 13, background: "var(--surface)", resize: "none" }}
          />
          <button type="submit" className="btn-primary" disabled={!draft.trim() || thinking}>
            Send
          </button>
        </form>
      </section>
    </>
  );
}

function SparkleIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5 10.1 11.9 4.5 10l5.6-1.4z" />
    </svg>
  );
}

const fabStyle: CSSProperties = {
  position: "fixed",
  bottom: 20,
  zIndex: 1200,
  padding: "12px 18px",
  background: "var(--green-deep)",
  color: "var(--page)",
  border: "none",
  borderRadius: 999,
  boxShadow: "var(--shadow-md)",
  cursor: "pointer",
  whiteSpace: "nowrap",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  transition: "left 0.18s ease, right 0.18s ease, transform 0.18s ease",
};

const panelStyle: CSSProperties = {
  position: "fixed",
  bottom: 20,
  zIndex: 1250,
  width: "min(380px, calc(100vw - 32px))",
  height: "min(560px, calc(100vh - 96px))",
  display: "flex",
  flexDirection: "column",
  background: "var(--surface)",
  border: "1px solid var(--rule)",
  borderRadius: "var(--r-lg)",
  boxShadow: "var(--shadow-md)",
  overflow: "hidden",
};

const expandedPanelStyle: CSSProperties = {
  right: "auto",
  bottom: "auto",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "min(760px, calc(100vw - 48px))",
  height: "min(85vh, calc(100vh - 48px))",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  padding: "12px 14px",
  borderBottom: "1px solid var(--rule)",
  background: "var(--surface)",
  flexShrink: 0,
};

const headerBtnStyle: CSSProperties = {
  padding: "4px 9px",
  fontFamily: "var(--sans)",
  fontSize: 11,
  fontWeight: 500,
  color: "var(--ink-soft)",
  background: "transparent",
  border: "1px solid var(--rule)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const threadStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  padding: "14px",
  display: "flex",
  flexDirection: "column",
  gap: 10,
  background: "var(--page)",
};

const userBubbleStyle: CSSProperties = {
  maxWidth: "85%",
  padding: "8px 11px",
  borderRadius: "var(--r-lg)",
  borderBottomRightRadius: "var(--r-sm)",
  background: "var(--green-deep)",
  color: "var(--page)",
  fontSize: 13,
  lineHeight: 1.5,
};

const assistantBubbleStyle: CSSProperties = {
  maxWidth: "90%",
  padding: "8px 11px",
  borderRadius: "var(--r-lg)",
  borderBottomLeftRadius: "var(--r-sm)",
  background: "var(--surface-sunk)",
  border: "1px solid var(--rule)",
  color: "var(--ink)",
  fontSize: 13,
  lineHeight: 1.55,
};

const suggestionStyle: CSSProperties = {
  textAlign: "left",
  padding: "8px 11px",
  fontSize: 12.5,
  fontFamily: "var(--sans)",
  color: "var(--ink-soft)",
  background: "var(--surface)",
  border: "1px solid var(--rule)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
};

const composerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  gap: 8,
  padding: 10,
  borderTop: "1px solid var(--rule)",
  background: "var(--surface)",
  flexShrink: 0,
};
