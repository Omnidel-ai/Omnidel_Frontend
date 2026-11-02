import { useState, type CSSProperties } from "react";
import { Button } from "../../components/common";
import {
  BottomSheet,
  Card,
  IconButton,
  ListRow,
  MicButton,
  MobileIcon,
  PersonAvatar,
  RowList,
  ScreenHeader,
  StatRow,
  StatTile,
  Tag,
  type LevelSource,
  type MicStatus,
} from "../../components/acharya-mobile";
import type { KaarigarData, KaarigarTask, Lane } from "./types";

/**
 * PR #207's segmented ring: 24 ticks, filled for the share of tasks done.
 * Kaarigar-only (report §5), so it lives here rather than in the kit.
 */
export function ProgressDial({ percent, label }: { percent: number; label: string }) {
  const value = Math.min(100, Math.max(0, Math.round(percent)));
  const lit = Math.round((value / 100) * 24);
  return (
    <div className="mb-dial" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
      <svg viewBox="0 0 100 100" aria-hidden>
        {Array.from({ length: 24 }, (_, i) => {
          const a = ((-90 + (i * 360) / 24) * Math.PI) / 180;
          return (
            <line
              key={i}
              x1={(50 + Math.cos(a) * 37).toFixed(3)}
              y1={(50 + Math.sin(a) * 37).toFixed(3)}
              x2={(50 + Math.cos(a) * 44).toFixed(3)}
              y2={(50 + Math.sin(a) * 44).toFixed(3)}
              stroke={i < lit ? "var(--green-deep)" : "var(--surface-sunk)"}
              strokeWidth="3.8"
              strokeLinecap="round"
            />
          );
        })}
      </svg>
      <div className="mb-dial__value"><strong>{value}<small>%</small></strong></div>
    </div>
  );
}

/** "1 task" / "4 tasks" — counted from the tasks, so it can't drift from them. */
export function taskCount(tasks: KaarigarTask[], slug: string) {
  const n = tasks.filter((t) => t.acharya === slug).length;
  return `${n} ${n === 1 ? "task" : "tasks"}`;
}

export function countLanes(tasks: KaarigarTask[]) {
  const n = (lane: Lane) => tasks.filter((t) => t.lane === lane).length;
  const done = n("done");
  return { todo: n("todo"), doing: n("doing"), review: n("review"), done, total: tasks.length, percent: tasks.length ? (done / tasks.length) * 100 : 0 };
}

export interface KaarigarHomeProps {
  data: KaarigarData;
  tasks: KaarigarTask[];
  mic: { status: MicStatus; toggle: () => void; level: LevelSource };
  onOpenTask: (id: string) => void;
  onOpenLane: (lane: Lane) => void;
  onOpenProfile: (tab?: string) => void;
}

/**
 * KarmYog Home (PR #207 `AcharyasHomeClient`): the guide with an inline mic,
 * the one next step, the journey overview, and the list of guides.
 */
export function KaarigarHome({ data, tasks, mic, onOpenTask, onOpenLane, onOpenProfile }: KaarigarHomeProps) {
  const progress = countLanes(tasks);
  const next = tasks.find((t) => t.lane === "doing") ?? tasks.find((t) => t.lane === "todo");
  const guide = data.acharyas.find((a) => a.featured) ?? data.acharyas[0];
  const first = data.user.name.split(" ")[0];
  const progressText = `${progress.done} completed · ${progress.total} tasks shown`;

  return (
    <>
      <ScreenHeader
        title={`Namaste, ${first}`}
        actions={
          <button type="button" className="am-press" aria-label="Open profile" onClick={() => onOpenProfile()} style={{ border: 0, padding: 0, background: "none", cursor: "pointer" }}>
            <PersonAvatar name={data.user.name} size={40} />
          </button>
        }
      />
      <div className="am-stack">
        <p className="mb-greeting" style={{ marginTop: -6 }}>A little better, every day.</p>

        <Card tone="forest" aria-label="Your Acharya">
          <div className="mb-guide">
            <PersonAvatar name={guide.name} size={56} ring />
            <div className="mb-guide__text">
              <p className="mb-guide__eyebrow">YOUR ACHARYA</p>
              <p className="mb-guide__name">{guide.name}</p>
              <p className="mb-guide__invite">Ask a question. Find your next step.</p>
            </div>
            <MicButton status={mic.status} onToggle={mic.toggle} level={mic.level} size={48} label={mic.status === "idle" ? "Talk now" : "End conversation"} />
          </div>
        </Card>

        {next ? (
          <button type="button" className="mb-next am-press" onClick={() => onOpenTask(next.id)}>
            <span className="mb-next__icon"><MobileIcon name="work" size={22} /></span>
            <span className="mb-next__text">
              <span className="mb-next__eyebrow">{next.lane === "doing" ? "Continue your work" : "Your next step"}</span>
              <span className="mb-next__title">{next.title}</span>
            </span>
            <MobileIcon name="arrow" />
          </button>
        ) : (
          <Card tone="green"><p className="mb-body">The work shown here is complete.</p></Card>
        )}

        <Card aria-label="Your work journey">
          <div className="mb-overview">
            <ProgressDial percent={progress.percent} label={progressText} />
            <div className="mb-overview__text">
              <h2>Your work journey</h2>
              <p>{progressText}</p>
            </div>
            <IconButton label="See progress" onClick={() => onOpenProfile("report")}><MobileIcon name="arrow" /></IconButton>
          </div>
          <div style={{ marginTop: 12 }}>
            <StatRow label="Work by lane">
              <StatTile tone="green" icon={<MobileIcon name="work" />} value={String(progress.todo)} label="Ready to start" onClick={() => onOpenLane("todo")} />
              <StatTile tone="ochre" icon={<MobileIcon name="clock" />} value={String(progress.doing)} label="In progress" onClick={() => onOpenLane("doing")} />
              <StatTile tone="slate" icon={<MobileIcon name="review" />} value={String(progress.review)} label="In review" onClick={() => onOpenLane("review")} />
            </StatRow>
          </div>
        </Card>

        <div className="mb-section-title">
          <h2>Your guides</h2>
          <button type="button" className="mb-link" onClick={() => onOpenLane("todo")}>See all work <MobileIcon name="arrow" size={16} /></button>
        </div>
        <RowList framed label="Your guides">
          {data.acharyas.map((a) => (
            <ListRow
              key={a.slug}
              leading={<PersonAvatar name={a.name} size="lg" />}
              title={a.name}
              subtitle={a.role}
              trailing={<Tag tone={a.featured ? "green" : "neutral"}>{taskCount(tasks, a.slug)}</Tag>}
              onSelect={() => onOpenLane("todo")}
            />
          ))}
        </RowList>
      </div>
    </>
  );
}

const STORY_BG = ["#376a46", "#3f5a72", "#a5711a", "#a74a2d"];

/** Stories — short lessons from each Acharya. The reels player itself is Kaarigar-only and not ported (report §5). */
export function KaarigarStories({ data }: { data: KaarigarData }) {
  const [open, setOpen] = useState<number | null>(null);
  const story = open === null ? null : data.stories[open];
  return (
    <>
      <ScreenHeader title="Stories" />
      <div className="mb-stories">
        {data.stories.map((s, i) => (
          <button key={s.title} type="button" className="mb-story am-press" style={{ "--story-bg": STORY_BG[i % STORY_BG.length] } as CSSProperties} onClick={() => setOpen(i)}>
            <span className="mb-story__play" aria-hidden><MobileIcon name="stories" size={18} /></span>
            <span className="mb-story__title">{s.title}</span>
            <span className="mb-story__meta">{s.acharya} · {s.duration}</span>
          </button>
        ))}
      </div>
      <BottomSheet
        open={story !== null}
        onClose={() => setOpen(null)}
        title={story?.title}
        footer={<Button block variant="secondary" onClick={() => setOpen(null)}>Close</Button>}
      >
        {story && (
          <p className="mb-body">
            {story.acharya} · {story.duration}. The full-screen reels player is Kaarigar-only and isn't ported to this demo yet.
          </p>
        )}
      </BottomSheet>
    </>
  );
}
