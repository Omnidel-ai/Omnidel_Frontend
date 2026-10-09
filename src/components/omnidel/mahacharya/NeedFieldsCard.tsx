"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { CustomSelect } from "@/components/omnidel/custom-select";
import { fetchJson } from "@/lib/client/fetch-json";
import { useTr } from "@/lib/client/language";

export interface NeedFieldInput {
  field: string;
  label: string;
  type: string;
  /**
   * Fixed options for a generic select (type === "select") or multiselect
   * (type === "multiselect") field. When present the field renders as a
   * CustomSelect (select) or a checkbox list (multiselect) over these
   * {value,label} pairs — the model/tool supplies the choices, the user never
   * free-types. (board_id / source / team dropdowns are sourced from live
   * endpoints instead; this covers small fixed enumerations like
   * visibility/flow, or multi-answer ones like what a board tracks.)
   * Each option may carry a plain-language `description` — shown as a helper
   * line for the CURRENTLY selected option (select) or each CHECKED option
   * (multiselect), so the user understands what the choice means (e.g. what
   * "Team" visibility grants).
   */
  options?: { value: string; label: string; description?: string }[];
  /**
   * Preselected value(s). For a select this is a single option `value`; for
   * a multiselect it may be an array of option values (or a single value,
   * preselecting just that one). For the live `team` dropdown it is a team
   * NAME (label) the model picked by semantic match — the card resolves it to
   * the real team id client-side, so the model never handles/prints an id.
   * Applied only when args has no value yet.
   */
  default?: string | string[];
}

export interface NeedFieldsCardPayload {
  kind: "need_fields";
  action?: string;
  fields: NeedFieldInput[];
  args?: Record<string, unknown>;
  /**
   * Optional 1–2 line card-level explainer rendered above the fields (e.g. what
   * "Team" vs "Visibility" mean). Plain prose the tool/model supplies.
   */
  explainer?: string;
}

interface TeamOption {
  id: string;
  name: string;
  role?: string;
}

const FILLED_FIELD_LABELS: Record<string, string> = {
  title: "Title",
  phone: "Phone",
  source: "Source",
  value_inr: "Value",
  owner: "Owner",
  owner_user_id: "Owner",
  board_id: "Project",
  assignee: "Assignee",
  due_date: "Due date",
  priority: "Priority",
};

const FILLED_FIELD_ORDER = [
  "title",
  "task_type",
  "phone",
  "board_id",
  "assignee",
  "due_date",
  "priority",
  "source",
  "value_inr",
  "owner",
  "owner_user_id",
];

/** Never show these — internal replay / server-only args, not user-facing
 *  data. Mirrors act-tools.ts's HIDDEN_PROPOSAL_FIELD_KEYS for the confirm
 *  card; this card had no equivalent filter, so contextBoardId (a raw
 *  internal UUID) leaked straight into the "Fill these fields" panel. */
const HIDDEN_FILLED_FIELD_KEYS = new Set([
  "contextBoardId",
  "forceContextBoard",
  "confirmed",
  "clientActionId",
  "client_action_id",
  "placement_hint",
  "task_type_id",
  // Display label for board_id, not a field of its own — it is rendered as the
  // Project value below rather than as a second "Board Name" row.
  "board_name",
  // How many titles the card is asking for. Already stated in the field's own
  // label ("Titles for the 5 tasks"), so a "Count: 5" row would just repeat it.
  "count",
]);

function filledFieldLabel(field: string, action?: string): string {
  if (field === "title" && action === "create_task") return "Task name";
  if (field === "title" && action === "create_lead") return "Title";
  if (field === "task_type") return "Task type";
  if (field === "simple") return "Simple task";
  return FILLED_FIELD_LABELS[field] || field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatFilledArgValue(raw: unknown): string {
  if (raw === undefined || raw === null) return "";
  if (typeof raw === "boolean") return raw ? "Yes" : "";
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  if (typeof raw === "string") return raw.trim();
  return "";
}

interface BoardOption {
  id: string;
  name: string;
  workspace_name?: string | null;
  is_active?: boolean;
}

function isBoardField(f: NeedFieldInput): boolean {
  return f.field === "board_id" || f.type === "board";
}

function isSourceField(f: NeedFieldInput): boolean {
  return f.field === "source" || f.type === "source";
}

/** Generic fixed-option dropdown: an explicit options list the tool supplied. */
function isSelectField(f: NeedFieldInput): boolean {
  return f.type === "select" && Array.isArray(f.options) && f.options.length > 0;
}

/**
 * Generic fixed-option CHECKBOX list: like a select, but several answers can
 * apply at once (e.g. "what does this board track" — Features + Bugs).
 * Value = an array of option `value`s.
 */
function isMultiselectField(f: NeedFieldInput): boolean {
  return f.type === "multiselect" && Array.isArray(f.options) && f.options.length > 0;
}

/**
 * Live team dropdown: options are the caller's own teams they MANAGE, fetched
 * client-side (never from the model). Used by the guided project-setup card so
 * the model only supplies a default team NAME, never an id.
 */
function isTeamField(f: NeedFieldInput): boolean {
  return f.field === "team" || f.type === "team";
}

function resolveTeamId(raw: string, teams: TeamOption[]): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const byId = teams.find((t) => t.id === trimmed);
  if (byId) return byId.id;
  const lower = trimmed.toLowerCase();
  const byName = teams.find((t) => (t.name || "").trim().toLowerCase() === lower);
  return byName?.id || "";
}

function formatSourceOptionLabel(slug: string): string {
  return slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildBoardSelectOptions(boards: BoardOption[]) {
  const active = boards.filter((b) => b.is_active !== false);
  const nameCounts = new Map<string, number>();
  for (const b of active) {
    const key = (b.name || "").trim().toLowerCase();
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
  }
  return active
    .map((b) => {
      const dup = (nameCounts.get((b.name || "").trim().toLowerCase()) ?? 0) > 1;
      const team = (b.workspace_name || "").trim();
      const label =
        team && (dup || active.length > 1)
          ? `${b.name} (${team})`
          : b.name;
      return { value: b.id, label };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

function resolveSourceSlug(
  raw: string,
  options: { value: string; label: string }[],
): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (options.some((o) => o.value === trimmed)) return trimmed;
  const normSlug = trimmed.toLowerCase().replace(/[\s-]+/g, "_");
  const bySlug = options.find((o) => o.value.toLowerCase() === normSlug);
  if (bySlug) return bySlug.value;
  const normLabel = trimmed.toLowerCase().replace(/[\s_-]+/g, " ").trim();
  const byLabel = options.find(
    (o) => o.label.toLowerCase().replace(/[\s_-]+/g, " ").trim() === normLabel,
  );
  return byLabel?.value || "";
}

function resolveBoardId(raw: string, boards: BoardOption[]): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const byId = boards.find((b) => b.id === trimmed);
  if (byId) return byId.id;
  const lower = trimmed.toLowerCase();
  const byName = boards.find((b) => (b.name || "").trim().toLowerCase() === lower);
  if (byName) return byName.id;
  return "";
}

interface NeedFieldsCardProps {
  payload: NeedFieldsCardPayload;
  /** The user's message that triggered this form (shown with parsed filled details). */
  userMessage?: string;
  onSubmit: (
    payload: NeedFieldsCardPayload,
    values: Record<string, string>,
    displayValues: Record<string, string>,
  ) => Promise<void> | void;
}

export function NeedFieldsCard({ payload, userMessage, onSubmit }: NeedFieldsCardProps) {
  const tr = useTr();
  function displayLabel(f: NeedFieldInput): string {
    const explicit = (f.label || "").trim();
    if (explicit) return explicit;
    const fromField = (f.field || "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!fromField) return "Detail";
    return fromField
      .split(" ")
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
      .join(" ");
  }

  const [values, setValues] = useState<Record<string, string>>({});
  const [multiValues, setMultiValues] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string>("");
  const [phase, setPhase] = useState<"idle" | "pending" | "done">("idle");

  const renderFields = useMemo(() => {
    const seen = new Set<string>();
    const out: NeedFieldInput[] = [];
    for (const f of payload.fields) {
      const key = `${f.field}::${f.label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(f);
    }
    return out;
  }, [payload.fields]);

  // Load boards when board_id is a form field OR already filled in args — so the
  // "Project: <uuid>" filled row can resolve to the project name.
  const needsBoards = useMemo(() => {
    if (renderFields.some(isBoardField)) return true;
    const raw = payload.args?.board_id;
    return typeof raw === "string" && raw.trim().length > 0;
  }, [renderFields, payload.args]);
  const needsSources = useMemo(() => renderFields.some(isSourceField), [renderFields]);
  const needsTeams = useMemo(() => renderFields.some(isTeamField), [renderFields]);
  const [boards, setBoards] = useState<BoardOption[]>([]);
  const [boardsLoading, setBoardsLoading] = useState(false);
  const [sourceOptions, setSourceOptions] = useState<{ value: string; label: string }[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const boardOptions = useMemo(() => buildBoardSelectOptions(boards), [boards]);
  // Only teams the caller MANAGES — creating a team/visible project needs manage
  // rights, so offering a team you can't manage would only earn a server refusal.
  const teamOptions = useMemo(
    () => teams.map((t) => ({ value: t.id, label: t.name })),
    [teams],
  );

  useEffect(() => {
    if (!needsBoards) return;
    let cancelled = false;
    setBoardsLoading(true);
    fetchJson<{ items?: BoardOption[] }>("/api/omnipulse/boards?all=1")
      .then((data) => {
        if (cancelled) return;
        const items = Array.isArray(data?.items) ? data.items : [];
        setBoards(items);
      })
      .catch(() => {
        if (!cancelled) setBoards([]);
      })
      .finally(() => {
        if (!cancelled) setBoardsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [needsBoards]);

  useEffect(() => {
    if (!needsTeams) return;
    let cancelled = false;
    setTeamsLoading(true);
    fetchJson<{ items?: TeamOption[] }>("/api/omnipulse/workspaces?relevant=1")
      .then((data) => {
        if (cancelled) return;
        const items = Array.isArray(data?.items) ? data.items : [];
        setTeams(items.filter((t) => t.role === "manager"));
      })
      .catch(() => {
        if (!cancelled) setTeams([]);
      })
      .finally(() => {
        if (!cancelled) setTeamsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [needsTeams]);

  useEffect(() => {
    if (!needsSources) return;
    let cancelled = false;
    setSourcesLoading(true);
    fetchJson<{ sources?: string[] }>("/api/omnimart/pipeline/options")
      .then((data) => {
        if (cancelled) return;
        const slugs = Array.isArray(data?.sources) ? data.sources : [];
        setSourceOptions(
          slugs.map((slug) => ({ value: slug, label: formatSourceOptionLabel(slug) })),
        );
      })
      .catch(() => {
        if (!cancelled) setSourceOptions([]);
      })
      .finally(() => {
        if (!cancelled) setSourcesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [needsSources]);

  const initialValues = useMemo(() => {
    const out: Record<string, string> = {};
    for (const f of renderFields) {
      const current = payload.args?.[f.field];
      out[f.field] =
        typeof current === "string" && current.trim()
          ? current
          : typeof f.default === "string"
            ? f.default
            : "";
    }
    return out;
  }, [renderFields, payload.args]);

  const initialMultiValues = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const f of renderFields) {
      if (!isMultiselectField(f)) continue;
      const current = payload.args?.[f.field];
      if (Array.isArray(current)) {
        out[f.field] = current.map(String);
      } else if (typeof current === "string" && current.trim()) {
        out[f.field] = current.split(",").map((s) => s.trim()).filter(Boolean);
      } else if (Array.isArray(f.default)) {
        out[f.field] = f.default.map(String);
      } else if (typeof f.default === "string" && f.default.trim()) {
        out[f.field] = [f.default];
      } else {
        out[f.field] = [];
      }
    }
    return out;
  }, [renderFields, payload.args]);

  const missingFieldKeys = useMemo(
    () => new Set(renderFields.map((f) => f.field)),
    [renderFields],
  );

  const filledDetails = useMemo(() => {
    const args = payload.args ?? {};
    const seen = new Set<string>();
    const rows: { field: string; label: string; value: string }[] = [];

    const orderedKeys = [
      ...FILLED_FIELD_ORDER.filter((k) => k in args && !HIDDEN_FILLED_FIELD_KEYS.has(k)),
      ...Object.keys(args).filter(
        (k) => !FILLED_FIELD_ORDER.includes(k) && !HIDDEN_FILLED_FIELD_KEYS.has(k),
      ),
    ];

    for (const field of orderedKeys) {
      if (missingFieldKeys.has(field)) continue;
      if (field === "owner_user_id" && seen.has("owner")) continue;
      if (field === "owner" && seen.has("owner_user_id")) continue;
      if (field === "simple" && typeof args.task_type === "string" && args.task_type.trim()) continue;
      if (field === "simple" && args.simple !== true) continue;

      const raw = formatFilledArgValue(args[field]);
      if (!raw) continue;

      let value = raw;
      if (field === "board_id") {
        const fromOptions = boardOptions.find((o) => o.value === raw)?.label;
        const fromBoards = boards.find((b) => b.id === raw)?.name;
        // board_name is the server's own display label for board_id (see
        // enrichActToolResult). It exists so the REPLAY board_id can stay a
        // real id — retest NEW-3, where the label had overwritten the id and
        // the confirm then failed to resolve "Design" back to a project.
        const serverLabel =
          typeof args.board_name === "string" ? args.board_name.trim() : "";
        if (fromOptions) value = fromOptions;
        else if (fromBoards) value = fromBoards;
        else if (serverLabel) value = serverLabel;
        else if (boardsLoading) value = "Loading project…";
        // else keep raw UUID until boards fail to load
      } else if (field === "source") {
        value =
          sourceOptions.find((o) => o.value === raw)?.label || formatSourceOptionLabel(raw);
      }

      const label = filledFieldLabel(field === "owner_user_id" ? "owner" : field, payload.action);
      const key = field === "owner_user_id" ? "owner" : field;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ field: key, label, value });
    }
    return rows;
  }, [payload.args, payload.action, missingFieldKeys, boardOptions, boards, boardsLoading, sourceOptions]);

  function getValue(field: string): string {
    const raw = values[field] ?? initialValues[field] ?? "";
    if (field === "board_id" && boards.length > 0 && raw) {
      if (boardOptions.some((o) => o.value === raw)) return raw;
      return resolveBoardId(raw, boards);
    }
    if (field === "source" && sourceOptions.length > 0 && raw) {
      if (sourceOptions.some((o) => o.value === raw)) return raw;
      return resolveSourceSlug(raw, sourceOptions);
    }
    if (field === "team" && teams.length > 0 && raw) {
      if (teamOptions.some((o) => o.value === raw)) return raw;
      return resolveTeamId(raw, teams);
    }
    return raw;
  }

  function setValue(field: string, next: string) {
    setValues((prev) => ({ ...prev, [field]: next }));
    if (error) setError("");
  }

  function getMultiValue(field: string): string[] {
    return multiValues[field] ?? initialMultiValues[field] ?? [];
  }

  function toggleMultiValue(field: string, optionValue: string) {
    const current = getMultiValue(field);
    const next = current.includes(optionValue)
      ? current.filter((v) => v !== optionValue)
      : [...current, optionValue];
    setMultiValues((prev) => ({ ...prev, [field]: next }));
    if (error) setError("");
  }

  async function handleSubmit() {
    if (phase === "pending" || phase === "done") return;
    const merged: Record<string, string> = {};
    for (const f of renderFields) {
      if (isMultiselectField(f)) {
        const selected = getMultiValue(f.field);
        if (selected.length === 0) {
          setError(`Please select at least one option for ${f.label}.`);
          return;
        }
        merged[f.field] = selected.join(",");
        continue;
      }
      const v = getValue(f.field).trim();
      if (!v) {
        setError(`Please fill ${f.label}.`);
        return;
      }
      merged[f.field] = v;
    }
    setError("");
    setPhase("pending");
    try {
      const display: Record<string, string> = {};
      for (const f of renderFields) {
        const v = merged[f.field];
        if (isMultiselectField(f)) {
          const selected = getMultiValue(f.field);
          display[f.field] = selected
            .map((val) => f.options?.find((o) => o.value === val)?.label || val)
            .join(", ");
        } else if (f.field === "board_id") {
          display[f.field] = boardOptions.find((o) => o.value === v)?.label || v;
        } else if (f.field === "source") {
          display[f.field] = sourceOptions.find((o) => o.value === v)?.label || v;
        } else if (isTeamField(f)) {
          display[f.field] = teamOptions.find((o) => o.value === v)?.label || v;
        } else if (isSelectField(f)) {
          display[f.field] = f.options?.find((o) => o.value === v)?.label || v;
        } else {
          display[f.field] = v;
        }
      }
      await onSubmit(payload, merged, display);
      setPhase("done");
    } catch (err) {
      setPhase("idle");
      setError(err instanceof Error ? err.message : "Couldn't submit these details. Please try again.");
    }
  }

  return (
    <div style={cardStyle} className="nfc-card">
      <style>{NFC_CSS}</style>
      <div style={titleRowStyle}>
        <span style={badgeStyle}>{tr("Details Needed")}</span>
        <span style={titleStyle}>{tr("Fill these fields")}</span>
      </div>

      {payload.explainer?.trim() && (
        <p style={explainerStyle}>{payload.explainer.trim()}</p>
      )}

      {(userMessage?.trim() || filledDetails.length > 0) && (
        <div style={filledSectionStyle}>
          {/* Retest bug 8: this box held the user's own typed sentence with no
              label at all, sitting above the real question — "the user cannot
              tell what that box is asking for". It is context, not an input, so
              it now says so. The rest of the panel already captions itself
              ("Still needed" below), and this makes the pattern consistent. */}
          {userMessage?.trim() && (
            <>
              <span style={sectionCaptionStyle}>{tr("What you asked for")}</span>
              <p style={userMessageStyle}>{userMessage.trim()}</p>
            </>
          )}
          {filledDetails.length > 0 && (
            <ul style={filledListStyle}>
              {filledDetails.map((row) => (
                <li key={row.field} style={filledRowStyle}>
                  <span style={filledLabelStyle}>{row.label}: </span>
                  <strong style={filledValueStyle}>{row.value}</strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {renderFields.length > 0 && (
        <div style={formStyle} className="nfc-form">
          {filledDetails.length > 0 && <span style={remainingLabelStyle}>{tr("Still needed")}</span>}
          {renderFields.map((f, idx) => {
          const label = displayLabel(f);
          if (isBoardField(f)) {
            return (
              <label key={`${f.field}-${idx}`} style={labelStyle}>
                <span style={labelTextStyle}>{label}</span>
                <CustomSelect
                  value={getValue(f.field)}
                  onChange={(v) => setValue(f.field, v)}
                  options={boardOptions}
                  placeholder={boardsLoading ? "Loading projects…" : "Select a project"}
                  disabled={phase !== "idle" || boardsLoading}
                />
              </label>
            );
          }
          if (isSourceField(f)) {
            return (
              <label key={`${f.field}-${idx}`} style={labelStyle}>
                <span style={labelTextStyle}>{label}</span>
                <CustomSelect
                  value={getValue(f.field)}
                  onChange={(v) => setValue(f.field, v)}
                  options={sourceOptions}
                  placeholder={sourcesLoading ? "Loading sources…" : "Select a source"}
                  disabled={phase !== "idle" || sourcesLoading}
                />
              </label>
            );
          }
          if (isTeamField(f)) {
            return (
              <label key={`${f.field}-${idx}`} style={labelStyle}>
                <span style={labelTextStyle}>{label}</span>
                <CustomSelect
                  value={getValue(f.field)}
                  onChange={(v) => setValue(f.field, v)}
                  options={teamOptions}
                  placeholder={teamsLoading ? "Loading teams…" : "Select a team"}
                  disabled={phase !== "idle" || teamsLoading}
                />
              </label>
            );
          }
          if (isSelectField(f)) {
            const selDesc = f.options?.find((o) => o.value === getValue(f.field))?.description;
            return (
              <label key={`${f.field}-${idx}`} style={labelStyle}>
                <span style={labelTextStyle}>{label}</span>
                <CustomSelect
                  value={getValue(f.field)}
                  onChange={(v) => setValue(f.field, v)}
                  options={(f.options ?? []).map((o) => ({ value: o.value, label: o.label }))}
                  placeholder={`Select ${label.toLowerCase()}`}
                  disabled={phase !== "idle"}
                />
                {selDesc?.trim() && <span style={optionHintStyle}>{selDesc.trim()}</span>}
              </label>
            );
          }
          if (isMultiselectField(f)) {
            const selected = getMultiValue(f.field);
            return (
              <div key={`${f.field}-${idx}`} style={labelFullStyle}>
                <span style={labelTextStyle}>{label}</span>
                <div style={checklistStyle}>
                  {(f.options ?? []).map((o) => {
                    const checked = selected.includes(o.value);
                    return (
                      <label key={o.value} style={checklistRowStyle} className="nfc-check">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleMultiValue(f.field, o.value)}
                          disabled={phase !== "idle"}
                          style={checklistInputStyle}
                        />
                        <span style={checklistOptionLabelStyle}>
                          {o.label}
                          {o.description?.trim() && (
                            <span style={optionHintStyle}> — {o.description.trim()}</span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          }
          // Multi-line answer (the "titles for the N tasks, one per line" field
          // the route asks for instead of inventing Task 1 … Task N — retest
          // NEW-2). A single-line input cannot take the newlines the label asks
          // for, so the field type has to be honoured.
          if (f.type === "textarea") {
            return (
              <label key={`${f.field}-${idx}`} style={labelStyle}>
                <span style={labelTextStyle}>{label}</span>
                <textarea
                  value={getValue(f.field)}
                  onChange={(e) => setValue(f.field, e.target.value)}
                  placeholder={tr("One per line")}
                  disabled={phase !== "idle"}
                  rows={4}
                  className="nfc-input"
                  style={{ ...inputStyle, resize: "vertical", minHeight: 72 }}
                />
              </label>
            );
          }
          const htmlType = f.type === "date" ? "date" : "text";
          return (
            <label key={`${f.field}-${idx}`} style={labelStyle}>
              <span style={labelTextStyle}>{label}</span>
              <input
                type={htmlType}
                value={getValue(f.field)}
                onChange={(e) => setValue(f.field, e.target.value)}
                placeholder={label}
                disabled={phase !== "idle"}
                className="nfc-input"
                style={inputStyle}
              />
            </label>
          );
        })}
        </div>
      )}

      <div style={actionsStyle}>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={phase !== "idle"}
          className="nfc-primary"
          style={{ ...primaryBtnStyle, opacity: phase === "idle" ? 1 : 0.65 }}
        >
          {phase === "pending" ? tr("Submitting...") : phase === "done" ? tr("Submitted") : tr("Continue")}
        </button>
      </div>
      {error && <div style={errorStyle}>{error}</div>}
      {phase === "done" && <div style={doneStyle}>{tr("Details sent.")}</div>}
    </div>
  );
}

// Interaction-state deltas inline styles can't express — base look stays
// inline; scoped by the `nfc-` class prefix.
const NFC_CSS = `
.nfc-input:focus { outline: none; border-color: var(--green-deep); }
.nfc-primary { transition: filter .12s ease; }
.nfc-primary:hover:not(:disabled) { filter: brightness(1.08); }
.nfc-primary:disabled { cursor: not-allowed; }
.nfc-check { transition: background-color .12s ease; border-radius: var(--r-sm); }
.nfc-check:hover { background: var(--surface); }
@media (prefers-reduced-motion: reduce) { .nfc-primary, .nfc-check { transition: none; } }
/* Card is the query container so the field grid responds to the card's OWN
   rendered width, not the viewport — this card renders both docked (~340px,
   e.g. the collapsed chat widget bubble) and spacious (~536px+, e.g. the
   project-setup modal) at the same viewport size, so a viewport @media rule
   would wrongly force 2 columns into a docked, still-narrow bubble. */
.nfc-card { container-type: inline-size; width: 100%; }
.nfc-form { grid-template-columns: 1fr; }
@container (min-width: 480px) {
  .nfc-form { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
`;

const cardStyle: CSSProperties = {
  marginTop: 8,
  padding: 12,
  background: "var(--surface)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule-strong)",
  borderRadius: "var(--r-md)",
  // width:100% + padding + border must stay inside the narrow docked column.
  boxSizing: "border-box",
};
const titleRowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 8 };
const badgeStyle: CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 9,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--ink-soft)",
  background: "var(--surface-sunk)",
  padding: "2px 6px",
  borderRadius: 999,
};
const titleStyle: CSSProperties = { fontFamily: "var(--serif)", fontSize: 14, color: "var(--ink)" };
const filledSectionStyle: CSSProperties = {
  marginTop: 8,
  padding: "8px 10px",
  background: "var(--surface-sunk)",
  borderRadius: "var(--r-sm)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
};
/** Caption above the restated request — same treatment as "Still needed". */
const sectionCaptionStyle: CSSProperties = {
  display: "block",
  marginBottom: 4,
  fontFamily: "var(--mono)",
  fontSize: 9,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--ink-soft)",
};
const userMessageStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--sans)",
  fontSize: 12,
  lineHeight: 1.45,
  color: "var(--ink-mute)",
};
const filledListStyle: CSSProperties = {
  margin: "8px 0 0",
  padding: 0,
  listStyle: "none",
  display: "flex",
  flexDirection: "column",
  gap: 4,
};
const filledRowStyle: CSSProperties = {
  fontFamily: "var(--sans)",
  fontSize: 12,
  lineHeight: 1.4,
  color: "var(--ink)",
};
const filledLabelStyle: CSSProperties = { color: "var(--ink-mute)" };
const filledValueStyle: CSSProperties = { fontWeight: 600, color: "var(--ink)" };
const remainingLabelStyle: CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 9,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--ink-soft)",
  gridColumn: "1 / -1",
};
const explainerStyle: CSSProperties = {
  margin: "6px 0 0",
  fontFamily: "var(--sans)",
  fontSize: 12,
  lineHeight: 1.45,
  color: "var(--ink-mute)",
};
const optionHintStyle: CSSProperties = {
  fontFamily: "var(--sans)",
  fontSize: 11,
  lineHeight: 1.4,
  color: "var(--ink-soft)",
};
const checklistStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  padding: "8px 9px",
  background: "var(--surface-sunk)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  borderRadius: "var(--r-sm)",
};
const checklistRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 8,
  padding: "2px 4px",
  margin: "0 -4px",
  cursor: "pointer",
};
const checklistInputStyle: CSSProperties = {
  marginTop: 2,
  accentColor: "var(--green-deep)",
  cursor: "pointer",
};
const checklistOptionLabelStyle: CSSProperties = {
  fontFamily: "var(--sans)",
  fontSize: 12,
  color: "var(--ink)",
  lineHeight: 1.4,
};
// Base is single-column (matches prior stacked behavior + degrades safely
// where @container isn't supported); .nfc-form's container-query rule in
// NFC_CSS switches this to a 2-up grid once the card itself has room.
const formStyle: CSSProperties = { display: "grid", gap: 8, marginTop: 8 };
const labelStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 4 };
// Full-width grid cell: multiselect checkbox groups need the whole row even
// in the 2-up layout, since a checklist can't sensibly sit beside a field.
const labelFullStyle: CSSProperties = { ...labelStyle, gridColumn: "1 / -1" };
const labelTextStyle: CSSProperties = { fontFamily: "var(--sans)", fontSize: 12, color: "var(--ink-mute)" };
const inputStyle: CSSProperties = {
  padding: "7px 9px",
  fontFamily: "var(--sans)",
  fontSize: 12,
  color: "var(--ink)",
  background: "var(--page)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  borderRadius: "var(--r-sm)",
  outline: "none",
};
const actionsStyle: CSSProperties = { display: "flex", gap: 8, marginTop: 10 };
const primaryBtnStyle: CSSProperties = {
  padding: "7px 13px",
  fontFamily: "var(--sans)",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--page)",
  background: "var(--green-deep)",
  borderWidth: 0,
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
};
const errorStyle: CSSProperties = {
  marginTop: 8,
  fontFamily: "var(--sans)",
  fontSize: 12,
  color: "var(--crit)",
};
const doneStyle: CSSProperties = {
  marginTop: 8,
  fontFamily: "var(--sans)",
  fontSize: 12,
  color: "var(--green-deep)",
  fontWeight: 500,
};
