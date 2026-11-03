import { useState } from "react";
import { Button, EmptyState } from "../../components/common";
import {
  Card,
  DetailList,
  IconButton,
  MicButton,
  MobileIcon,
  PersonAvatar,
  ScreenHeader,
  SectionHeader,
  SegmentedTabs,
  Tag,
  TaskCard,
  type LevelSource,
  type MicStatus,
} from "../../components/acharya-mobile";
import { WorkSymbol } from "./WorkSymbol";
import { LANES, LANE_TINT, type KaarigarAcharya, type KaarigarTask, type Lane } from "./types";

function taskTags(t: KaarigarTask) {
  return (
    <>
      {t.score != null && <Tag tone="ok">{t.score.toFixed(1)}/10</Tag>}
      {t.lane === "review" && <Tag tone="ochre">Reviewing</Tag>}
      <Tag icon={<MobileIcon name="board" size={10} />}>{t.board}</Tag>
      {t.sessions.total > 1 && <Tag>{t.sessions.total} sessions</Tag>}
    </>
  );
}

export interface KaarigarWorkProps {
  tasks: KaarigarTask[];
  lane: Lane;
  onLane: (lane: Lane) => void;
  onOpenTask: (id: string) => void;
  guide: KaarigarAcharya;
}

/** My work (PR #207 `TasksPageClient` + `task-board`): toolbar, overall progress, lane tabs, task cards. */
export function KaarigarWork({ tasks, lane, onLane, onOpenTask, guide }: KaarigarWorkProps) {
  const [refreshing, setRefreshing] = useState(false);
  const done = tasks.filter((t) => t.lane === "done").length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const shown = tasks.filter((t) => t.lane === lane);

  return (
    <>
      <ScreenHeader
        title="My work"
        actions={
          <>
            <PersonAvatar name={guide.name} size={36} />
            <IconButton
              label={refreshing ? "Refreshing" : "Refresh tasks"}
              busy={refreshing}
              onClick={() => {
                setRefreshing(true);
                window.setTimeout(() => setRefreshing(false), 900);
              }}
            >
              <MobileIcon name="refresh" size={19} />
            </IconButton>
          </>
        }
      />
      <div className="am-stack">
        <Card>
          <div className="mb-board-progress">
            <strong>{pct}%</strong>
            <div className="mb-board-progress__body">
              <div className="mb-board-progress__label"><span>Overall progress</span><span>{done} / {tasks.length}</span></div>
              <div className="mb-board-progress__track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${pct}% completed`}>
                <div style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
        </Card>

        <SegmentedTabs
          ariaLabel="Lanes"
          active={lane}
          onChange={(k) => onLane(k as Lane)}
          idPrefix="kg-lane"
          tabs={LANES.map((l) => ({ key: l.key, label: l.label, count: tasks.filter((t) => t.lane === l.key).length }))}
        />

        <div role="tabpanel" id={`kg-lane-${lane}`} aria-labelledby={`kg-lane-tab-${lane}`} className="am-stack">
          {shown.length === 0 ? (
            <EmptyState size="inline" title="Nothing here" description="Work you move into this lane shows up here." icon={<MobileIcon name="work" size={22} />} />
          ) : (
            shown.map((t) => (
              <TaskCard
                key={t.id}
                title={t.title}
                description={t.description}
                leading={<WorkSymbol category={t.category} />}
                tags={taskTags(t)}
                due={t.lane === "done" ? undefined : t.due}
                progress={t.sessions}
                done={t.lane === "done"}
                tint={t.lane === "todo" ? undefined : LANE_TINT[t.lane]}
                onSelect={() => onOpenTask(t.id)}
                ariaLabel={`Open task: ${t.title}`}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}

const SECTIONS = [
  { key: "task", label: "Task", icon: "work" },
  { key: "chat", label: "Chat", icon: "chat" },
  { key: "quiz", label: "Quiz", icon: "quiz" },
  { key: "learn", label: "Learn", icon: "learn" },
  { key: "comments", label: "Notes", icon: "comment" },
] as const;

export interface KaarigarTaskProps {
  task: KaarigarTask;
  acharya: KaarigarAcharya;
  section: string;
  onSection: (key: string) => void;
  onBack: () => void;
  onMove: (id: string, lane: Lane, sessionsDone?: number) => void;
  mic: { status: MicStatus; toggle: () => void; level: LevelSource };
}

/**
 * Task detail (PR #207 `TaskDetailClient`): trade symbol heading, icon section
 * tabs, sessions, the steps, and the one action that moves the work on.
 */
export function KaarigarTaskScreen({ task, acharya, section, onSection, onBack, onMove, mic }: KaarigarTaskProps) {
  const { done, total } = task.sessions;
  const action =
    task.lane === "todo" ? { label: "Start work", run: () => onMove(task.id, "doing") }
    : task.lane === "doing" && done + 1 < total ? { label: `Finish session ${done + 1} of ${total}`, run: () => onMove(task.id, "doing", done + 1) }
    : task.lane === "doing" ? { label: "Submit for review", run: () => onMove(task.id, "review", total) }
    : null;

  return (
    <>
      <ScreenHeader title="" onBack={onBack} backLabel="My work" actions={<MicButton status={mic.status} onToggle={mic.toggle} level={mic.level} size={44} label={`Talk to ${acharya.name}`} />} />
      <div className="am-stack">
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <WorkSymbol category={task.category} size={56} />
          <div style={{ minWidth: 0 }}>
            <h1 className="mb-task-title" style={{ fontSize: 19 }}>{task.title}</h1>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {taskTags(task)}
              {task.due && task.lane !== "done" && <Tag tone={task.due.tone === "overdue" ? "crit" : task.due.tone === "warn" ? "ochre" : "neutral"} icon={<MobileIcon name="clock" size={10} />}>{task.due.label}</Tag>}
            </div>
          </div>
        </div>

        <SegmentedTabs
          ariaLabel="Task sections"
          active={section}
          onChange={onSection}
          idPrefix="kg-task"
          tabs={SECTIONS.map((s) => ({ key: s.key, label: s.label, icon: s.icon, count: s.key === "comments" && task.notes.length ? task.notes.length : undefined }))}
        />

        <div role="tabpanel" id={`kg-task-${section}`} aria-labelledby={`kg-task-tab-${section}`} className="am-stack">
          {section === "task" && (
            <>
              {task.description && <Card><p className="mb-body">{task.description}</p></Card>}
              <Card>
                <SectionHeader title="Sessions" icon={<MobileIcon name="clock" />} right={`${done}/${total}`} />
                <div className="am-task__segments" aria-hidden style={{ marginBottom: 12 }}>
                  {Array.from({ length: total }, (_, i) => <span key={i} data-on={i < done ? "" : undefined} style={{ height: 6 }} />)}
                </div>
                <DetailList
                  rows={[
                    { label: "Acharya", value: acharya.name },
                    { label: "Board", value: task.board },
                  ]}
                />
              </Card>
              {task.steps.length > 0 && (
                <Card>
                  <SectionHeader title="Steps" icon={<MobileIcon name="check-circle" />} />
                  <ol className="mb-steps">{task.steps.map((s) => <li key={s}>{s}</li>)}</ol>
                </Card>
              )}
              {action ? (
                <Button size="lg" block onClick={action.run}>{action.label}</Button>
              ) : (
                <Card tone={task.lane === "done" ? "green" : "slate"}>
                  <p className="mb-body">{task.lane === "done" ? "Approved. Well done." : "Submitted work stays in review until it is checked."}</p>
                </Card>
              )}
            </>
          )}

          {section === "chat" && (
            <EmptyState
              size="inline"
              title={`Ask ${acharya.name}`}
              description="Tap the mic above to talk about this task. The typed chat thread is Kaarigar-only and isn't ported to this demo yet."
              icon={<MobileIcon name="chat" size={22} />}
            />
          )}
          {(section === "quiz" || section === "learn") && (
            <EmptyState
              size="inline"
              title={section === "quiz" ? "Quiz" : "Learn"}
              description="The lesson deck, quiz and celebration are Kaarigar-only (report §5) and aren't ported to this demo yet."
              icon={<MobileIcon name={section === "quiz" ? "quiz" : "learn"} size={22} />}
            />
          )}
          {section === "comments" &&
            (task.notes.length === 0 ? (
              <EmptyState size="inline" title="No notes yet" description="Notes from your supervisor and Acharya show up here." icon={<MobileIcon name="comment" size={22} />} />
            ) : (
              <Card>
                {task.notes.map((n, i) => (
                  <div key={i} className="mb-note">
                    <PersonAvatar name={n.author} size="sm" />
                    <div style={{ minWidth: 0 }}>
                      <span className="mb-note__who">{n.author}</span>
                      <span className="mb-note__when">{n.when}</span>
                      <p className="mb-note__text">{n.text}</p>
                    </div>
                  </div>
                ))}
              </Card>
            ))}
        </div>
      </div>
    </>
  );
}
