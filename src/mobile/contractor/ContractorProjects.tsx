import { useMemo, useState } from "react";
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
  TaskCard,
  colorTagStyle,
} from "../../components/acharya-mobile";
import type { Project, PulseLane, PulseTask, Team } from "./types";

export function laneOf(lanes: PulseLane[], key: string) {
  return lanes.find((l) => l.key === key) ?? lanes[0];
}

export interface ContractorProjectsProps {
  projects: Project[];
  tasks: PulseTask[];
  onOpen: (id: string) => void;
}

/** Projects (OmniPulse `HomeScreen` tab=projects): three counts, then every project with its open count. */
export function ContractorProjects({ projects, tasks, onOpen }: ContractorProjectsProps) {
  const [most, setMost] = useState(true);
  const openCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tasks) if (t.lane !== "done") counts[t.projectId] = (counts[t.projectId] ?? 0) + 1;
    return counts;
  }, [tasks]);
  const open = (id: string) => openCounts[id] ?? 0;
  const sorted = useMemo(
    () => [...projects].sort((a, b) => {
      const d = (openCounts[b.id] ?? 0) - (openCounts[a.id] ?? 0);
      return (most ? d : -d) || a.name.localeCompare(b.name);
    }),
    [projects, openCounts, most],
  );
  const totalOpen = tasks.filter((t) => t.lane !== "done").length;

  return (
    <>
      <ScreenHeader title="Projects" sticky />
      <div className="am-stack" style={{ paddingTop: 14 }}>
        <StatRow label="Your projects">
          <StatTile layout="row" tone="ochre" icon={<MobileIcon name="projects" />} value={String(projects.length)} label="Projects" />
          <StatTile layout="row" tone="green" icon={<MobileIcon name="check-circle" />} value={String(totalOpen)} label="Open" />
          <StatTile layout="row" tone="slate" icon={<MobileIcon name="teams" />} value={String(new Set(projects.map((p) => p.team)).size)} label="Teams" />
        </StatRow>
        <Card flush>
          <SectionHeader
            variant="rule"
            title="My projects"
            icon={<MobileIcon name="projects" />}
            right={
              <>
                <button type="button" className="mb-sort am-press" onClick={() => setMost((v) => !v)} aria-label="Sort by">
                  <MobileIcon name="sort" size={12} /> {most ? "Most tasks" : "Fewest tasks"}
                </button>
                {projects.length}
              </>
            }
          />
          <RowList>
            {sorted.map((p) => {
              const n = open(p.id);
              return (
                <ListRow
                  key={p.id}
                  accent={p.color}
                  title={p.name}
                  subtitle={<><Tag size="xs">T: {p.team}</Tag><Tag size="xs" tone={n > 0 ? "ochre" : "green"}>{n > 0 ? `${n} left` : "All done"}</Tag></>}
                  onSelect={() => onOpen(p.id)}
                />
              );
            })}
          </RowList>
        </Card>
      </div>
    </>
  );
}

export interface ContractorProjectProps {
  project: Project;
  lanes: PulseLane[];
  tasks: PulseTask[];
  team?: Team;
  onBack: () => void;
  onOpenTask: (id: string) => void;
  onCreate: (task: PulseTask) => void;
}

/** One project's board (OmniPulse `ProjectScreen`): lane chips, task rows, and New task in a sheet. */
export function ContractorProject({ project, lanes, tasks, team, onBack, onOpenTask, onCreate }: ContractorProjectProps) {
  const [lane, setLane] = useState("all");
  const [sheet, setSheet] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [who, setWho] = useState("none");
  const [urgent, setUrgent] = useState("normal");
  const mine = tasks.filter((t) => t.projectId === project.id);
  const shown = lane === "all" ? mine : mine.filter((t) => t.lane === lane);
  const kaarigars = (team?.members ?? []).filter((m) => m.role === "Kaarigar");

  const create = () => {
    const n = 400 + tasks.length;
    onCreate({
      id: `t-${n}`, projectId: project.id, code: `#${n}`, lane: "todo", title: title.trim(), description: desc.trim(),
      assignee: who === "none" ? null : who, due: "No date", priority: urgent === "urgent" ? "urgent" : "normal",
      comments: 0, attachments: 0, notes: [], files: [], activity: ["Created just now"],
    });
    setSheet(false);
    setTitle("");
    setDesc("");
    setWho("none");
    setUrgent("normal");
    setLane("all");
  };

  return (
    <>
      <ScreenHeader
        title=""
        onBack={onBack}
        backLabel="Projects"
        actions={<Button size="sm" iconLeft={<MobileIcon name="check" size={14} />} onClick={() => setSheet(true)}>New task</Button>}
      />
      <div className="am-stack">
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span className="am-row__accent" style={{ background: project.color, height: 40 }} aria-hidden />
          <div>
            <h1 className="mb-task-title" style={{ fontSize: 22 }}>{project.name}</h1>
            <p className="mb-greeting" style={{ margin: "2px 0 0" }}>Team: {project.team}</p>
          </div>
        </div>

        <div className="mb-filters" role="group" aria-label="Filter by lane">
          {[{ key: "all", label: "All", color: "" }, ...lanes].map((l) => (
            <button key={l.key} type="button" className="mb-chip am-press" aria-pressed={lane === l.key} onClick={() => setLane(l.key)}>
              {l.color && <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: l.color }} />}
              {l.label}
              <span style={{ font: "700 11px/1 var(--mono)", opacity: 0.75 }}>{l.key === "all" ? mine.length : mine.filter((t) => t.lane === l.key).length}</span>
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <EmptyState size="inline" title="No tasks here" description="Add one with New task, or pick another lane." icon={<MobileIcon name="projects" size={22} />} />
        ) : (
          shown.map((t) => {
            const l = laneOf(lanes, t.lane);
            return (
              <TaskCard
                key={t.id}
                code={t.code}
                title={t.title}
                tags={<><Tag size="xs" style={colorTagStyle(l.color)}>{l.label}</Tag>{t.priority === "urgent" && <Tag size="xs" tone="crit">Urgent</Tag>}</>}
                due={{ label: t.due }}
                comments={t.comments}
                attachments={t.attachments}
                assignee={t.assignee}
                reserveAssignee
                done={t.lane === "done"}
                onSelect={() => onOpenTask(t.id)}
              />
            );
          })
        )}
      </div>

      <BottomSheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="New task"
        footer={<Button block size="lg" disabled={!title.trim()} onClick={create}>Create task</Button>}
      >
        <div className="am-stack">
          <label className="mb-field">
            <span>Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" autoFocus />
          </label>
          <label className="mb-field">
            <span>Details</span>
            <textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Anything the kaarigar should know" />
          </label>
          <div className="mb-field">
            <span>Give it to</span>
            <ChoiceGroup ariaLabel="Assignee" value={who} onChange={setWho} options={[{ value: "none", label: "Nobody yet" }, ...kaarigars.map((m) => ({ value: m.name, label: m.name }))]} />
          </div>
          <div className="mb-field">
            <span>Priority</span>
            <ChoiceGroup ariaLabel="Priority" layout="pill" value={urgent} onChange={setUrgent} options={[{ value: "normal", label: "Normal" }, { value: "urgent", label: "Urgent" }]} />
          </div>
        </div>
      </BottomSheet>
    </>
  );
}

export interface ContractorTaskProps {
  task: PulseTask;
  project?: Project;
  lanes: PulseLane[];
  tab: string;
  onTab: (tab: string) => void;
  onBack: () => void;
}

/** One task (OmniPulse `TaskScreen`): title, details, then Notes / Files / Activity. */
export function ContractorTask({ task, project, lanes, tab, onTab, onBack }: ContractorTaskProps) {
  const lane = laneOf(lanes, task.lane);
  return (
    <>
      <ScreenHeader title="" onBack={onBack} backLabel={project?.name ?? "Back"} />
      <div className="am-stack">
        <div>
          <p className="mb-eyebrow">{task.code}</p>
          <h1 className="mb-task-title">{task.title}</h1>
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <Tag style={colorTagStyle(lane.color)}>{lane.label}</Tag>
            {task.priority === "urgent" && <Tag tone="crit">Urgent</Tag>}
          </div>
        </div>
        <Card flush>
          <SectionHeader variant="rule" title="Details" icon={<MobileIcon name="info" />} />
          <div style={{ padding: 12 }}>
            <DetailList
              emptyValue="—"
              rows={[
                { label: "Assigned to", value: task.assignee ? <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><PersonAvatar name={task.assignee} size={20} />{task.assignee}</span> : "" },
                { label: "Due", value: task.due },
                { label: "Project", value: project?.name },
                { label: "Lane", value: lane.label },
              ]}
            />
            {task.description && <p className="mb-body" style={{ marginTop: 14 }}>{task.description}</p>}
          </div>
        </Card>

        <SegmentedTabs
          variant="plate"
          ariaLabel="Task sections"
          active={tab}
          onChange={onTab}
          idPrefix="op-task"
          tabs={[
            { key: "notes", label: "Notes", icon: "comment", count: task.notes.length },
            { key: "files", label: "Files", icon: "paperclip", count: task.files.length },
            { key: "activity", label: "Activity", icon: "clock" },
          ]}
        />
        <div role="tabpanel" id={`op-task-${tab}`} aria-labelledby={`op-task-tab-${tab}`}>
          {tab === "notes" &&
            (task.notes.length ? (
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
            ) : (
              <EmptyState size="inline" title="No notes" icon={<MobileIcon name="comment" size={22} />} />
            ))}
          {tab === "files" &&
            (task.files.length ? (
              <Card>
                <ul className="mb-files">
                  {task.files.map((f) => <li key={f.name}><MobileIcon name="paperclip" size={18} />{f.name}<small>{f.size}</small></li>)}
                </ul>
              </Card>
            ) : (
              <EmptyState size="inline" title="No files" icon={<MobileIcon name="paperclip" size={22} />} />
            ))}
          {tab === "activity" && (
            <Card>
              <ul className="mb-activity">{task.activity.map((a) => <li key={a}>{a}</li>)}</ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
