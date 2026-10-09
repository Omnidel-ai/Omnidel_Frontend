"use client";

import Link from "next/link";
import { useLang } from "@/lib/i18n/useLang";
import { journeyStrings } from "@/lib/i18n/journey-strings";
import { workProgress } from "@/lib/work-progress";
import type { KarigarTask } from "@/lib/api/tasks";

/** A compact segmented ring represents actual completed assignments. */
export function ProgressDial({ percent, label }: { percent: number; label: string }) {
  const value = Math.min(100, Math.max(0, percent));
  return (
    <div className="journey-dial" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        {Array.from({ length: 24 }, (_, index) => {
          const angle = (-90 + index * 360 / 24) * Math.PI / 180;
          return <line key={index} x1={(50 + Math.cos(angle) * 37).toFixed(3)} y1={(50 + Math.sin(angle) * 37).toFixed(3)} x2={(50 + Math.cos(angle) * 44).toFixed(3)} y2={(50 + Math.sin(angle) * 44).toFixed(3)} stroke={index < Math.round(value / 100 * 24) ? "var(--journey-accent)" : "var(--journey-dial-track)"} strokeWidth="3.8" strokeLinecap="round" />;
        })}
      </svg>
      <div className="journey-dial-value"><strong>{value}<span>%</span></strong></div>
    </div>
  );
}

export default function WorkProgressOverview({ tasks }: { tasks: KarigarTask[] }) {
  const copy = journeyStrings(useLang());
  const progress = workProgress(tasks);
  return (
    <section className="journey-overview" aria-label={copy.journey}>
      <div className="journey-progress-summary">
        <ProgressDial percent={progress.percent} label={copy.progressAria(progress.done, progress.total)} />
        <div><h2>{copy.journey}</h2><p>{copy.progressAria(progress.done, progress.total)}</p></div>
        <Link className="journey-round-link" href="/profile?tab=report" aria-label={copy.progress}><JourneyIcon name="arrow" /></Link>
      </div>
      <div className="journey-status-grid">
        <Link href="/tasks?tab=todo"><span><JourneyIcon name="work" />{copy.ready}</span><strong>{progress.todo}</strong></Link>
        <Link href="/tasks?tab=doing"><span><JourneyIcon name="clock" />{copy.inProgress}</span><strong>{progress.doing}</strong></Link>
        <Link href="/tasks?tab=review"><span><JourneyIcon name="review" />{copy.inReview}</span><strong>{progress.review}</strong></Link>
      </div>
    </section>
  );
}

export type JourneyIconName = "home" | "work" | "progress" | "stories" | "profile" | "clock" | "review" | "arrow" | "mic" | "chat" | "learn" | "quiz" | "type" | "language";
export function JourneyIcon({ name }: { name: JourneyIconName }) {
  const paths: Record<JourneyIconName, React.ReactNode> = {
    home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" /></>,
    work: <><rect x="4" y="5" width="16" height="16" rx="3" /><path d="M9 5V3h6v2M8 11h8M8 16h5" /></>,
    progress: <><path d="M5 20v-5m7 5V9m7 11V4M3 10l6-4 5 1 6-5" /></>,
    stories: <><rect x="4" y="3" width="16" height="18" rx="3" /><path d="m10 8 5 4-5 4Z" /></>,
    profile: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    review: <><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6Z" /><path d="m8 12 3 3 5-6" /></>,
    arrow: <><path d="M5 12h14m-6-6 6 6-6 6" /></>,
    mic: <><rect x="9" y="2" width="6" height="13" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M9 22h6" /></>,
    chat: <><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2v-9.5A9.5 9.5 0 0 1 11.5 3H13a8 8 0 0 1 8 8.5Z" /><path d="M7 9h9M7 14h6" /></>,
    learn: <><path d="M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1Zm0 0v15" /></>,
    quiz: <><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M9 8a3 3 0 0 1 6 0c0 2-3 2-3 4m0 4h.01" /></>,
    type: <><path d="m2 19 6-15 6 15M4 14h8m3 5 4-10 4 10m-6-4h4" /></>,
    language: <><path d="M3 5h12M9 2v3m4 0c0 6-4 10-9 12m1-9c1 4 4 7 8 9m1 4 4-11 4 11m-6-4h5" /></>,
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
