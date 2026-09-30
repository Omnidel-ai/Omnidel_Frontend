import { useMemo, useState } from "react";
import { Button, Modal, emitToast } from "../components";
import { FieldControl, coerce, defaultFor, validate } from "../admin";
import type { DemoField } from "../data/types";
import type { OmniPulseProject } from "./types";

export interface ProjectFormProps {
  open: boolean;
  /** The project being edited, or null to create one. */
  project: OmniPulseProject | null;
  teams: { id: string; name: string }[];
  people: string[];
  onClose: () => void;
  onSave: (project: OmniPulseProject) => void;
}

/**
 * New project, or the settings of one that exists.
 *
 * The same form for both, because a project's fields do not change once it has
 * an id — only the title on the sheet and what the save is called.
 *
 * It reuses the admin forms' `FieldControl`, `defaultFor`, `validate` and
 * `coerce` rather than hand-rolling inputs. A project is not reference data
 * and does not belong in a master descriptor, but the *controls* are the same
 * controls, and a second implementation of "required field, error under it" is
 * a second implementation that drifts.
 */
export function ProjectForm({ open, project, teams, people, onClose, onSave }: ProjectFormProps) {
  const fields = useMemo<DemoField[]>(
    () => [
      { key: "name", label: "Project", type: "text", required: true, placeholder: "Newtown duplex" },
      {
        key: "teamId",
        label: "Team",
        type: "select",
        required: true,
        options: teams.map((t) => ({ value: t.id, label: t.name })),
      },
      {
        key: "lead",
        label: "Lead",
        type: "select",
        required: true,
        hint: "Who answers for this project when it slips.",
        options: people.map((p) => ({ value: p, label: p })),
      },
      {
        key: "visibility",
        label: "Visibility",
        type: "select",
        required: true,
        options: [
          { value: "Team", label: "Team — everyone in the team" },
          { value: "Private", label: "Private — the lead and whoever is assigned" },
          { value: "Workspace", label: "Workspace — anyone in the workspace" },
        ],
      },
      {
        key: "description",
        label: "What it is",
        type: "textarea",
        placeholder: "One line, so a person opening the board knows what they are looking at.",
      },
    ],
    [people, teams],
  );

  // Keyed on the project, so opening a different one starts from its values.
  const [values, setValues] = useState<Record<string, unknown>>(() => initial(fields, project));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [key, setKey] = useState(project?.id ?? "new");

  const openingKey = project?.id ?? "new";
  if (openingKey !== key) {
    setKey(openingKey);
    setValues(initial(fields, project));
    setErrors({});
  }

  function set(field: string, value: unknown) {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => (e[field] ? { ...e, [field]: "" } : e));
  }

  function save() {
    const found = validate(fields, values);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    const clean = coerce(fields, values);
    const team = teams.find((t) => t.id === clean.teamId);
    const next: OmniPulseProject = {
      // An existing project keeps its id, its board and its counts — this form
      // edits the description of a project, never its work.
      ...(project ?? emptyProject()),
      name: String(clean.name ?? "").trim(),
      teamId: String(clean.teamId ?? ""),
      team: team?.name ?? "",
      lead: String(clean.lead ?? ""),
      visibility: String(clean.visibility ?? "Team"),
      description: String(clean.description ?? "").trim(),
    };
    onSave(next);
    emitToast(project ? `${next.name} updated` : `${next.name} created`, "success");
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={project ? `Project settings — ${project.name}` : "New project"}
      description={
        project
          ? "Renaming a project or moving it to another team does not touch its board."
          : "A project opens with an empty board. Lists and cards come after."
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>{project ? "Save changes" : "Create project"}</Button>
        </>
      }
    >
      <div style={{ display: "grid", gap: 14 }}>
        {fields.map((f) => (
          <FieldControl
            key={f.key}
            field={f}
            value={values[f.key]}
            error={errors[f.key]}
            onChange={(v) => set(f.key, v)}
          />
        ))}
      </div>
    </Modal>
  );
}

function initial(fields: DemoField[], project: OmniPulseProject | null): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    out[f.key] = project
      ? ((project as unknown as Record<string, unknown>)[f.key] ?? defaultFor(f))
      : defaultFor(f);
  }
  return out;
}

/** A project with no work in it yet — the counts a new board starts on. */
function emptyProject(): OmniPulseProject {
  return {
    id: `p${Date.now()}`,
    name: "",
    team: "",
    teamId: "",
    lead: "",
    visibility: "Team",
    description: "",
    cards: 0,
    total: 0,
    mine: 0,
    planned: 0,
    doing: 0,
    done: 0,
  };
}
