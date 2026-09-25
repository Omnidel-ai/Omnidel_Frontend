"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { displayTaskTitle, resolveTaskText } from "@/lib/task-text";
import type { Lang } from "@/lib/store";
import { useStrings } from "@/lib/i18n/useLang";
import { LearnPanelShell, LearnSectionHeader } from "@/components/learn/LearnPanelShell";
import { LearnBrowseSheet } from "@/components/learn/LearnBrowseSheet";
import { ArticleReaderSheet } from "@/components/learn/ArticleReaderSheet";
import { isPdfUrl } from "@/lib/link-kind";
import {
  learnCardGrid,
  ResourceCardView,
  ToolCardView,
  type ResourceCard,
  type ToolCard,
} from "@/components/learn/learn-resource-cards";

interface TaskShape {
  id: string;
  title: string;
  description: string | null;
}

interface SearchSuggestion {
  label: string;
  query: string;
}

interface SearchPayload {
  primaryQuery: string;
  googleSearchQuery?: string;
  googleSearchUrl?: string;
  suggestions: SearchSuggestion[];
  briefing: string;
  guides: ResourceCard[];
  tools: ToolCard[];
  references: ResourceCard[];
  focusIntent?: string;
}

type State =
  | { status: "idle" }
  | { status: "loading"; previous?: SearchPayload; activeQuery?: string }
  | { status: "ready"; data: SearchPayload; activeQuery: string }
  | { status: "error"; message: string; activeQuery: string };

interface Props {
  task: TaskShape;
  workspaceSlug: string;
  lang: Lang;
}

export function TaskLearnWebView({ task, workspaceSlug, lang }: Props) {
  const taskTitle = displayTaskTitle(task.title, lang);
  const s = useStrings();
  const [state, setState] = useState<State>({ status: "idle" });
  const [activeChip, setActiveChip] = useState("Overview");
  const [browseOpen, setBrowseOpen] = useState(false);
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null);
  // Monotonic id of the most recent search. Responses that arrive out of order
  // (e.g. the auto-fired Overview request resolving after a chip tap) must be
  // discarded so the displayed content always matches the latest selected chip.
  const requestIdRef = useRef(0);

  const openPreview = useCallback((url: string, title: string) => {
    // PDFs are not articles. `/api/work/read` can only extract HTML, so routing
    // a PDF into the reader sheet produced "Unsupported Content-Type" and the
    // document never opened. Hand it to the browser's own viewer instead —
    // this runs inside the tap, so it is a real user gesture and not a popup.
    if (isPdfUrl(url)) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    setPreview({ url, title });
  }, []);

  const runSearch = useCallback(
    async (focus?: string) => {
      const requestId = ++requestIdRef.current;
      if (focus) setActiveChip(focus);
      setState((prev) => ({
        status: "loading",
        previous: prev.status === "ready" ? prev.data : prev.status === "loading" ? prev.previous : undefined,
        activeQuery: prev.status === "ready" || prev.status === "error" ? prev.activeQuery : undefined,
      }));

      try {
        const res = await fetch("/api/work/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspace: workspaceSlug,
            taskId: task.id,
            lang,
            focus: focus || undefined,
          }),
        });
        const data = (await res.json().catch(() => null)) as
          | (Partial<SearchPayload> & { error?: string })
          | null;

        // A newer search was started while this one was in flight — drop this
        // stale response so it cannot overwrite the latest chip's content.
        if (requestId !== requestIdRef.current) return;

        if (!res.ok && !data?.primaryQuery) {
          throw new Error(data?.error ?? `Search API error: ${res.status}`);
        }

        if (!data || typeof data.primaryQuery !== "string") {
          throw new Error("Invalid search response.");
        }

        const payload: SearchPayload = {
          primaryQuery: data.primaryQuery,
          googleSearchQuery:
            typeof data.googleSearchQuery === "string" ? data.googleSearchQuery : data.primaryQuery,
          googleSearchUrl: typeof data.googleSearchUrl === "string" ? data.googleSearchUrl : undefined,
          suggestions: Array.isArray(data.suggestions) ? (data.suggestions as SearchSuggestion[]) : [],
          briefing: typeof data.briefing === "string" ? data.briefing : "",
          guides: Array.isArray(data.guides) ? (data.guides as ResourceCard[]) : [],
          tools: Array.isArray(data.tools) ? (data.tools as ToolCard[]) : [],
          references: Array.isArray(data.references) ? (data.references as ResourceCard[]) : [],
          focusIntent: typeof data.focusIntent === "string" ? data.focusIntent : undefined,
        };

        setState({
          status: "ready",
          data: payload,
          activeQuery: data.primaryQuery,
        });
        if (!focus && payload.suggestions[0]?.label) {
          setActiveChip(payload.suggestions[0].label);
        }
      } catch (err) {
        // Ignore errors from superseded requests too.
        if (requestId !== requestIdRef.current) return;
        setState((prev) => ({
          status: "error",
          message: err instanceof Error ? err.message : "Could not load web results.",
          activeQuery: prev.status === "ready" || prev.status === "error" ? prev.activeQuery : "",
        }));
      }
    },
    [workspaceSlug, task.id, lang]
  );

  const pickChip = useCallback(
    (chip: SearchSuggestion) => {
      void runSearch(chip.label);
    },
    [runSearch]
  );

  useEffect(() => {
    setActiveChip("Overview");
    void runSearch();
  }, [task.id, runSearch]);

  if (state.status === "idle") {
    return (
      <CenteredState>
        <Spinner label={s.findingReferences} />
      </CenteredState>
    );
  }

  if (state.status === "loading" && !state.previous) {
    return (
      <CenteredState>
        <Spinner label={s.findingReferences} />
      </CenteredState>
    );
  }

  if (state.status === "error") {
    return (
      <CenteredState>
        <p style={{ fontSize: 13, color: "var(--ink-mute)", margin: 0, maxWidth: 320, textAlign: "center" }}>
          {state.message}
        </p>
        <button type="button" onClick={() => void runSearch()} style={primaryBtn}>
          Try again
        </button>
      </CenteredState>
    );
  }

  const data = state.status === "loading" ? state.previous! : state.data;
  const activeQuery = (state.status === "loading" ? state.activeQuery : state.activeQuery)?.trim() ?? data.primaryQuery;
  const googleSearchUrl = data.googleSearchUrl ?? `https://www.google.com/search?q=${encodeURIComponent(activeQuery)}`;
  const isRefreshing = state.status === "loading";
  const focusIntent = data.focusIntent ?? "overview";
  const chips: SearchSuggestion[] =
    data.suggestions.length > 0
      ? data.suggestions
      : [{ label: "Overview", query: data.primaryQuery }];

  return (
    <>
    <LearnPanelShell card>
      {isRefreshing ? (
        <p style={{ fontSize: 12, color: "var(--green-deep)", textAlign: "center", margin: "0 0 10px", fontWeight: 700 }}>
          Updating {activeChip}…
        </p>
      ) : null}
      <LearnSectionHeader label="Lesson" subtitle="What to read and use before you start" />
      <p
        style={{
          fontFamily: "var(--serif)",
          fontSize: 15,
          lineHeight: 1.65,
          color: "var(--ink)",
          margin: "0 0 16px",
        }}
      >
        {data.briefing || `Resources for: ${taskTitle}`}
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14, justifyContent: "center" }}>
        {chips.map((chip, i) => {
          const isActive = chip.label === activeChip;
          return (
            <button
              key={`${chip.label}-${i}`}
              type="button"
              disabled={isRefreshing}
              onClick={() => pickChip(chip)}
              style={{
                minHeight: 36,
                padding: "8px 14px",
                borderRadius: 999,
                border: `1px solid ${isActive ? "var(--green-deep)" : "var(--rule)"}`,
                background: isActive ? "var(--green-deep)" : "var(--surface)",
                color: isActive ? "#f4efdf" : "var(--ink)",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className="press"
        onClick={() => setBrowseOpen(true)}
        style={{ ...googleSearchCard, width: "100%", cursor: "pointer", textAlign: "left" }}
      >
        <div style={googleSearchIconWrap}>
          <SearchIcon />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: "0 0 4px" }}>
            Related guides & docs
          </p>
          <p style={{ fontSize: 12, color: "var(--ink-mute)", margin: "0 0 8px", lineHeight: 1.4 }}>
            Searching: <span style={{ fontWeight: 600, color: "var(--green-deep)" }}>{activeChip}</span>
            {" · "}
            <span style={{ fontStyle: "italic" }}>“{activeQuery}”</span>
          </p>
          <span style={openCta}>Browse resources</span>
        </div>
      </button>

      {focusIntent === "tools" && data.tools.length > 0 ? (
        <section style={{ marginTop: 20 }}>
          <LearnSectionHeader label="Tools & APIs" subtitle="What you may need for this task" />
          <div style={learnCardGrid}>
            {data.tools.map((tool, i) => (
              <ToolCardView key={`${tool.name}-${i}`} tool={tool} onPreview={openPreview} />
            ))}
          </div>
        </section>
      ) : null}

      {focusIntent !== "tools" && data.guides.length > 0 ? (
        <section style={{ marginTop: 20 }}>
          <LearnSectionHeader label="Suggested picks" subtitle="Web guides for this task" />
          <div style={learnCardGrid}>
            {data.guides.map((item, i) => (
              <ResourceCardView
                key={`${item.link}-${i}`}
                item={item}
                onPreview={(card) => openPreview(card.link, card.title)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {focusIntent !== "tools" && data.tools.length > 0 ? (
        <section style={{ marginTop: 20 }}>
          <LearnSectionHeader label="Tools & APIs" subtitle="Quick links" />
          <div style={learnCardGrid}>
            {data.tools.slice(0, 3).map((tool, i) => (
              <ToolCardView key={`${tool.name}-${i}`} tool={tool} onPreview={openPreview} />
            ))}
          </div>
        </section>
      ) : null}

      {data.references.length > 0 ? (
        <section style={{ marginTop: 20 }}>
          <LearnSectionHeader label="More references" subtitle="Extra reading and examples" />
          <div style={learnCardGrid}>
            {data.references.map((item, i) => (
              <ResourceCardView
                key={`${item.link}-${i}`}
                item={item}
                onPreview={(card) => openPreview(card.link, card.title)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {data.guides.length === 0 && data.references.length === 0 && data.tools.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--ink-mute)", marginTop: 16 }}>
          No curated picks for this focus. Browse resources above or try another chip.
        </p>
      ) : null}
    </LearnPanelShell>

    <LearnBrowseSheet
      open={browseOpen}
      onClose={() => setBrowseOpen(false)}
      activeChip={activeChip}
      activeQuery={activeQuery}
      googleSearchUrl={googleSearchUrl}
      onPreviewLink={openPreview}
      data={{
        briefing: data.briefing,
        guides: data.guides,
        tools: data.tools,
        references: data.references,
      }}
    />

    <ArticleReaderSheet
      open={Boolean(preview)}
      url={preview?.url ?? null}
      title={preview?.title ?? "Resource"}
      onClose={() => setPreview(null)}
    />
    </>
  );
}

function SearchIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="var(--green-deep)" strokeWidth="2" />
      <path d="M20 20L16.5 16.5" stroke="var(--green-deep)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CenteredState({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 16px", gap: 14 }}>
      {children}
    </div>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <>
      <div
        aria-label={label}
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          border: "2px solid var(--green-deep)",
          borderTopColor: "transparent",
          animation: "web-spin 0.7s linear infinite",
        }}
      />
      <p style={{ fontSize: 13, color: "var(--ink-mute)", margin: 0 }}>{label}…</p>
      <style>{`@keyframes web-spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

const primaryBtn: CSSProperties = {
  minHeight: 44,
  padding: "10px 24px",
  borderRadius: "var(--r-md)",
  background: "var(--green-deep)",
  color: "#f4efdf",
  fontWeight: 700,
  border: "none",
  cursor: "pointer",
};

const googleSearchCard: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: "16px 18px",
  marginBottom: 4,
  border: "2px solid var(--green-deep)",
  borderRadius: "var(--r-md)",
  background: "color-mix(in srgb, var(--green-deep) 6%, var(--surface))",
  boxShadow: "0 6px 20px color-mix(in srgb, var(--green-deep) 12%, transparent)",
};

const googleSearchIconWrap: CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: "var(--r-md)",
  background: "var(--surface-sunk)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const openCta: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "var(--green-deep)",
};
