import { useMemo, useState, type CSSProperties } from "react";
import { Button, EmptyState } from "../../components/common";
import {
  BottomSheet,
  Card,
  ChoiceGroup,
  DetailList,
  ListRow,
  MobileIcon,
  PersonAvatar,
  RowList,
  ScreenHeader,
  SectionHeader,
  SegmentedTabs,
  StatRow,
  StatTile,
  Tag,
} from "../../components/acharya-mobile";
import type { Approval } from "./types";

const firstName = (n: string) => n.split(" ")[0];

/** The oldest item still waiting: "3d", "<1d" for today's, "—" when the queue is empty. */
export function oldestLabel(approvals: Approval[]) {
  if (approvals.length === 0) return "—";
  const days = Math.max(...approvals.map((a) => a.ageDays));
  return days < 1 ? "<1d" : `${days}d`;
}

export interface ContractorReviewProps {
  approvals: Approval[];
  onOpen: (id: string) => void;
  /** The decision just made, said once at the top of the list. */
  notice?: { text: string; tone: "green" | "ochre" };
  onDismissNotice: () => void;
}

/** Review (OmniPulse `HomeScreen` tab=review + `ReviewList`): three counts, search, person filter, the queue. */
export function ContractorReview({ approvals, onOpen, notice, onDismissNotice }: ContractorReviewProps) {
  const [q, setQ] = useState("");
  const [person, setPerson] = useState("all");
  const [newest, setNewest] = useState(true);
  const people = useMemo(() => [...new Set(approvals.map((a) => a.kaarigar))].sort(), [approvals]);
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    const list = approvals.filter((a) => (person === "all" || a.kaarigar === person) && (!n || a.task.toLowerCase().includes(n) || a.kaarigar.toLowerCase().includes(n)));
    return newest ? list : [...list].reverse();
  }, [approvals, q, person, newest]);

  return (
    <>
      <ScreenHeader title="Review" sticky />
      <div className="am-stack" style={{ paddingTop: 14 }}>
        {notice && (
          <Card tone={notice.tone}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <MobileIcon name={notice.tone === "green" ? "check-circle" : "retry"} />
              <p className="mb-body" style={{ flex: 1, color: "var(--ink)" }}>{notice.text}</p>
              <button type="button" className="am-iconbtn am-iconbtn--ghost" aria-label="Dismiss" onClick={onDismissNotice}><MobileIcon name="close" size={18} /></button>
            </div>
          </Card>
        )}
        <StatRow label="Waiting for you">
          <StatTile layout="row" tone="ochre" icon={<MobileIcon name="inbox" />} value={String(approvals.length)} label="Waiting" />
          <StatTile layout="row" tone="green" icon={<MobileIcon name="clock" />} value={oldestLabel(approvals)} label="Oldest" />
          <StatTile layout="row" tone="slate" icon={<MobileIcon name="teams" />} value={String(people.length)} label="People" />
        </StatRow>

        {approvals.length === 0 ? (
          <EmptyState size="inline" title="Nothing to approve" description="When a kaarigar submits work, it waits here for you." icon={<MobileIcon name="inbox" size={22} />} />
        ) : (
          <>
            <label className="mb-search">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks or people" aria-label="Search" />
            </label>
            <div className="mb-filters" role="group" aria-label="Filter by person">
              {["all", ...people].map((p) => (
                <button key={p} type="button" className="mb-chip am-press" aria-pressed={person === p} onClick={() => setPerson(p)}>
                  {p !== "all" && <PersonAvatar name={p} size={20} />}
                  {p === "all" ? "Everyone" : firstName(p)}
                </button>
              ))}
            </div>
            {shown.length === 0 ? (
              <EmptyState size="inline" variant="no-results" title="No matches" description="Try another name or clear the search." />
            ) : (
              <Card flush>
                <SectionHeader
                  variant="rule"
                  title="Needs your answer"
                  icon={<MobileIcon name="inbox" />}
                  right={
                    <>
                      <button type="button" className="mb-sort am-press" onClick={() => setNewest((v) => !v)} aria-label="Sort">
                        <MobileIcon name="sort" size={12} /> {newest ? "Newest" : "Oldest"}
                      </button>
                      {shown.length}
                    </>
                  }
                />
                <RowList>
                  {shown.map((a) => (
                    <ListRow
                      key={a.id}
                      leading={<PersonAvatar name={a.kaarigar} />}
                      title={a.task}
                      subtitle={
                        <>
                          <Tag size="xs">{firstName(a.kaarigar)}</Tag>
                          <Tag size="xs">{a.project}</Tag>
                          <Tag size="xs">{a.when}</Tag>
                          {a.priority === "urgent" && <Tag size="xs" tone="crit">Urgent</Tag>}
                        </>
                      }
                      trailing={<span className="mb-score" data-good={a.score >= 7 ? "" : undefined}>{a.score}<small>/10</small></span>}
                      onSelect={() => onOpen(a.id)}
                    />
                  ))}
                </RowList>
              </Card>
            )}
          </>
        )}
      </div>
    </>
  );
}

const PHOTO_TONES = [["#b5a77a", "#6b5f47"], ["#c7d6bd", "#376a46"], ["#e7bfa5", "#a74a2d"], ["#dde4ec", "#3f5a72"], ["#e6cf9a", "#a5711a"]];
const photoStyle = (i: number) => ({ "--photo-a": PHOTO_TONES[i % 5][0], "--photo-b": PHOTO_TONES[i % 5][1] }) as CSSProperties;

export interface ContractorApprovalProps {
  approval: Approval;
  tab: string;
  onTab: (tab: string) => void;
  onBack: () => void;
  onDecide: (approval: Approval, verdict: "approve" | "redo", score: number) => void;
}

/** One approval (OmniPulse `ApprovalScreen`): details, what they said, evidence, scoring — and the decision, always in reach. */
export function ContractorApproval({ approval: a, tab, onTab, onBack, onDecide }: ContractorApprovalProps) {
  const [score, setScore] = useState(String(a.score));
  const [photo, setPhoto] = useState<number | null>(null);
  const tone = a.score >= 7 ? "green" : a.score >= 4 ? "ochre" : "terracotta";

  return (
    <>
      <ScreenHeader title="" onBack={onBack} backLabel="Back" />
      <div className="am-stack" style={{ paddingBottom: 96 }}>
        <SegmentedTabs
          variant="plate"
          ariaLabel="Approval sections"
          active={tab}
          onChange={onTab}
          idPrefix="op-approval"
          tabs={[
            { key: "details", label: "Details", icon: "info" },
            { key: "notes", label: "Notes", icon: "comment", count: 1 },
            { key: "evidence", label: "Proof", icon: "stories", count: a.photos },
            { key: "scoring", label: "Score", icon: "check-circle" },
          ]}
        />

        <div role="tabpanel" id={`op-approval-${tab}`} aria-labelledby={`op-approval-tab-${tab}`} className="am-stack">
          {tab === "details" && (
            <Card>
              <h2 className="mb-task-title">{a.task}</h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "10px 0 14px" }}>
                <Tag tone="green">{a.type}</Tag>
                {a.priority === "urgent" && <Tag tone="crit">Urgent</Tag>}
                <Tag>{a.project}</Tag>
              </div>
              <DetailList rows={[
                { label: "Kaarigar", value: a.kaarigar },
                { label: "Submitted", value: a.when },
                { label: "Project", value: a.project },
                { label: "Checked by", value: a.acharya },
              ]} />
            </Card>
          )}

          {tab === "notes" && (
            <Card flush>
              <SectionHeader variant="rule" title="What they said" icon={<MobileIcon name="comment" />} />
              <div style={{ padding: 12, display: "flex", gap: 10 }}>
                <PersonAvatar name={a.kaarigar} />
                <blockquote className="mb-quote" style={{ flex: 1 }}>{a.said}</blockquote>
              </div>
            </Card>
          )}

          {tab === "evidence" && (
            <Card flush>
              <SectionHeader variant="rule" title="Photos" icon={<MobileIcon name="stories" />} right={a.photos} />
              <div className="mb-photos" style={{ padding: 12 }}>
                {Array.from({ length: a.photos }, (_, i) => (
                  <button key={i} type="button" className="mb-photo am-press" style={photoStyle(i)} aria-label={`Photo ${i + 1} of ${a.photos}`} onClick={() => setPhoto(i)}>
                    <MobileIcon name="stories" size={22} />
                  </button>
                ))}
              </div>
            </Card>
          )}

          {tab === "scoring" && (
            <>
              <Card tone={tone}>
                <div className="mb-verdict">
                  <div style={{ minWidth: 0 }}>
                    <p className="mb-eyebrow" style={{ margin: 0 }}>Acharya evaluation</p>
                    <p style={{ margin: "4px 0 0", font: "700 15px/1.3 var(--sans)" }}>{a.acharya}</p>
                    <p style={{ margin: "3px 0 0", font: "600 11px/1 var(--mono)", color: "var(--ink-mute)" }}>Checked {a.when}</p>
                  </div>
                  <div className="mb-verdict__score"><strong>{a.score}<span style={{ fontSize: 11, opacity: 0.7 }}>/10</span></strong><small>Acharya</small></div>
                </div>
              </Card>
              <Card tone="ochre">
                <p className="mb-eyebrow">Acharya · {a.acharya}</p>
                <p className="mb-body" style={{ color: "var(--ink)" }}>{a.acharyaNotes}</p>
              </Card>
              <Card>
                <p className="mb-eyebrow">Your number (out of 10)</p>
                <ChoiceGroup
                  ariaLabel="Your score"
                  layout="grid"
                  columns={6}
                  value={score}
                  onChange={setScore}
                  options={["5", "6", "7", "8", "9", "10"].map((v) => ({ value: v, label: v }))}
                />
              </Card>
            </>
          )}
        </div>
      </div>

      <div className="mb-decision">
        <Button size="lg" variant="secondary" iconLeft={<MobileIcon name="retry" size={18} />} onClick={() => onDecide(a, "redo", Number(score))}>Send back</Button>
        <Button size="lg" iconLeft={<MobileIcon name="check" size={18} />} onClick={() => onDecide(a, "approve", Number(score))}>Theek hai · {score}/10</Button>
      </div>

      <BottomSheet
        open={photo !== null}
        onClose={() => setPhoto(null)}
        title={photo === null ? undefined : `Photo ${photo + 1} of ${a.photos}`}
        footer={
          <div className="mb-actions">
            <Button variant="secondary" disabled={photo === 0} onClick={() => setPhoto((p) => (p === null ? p : Math.max(0, p - 1)))}>Previous</Button>
            <Button variant="secondary" disabled={photo === a.photos - 1} onClick={() => setPhoto((p) => (p === null ? p : Math.min(a.photos - 1, p + 1)))}>Next</Button>
          </div>
        }
      >
        {photo !== null && <div className="mb-photo" style={{ ...photoStyle(photo), aspectRatio: "3 / 4", cursor: "default" }}><MobileIcon name="stories" size={40} /></div>}
      </BottomSheet>
    </>
  );
}
