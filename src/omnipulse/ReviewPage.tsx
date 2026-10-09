import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  ConfirmDialog,
  Modal,
  PageHeader,
  SearchBar,
  SubTabs,
  Table,
  TableAction,
  TableRowActions,
  emitToast,
  type Column,
} from "../components/common";
import type { OmniPulseReviewData, OmniPulseSubmission } from "./types";
import { Avatars } from "./cards";
import {
  ScoreDecision,
  decisionProblem,
  formatScoreOutOfTen,
  scoreTone,
  type ScoreDecisionValue,
} from "./ScoreDecision";

const ALL = "All";

const STATUS_TONE = { Pending: "amber", Approved: "ok", Returned: "crit" } as const;

/** What a freshly opened submission proposes: take the acharya's score. */
function openingDecision(row: OmniPulseSubmission): ScoreDecisionValue {
  return {
    mode: row.isSimpleTask ? "revise" : "accept",
    // The reviewer's input starts at the acharya's number rather than at zero:
    // most overrides are an adjustment, not a fresh judgement.
    score: row.acharyaScore != null ? Math.round(row.acharyaScore * 100) / 10 : 7,
    feedback: "",
  };
}

export interface ReviewPageProps {
  data: OmniPulseReviewData;
}

/**
 * Review — the evaluation queue.
 *
 * A table, not cards: eight columns of numbers and names that a reviewer scans
 * top to bottom. Opening a row gives the submission and the two decisions,
 * which is the whole job of the screen.
 *
 * Decisions move the row between the tabs and nothing else — there is no API
 * here, so "approved" lasts until the page reloads.
 */
export function ReviewPage({ data }: ReviewPageProps) {
  const [rows, setRows] = useState<OmniPulseSubmission[]>(data.rows);
  const [tab, setTab] = useState(data.tabs[0]?.label ?? ALL);
  const [search, setSearch] = useState("");
  // Loaded on the server (the rows are already in hand); in the browser the
  // screen opens through its skeleton, which is where the read will go.
  const [loading, setLoading] = useState(() => typeof window !== "undefined");
  const [open, setOpen] = useState<OmniPulseSubmission | null>(null);
  const [returning, setReturning] = useState<OmniPulseSubmission | null>(null);
  const [decision, setDecision] = useState<ScoreDecisionValue>({
    mode: "accept",
    score: 7,
    feedback: "",
  });

  /** Opening a submission resets the decision to what that row proposes. */
  function openRow(row: OmniPulseSubmission) {
    setDecision(openingDecision(row));
    setOpen(row);
  }

  useEffect(() => {
    const id = window.setTimeout(() => setLoading(false), 600);
    return () => window.clearTimeout(id);
  }, []);

  const q = search.trim().toLowerCase();

  const filtered = useMemo(() => {
    const t = data.tabs.find((x) => x.label === tab);
    return rows.filter((r) => {
      if (t && r.status !== t.value) return false;
      if (!q) return true;
      return (
        r.task.toLowerCase().includes(q) ||
        r.karigar.toLowerCase().includes(q) ||
        r.project.toLowerCase().includes(q)
      );
    });
  }, [rows, tab, q, data.tabs]);

  /**
   * Approve, with whichever score the reviewer settled on.
   *
   * The final score is stored separately from the acharya's rather than
   * overwriting it: what the acharya said and what the reviewer decided are
   * two facts, and a screen that keeps only the second cannot show that
   * anyone disagreed.
   */
  function approve(row: OmniPulseSubmission) {
    const problem = decisionProblem(decision, row.isSimpleTask);
    if (problem) {
      emitToast(problem, "error");
      return;
    }
    const accepted = decision.mode === "accept" && !row.isSimpleTask;
    const finalScore = accepted ? row.acharyaScore : Math.min(1, Math.max(0, decision.score / 10));
    setRows((rs) =>
      rs.map((r) =>
        r.id === row.id
          ? {
              ...r,
              status: "Approved",
              finalScore,
              feedback: decision.feedback.trim(),
              decidedBy: "You",
            }
          : r,
      ),
    );
    setOpen(null);
    emitToast(
      accepted
        ? `#${row.seq} approved on the acharya's ${formatScoreOutOfTen(finalScore)}`
        : `#${row.seq} approved at ${formatScoreOutOfTen(finalScore)} — your score`,
      "success",
    );
  }

  function returnForRework(row: OmniPulseSubmission) {
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, status: "Returned" } : r)));
    setOpen(null);
    setReturning(null);
    emitToast(`#${row.seq} returned to ${row.karigar}`, "info");
  }

  const columns: Column<OmniPulseSubmission>[] = [
    {
      key: "seq",
      header: "#",
      width: "64px",
      render: (r) => (
        <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--ink-mute)" }}>
          {r.seq}
        </span>
      ),
    },
    {
      key: "task",
      header: "Task",
      width: "minmax(200px, 2fr)",
      render: (r) => <span className="picker-truncate">{r.task}</span>,
    },
    {
      key: "karigar",
      header: "Karigar",
      width: "minmax(150px, 1fr)",
      render: (r) => (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <Avatars names={[r.karigar]} size={20} />
          <span className="picker-truncate">{r.karigar}</span>
        </span>
      ),
    },
    {
      key: "acharyaScore",
      header: "Acharya",
      width: "104px",
      align: "right",
      render: (r) =>
        r.isSimpleTask ? (
          <span style={{ color: "var(--ink-faint)" }}>—</span>
        ) : (
          <Badge tone={scoreTone(r.acharyaScore)}>{formatScoreOutOfTen(r.acharyaScore)}</Badge>
        ),
    },
    {
      // What stands, once someone has decided. Beside the acharya's rather
      // than replacing it, so a disagreement is visible in the list.
      key: "finalScore",
      header: "Final",
      width: "104px",
      align: "right",
      render: (r) =>
        r.finalScore == null ? (
          <span style={{ color: "var(--ink-faint)" }}>—</span>
        ) : (
          <Badge tone={scoreTone(r.finalScore)}>{formatScoreOutOfTen(r.finalScore)}</Badge>
        ),
    },
    { key: "project", header: "Project", width: "minmax(140px, 1fr)" },
    { key: "team", header: "Team", width: "120px" },
    {
      key: "date",
      header: "Date",
      width: "130px",
      render: (r) => (
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-soft)" }}>
          {r.date}
        </span>
      ),
    },
    {
      key: "__actions",
      header: "Actions",
      width: "110px",
      align: "right",
      render: (r) => (
        <TableRowActions nowrap>
          <TableAction onClick={() => openRow(r)}>
            {r.status === "Pending" ? "Review" : "Open"}
          </TableAction>
        </TableRowActions>
      ),
    },
  ];

  const pending = rows.filter((r) => r.status === "Pending").length;

  return (
    <div>
      <PageHeader
        eyebrow="OmniPulse"
        crumbs={[{ label: "OmniPulse" }, { label: data.label }]}
        actions={
          <span className="ui-meta" >
            {pending} awaiting review
          </span>
        }
      />

      <div style={{ marginBottom: 14 }}>
        <SubTabs
          tabs={[ALL, ...data.tabs.map((t) => t.label)]}
          active={tab}
          onChange={setTab}
          ariaLabel="Review queue"
          counts={Object.fromEntries(
            data.tabs.map((t) => [t.label, rows.filter((r) => r.status === t.value).length]),
          )}
        />
      </div>

      <div className="opx-toolbar">
        <SearchBar value={search} onChange={setSearch} placeholder={data.searchPlaceholder} width={280} />
      </div>

      <Table
        columns={columns}
        data={filtered}
        rowKey={(r) => r.id}
        loading={loading}
        minWidth={1180}
        onRowClick={openRow}
        emptyVariant={q || tab !== ALL ? "no-results" : "empty"}
        emptyMessage={q ? `No submissions match “${q}”` : data.emptyMessage}
        emptyHint={q ? "Check the spelling, or clear the search." : data.emptyHint}
      />

      <Modal
        open={open != null}
        onClose={() => setOpen(null)}
        size="lg"
        title={open ? `#${open.seq} · ${open.task}` : ""}
        description={open ? `${open.karigar} · ${open.project} · ${open.team} · ${open.date}` : ""}
        footer={
          open && open.status === "Pending" ? (
            <>
              <Button variant="ghost" onClick={() => setOpen(null)}>
                Close
              </Button>
              <Button variant="danger" onClick={() => setReturning(open)}>
                Return for rework
              </Button>
              <Button onClick={() => approve(open)}>
                {open.isSimpleTask || decision.mode === "revise" ? "Approve at my score" : "Approve"}
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => setOpen(null)}>
              Close
            </Button>
          )
        }
      >
        {open && (
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <Badge tone={STATUS_TONE[open.status as keyof typeof STATUS_TONE] ?? "neutral"}>
                {open.status}
              </Badge>
              {open.isSimpleTask ? (
                <Badge tone="neutral">Not scored by an acharya</Badge>
              ) : (
                <Badge tone={scoreTone(open.acharyaScore)}>
                  Acharya {formatScoreOutOfTen(open.acharyaScore)}
                </Badge>
              )}
              {open.finalScore != null && (
                <Badge tone={scoreTone(open.finalScore)}>
                  Final {formatScoreOutOfTen(open.finalScore)}
                </Badge>
              )}
              <Badge tone="neutral">
                {open.attachments} {open.attachments === 1 ? "attachment" : "attachments"}
              </Badge>
            </div>

            {/* The evidence gallery is a feature of its own in the app; here the
                attachments are placeholders at the right shape and count. */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {Array.from({ length: open.attachments }).map((_, i) => (
                <div className="ui-meta-faint"
 key={i}
 style={{ width: 96, height: 72, borderRadius: "var(--r-sm)", background: "var(--surface-sunk)", border: "1px solid var(--rule)", display: "grid", placeItems: "center" }}
 >
                  IMG {i + 1}
                </div>
              ))}
            </div>

            <div>
              <div className="form-label">Acharya's note</div>
              <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6 }}>
                {open.note || "No note left on this submission."}
              </p>
            </div>

            {open.status === "Pending" ? (
              <ScoreDecision
                acharyaScore={open.acharyaScore}
                isSimpleTask={open.isSimpleTask}
                value={decision}
                onChange={setDecision}
                feedbackMax={data.feedbackMax ?? 200}
              />
            ) : (
              <div className="decision decision--settled">
                <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6 }}>
                  {open.status === "Returned"
                    ? `Returned to ${open.karigar} for rework.`
                    : open.finalScore != null && open.finalScore === open.acharyaScore
                      ? `${open.decidedBy || "A reviewer"} kept the acharya's ${formatScoreOutOfTen(open.finalScore)}.`
                      : `${open.decidedBy || "A reviewer"} set ${formatScoreOutOfTen(open.finalScore)} over the acharya's ${formatScoreOutOfTen(open.acharyaScore)}.`}
                </p>
                {open.feedback && (
                  <p style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.6, marginTop: 6 }}>
                    “{open.feedback}”
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={returning != null}
        title="Return this submission?"
        description={
          returning
            ? `${returning.karigar} will be asked to redo “${returning.task}”. Tell them what to fix.`
            : ""
        }
        requireText={{ label: "What needs fixing", placeholder: "Three angles, not one…", minLength: 10 }}
        confirmLabel="Return for rework"
        confirmTone="danger"
        onCancel={() => setReturning(null)}
        onConfirm={() => {
          if (returning) returnForRework(returning);
        }}
      />
    </div>
  );
}
