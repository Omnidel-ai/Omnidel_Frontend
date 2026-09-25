import { Menu, PinButton } from "../components";
import type { OmniPulseProject } from "./types";

/**
 * A project tile.
 *
 * Reads top to bottom the way the application's does: name, whether it is
 * active, who can see it, the brief, then the work — a proportion bar, the
 * card and task counts, and the three states spelled out with their dots.
 *
 * The dots are never the only carrier: every one has its number and its word
 * beside it.
 */
export function ProjectCard({
  project,
  pinned,
  onPinChange,
  onOpen,
}: {
  project: OmniPulseProject;
  pinned: boolean;
  onPinChange: (next: boolean) => void;
  onOpen: () => void;
}) {
  const { done, doing, planned } = project;
  const total = done + doing + planned;

  return (
    <div className="opx-proj">
      <button type="button" className="opx-proj__body" onClick={onOpen} title={`Open ${project.name}`}>
        <span className="opx-proj__name">{project.name}</span>

        <span className={`opx-status ${project.archived ? "opx-status--off" : ""}`}>
          <span className="opx-status__dot" aria-hidden="true" />
          {project.archived ? "Archived" : "Active"}
        </span>

        <span className="opx-proj__vis">{project.visibility}</span>

        {project.description && <span className="opx-proj__desc">{project.description}</span>}

        <span className="opx-proj__work">
          {total > 0 ? (
            <span className="opx-bar" aria-hidden="true">
              {done > 0 && <span style={{ width: `${(done / total) * 100}%`, background: "var(--green-deep)" }} />}
              {doing > 0 && <span style={{ width: `${(doing / total) * 100}%`, background: "var(--ochre)" }} />}
              {planned > 0 && <span style={{ width: `${(planned / total) * 100}%`, background: "var(--rule)" }} />}
            </span>
          ) : (
            <span className="opx-bar opx-bar--empty" aria-hidden="true" />
          )}

          <span className="opx-proj__counts">
            {project.cards} {project.cards === 1 ? "card" : "cards"}
            {" · "}
            {total > 0 ? `${project.total} ${project.total === 1 ? "task" : "tasks"}` : "No tasks yet"}
          </span>

          {total > 0 && (
            <span className="opx-legend">
              <span>
                <i className="opx-legend__dot" style={{ background: "var(--green-deep)" }} />
                {done} done
              </span>
              <span>
                <i className="opx-legend__dot" style={{ background: "var(--ochre)" }} />
                {doing} doing
              </span>
              <span>
                <i className="opx-legend__dot" style={{ background: "var(--rule-strong)" }} />
                {planned} planned
              </span>
            </span>
          )}
        </span>
      </button>

      <div className="opx-proj__actions">
        <Menu
          size="sm"
          label={`${project.name} actions`}
          items={[
            { label: "Open board", onClick: onOpen },
            { label: pinned ? "Unpin" : "Pin to sidebar", onClick: () => onPinChange(!pinned) },
            { label: "Project settings", onClick: () => undefined },
            { label: "Archive project", onClick: () => undefined, tone: "danger", separated: true },
          ]}
        />
        <PinButton pinned={pinned} onToggle={onPinChange} label={project.name} size="sm" />
      </div>
    </div>
  );
}
