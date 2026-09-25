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
} from "../components";
import type { OmniPulseReviewData, OmniPulseSubmission } from "./types";
import { Avatars } from "./cards";

const ALL = "All";

const STATUS_TONE = { Pending: "amber", Approved: "ok", Returned: "crit" } as const;

/** A score is a judgement, so it carries its band in text as well as colour. */
function scoreTone(score: number): "ok" | "amber" | "crit" {
  if (score >= 85) return "ok";
  if (score >= 65) return "amber";
  return "crit";
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

  function decide(row: OmniPulseSubmission, status: "Approved" | "Returned") {
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, status } : r)));
    setOpen(null);
    setReturning(null);
    emitToast(
      `#${row.seq} ${status === "Approved" ? "approved" : "returned to " + row.karigar}`,
      status === "Approved" ? "success" : "info",
    );
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
      key: "score",
      header: "Score",
      width: "96px",
      align: "right",
      render: (r) => <Badge tone={scoreTone(r.score)}>{r.score}</Badge>,
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
          <TableAction onClick={() => setOpen(r)}>Open</TableAction>
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
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-mute)" }}>
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
        minWidth={1040}
        onRowClick={setOpen}
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
              <Button onClick={() => decide(open, "Approved")}>Approve</Button>
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
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Badge tone={STATUS_TONE[open.status as keyof typeof STATUS_TONE] ?? "neutral"}>
                {open.status}
              </Badge>
              <Badge tone={scoreTone(open.score)}>Score {open.score}</Badge>
              <Badge tone="neutral">
                {open.attachments} {open.attachments === 1 ? "attachment" : "attachments"}
              </Badge>
            </div>

            {/* The evidence gallery is a feature of its own in the app; here the
                attachments are placeholders at the right shape and count. */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {Array.from({ length: open.attachments }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: 96,
                    height: 72,
                    borderRadius: "var(--r-sm)",
                    background: "var(--surface-sunk)",
                    border: "1px solid var(--rule)",
                    display: "grid",
                    placeItems: "center",
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    color: "var(--ink-faint)",
                  }}
                >
                  IMG {i + 1}
                </div>
              ))}
            </div>

            <div>
              <div className="form-label">Reviewer note</div>
              <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6 }}>
                {open.note || "No note left on this submission."}
              </p>
            </div>
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
          if (returning) decide(returning, "Returned");
        }}
      />
    </div>
  );
}
