import { useState } from "react";
import {
  Button,
  CustomSelect,
  Disclosure,
  FormField,
  Input,
  Menu,
  Modal,
  MultiSelect,
  Textarea,
  emitToast,
} from "../components";
import type { OmniPulseCard, OmniPulseTaskMeta } from "./types";

const STATUSES = ["Planned", "Doing", "Done"];
const PRIORITIES = ["High", "Med", "Low"];

const PRIORITY_DOT: Record<string, string> = {
  High: "var(--crit)",
  Med: "var(--ochre)",
  Low: "var(--ink-mute)",
};

export interface TaskModalProps {
  card: OmniPulseCard;
  /** List the card sits in, shown as its status chip. */
  status: string;
  meta: OmniPulseTaskMeta;
  people: string[];
  onClose: () => void;
  onSave: (next: Partial<OmniPulseCard>) => void;
}

/**
 * The task sheet — everything a card holds, on one scrolling page.
 *
 * Its own layout rather than the master dialog's: the fields are grouped into
 * foldable sections (Description, Task Details, Man Power, Subtasks, Files)
 * with the comment thread beside them, and the header carries the done circle,
 * the title, the status and priority chips and Save. That shape is the
 * application's, and it is a genuinely different form from "a record with a
 * flat field list".
 *
 * Every control in it is a shared component; nothing new was invented for the
 * sheet except the way they are arranged.
 */
export function TaskModal({ card, status, meta, people, onClose, onSave }: TaskModalProps) {
  const [title, setTitle] = useState(card.title);
  const [done, setDone] = useState(card.done);
  const [priority, setPriority] = useState(card.priority);
  const [taskStatus, setTaskStatus] = useState(status);
  const [description, setDescription] = useState(meta.description ?? "");
  const [taskType, setTaskType] = useState(meta.taskType ?? "");
  const [acharya, setAcharya] = useState(meta.acharya ?? "");
  const [mission, setMission] = useState(meta.mission ?? "");
  const [impact, setImpact] = useState(meta.missionImpact ?? "");
  const [assignedTo, setAssignedTo] = useState<string[]>(card.assignees);
  const [assignDate, setAssignDate] = useState(meta.assignDate ?? "");
  const [deadline, setDeadline] = useState(card.due ?? "");
  const [sessions, setSessions] = useState(String(meta.sessions ?? 1));
  const [breaks, setBreaks] = useState(String(meta.breaks ?? 1));

  const dirty =
    title !== card.title ||
    done !== card.done ||
    priority !== card.priority ||
    taskStatus !== status ||
    deadline !== (card.due ?? "") ||
    assignedTo.join() !== card.assignees.join() ||
    description !== (meta.description ?? "");

  function save() {
    onSave({ title, done, priority, due: deadline, assignees: assignedTo });
    emitToast("Task saved", "success");
  }

  return (
    <Modal open onClose={onClose} size="xl" hideClose>
      <div className="tsk">
        <header className="tsk__head">
          <button
            type="button"
            role="checkbox"
            aria-checked={done}
            aria-label={done ? "Mark not done" : "Mark done"}
            onClick={() => setDone((d) => !d)}
            className={`tsk__check${done ? " tsk__check--on" : ""}`}
          >
            {done && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>

          <input
            className="tsk__title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Task title"
          />

          <Button size="sm" disabled={!dirty} onClick={save}>
            Save
          </Button>
          <button type="button" className="tsk__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="tsk__chips">
          <span className="tsk__chip tsk__chip--status">{taskStatus}</span>
          <span className="tsk__chip tsk__chip--pri">{priority}</span>
          <Button variant="secondary" size="sm" onClick={() => emitToast("Labels — demo", "info")}>
            + Add label
          </Button>
        </div>

        <div className="tsk__body themed-scroll-y">
          <div className="tsk__main">
            <Disclosure title="Description" divided>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What has to happen, and what done looks like."
                rows={4}
                aria-label="Description"
              />
            </Disclosure>

            <Disclosure title="Task Details" divided>
              <div className="tsk__grid">
                <FormField label="Status">
                  <CustomSelect
                    value={taskStatus}
                    onChange={setTaskStatus}
                    options={STATUSES.map((s) => ({ value: s, label: s }))}
                    aria-label="Status"
                  />
                </FormField>
                <FormField label="Priority">
                  <CustomSelect
                    value={priority}
                    onChange={setPriority}
                    options={PRIORITIES.map((p) => ({
                      value: p,
                      label: p.toLowerCase(),
                      color: PRIORITY_DOT[p],
                    }))}
                    aria-label="Priority"
                  />
                </FormField>
                <FormField label="Task type">
                  <CustomSelect
                    value={taskType}
                    onChange={setTaskType}
                    options={(meta.taskTypes ?? []).map((t) => ({ value: t, label: t }))}
                    placeholder="Pick a type"
                    aria-label="Task type"
                  />
                </FormField>
                <FormField label="Acharya">
                  <CustomSelect
                    value={acharya}
                    onChange={setAcharya}
                    options={(meta.acharyas ?? []).map((a) => ({ value: a, label: a }))}
                    placeholder="Pick an acharya"
                    aria-label="Acharya"
                  />
                </FormField>
                <FormField label="Mission">
                  <CustomSelect
                    value={mission}
                    onChange={setMission}
                    options={(meta.missions ?? []).map((m) => ({ value: m, label: m }))}
                    placeholder="Project default"
                    aria-label="Mission"
                  />
                </FormField>
                <Input
                  label="Mission impact"
                  value={impact}
                  onChange={(e) => setImpact(e.target.value)}
                  placeholder="How does this task impact mission?"
                />
              </div>
            </Disclosure>

            <Disclosure title="Man Power Details" divided>
              <div className="tsk__grid">
                <FormField label="Assigned to">
                  <MultiSelect
                    options={people.map((p) => ({ value: p, label: p }))}
                    value={assignedTo}
                    onChange={setAssignedTo}
                    placeholder="Nobody yet"
                    showChips
                  />
                </FormField>
                <Input
                  label="Assign date"
                  type="date"
                  value={assignDate}
                  onChange={(e) => setAssignDate(e.target.value)}
                />
                <Input label="Assigned by" value={meta.assignedBy ?? ""} readOnly disabled />
                <Input
                  label="Deadline date"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
                <Input label="Created" value={meta.created ?? ""} readOnly disabled />
                <Input
                  label="Sessions (45 min each)"
                  type="number"
                  value={sessions}
                  onChange={(e) => setSessions(e.target.value)}
                  hint="A session is one focused 45-minute block."
                />
                <Input
                  label="Extra breaks · whole task · default: 1"
                  type="number"
                  value={breaks}
                  onChange={(e) => setBreaks(e.target.value)}
                />
              </div>
            </Disclosure>

            <Disclosure
              title="Subtasks"
              divided
              actions={
                <>
                  <Button variant="secondary" size="sm" onClick={() => emitToast("Subtasks — demo", "info")}>
                    + Add subtask
                  </Button>
                  <Menu
                    label="Subtask actions"
                    trigger="⋮"
                    items={[
                      { label: "Convert to checklist", onClick: () => undefined },
                      { label: "Copy from template", onClick: () => undefined },
                    ]}
                  />
                </>
              }
            >
              <p className="tsk__empty">No subtasks yet</p>
            </Disclosure>

            <Disclosure
              title="Files"
              meta={`(${card.attachments})`}
              actions={
                <Button size="sm" onClick={() => emitToast("Files — demo", "info")}>
                  + Add File
                </Button>
              }
            >
              {card.attachments === 0 ? (
                <p className="tsk__empty">No files attached yet</p>
              ) : (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {Array.from({ length: card.attachments }).map((_, i) => (
                    <span key={i} className="tsk__file">
                      File {i + 1}
                    </span>
                  ))}
                </div>
              )}
            </Disclosure>
          </div>

          <aside className="tsk__side">
            <Disclosure
              title="Comments & Notes"
              actions={
                <Button size="sm" onClick={() => emitToast("Comments — demo", "info")}>
                  + Add Comment
                </Button>
              }
            >
              {card.comments === 0 ? (
                <p className="tsk__empty">No comments yet</p>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {Array.from({ length: card.comments }).map((_, i) => (
                    <div key={i} className="tsk__comment">
                      <span className="tsk__comment-who">{card.assignees[0] ?? "Someone"}</span>
                      <span className="tsk__comment-body">
                        Comment {i + 1} on this task — the thread is demo content.
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Disclosure>
          </aside>
        </div>
      </div>
    </Modal>
  );
}
