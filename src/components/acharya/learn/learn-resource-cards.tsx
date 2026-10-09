"use client";

import type { CSSProperties } from "react";

export interface ResourceCard {
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
  kind: "guide" | "doc" | "reference";
}

export interface ToolCard {
  name: string;
  url?: string;
  description: string;
  kind: "tool" | "api" | "website";
}

export function ToolCardView({
  tool,
  onPreview,
}: {
  tool: ToolCard;
  onPreview?: (url: string, title: string) => void;
}) {
  const displayLink = tool.url
    ? (() => {
        try {
          return new URL(tool.url).hostname.replace(/^www\./, "");
        } catch {
          return tool.kind;
        }
      })()
    : tool.kind;

  const inner = (
    <article style={resourceCard}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={kindBadge}>{tool.kind}</span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-mute)", textTransform: "uppercase" }}>
          {displayLink}
        </span>
      </div>
      <p
        style={{
          fontFamily: "var(--serif)",
          fontSize: 16,
          fontWeight: 600,
          color: "var(--ink)",
          margin: "0 0 6px",
          lineHeight: 1.35,
        }}
      >
        {tool.name}
      </p>
      <p style={{ fontSize: 13, color: "var(--ink-mute)", margin: 0, lineHeight: 1.5, ...snippetClamp }}>
        {tool.description}
      </p>
      {tool.url ? (
        <span style={{ ...openLink, marginTop: 10 }}>{onPreview ? "Read here" : "Open ↗"}</span>
      ) : null}
    </article>
  );

  if (!tool.url) return inner;

  if (onPreview) {
    return (
      <button
        type="button"
        className="press"
        onClick={() => onPreview(tool.url!, tool.name)}
        style={{ ...cardButton, textDecoration: "none", color: "inherit" }}
      >
        {inner}
      </button>
    );
  }

  return (
    <a href={tool.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", color: "inherit" }}>
      {inner}
    </a>
  );
}

export function ResourceCardView({
  item,
  onPreview,
}: {
  item: ResourceCard;
  onPreview?: (item: ResourceCard) => void;
}) {
  const titleBlock = onPreview ? (
    <button
      type="button"
      className="press"
      onClick={() => onPreview(item)}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        fontFamily: "var(--serif)",
        fontSize: 16,
        fontWeight: 600,
        color: "var(--ink)",
        background: "transparent",
        border: "none",
        padding: 0,
        marginBottom: 6,
        lineHeight: 1.35,
        cursor: "pointer",
      }}
    >
      {item.title}
    </button>
  ) : (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "block",
        fontFamily: "var(--serif)",
        fontSize: 16,
        fontWeight: 600,
        color: "var(--ink)",
        textDecoration: "none",
        marginBottom: 6,
        lineHeight: 1.35,
      }}
    >
      {item.title}
    </a>
  );

  const openAction = onPreview ? (
    <button
      type="button"
      className="press"
      onClick={() => onPreview(item)}
      style={{ ...openLink, marginTop: 10, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
    >
      Read here
    </button>
  ) : (
    <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ ...openLink, marginTop: 10 }}>
      Open ↗
    </a>
  );

  return (
    <article style={resourceCard}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={kindBadge}>{item.kind}</span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-mute)", textTransform: "uppercase" }}>
          {item.displayLink}
        </span>
      </div>
      {titleBlock}
      <p style={{ fontSize: 13, color: "var(--ink-mute)", margin: 0, lineHeight: 1.5, ...snippetClamp }}>{item.snippet}</p>
      {openAction}
    </article>
  );
}

export const learnCardGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
  gap: 10,
};

const resourceCard: CSSProperties = {
  border: "1px solid var(--rule)",
  borderRadius: "var(--r-md)",
  background: "var(--surface)",
  padding: "14px",
  boxShadow: "0 4px 14px color-mix(in srgb, var(--ink) 5%, transparent)",
  height: "100%",
};

const cardButton: CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  background: "transparent",
  border: "none",
  padding: 0,
  cursor: "pointer",
};

const kindBadge: CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 9,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  padding: "3px 8px",
  borderRadius: 999,
  background: "var(--surface-sunk)",
  color: "var(--green-deep)",
  border: "1px solid var(--rule)",
};

const openLink: CSSProperties = {
  display: "inline-flex",
  fontSize: 12,
  color: "var(--green-deep)",
  fontWeight: 700,
  textDecoration: "none",
};

const snippetClamp: CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 3,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};
