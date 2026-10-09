"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { usePermissions } from "@/lib/client/permissions";
import { CustomSelect } from "@/components/omnidel/custom-select";
import { DatePicker } from "@/components/omnidel/date-picker";
import { MemberMultiSelect, type MemberOption } from "@/components/omnidel/member-multi-select";
import { TableScroll } from "@/components/omnidel/table-scroll";
import { StatCard, cardStyle, cardHeaderStyle } from "@/components/omnidel/dashboard/primitives";
import { Markdown } from "@/components/omnidel/markdown";
import { fetchJson, FetchError } from "@/lib/client/fetch-json";
import { istToday, istDateDaysAgo } from "@/lib/ist";
import {
  STATUS_LABELS,
  NOTE_TYPE_LABELS,
  type ReportEntityType,
  type AdminReport,
  type ReportTaskRow,
  type ReportConversationRow,
  type TaskReportDetail,
  type ReportPickerOptions,
} from "@/components/omnidel/admin/reports-types";
import { useTr } from "@/lib/client/language";

/**
 * Admin ▸ Reports — an activity report for a person, a set of people, or a
 * whole team, over an explicit date range. See docs (this file's own header)
 * for why this is NOT built on the dashboard's `resolveWindow`/"last N days"
 * machinery: a report's period is two calendar dates someone picks, not a
 * rolling window — the backend (admin-reports.ts) takes real startDate/endDate
 * for the same reason.
 *
 * Task and conversation detail are fetched LAZILY per row on expand, not
 * inlined into the bulk report — a report can list hundreds of tasks and
 * dozens of conversations; nobody expands all of them, and inlining every
 * task's history + every conversation's full transcript up front would make
 * the initial generate a very large, very slow request.
 */

const ENTITY_LABELS: Record<ReportEntityType, string> = {
  user: "User",
  users: "Multiple Users",
  team: "Team",
};

type QuickRange = "7d" | "30d" | "month" | "custom";

function quickRangeDates(range: QuickRange): { start: string; end: string } {
  const today = istToday();
  if (range === "7d") return { start: istDateDaysAgo(6), end: today };
  if (range === "30d") return { start: istDateDaysAgo(29), end: today };
  if (range === "month") {
    const [y, m] = today.split("-");
    return { start: `${y}-${m}-01`, end: today };
  }
  return { start: today, end: today };
}

export function ReportsClient() {
  const tr = useTr();
  const { isAdmin } = usePermissions();

  const [entityType, setEntityType] = useState<ReportEntityType>("user");
  const [userIds, setUserIds] = useState<string[]>([]);
  const [teamId, setTeamId] = useState<string>("");
  const [quickRange, setQuickRange] = useState<QuickRange>("7d");
  const [startDate, setStartDate] = useState<string>(() => quickRangeDates("7d").start);
  const [endDate, setEndDate] = useState<string>(() => quickRangeDates("7d").end);

  const [options, setOptions] = useState<ReportPickerOptions | null>(null);
  const [optionsErr, setOptionsErr] = useState<string | null>(null);

  const [report, setReport] = useState<AdminReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    fetchJson<ReportPickerOptions>("/api/admin/reports/options")
      .then(setOptions)
      .catch((e) => setOptionsErr(e instanceof FetchError ? e.message : "Failed to load users/teams."));
  }, [isAdmin]);

  const memberOptions: MemberOption[] = useMemo(
    () =>
      (options?.users ?? []).map((u) => ({
        id: u.id,
        name: u.name,
        primary_workspace_id: u.primary_workspace_id,
        primary_workspace_name: u.primary_workspace_name,
      })),
    [options],
  );
  const teamOptions = useMemo(
    () => (options?.teams ?? []).map((t) => ({ value: t.id, label: t.name })),
    [options],
  );

  const applyQuickRange = useCallback((range: QuickRange) => {
    setQuickRange(range);
    if (range === "custom") return;
    const { start, end } = quickRangeDates(range);
    setStartDate(start);
    setEndDate(end);
  }, []);

  const canGenerate =
    entityType === "team" ? !!teamId : userIds.length > 0;

  const generate = useCallback(async () => {
    if (!canGenerate) return;
    setLoading(true);
    setErr(null);
    try {
      const entityIds = entityType === "team" ? [teamId] : userIds;
      const qs = new URLSearchParams({
        entityType,
        entityIds: entityIds.join(","),
        startDate,
        endDate,
      });
      const data = await fetchJson<AdminReport>(`/api/admin/reports?${qs.toString()}`);
      setReport(data);
    } catch (e) {
      setErr(e instanceof FetchError ? e.message : "Failed to generate report.");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [canGenerate, entityType, teamId, userIds, startDate, endDate]);

  if (!isAdmin) {
    return (
      <div style={{ maxWidth: 480 }}>
        <h2 style={{ fontFamily: "var(--serif)", marginBottom: 8 }}>{tr("Reports")}</h2>
        <p style={{ color: "var(--ink-mute)", fontSize: 14, lineHeight: 1.5 }}>
          {tr("Only founder or admin can generate activity reports.")}
        </p>
      </div>
    );
  }

  return (
    <div>
      <style>{PRINT_CSS}</style>

      <div className="reports-no-print" style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: "var(--serif)", margin: "0 0 16px" }}>
          <span style={{ color: "var(--ink-mute)" }}>{tr("Admin")}</span> {tr("/ Reports")}
        </h2>

        {optionsErr && (
          <div style={{ ...alertStyle, marginBottom: 12 }}>{optionsErr}</div>
        )}

        <div style={cardStyle}>
          <div style={cardHeaderStyle}>{tr("GENERATE REPORT FOR")}</div>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              {(["user", "users", "team"] as ReportEntityType[]).map((t) => (
                <label key={t} style={radioLabelStyle}>
                  <input
                    type="radio"
                    name="entityType"
                    checked={entityType === t}
                    onChange={() => {
                      setEntityType(t);
                      setUserIds([]);
                      setTeamId("");
                    }}
                  />
                  {tr(ENTITY_LABELS[t])}
                </label>
              ))}
            </div>

            {entityType !== "team" ? (
              <label style={fieldLabelStyle}>
                <span>{entityType === "user" ? tr("Select User") : tr("Select Users")}</span>
                <MemberMultiSelect
                  value={userIds}
                  onChange={(ids) => setUserIds(entityType === "user" ? ids.slice(-1) : ids)}
                  options={memberOptions}
                  placeholder={entityType === "user" ? tr("Search and select a user…") : tr("Search and select users…")}
                  groupByPrimaryTeam={entityType === "users"}
                />
              </label>
            ) : (
              <label style={fieldLabelStyle}>
                <span>{tr("Select Team")}</span>
                <div style={{ maxWidth: 320 }}>
                  <CustomSelect value={teamId} onChange={setTeamId} options={teamOptions} placeholder={tr("Select a team…")} />
                </div>
              </label>
            )}

            <div>
              <div style={{ ...fieldLabelStyle, marginBottom: 8 }}>
                <span>{tr("Date Range")}</span>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                {(
                  [
                    ["7d", "Last 7 days"],
                    ["30d", "Last 30 days"],
                    ["month", "This month"],
                    ["custom", "Custom range"],
                  ] as Array<[QuickRange, string]>
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => applyQuickRange(value)}
                    style={quickRange === value ? quickBtnActiveStyle : quickBtnStyle}
                  >
                    {tr(label)}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ width: 170 }}>
                  <DatePicker
                    value={startDate}
                    onChange={(iso) => { setStartDate(iso); setQuickRange("custom"); }}
                    max={endDate || istToday()}
                    placeholder={tr("From")}
                  />
                </div>
                <span style={{ color: "var(--ink-mute)", fontSize: 12 }}>{tr("to")}</span>
                <div style={{ width: 170 }}>
                  <DatePicker
                    value={endDate}
                    onChange={(iso) => { setEndDate(iso); setQuickRange("custom"); }}
                    min={startDate}
                    max={istToday()}
                    placeholder={tr("To")}
                  />
                </div>
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={generate}
                disabled={!canGenerate || loading}
                style={{ ...generateBtnStyle, opacity: !canGenerate || loading ? 0.6 : 1 }}
              >
                {loading ? tr("Generating…") : tr("Generate Report")}
              </button>
            </div>
          </div>
        </div>
      </div>

      {err && <div style={{ ...alertStyle, marginBottom: 16 }}>{err}</div>}

      {report && <ReportView report={report} onExportPdf={() => window.print()} />}
    </div>
  );
}

// ── Report display ───────────────────────────────────────────────────────────

function ReportView({ report, onExportPdf }: { report: AdminReport; onExportPdf: () => void }) {
  const tr = useTr();
  return (
    <div id="reports-print-root">
      <div className="reports-no-print" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button type="button" onClick={onExportPdf} style={exportBtnStyle}>
          {tr("Export as PDF")}
        </button>
      </div>

      <ReportSummary report={report} />

      <SectionHeading title={tr("Task Summary")} />
      <div className="dash-auto-grid" style={{ marginBottom: 20 }}>
        <StatCard label={tr("TASKS CREATED")} value={report.taskStats.created} bg="var(--surface)" accent="var(--ink-soft)" />
        <StatCard label={tr("TASKS ASSIGNED")} value={report.taskStats.assigned} bg="var(--surface)" accent="var(--ink-soft)" />
        <StatCard label={tr("PLANNED")} value={report.taskStats.planned} bg="var(--ochre-wash)" accent="var(--ochre)" />
        <StatCard label={tr("DOING")} value={report.taskStats.doing} bg="var(--ochre-wash)" accent="var(--ochre)" />
        <StatCard label={tr("DONE")} value={report.taskStats.done} bg="var(--ok-wash)" accent="var(--ok)" />
      </div>

      <SectionHeading title={tr("Detailed Task List")} note={`${report.tasks.length} task${report.tasks.length === 1 ? "" : "s"}`} />
      <TaskTable tasks={report.tasks} />

      <SectionHeading title={tr("Conversation Summary")} />
      <div className="dash-auto-grid" style={{ marginBottom: 20 }}>
        <StatCard label={tr("TOTAL CONVERSATIONS")} value={report.conversationStats.total} bg="var(--surface)" accent="var(--ink-soft)" />
        <StatCard label={tr("TEXT CONVERSATIONS")} value={report.conversationStats.text} bg="var(--surface)" accent="var(--ink-soft)" />
        <StatCard label={tr("VOICE CONVERSATIONS")} value={report.conversationStats.voice} bg="var(--surface)" accent="var(--ink-soft)" />
      </div>

      <SectionHeading title={tr("Conversation Logs")} note={`${report.conversations.length} conversation${report.conversations.length === 1 ? "" : "s"}`} />
      <ConversationLogs conversations={report.conversations} />

      {report.entityType !== "user" && report.memberBreakdown.length > 0 && (
        <>
          <SectionHeading title={tr("Individual Breakdown")} />
          <MemberBreakdown members={report.memberBreakdown} />
        </>
      )}
    </div>
  );
}

function ReportSummary({ report }: { report: AdminReport }) {
  const tr = useTr();
  return (
    <div style={{ ...cardStyle, padding: "16px 20px", marginBottom: 20 }}>
      <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-mute)", marginBottom: 10 }}>
        {tr("REPORT")}
      </div>
      {report.entityType === "user" && report.user && (
        <>
          <div style={{ fontFamily: "var(--serif)", fontSize: 20, marginBottom: 4 }}>{report.user.name}</div>
          <div style={{ fontSize: 13, color: "var(--ink-mute)" }}>
            {report.user.email && <>{report.user.email} &middot; </>}
            {report.user.phone} &middot; {report.user.teamName || tr("No team")}
          </div>
        </>
      )}
      {report.entityType === "users" && (
        <div style={{ fontFamily: "var(--serif)", fontSize: 20 }}>{tr("Selected Users:")} {report.memberCount}</div>
      )}
      {report.entityType === "team" && (
        <>
          <div style={{ fontFamily: "var(--serif)", fontSize: 20, marginBottom: 4 }}>{report.teamName}</div>
          <div style={{ fontSize: 13, color: "var(--ink-mute)" }}>{tr("Members:")} {report.memberCount}</div>
        </>
      )}
      <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 10 }}>
        {tr("Report Period:")} {formatDate(report.period.start)} – {formatDate(report.period.end)}
      </div>
    </div>
  );
}

function SectionHeading({ title, note }: { title: string; note?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10, marginTop: 8 }}>
      <h3 style={{ fontFamily: "var(--serif)", fontSize: 16, fontWeight: 500, margin: 0 }}>{title}</h3>
      {note && <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-mute)", letterSpacing: "0.06em", textTransform: "uppercase" }}>{note}</span>}
    </div>
  );
}

// ── Task table ──────────────────────────────────────────────────────────────

const TASK_COLS = "1.6fr 90px 1fr 1fr 1fr 90px";

function TaskTable({ tasks }: { tasks: ReportTaskRow[] }) {
  const tr = useTr();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (tasks.length === 0) {
    return (
      <div style={{ ...cardStyle, padding: 20, textAlign: "center", color: "var(--ink-faint)", fontSize: 12, marginBottom: 20 }}>
        {tr("No tasks in this period.")}
      </div>
    );
  }

  return (
    <div style={{ ...cardStyle, overflow: "hidden", marginBottom: 20 }}>
      <TableScroll minWidth={720}>
        <div className="table-header" style={{ gridTemplateColumns: TASK_COLS }}>
          <span>{tr("Task Name")}</span>
          <span>{tr("Status")}</span>
          <span>{tr("Created By")}</span>
          <span>{tr("Assigned To")}</span>
          <span>{tr("Assigned By")}</span>
          <span>{tr("Created Date")}</span>
        </div>
        {tasks.map((t) => {
          const isOpen = expandedId === t.id;
          return (
            <div key={t.id}>
              <div
                className="table-row"
                role="button"
                tabIndex={0}
                aria-expanded={isOpen}
                onClick={() => setExpandedId(isOpen ? null : t.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpandedId(isOpen ? null : t.id); }
                }}
                style={{ gridTemplateColumns: TASK_COLS, cursor: "pointer", background: isOpen ? "var(--surface-sunk)" : undefined }}
              >
                <span style={{ fontWeight: 500, color: "var(--green-deep)" }}>{t.title}</span>
                <span><StatusTag slug={t.statusSlug} /></span>
                <span>{t.createdByName}</span>
                <span>{t.assignedToNames.length > 0 ? t.assignedToNames.join(", ") : tr("Unassigned")}</span>
                <span>{t.assignedByName || "---"}</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{formatDate(t.createdOn)}</span>
              </div>
              {isOpen && <TaskDetailPanel task={t} />}
            </div>
          );
        })}
      </TableScroll>
    </div>
  );
}

function StatusTag({ slug }: { slug: ReportTaskRow["statusSlug"] }) {
  const color = slug === "done" ? "var(--ok)" : slug === "doing" ? "var(--ochre)" : "var(--ink-mute)";
  return (
    <span style={{
      fontFamily: "var(--mono)", fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
      padding: "2px 7px", borderRadius: 999, color, background: `color-mix(in srgb, ${color} 14%, transparent)`,
    }}>
      {STATUS_LABELS[slug]}
    </span>
  );
}

function TaskDetailPanel({ task }: { task: ReportTaskRow }) {
  const tr = useTr();
  const [detail, setDetail] = useState<TaskReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setErr(null);
    fetchJson<TaskReportDetail>(`/api/admin/reports/tasks/${task.id}`)
      .then((d) => { if (live) setDetail(d); })
      .catch((e) => { if (live) setErr(e instanceof FetchError ? e.message : "Failed to load task detail."); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [task.id]);

  return (
    <div style={{ padding: "14px 16px", background: "var(--surface-sunk)", borderTop: "1px solid var(--rule)", fontSize: 13 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 12 }}>
        <Meta label={tr("Board / Project")} value={task.boardName} />
        <Meta label={tr("Column")} value={task.listName} />
        <Meta label={tr("Priority")} value={task.priority || "---"} />
        <Meta label={tr("Due date")} value={task.dueDate ? formatDate(task.dueDate) : "---"} />
        <Meta label={tr("Last updated")} value={formatDate(task.updatedOn)} />
      </div>

      {loading && <div style={{ color: "var(--ink-mute)" }}>{tr("Loading task detail…")}</div>}
      {err && <div style={{ color: "var(--crit)" }}>{err}</div>}
      {detail && (
        <>
          {detail.description && (
            <div style={{ marginBottom: 12 }}>
              <div style={metaLabelStyle}>{tr("Description")}</div>
              <div style={{ fontSize: 13, lineHeight: 1.55 }}><Markdown source={detail.description} /></div>
            </div>
          )}
          <div style={metaLabelStyle}>{tr("Activity history (")}{detail.history.length})</div>
          {detail.history.length === 0 ? (
            <div style={{ color: "var(--ink-faint)", fontSize: 12 }}>{tr("No recorded activity.")}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {detail.history.map((h) => (
                <div key={h.id} style={{ display: "flex", gap: 8, fontSize: 12 }}>
                  <span style={{ color: "var(--ink-faint)", whiteSpace: "nowrap", fontFamily: "var(--mono)" }}>{formatDate(h.createdOn)}</span>
                  <span style={{ color: "var(--green-deep)", fontWeight: 500 }}>{NOTE_TYPE_LABELS[h.noteType] || h.noteType}</span>
                  <span style={{ color: "var(--ink-mute)" }}>{h.authorName}</span>
                  {h.content && <span style={{ color: "var(--ink-soft)" }}>— {h.content}</span>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={metaLabelStyle}>{label}</div>
      <div>{value}</div>
    </div>
  );
}

const metaLabelStyle: CSSProperties = {
  fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase",
  color: "var(--ink-faint)", marginBottom: 3,
};

// ── Conversation logs ────────────────────────────────────────────────────────

interface TranscriptMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

function ConversationLogs({ conversations }: { conversations: ReportConversationRow[] }) {
  const tr = useTr();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (conversations.length === 0) {
    return (
      <div style={{ ...cardStyle, padding: 20, textAlign: "center", color: "var(--ink-faint)", fontSize: 12, marginBottom: 20 }}>
        {tr("No conversations in this period.")}
      </div>
    );
  }

  return (
    <div style={{ ...cardStyle, marginBottom: 20 }}>
      {conversations.map((c, i) => {
        // c.id is the real task/thread id (needed as-is for the transcript
        // endpoint's URL) — but a task conversation appears once PER USER who
        // chatted on it, so two rows can share the same id. rowKey is the
        // unique identity for React's key and for "which row is expanded";
        // c.id alone stays the API path segment.
        const rowKey = `${c.source}:${c.id}:${c.userId}`;
        const isOpen = expandedId === rowKey;
        return (
          <div key={rowKey} style={{ borderBottom: i < conversations.length - 1 ? "1px solid var(--rule)" : "none" }}>
            <div
              role="button"
              tabIndex={0}
              aria-expanded={isOpen}
              onClick={() => setExpandedId(isOpen ? null : rowKey)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpandedId(isOpen ? null : rowKey); } }}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
                padding: "12px 16px", cursor: "pointer", flexWrap: "wrap",
                background: isOpen ? "var(--surface-sunk)" : undefined,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 500, color: "var(--green-deep)" }}>{c.title}</span>
                <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{c.userName}</span>
                <span className="tag" style={c.type === "voice" ? { background: "var(--ochre-wash)", color: "var(--ochre)" } : { background: "var(--surface-sunk)", color: "var(--ink-mute)" }}>
                  {c.type === "voice" ? tr("Voice") : tr("Text")}
                </span>
              </div>
              <span style={{ fontSize: 11, color: "var(--ink-faint)", fontFamily: "var(--mono)" }}>{formatDateTime(c.lastActivity)}</span>
            </div>
            {isOpen && <ConversationTranscript conversation={c} />}
          </div>
        );
      })}
    </div>
  );
}

function ConversationTranscript({ conversation }: { conversation: ReportConversationRow }) {
  const tr = useTr();
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setErr(null);
    const qs = new URLSearchParams({ userId: conversation.userId, page: "1", per_page: "50" });
    fetchJson<{ items: TranscriptMessage[] }>(
      `/api/admin/reports/conversations/${conversation.source}/${conversation.id}?${qs.toString()}`,
    )
      .then((d) => { if (live) setMessages(d.items || []); })
      .catch((e) => { if (live) setErr(e instanceof FetchError ? e.message : "Failed to load transcript."); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [conversation.source, conversation.id, conversation.userId]);

  return (
    <div style={{ padding: "12px 16px", background: "var(--surface-sunk)", borderTop: "1px solid var(--rule)" }}>
      {loading && <div style={{ color: "var(--ink-mute)", fontSize: 13 }}>{tr("Loading transcript…")}</div>}
      {err && <div style={{ color: "var(--crit)", fontSize: 13 }}>{err}</div>}
      {!loading && !err && messages.length === 0 && (
        <div style={{ color: "var(--ink-faint)", fontSize: 13 }}>{tr("Nothing recorded.")}</div>
      )}
      {messages.map((m) => (
        <div key={m.id} style={{ marginBottom: 10, fontSize: 13 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: m.role === "user" ? "var(--ochre)" : "var(--green-deep)", fontWeight: 600 }}>
              {m.role === "user" ? tr("User") : tr("Assistant")}
            </span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-faint)" }}>{formatDateTime(m.createdAt)}</span>
          </div>
          <div style={{ lineHeight: 1.5 }}><Markdown source={m.content} /></div>
        </div>
      ))}
    </div>
  );
}

// ── Member breakdown ─────────────────────────────────────────────────────────

const MEMBER_COLS = "1.4fr 80px 80px 80px 90px 90px";

function MemberBreakdown({ members }: { members: AdminReport["memberBreakdown"] }) {
  const tr = useTr();
  return (
    <div style={{ ...cardStyle, overflow: "hidden", marginBottom: 20 }}>
      <TableScroll minWidth={640}>
        <div className="table-header" style={{ gridTemplateColumns: MEMBER_COLS }}>
          <span>{tr("Name")}</span>
          <span>{tr("Created")}</span>
          <span>{tr("Assigned")}</span>
          <span>{tr("Done")}</span>
          <span>{tr("Conversations")}</span>
          <span>{tr("Voice")}</span>
        </div>
        {members.map((m) => (
          <div key={m.userId} className="table-row" style={{ gridTemplateColumns: MEMBER_COLS }}>
            <span style={{ fontWeight: 500 }}>{m.name}</span>
            <span>{m.taskStats.created}</span>
            <span>{m.taskStats.assigned}</span>
            <span>{m.taskStats.done}</span>
            <span>{m.conversationStats.total}</span>
            <span>{m.conversationStats.voice}</span>
          </div>
        ))}
      </TableScroll>
    </div>
  );
}

// ── Formatting + styles ──────────────────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return "---";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function formatDateTime(iso: string): string {
  if (!iso) return "---";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const alertStyle: CSSProperties = {
  fontSize: 13, color: "var(--crit)", background: "var(--crit-wash)",
  border: "1px solid var(--crit)", borderRadius: "var(--r-sm)", padding: "10px 14px",
};
const radioLabelStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer",
};
const fieldLabelStyle: CSSProperties = {
  display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 500, color: "var(--ink-soft)",
};
const quickBtnStyle: CSSProperties = {
  padding: "5px 11px", fontSize: 12, fontFamily: "var(--sans)", background: "var(--surface)",
  border: "1px solid var(--rule)", borderRadius: "var(--r-sm)", color: "var(--ink-mute)", cursor: "pointer",
};
const quickBtnActiveStyle: CSSProperties = {
  ...quickBtnStyle, background: "var(--green-wash)", borderColor: "var(--green-deep)", color: "var(--green-deep)", fontWeight: 600,
};
const generateBtnStyle: CSSProperties = {
  padding: "9px 18px", fontSize: 13, fontWeight: 600, fontFamily: "var(--sans)",
  background: "var(--green-deep)", color: "var(--surface)", border: "none",
  borderRadius: "var(--r-sm)", cursor: "pointer",
};
const exportBtnStyle: CSSProperties = {
  padding: "8px 16px", fontSize: 12, fontWeight: 600, fontFamily: "var(--sans)",
  background: "var(--surface)", color: "var(--green-deep)", border: "1px solid var(--green-deep)",
  borderRadius: "var(--r-sm)", cursor: "pointer",
};

/**
 * Print only the generated report. No PDF library exists in this codebase
 * (confirmed: no jsPDF/react-pdf/puppeteer/pdfkit) — the browser's own
 * print-to-PDF via window.print() renders exactly what is already on screen,
 * with zero new dependency and no serverless PDF-rendering complexity.
 * ".reports-no-print" hides the filter panel and the Export button itself;
 * everything else under #reports-print-root prints as-is.
 */
const PRINT_CSS = `
@media print {
  .reports-no-print { display: none !important; }
  body * { visibility: hidden; }
  #reports-print-root, #reports-print-root * { visibility: visible; }
  #reports-print-root { position: absolute; left: 0; top: 0; width: 100%; }
}
`;
