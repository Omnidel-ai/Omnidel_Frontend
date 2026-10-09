"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { TableScroll } from "@/components/omnidel/table-scroll";
import {
  TableControls,
  Pagination,
  useTablePagination,
  useDebouncedSearch,
} from "@/components/omnidel/table-controls";
import { timeAgo } from "@/components/omnidel/dashboard/types";
import { fetchJson, FetchError } from "@/lib/client/fetch-json";
import type { AdminConversationRow, ConversationSource } from "@/lib/admin/conversation-merge";
import { Markdown } from "@/components/omnidel/markdown";
import { parseAssistantTurn, parseUserMessage } from "@/lib/client/mahacharya-parse";
import { useTr } from "@/lib/client/language";

/**
 * Human-readable text for a transcript turn: strip the mahacharya-* protocol
 * fences (act / need-fields / nav / trace JSON the model emits for the chat UI to
 * act on) and the user-attachment encoding, leaving just the prose. Without this
 * the admin transcript showed raw JSON blocks instead of the question/answer.
 */
function transcriptText(role: "user" | "assistant", content: string): string {
  if (!content) return "";
  return (role === "user" ? parseUserMessage(content).text : parseAssistantTurn(content).text).trim();
}

/**
 * Admin read of one person's chat transcripts.
 *
 * Voice conversations show up here as TEXT, because that is how they are stored:
 * the STT route and Gemini Live both transcribe before the chat route persists a
 * turn, so a spoken message is already durable text. The raw audio is not kept
 * anywhere, so there is nothing to play — a spoken turn is instead marked with a
 * VOICE tag, from log_acharya_messages.input_mode.
 *
 * A turn with no recorded mode renders as a dash, never as "typed": every message
 * written before 20260880000000_acharya_messages_input_mode has no mode, and
 * task-chat turns never carry one at all. Claiming those were typed would
 * mislabel the entire back catalogue.
 */

interface TranscriptMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  inputMode?: "voice" | "typed";
  model?: string;
  lang?: string;
  responseTimeMs?: number;
}

interface OpenConversation {
  id: string;
  source: ConversationSource;
  title: string;
}

const SOURCE_LABEL: Record<ConversationSource, string> = {
  assistant: "Assistant",
  task: "Task chat",
};

/**
 * What one paginated unit IS differs by source, so it cannot share a label.
 * An assistant thread stores one row per message; a task chat stores one row per
 * request/response PAIR, which the transcript expands into two messages. Calling
 * both "entries" would make the same number mean two different things.
 */
const UNIT_LABEL: Record<ConversationSource, { one: string; many: string }> = {
  assistant: { one: "message", many: "messages" },
  task: { one: "exchange", many: "exchanges" },
};

export function UserConversations({
  userId,
  days,
  initialOpen,
}: {
  userId: string;
  days: number;
  /**
   * Open a specific conversation as soon as this mounts, e.g. a flagged row on
   * the Chat Sentiment page linking straight into its transcript rather than
   * making the reviewer find it in the table first. `open`'s state used to be
   * purely internal — this is the seed, only ever "assistant" source since
   * that is the only surface Chat Sentiment scores. Ignored on a later
   * userId/days change (see the reset effect below), just like any other open
   * conversation.
   */
  initialOpen?: { id: string; title: string } | null;
}) {
  const tr = useTr();
  const { searchInput, setSearchInput, debouncedSearch } = useDebouncedSearch();

  const [rows, setRows] = useState<AdminConversationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const { page, setPage, perPage } = useTablePagination(20, total, `${debouncedSearch}|${days}`);
  const [open, setOpen] = useState<OpenConversation | null>(() =>
    initialOpen ? { id: initialOpen.id, source: "assistant", title: initialOpen.title } : null,
  );

  useEffect(() => {
    let live = true;
    setLoading(true);
    setErr(null);

    const qs = new URLSearchParams({
      days: String(days),
      page: String(page),
      per_page: String(perPage),
    });
    if (debouncedSearch) qs.set("q", debouncedSearch);

    fetchJson<{ items?: AdminConversationRow[]; total?: number; truncated?: boolean }>(
      `/api/admin/dashboard/users/${userId}/conversations?${qs.toString()}`,
    )
      .then((d) => {
        if (!live) return;
        setRows(d.items || []);
        setTotal(d.total || 0);
        setTruncated(!!d.truncated);
      })
      .catch((e) => {
        if (!live) return;
        setErr(e instanceof FetchError ? e.message : "Failed to load conversations");
      })
      .finally(() => {
        if (live) setLoading(false);
      });

    // Guards against a slow earlier page landing after a newer one.
    return () => {
      live = false;
    };
  }, [userId, days, page, perPage, debouncedSearch]);

  // Close the reader when the person or window changes — the open conversation
  // may not be in the new result set at all. Skipped on the very first run so
  // it does not immediately clear the initialOpen seed above; a genuinely
  // later change of userId/days still closes whatever is open, same as before.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setOpen(null);
  }, [userId, days]);

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <TableControls search={searchInput} onSearch={setSearchInput} />
      </div>

      {err && (
        <div
          role="alert"
          style={{
            fontSize: 13, color: "var(--crit)", background: "var(--crit-wash)",
            border: "1px solid var(--crit)", borderRadius: "var(--r-sm)",
            padding: "10px 14px", marginBottom: 12,
          }}
        >
          {err}
        </div>
      )}

      {truncated && (
        <div
          style={{
            fontSize: 12, color: "var(--ink-mute)", background: "var(--surface-sunk)",
            border: "1px solid var(--rule)", borderRadius: "var(--r-sm)",
            padding: "8px 12px", marginBottom: 12,
          }}
        >
          {tr("This person has more history than one scan covers. Showing the most recent conversations in the window — narrow the window to see older ones.")}
        </div>
      )}

      <div style={{ background: "var(--surface)", border: "1px solid var(--rule)", borderRadius: "var(--r-md)", overflow: "hidden", marginBottom: 12 }}>
        <TableScroll minWidth={720}>
          <div className="table-header" style={{ gridTemplateColumns: GRID }}>
            <span>{tr("Conversation")}</span>
            <span>{tr("Source")}</span>
            <span style={{ textAlign: "right" }}>{tr("Messages")}</span>
            <span style={{ textAlign: "right" }}>{tr("Voice")}</span>
            <span>{tr("Last activity")}</span>
          </div>

          {loading && rows.length === 0 && (
            <div style={{ padding: 16, fontSize: 13, color: "var(--ink-mute)" }}>{tr("Loading conversations...")}</div>
          )}

          {!loading && rows.length === 0 && !err && (
            <div style={{ padding: 16, fontSize: 13, color: "var(--ink-faint)" }}>
              {tr("No conversations in the last")} {days} days
            </div>
          )}

          {rows.map((row) => {
            const isOpen = open?.id === row.id && open?.source === row.source;
            return (
              <div
                key={`${row.source}:${row.id}`}
                className="table-row"
                role="button"
                tabIndex={0}
                aria-expanded={isOpen}
                onClick={() =>
                  setOpen(isOpen ? null : { id: row.id, source: row.source, title: row.title })
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setOpen(isOpen ? null : { id: row.id, source: row.source, title: row.title });
                  }
                }}
                style={{
                  gridTemplateColumns: GRID,
                  cursor: "pointer",
                  background: isOpen ? "var(--surface-sunk)" : undefined,
                }}
              >
                <span style={{ fontWeight: 500, color: "var(--green-deep)" }}>{row.title}</span>
                <span>
                  <span
                    className="tag"
                    style={
                      row.source === "assistant"
                        ? { background: "var(--green-wash)", color: "var(--green-deep)" }
                        : { background: "var(--ochre-wash)", color: "var(--ochre)" }
                    }
                  >
                    {SOURCE_LABEL[row.source]}
                  </span>
                </span>
                <span style={{ fontFamily: "var(--mono)", fontSize: 12, textAlign: "right" }}>
                  {row.messageCount}
                </span>
                <span style={{ fontFamily: "var(--mono)", fontSize: 12, textAlign: "right", color: row.voiceCount > 0 ? "var(--ink)" : "var(--ink-faint)" }}>
                  {/* Task chat carries no voice flag, so a 0 there means "not
                      recorded" rather than "none happened" — show a dash. */}
                  {row.source === "task" ? "—" : row.voiceCount}
                </span>
                <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-mute)" }}>
                  {timeAgo(row.lastActivity)}
                </span>
              </div>
            );
          })}
        </TableScroll>
      </div>

      {total > perPage && (
        <Pagination page={page} total={total} perPage={perPage} onChange={setPage} label="conversations" />
      )}

      {open && (
        <Transcript
          userId={userId}
          days={days}
          conversation={open}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

const GRID = "minmax(180px, 3fr) 110px 90px 70px 110px";

/**
 * One conversation, oldest-first.
 *
 * Follows the read-only viewer already proven at
 * omnipulse/dashboards/chats/[taskId]: stacked cards with a coloured left border
 * rather than chat bubbles. For reading a transcript top to bottom that beats a
 * bubble layout — attribution stays in a fixed place down the page.
 */
function Transcript({
  userId,
  days,
  conversation,
  onClose,
}: {
  userId: string;
  days: number;
  conversation: OpenConversation;
  onClose: () => void;
}) {
  const tr = useTr();
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const { page, setPage, perPage } = useTablePagination(
    30,
    total,
    `${conversation.source}:${conversation.id}`,
  );
  const unit = UNIT_LABEL[conversation.source];

  useEffect(() => {
    let live = true;
    setLoading(true);
    setErr(null);

    const qs = new URLSearchParams({
      source: conversation.source,
      days: String(days),
      page: String(page),
      per_page: String(perPage),
    });

    fetchJson<{ items?: TranscriptMessage[]; total?: number }>(
      `/api/admin/dashboard/users/${userId}/conversations/${conversation.id}?${qs.toString()}`,
    )
      .then((d) => {
        if (!live) return;
        setMessages(d.items || []);
        setTotal(d.total || 0);
      })
      .catch((e) => {
        if (!live) return;
        setErr(e instanceof FetchError ? e.message : "Failed to load the transcript");
      })
      .finally(() => {
        if (live) setLoading(false);
      });

    return () => {
      live = false;
    };
  }, [userId, days, conversation.id, conversation.source, page, perPage]);

  return (
    <div style={{ marginTop: 20 }}>
      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "baseline",
          gap: 12, flexWrap: "wrap", marginBottom: 12,
          paddingBottom: 8, borderBottom: "1px solid var(--rule)",
        }}
      >
        <div>
          <div style={{ fontFamily: "var(--serif)", fontSize: 18 }}>{conversation.title}</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-mute)", marginTop: 2 }}>
            {SOURCE_LABEL[conversation.source]} &middot; {total}{" "}
            {total === 1 ? unit.one : unit.many}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: "transparent", border: "1px solid var(--rule)",
            borderRadius: "var(--r-sm)", padding: "6px 12px", cursor: "pointer",
            fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.06em",
            textTransform: "uppercase", color: "var(--ink-mute)",
          }}
        >
          {tr("Close transcript")}
        </button>
      </div>

      {err && (
        <div
          role="alert"
          style={{
            fontSize: 13, color: "var(--crit)", background: "var(--crit-wash)",
            border: "1px solid var(--crit)", borderRadius: "var(--r-sm)",
            padding: "10px 14px", marginBottom: 12,
          }}
        >
          {err}
        </div>
      )}

      {loading && messages.length === 0 && (
        <div style={{ fontSize: 13, color: "var(--ink-mute)", padding: 12 }}>{tr("Loading transcript...")}</div>
      )}

      {!loading && messages.length === 0 && !err && (
        <div style={{ fontSize: 13, color: "var(--ink-faint)", padding: 12 }}>
          {tr("Nothing recorded for this conversation in the last")} {days} days
        </div>
      )}

      {messages.map((m) => {
        const isUser = m.role === "user";
        const accent = isUser ? "var(--ochre)" : "var(--green-deep)";
        return (
          <div
            key={m.id}
            style={{
              background: "var(--surface)", border: "1px solid var(--rule)",
              borderLeft: `3px solid ${accent}`, borderRadius: "var(--r-md)",
              padding: "12px 16px", marginBottom: 8,
            }}
          >
            <div
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                gap: 8, flexWrap: "wrap", marginBottom: 6,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.1em",
                  textTransform: "uppercase", color: accent, fontWeight: 600,
                }}
              >
                {isUser ? tr("User") : tr("Acharya")}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {isUser && <InputModeTag mode={m.inputMode} />}
                {m.lang && (
                  <span className="tag" style={{ background: "var(--surface-sunk)", color: "var(--ink-mute)" }}>
                    {m.lang.toUpperCase()}
                  </span>
                )}
                <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-faint)" }}>
                  {new Date(m.createdAt).toLocaleString("en-IN")}
                </span>
              </span>
            </div>

            {(() => {
              const text = transcriptText(m.role, m.content);
              return text ? (
                <div style={{ fontSize: 14, lineHeight: 1.6 }}>
                  <Markdown source={text} />
                </div>
              ) : (
                <p style={{ fontSize: 13, fontStyle: "italic", color: "var(--ink-faint)", margin: 0 }}>
                  {isUser ? tr("(no text)") : tr("(action only)")}
                </p>
              );
            })()}

            {(m.model || m.responseTimeMs != null) && (
              <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-faint)", marginTop: 6 }}>
                {[
                  m.responseTimeMs != null ? `${(m.responseTimeMs / 1000).toFixed(2)}s` : null,
                  m.model,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            )}
          </div>
        );
      })}

      {total > perPage && (
        <Pagination page={page} total={total} perPage={perPage} onChange={setPage} label={unit.many} />
      )}
    </div>
  );
}

/**
 * VOICE / TYPED, or a dash when the mode was never recorded.
 *
 * The dash is load-bearing. Every turn written before
 * 20260880000000_acharya_messages_input_mode has no mode, and rendering those as
 * "typed" would assert something we do not know about the whole existing history.
 */
function InputModeTag({ mode }: { mode?: "voice" | "typed" }) {
  const tr = useTr();
  if (mode === "voice") {
    return (
      <span className="tag" style={{ background: "var(--ochre-wash)", color: "var(--ochre)" }} title={tr("Spoken — transcribed to text")}>
        {tr("Voice")}
      </span>
    );
  }
  if (mode === "typed") {
    return (
      <span className="tag" style={{ background: "var(--surface-sunk)", color: "var(--ink-mute)" }}>
        {tr("Typed")}
      </span>
    );
  }
  return (
    <span
      className="tag"
      style={{ background: "var(--surface-sunk)", color: "var(--ink-faint)" }}
      title={tr("Not recorded — this turn predates voice/typed tracking")}
    >
      &mdash;
    </span>
  );
}
