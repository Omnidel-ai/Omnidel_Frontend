import type { ReactNode } from "react";
import { MobileIcon } from "./Icon";
import { PersonAvatar } from "./PersonAvatar";
import { Tag } from "./Tag";

export type DueTone = "neutral" | "warn" | "overdue";
const DUE_TAG = { neutral: "neutral", warn: "ochre", overdue: "crit" } as const;

export interface TaskCardProps {
  title: string;
  /** A ticket code shown in mono before the title — "#214", "KF-12". */
  code?: string;
  /** One line, ellipsised. */
  description?: string;
  /** Left slot — Kaarigar's trade symbol (`WorkSymbol`), or nothing. */
  leading?: ReactNode;
  /** Tags qualifying the title: status, board, sessions, score. */
  tags?: ReactNode;
  /** Due date, pinned right in the tag row, toned by urgency. */
  due?: { label: string; tone?: DueTone };
  /** Comment and attachment counts — Contractor's row. Zero hides each. */
  comments?: number;
  attachments?: number;
  /** Whoever the task is with. Their avatar sits in a fixed slot, so titles end at the same x. */
  assignee?: string | null;
  /** Reserve the assignee slot even when nobody is assigned (keeps a list aligned). */
  reserveAssignee?: boolean;
  /** Sessions done out of planned — drawn as one segment per session. Hidden for 0 or 1 planned. */
  progress?: { done: number; total: number };
  /** Struck through, with a tick. */
  done?: boolean;
  /** Wash the card by lane — Kaarigar's board does. */
  tint?: "doing" | "review" | "done";
  href?: string;
  onSelect?: () => void;
  ariaLabel?: string;
}

/**
 * One task in a list.
 *
 * Contractor's `TaskRow` and Kaarigar's `TaskCardLink` read the same task and
 * lay it out the same way: title first, two lines max, then a row of small
 * facts with the date on the right. Contractor adds counts and an assignee;
 * Kaarigar adds a trade symbol, a description and session progress. Each extra
 * is an optional prop here, so each app passes what it shows and nothing more.
 */
export function TaskCard(props: TaskCardProps) {
  const { title, code, description, leading, tags, due, comments, attachments, assignee, reserveAssignee, progress, done, tint, href, onSelect, ariaLabel } = props;
  const showProgress = progress && progress.total > 1;
  const doneCount = progress ? Math.min(progress.done, progress.total) : 0;
  const hasMeta = tags || due || comments || attachments;
  const className = `am-task${href || onSelect ? " am-press" : ""}`;

  const body = (
    <>
      {leading && <span className="am-task__lead">{leading}</span>}
      <span className="am-task__body">
        <span style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          {done && <span style={{ color: "var(--ok)", marginTop: 1, display: "inline-flex" }}><MobileIcon name="check-circle" size={16} strokeWidth={2.2} /></span>}
          <span className="am-task__title">
            {code && <span className="am-task__code">{code}</span>}
            {title}
          </span>
        </span>
        {description && <span className="am-task__desc">{description}</span>}
        {hasMeta && (
          <span className="am-task__meta">
            <span className="am-task__tags">
              {tags}
              {comments ? <span className="am-task__count"><MobileIcon name="comment" size={14} />{comments}</span> : null}
              {attachments ? <span className="am-task__count"><MobileIcon name="paperclip" size={14} />{attachments}</span> : null}
            </span>
            {due && (
              <Tag tone={DUE_TAG[due.tone ?? "neutral"]} icon={<MobileIcon name="clock" size={10} strokeWidth={2.2} />}>
                {due.label}
              </Tag>
            )}
          </span>
        )}
        {showProgress && (
          <span className="am-task__progress">
            <span className="am-task__segments" aria-hidden>
              {Array.from({ length: progress.total }, (_, i) => <span key={i} data-on={i < doneCount ? "" : undefined} />)}
            </span>
            <span className="am-task__ratio">{doneCount}/{progress.total}</span>
          </span>
        )}
      </span>
      {(assignee || reserveAssignee) && (
        <span className="am-task__trail">{assignee && <PersonAvatar name={assignee} size="sm" />}</span>
      )}
    </>
  );

  const shared = { className, "data-tint": tint, "data-done": done ? "" : undefined, "aria-label": ariaLabel ?? title };
  if (href) return <a {...shared} href={href} onClick={onSelect}>{body}</a>;
  if (onSelect) return <button {...shared} type="button" onClick={onSelect}>{body}</button>;
  return <div {...shared}>{body}</div>;
}
