"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { insertMentionAtCaret, syncMentionQuery } from "@/lib/mention-slug";
import { useTr } from "@/lib/client/language";

interface MentionOption {
  id: string;
  slug: string;
  display_name: string;
}

interface Props {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  minRows?: number;
  maxRows?: number;
  /** `field` = standalone control matching form-input / select height. `nested` = inside a bordered wrapper. */
  variant?: "field" | "nested";
  mentionPlacement?: "above" | "below";
  onSubmit?: () => void;
  fetchMentions: (query: string) => Promise<MentionOption[]>;
  mentionMenuLabel?: string;
  emptyResultsLabel?: string;
}

const LINE_HEIGHT_PX = 20;
const FIELD_PAD_Y = 10;
const FIELD_PAD_X = 12;

export type TextareaWithMentionsHandle = {
  triggerMention: () => void;
};

export const TextareaWithMentions = forwardRef<TextareaWithMentionsHandle, Props>(function TextareaWithMentions(
  {
    value,
    onChange,
    placeholder,
    minRows = 2,
    maxRows = 10,
    variant = "nested",
    mentionPlacement = "below",
    onSubmit,
    fetchMentions,
    mentionMenuLabel = "Mention",
    emptyResultsLabel = "No results",
  },
  ref,
) {
  const tr = useTr();
  const wrapRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  // After Escape dismisses the menu, the following keyup would otherwise
  // recompute the query from the unchanged caret and immediately reopen it.
  const suppressKeyUpRef = useRef(false);
  const [query, setQuery] = useState<string | null>(null);
  const [options, setOptions] = useState<MentionOption[]>([]);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [popoverPos, setPopoverPos] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
  } | null>(null);

  const isField = variant === "field";
  const padY = isField ? FIELD_PAD_Y * 2 : 0;
  const linePx = isField ? 18 : LINE_HEIGHT_PX;
  const minHeight = minRows * linePx + padY;
  const maxHeight = maxRows * linePx + padY;

  const resize = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    if (isField) {
      ta.style.overflow = "hidden";
      ta.style.height = "0px";
      const contentHeight = ta.scrollHeight;
      const next = Math.min(Math.max(contentHeight, minHeight), maxHeight);
      ta.style.height = `${next}px`;
      ta.style.overflowY = contentHeight > maxHeight ? "auto" : "hidden";
      return;
    }
    ta.style.height = "auto";
    const next = Math.min(Math.max(ta.scrollHeight, minHeight), maxHeight);
    ta.style.height = `${next}px`;
    ta.style.overflowY = ta.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [isField, minHeight, maxHeight]);

  useEffect(() => {
    resize();
  }, [value, resize]);

  useLayoutEffect(() => {
    resize();
  }, [resize]);

  const updatePopoverPosition = useCallback(() => {
    const ta = taRef.current;
    if (!ta || query === null) {
      setPopoverPos(null);
      return;
    }
    const r = ta.getBoundingClientRect();
    if (mentionPlacement === "above") {
      setPopoverPos({
        bottom: window.innerHeight - r.top + 6,
        left: r.left,
        width: Math.max(r.width, 240),
      });
    } else {
      setPopoverPos({
        top: r.bottom + 6,
        left: r.left,
        width: Math.max(r.width, 240),
      });
    }
  }, [query, mentionPlacement]);

  useLayoutEffect(() => {
    updatePopoverPosition();
    if (query === null) return;
    window.addEventListener("scroll", updatePopoverPosition, true);
    window.addEventListener("resize", updatePopoverPosition);
    return () => {
      window.removeEventListener("scroll", updatePopoverPosition, true);
      window.removeEventListener("resize", updatePopoverPosition);
    };
  }, [query, updatePopoverPosition, value]);

  useEffect(() => {
    if (query === null) {
      setOptions([]);
      setMentionLoading(false);
      return;
    }
    let cancelled = false;
    setMentionLoading(true);
    const t = setTimeout(async () => {
      try {
        const results = await fetchMentions(query);
        if (!cancelled) {
          setOptions(results);
          setActiveIdx(0);
        }
      } catch {
        if (!cancelled) setOptions([]);
      } finally {
        if (!cancelled) setMentionLoading(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, fetchMentions]);

  useImperativeHandle(ref, () => ({
    triggerMention() {
      const ta = taRef.current;
      if (!ta) return;
      const caret = ta.selectionStart ?? ta.value.length;
      const before = ta.value.slice(0, caret);
      const after = ta.value.slice(caret);
      const insert = before.length > 0 && !/\s$/.test(before) ? " @" : "@";
      const next = before + insert + after;
      const newCaret = (before + insert).length;
      onChange(next);
      setQuery("");
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(newCaret, newCaret);
        resize();
      });
    },
  }));

  function refreshQueryFromCaret() {
    if (suppressKeyUpRef.current) {
      suppressKeyUpRef.current = false;
      return;
    }
    const ta = taRef.current;
    if (!ta) return;
    setQuery(syncMentionQuery(ta.value, ta.selectionStart));
  }

  function onInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    onChange(next);
    setQuery(syncMentionQuery(next, e.target.selectionStart));
    requestAnimationFrame(resize);
  }

  function selectOption(opt: MentionOption) {
    const ta = taRef.current;
    if (!ta) return;
    const caret = ta.selectionStart;
    const { next, caret: newCaret } = insertMentionAtCaret(ta.value, caret, opt.display_name);
    onChange(next);
    setQuery(null);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(newCaret, newCaret);
      resize();
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const menuOpen = query !== null;

    if (menuOpen && options.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(options.length - 1, i + 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectOption(options[activeIdx]);
        return;
      }
    }

    if (menuOpen && e.key === "Escape") {
      e.preventDefault();
      setQuery(null);
      suppressKeyUpRef.current = true;   // don't let the keyup reopen it
      return;
    }

    if (e.key === "Enter" && !e.shiftKey && onSubmit && !menuOpen) {
      e.preventDefault();
      onSubmit();
    }
  }

  const popover =
    query !== null && popoverPos
      ? createPortal(
          <div
            style={{
              position: "fixed",
              ...(popoverPos.top !== undefined ? { top: popoverPos.top } : {}),
              ...(popoverPos.bottom !== undefined ? { bottom: popoverPos.bottom } : {}),
              left: popoverPos.left,
              width: popoverPos.width,
              zIndex: 2000,
              background: "var(--surface)",
              border: "1px solid var(--rule)",
              borderRadius: "var(--r-md)",
              boxShadow: "var(--shadow-md)",
              maxHeight: 240,
              overflowY: "auto",
              padding: "4px 0",
            }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <div
              style={{
                padding: "6px 12px",
                fontFamily: "var(--mono)",
                fontSize: 10,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--ink-mute)",
                borderBottom: "1px solid var(--rule)",
              }}
            >
              {mentionMenuLabel}
            </div>
            {mentionLoading ? (
              <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--ink-mute)" }}>{tr("Loading…")}</div>
            ) : options.length === 0 ? (
              <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--ink-mute)" }}>
                {emptyResultsLabel}
              </div>
            ) : (
              options.map((opt, i) => (
                <button
                  key={opt.id}
                  type="button"
                  onMouseEnter={() => setActiveIdx(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectOption(opt);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 12px",
                    background: i === activeIdx ? "var(--green-wash)" : "transparent",
                    border: "none",
                    color: "var(--ink)",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 500 }}>@{opt.display_name}</div>
                </button>
              ))
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={wrapRef} style={{ position: "relative", minWidth: 0, width: "100%" }}>
      <textarea
        ref={taRef}
        className="form-input"
        rows={isField ? undefined : minRows}
        value={value}
        onChange={onInput}
        onKeyDown={onKeyDown}
        onKeyUp={refreshQueryFromCaret}
        onClick={refreshQueryFromCaret}
        placeholder={placeholder}
        style={{
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
          resize: "none",
          overflowX: "hidden",
          lineHeight: isField ? `${linePx}px` : `${LINE_HEIGHT_PX}px`,
          fontSize: 13,
          fontFamily: "var(--sans)",
          wordBreak: "break-word",
          overflowWrap: "anywhere",
          margin: 0,
          verticalAlign: "top",
          ...(isField
            ? {
                padding: `${FIELD_PAD_Y}px ${FIELD_PAD_X}px`,
                border: "1px solid var(--rule-strong)",
                borderRadius: "var(--r-sm)",
                background: "var(--page)",
                color: "var(--ink)",
              }
            : {
                overflowY: "auto",
                minHeight,
                maxHeight,
                padding: "2px 0",
                border: "none",
                background: "transparent",
                boxShadow: "none",
              }),
        }}
      />
      {popover}
    </div>
  );
});
