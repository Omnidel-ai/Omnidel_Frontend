"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Markdown } from "@/components/omnidel/markdown";
import type { ReleaseNote, WhatsNewApp, WhatsNewChangeType, WhatsNewModule } from "@/lib/whats-new-schema";
import {
  WHATS_NEW_APP_LABELS,
  WHATS_NEW_CHANGE_TYPE_LABELS,
  WHATS_NEW_MODULE_LABELS,
} from "@/lib/whats-new-schema";
import { useTr } from "@/lib/client/language";

/**
 * Description: show full text when short; clamp + Show more when long.
 */
function ExpandableDescription({ text }: { text: string }) {
  const tr = useTr();
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [text, expanded]);

  useEffect(() => {
    function remeasure() {
      const el = ref.current;
      if (!el || expanded) return;
      setOverflows(el.scrollHeight > el.clientHeight + 1);
    }
    window.addEventListener("resize", remeasure);
    return () => window.removeEventListener("resize", remeasure);
  }, [expanded]);

  return (
    <div style={{ marginTop: 10 }}>
      <p
        ref={ref}
        style={{
          ...descStyle,
          margin: 0,
          ...(expanded
            ? null
            : {
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical" as const,
                overflow: "hidden",
              }),
        }}
      >
        {text}
      </p>
      {(overflows || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          style={viewAllBtn}
        >
          {expanded ? tr("Show less") : tr("Show more")}
        </button>
      )}
    </div>
  );
}

function TagRow({ note }: { note: ReleaseNote }) {
  const tr = useTr();
  const tags = useMemo(() => {
    const out: { key: string; label: string; kind: "app" | "type" | "module" }[] = [];
    const shownLabels = new Set<string>();

    for (const app of note.apps) {
      const label = WHATS_NEW_APP_LABELS[app as WhatsNewApp] ?? app;
      out.push({ key: `app:${app}`, label, kind: "app" });
      shownLabels.add(label.toLowerCase());
    }

    const types = new Set(note.items.map((it) => it.change_type));
    for (const t of WHATS_NEW_CHANGE_TYPE_ORDER) {
      if (!types.has(t)) continue;
      const label = WHATS_NEW_CHANGE_TYPE_LABELS[t];
      out.push({ key: `type:${t}`, label, kind: "type" });
      shownLabels.add(label.toLowerCase());
    }

    // Skip module chips that repeat an app/type label (e.g. module `acharya`
    // is also labeled "Karmyog", same as the app chip).
    const modules = new Set(note.items.map((it) => it.module));
    for (const m of modules) {
      const label = WHATS_NEW_MODULE_LABELS[m as WhatsNewModule] ?? m;
      if (shownLabels.has(label.toLowerCase())) continue;
      out.push({ key: `mod:${m}`, label, kind: "module" });
      shownLabels.add(label.toLowerCase());
    }
    return out;
  }, [note]);

  if (tags.length === 0) return null;

  return (
    <div style={tagRowStyle} aria-label={tr("Tags")}>
      {tags.map((t) => (
        <span key={t.key} style={tagStyle[t.kind]}>
          {t.label}
        </span>
      ))}
    </div>
  );
}

const WHATS_NEW_CHANGE_TYPE_ORDER: WhatsNewChangeType[] = ["new", "improved", "fixed"];

/**
 * One release card under a date section — plain language only (ChatGPT-style).
 */
export function EntryCard({ note, isLast: _isLast }: { note: ReleaseNote; isLast?: boolean }) {
  const description = (note.summary ?? "").trim();

  return (
    <article style={cardStyle}>
      <TagRow note={note} />
      <h3 style={titleStyle}>{note.title}</h3>

      {description ? <ExpandableDescription text={description} /> : null}

      {note.items.length > 0 ? (
        <ul style={listStyle}>
          {note.items.map((it) => (
            <li key={it.id} style={itemRowStyle}>
              <span style={bullet} aria-hidden="true" />
              <span style={itemTextStyle}>{it.text}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {note.body ? (
        <div style={bodyStyle}>
          <Markdown source={note.body} />
        </div>
      ) : null}
    </article>
  );
}

const cardStyle: CSSProperties = {
  background: "transparent",
  maxWidth: 880,
};

const tagRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  marginBottom: 10,
};

const tagBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  fontFamily: "var(--sans)",
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: "0.01em",
  lineHeight: 1.2,
  padding: "3px 8px",
  borderRadius: "var(--r-sm)",
  border: "1px solid transparent",
};

const tagStyle: Record<"app" | "type" | "module", CSSProperties> = {
  app: {
    ...tagBase,
    background: "var(--green-wash)",
    color: "var(--green-deep)",
    borderColor: "var(--green-soft)",
  },
  type: {
    ...tagBase,
    background: "var(--amber-wash)",
    color: "var(--amber)",
    borderColor: "var(--amber-wash)",
  },
  module: {
    ...tagBase,
    background: "var(--surface-sunk)",
    color: "var(--ink-soft)",
    borderColor: "var(--rule)",
  },
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--serif)",
  fontSize: 22,
  fontWeight: 600,
  letterSpacing: "-0.015em",
  color: "var(--ink)",
  lineHeight: 1.3,
};

const descStyle: CSSProperties = {
  fontSize: 15,
  lineHeight: 1.6,
  color: "var(--ink-soft)",
  fontFamily: "var(--sans)",
};

const viewAllBtn: CSSProperties = {
  display: "inline-block",
  marginTop: 8,
  padding: 0,
  background: "none",
  border: "none",
  fontFamily: "var(--sans)",
  fontSize: 13,
  fontWeight: 500,
  color: "var(--green-deep)",
  cursor: "pointer",
};

const listStyle: CSSProperties = {
  listStyle: "none",
  margin: "18px 0 0",
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const itemRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
};

const bullet: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: "50%",
  background: "var(--green-deep)",
  marginTop: 8,
  flexShrink: 0,
  opacity: 0.85,
};

const itemTextStyle: CSSProperties = {
  fontSize: 15,
  lineHeight: 1.55,
  color: "var(--ink)",
  fontFamily: "var(--sans)",
  minWidth: 0,
};

const bodyStyle: CSSProperties = {
  marginTop: 16,
  paddingTop: 14,
  borderTop: "1px solid var(--rule)",
  fontSize: 14,
  color: "var(--ink-soft)",
};
