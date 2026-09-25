"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { LearnFullscreenSheet } from "@/components/learn/LearnFullscreenSheet";
import { ArticleMarkdown } from "@/components/learn/ArticleMarkdown";
import { isPdfUrl } from "@/lib/link-kind";

interface ReadPayload {
  title: string;
  siteName: string;
  excerpt?: string;
  markdown: string;
  sourceUrl: string;
  cached: boolean;
}

interface Props {
  open: boolean;
  url: string | null;
  title: string;
  onClose: () => void;
}

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: ReadPayload }
  /** Not an article (PDF, spreadsheet, download) — offer the file itself. */
  | { status: "file" }
  | { status: "error"; message: string };

export function ArticleReaderSheet({ open, url, title, onClose }: Props) {
  const [state, setState] = useState<State>({ status: "idle" });

  useEffect(() => {
    if (!open || !url) {
      setState({ status: "idle" });
      return;
    }

    // Known file type — don't even ask the reader.
    if (isPdfUrl(url)) {
      setState({ status: "file" });
      return;
    }

    const controller = new AbortController();
    setState({ status: "loading" });

    void (async () => {
      try {
        const res = await fetch("/api/work/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
          signal: controller.signal,
        });
        const data = (await res.json().catch(() => null)) as
          | (Partial<ReadPayload> & { error?: string })
          | null;

        // The reader only speaks HTML. A PDF (or any other file) comes back as
        // `non_html` — that is not an error to show the karigar, it just means
        // "open the file, don't read it".
        if (!res.ok && (data as { code?: string } | null)?.code === "non_html") {
          setState({ status: "file" });
          return;
        }

        if (!res.ok) {
          throw new Error(data?.error ?? `Could not read article (${res.status})`);
        }

        if (!data?.markdown || typeof data.title !== "string") {
          throw new Error("Invalid reader response.");
        }

        setState({
          status: "ready",
          data: {
            title: data.title,
            siteName: typeof data.siteName === "string" ? data.siteName : "",
            excerpt: typeof data.excerpt === "string" ? data.excerpt : undefined,
            markdown: data.markdown,
            sourceUrl: typeof data.sourceUrl === "string" ? data.sourceUrl : url,
            cached: Boolean(data.cached),
          },
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Could not load article.",
        });
      }
    })();

    return () => controller.abort();
  }, [open, url]);

  function handleClose() {
    setState({ status: "idle" });
    onClose();
  }

  const sheetTitle = state.status === "ready" ? state.data.title : title;
  const subtitle =
    state.status === "ready"
      ? state.data.siteName
      : url
        ? (() => {
            try {
              return new URL(url).hostname.replace(/^www\./, "");
            } catch {
              return undefined;
            }
          })()
        : undefined;

  return (
    <LearnFullscreenSheet
      open={open && Boolean(url)}
      title={sheetTitle}
      subtitle={subtitle}
      onClose={handleClose}
      zIndex={70}
    >
      {state.status === "loading" ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 8px", gap: 12 }}>
          <div
            aria-label="Loading article"
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              border: "2px solid var(--green-deep)",
              borderTopColor: "transparent",
              animation: "reader-spin 0.7s linear infinite",
            }}
          />
          <p style={{ fontSize: 13, color: "var(--ink-mute)", margin: 0 }}>Loading article…</p>
          <style>{`@keyframes reader-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : null}

      {state.status === "ready" ? (
        <>
          {state.data.excerpt ? (
            <p
              style={{
                fontSize: 13,
                color: "var(--ink-mute)",
                margin: "0 0 14px",
                lineHeight: 1.5,
                fontStyle: "italic",
              }}
            >
              {state.data.excerpt}
            </p>
          ) : null}
          <ArticleMarkdown markdown={state.data.markdown} />
        </>
      ) : null}

      {state.status === "file" && url ? (
        <div style={{ padding: "8px 0 24px" }}>
          <p style={{ fontSize: 14, color: "var(--ink-mute)", margin: "0 0 14px", lineHeight: 1.5 }}>
            {isPdfUrl(url)
              ? "This is a PDF document."
              : "This link is a file, not a web page."}
          </p>
          <a href={url} target="_blank" rel="noopener noreferrer" className="press" style={openFileBtn}>
            <OpenIcon />
            {isPdfUrl(url) ? "Open PDF" : "Open file"}
          </a>
          {/* Desktop browsers render the document right here; on Android the
              frame stays blank, which is exactly why the button above is the
              primary action and not a fallback. */}
          <iframe
            src={url}
            title={title}
            style={{
              display: "block",
              width: "100%",
              height: "min(70dvh, 560px)",
              marginTop: 16,
              border: "1px solid var(--rule)",
              borderRadius: "var(--r-md)",
              background: "var(--surface)",
            }}
          />
        </div>
      ) : null}

      {state.status === "error" ? (
        <div style={{ padding: "24px 8px", textAlign: "center" }}>
          <p style={{ fontSize: 14, color: "var(--ink-mute)", margin: "0 0 16px", lineHeight: 1.5 }}>
            {state.message}
          </p>
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 13, fontWeight: 700, color: "var(--green-deep)" }}
            >
              Open in browser ↗
            </a>
          ) : null}
        </div>
      ) : null}

      {state.status !== "file" ? (
        <p style={{ fontSize: 11, color: "var(--ink-faint)", margin: "14px 0 0", textAlign: "center" }}>
          Tap × to close — reader mode shows text only (no images)
        </p>
      ) : null}
    </LearnFullscreenSheet>
  );
}

function OpenIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 4h6v6M20 4l-8.5 8.5" />
      <path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
    </svg>
  );
}

const openFileBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  minHeight: 44,
  padding: "0 18px",
  borderRadius: 999,
  background: "var(--green-deep)",
  color: "#f4efdf",
  fontFamily: "var(--sans)",
  fontSize: 14,
  fontWeight: 700,
  textDecoration: "none",
};
