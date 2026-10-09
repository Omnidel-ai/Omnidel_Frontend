"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { ConfirmDialog } from "@/components/omnidel/confirm-dialog";
import {
  draftItemsFromTemplateSteps,
  type DraftChecklistItem,
} from "@/components/omnidel/task-checklist";
import { useTr } from "@/lib/client/language";

export type TemplateStep = { title: string; session_count: number; session_slot: number };

interface BoardTemplateListItem {
  id: string;
  name: string;
  items: Array<{ id: string; title: string; session_count: number; session_slot?: number; sort_order: number }>;
}

function templateSteps(tpl: BoardTemplateListItem): TemplateStep[] {
  return (tpl.items || [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((i) => ({
      title: (i.title || "").trim(),
      session_count: Math.min(8, Math.max(1, Math.floor(Number(i.session_count) || 1))),
      session_slot: Math.min(8, Math.max(1, Math.floor(Number(i.session_slot) || 1))),
    }))
    .filter((i) => i.title.length > 0);
}

/** Longest template whose steps are a prefix of the current subtasks (order + sessions). */
function findActiveTemplateId(
  current: TemplateStep[],
  list: BoardTemplateListItem[],
): string | null {
  if (current.length === 0) return null;
  let best: { id: string; len: number } | null = null;
  for (const tpl of list) {
    const steps = templateSteps(tpl);
    if (steps.length === 0 || current.length < steps.length) continue;
    const matches = steps.every(
      (s, i) =>
        current[i].title === s.title
        && current[i].session_count === s.session_count
        && current[i].session_slot === s.session_slot,
    );
    if (matches && (!best || steps.length > best.len)) {
      best = { id: tpl.id, len: steps.length };
    }
  }
  return best?.id ?? null;
}

interface Props {
  boardId?: string | null;
  canEdit: boolean;
  /** Create-modal drafts (mutually exclusive with taskId apply path). */
  draftItems?: DraftChecklistItem[];
  onDraftChange?: (items: DraftChecklistItem[]) => void;
  /** Edit-modal: persisted checklist on this task. */
  taskId?: string;
  /** Bump TaskChecklist refreshToken after mutate. */
  onTaskChecklistMutated?: () => void;
  /** When set (edit mode), gates the clear/Delete menu item. */
  hasSubtasks?: boolean;
  /** Clamp template session slots to the task's session count. */
  taskSessionCount?: number;
}

type Panel = "menu" | "create" | "copy" | "applyMode" | null;

export function SubtaskTemplateMenu({
  boardId,
  canEdit,
  draftItems,
  onDraftChange,
  taskId,
  onTaskChecklistMutated,
  hasSubtasks,
  taskSessionCount,
}: Props) {
  const tr = useTr();
  const [panel, setPanel] = useState<Panel>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templates, setTemplates] = useState<BoardTemplateListItem[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [pendingSteps, setPendingSteps] = useState<TemplateStep[]>([]);
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);
  /** Template currently applied on this task (detected from subtasks, or set after apply). */
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const isDraftMode = typeof onDraftChange === "function";
  const resolvedBoardId = (boardId || "").trim();
  const enabled = canEdit && !!resolvedBoardId;

  const closeAll = useCallback(() => {
    setPanel(null);
    setError("");
    setTemplateName("");
    setPendingSteps([]);
    setPendingTemplateId(null);
    setClearOpen(false);
  }, []);

  const placeMenu = useCallback(() => {
    const b = btnRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    setMenuPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
  }, []);

  useLayoutEffect(() => {
    if (panel !== "menu") return;
    placeMenu();
    window.addEventListener("scroll", placeMenu, true);
    window.addEventListener("resize", placeMenu);
    return () => {
      window.removeEventListener("scroll", placeMenu, true);
      window.removeEventListener("resize", placeMenu);
    };
  }, [panel, placeMenu]);

  useEffect(() => {
    if (panel !== "menu") return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setPanel(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPanel(null);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [panel]);

  async function loadSourceSteps(): Promise<TemplateStep[]> {
    if (isDraftMode) {
      return (draftItems || [])
        .map((i) => ({
          title: (i.title || "").trim(),
          session_count: Math.min(8, Math.max(1, Math.floor(Number(i.session_count) || 1))),
          session_slot: Math.min(8, Math.max(1, Math.floor(Number(i.session_slot) || 1))),
        }))
        .filter((i) => i.title.length > 0);
    }
    if (!taskId) return [];
    const res = await fetch(`/api/omnipulse/tasks/${taskId}/checklist`);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || "Failed to load subtasks");
    }
    const data = await res.json();
    return ((data.items || []) as Array<{ title?: string; session_count?: number; session_slot?: number }>)
      .map((i) => ({
        title: (i.title || "").trim(),
        session_count: Math.min(8, Math.max(1, Math.floor(Number(i.session_count) || 1))),
        session_slot: Math.min(8, Math.max(1, Math.floor(Number(i.session_slot) || 1))),
      }))
      .filter((i) => i.title.length > 0);
  }

  async function applySteps(steps: TemplateStep[], templateId: string | null) {
    const maxSlots = Math.max(1, Math.min(8, Math.floor(Number(taskSessionCount) || 8)));
    if (isDraftMode && onDraftChange) {
      onDraftChange(draftItemsFromTemplateSteps(steps, maxSlots));
      setActiveTemplateId(templateId);
      return;
    }
    if (!taskId) throw new Error("Missing task");

    const listRes = await fetch(`/api/omnipulse/tasks/${taskId}/checklist`);
    if (!listRes.ok) {
      const d = await listRes.json().catch(() => ({}));
      throw new Error(d.error || "Failed to load subtasks");
    }
    const listData = await listRes.json();
    const existing = (listData.items || []) as Array<{ id: string }>;
    for (const item of existing) {
      const del = await fetch(`/api/omnipulse/tasks/${taskId}/checklist/${item.id}`, { method: "DELETE" });
      if (!del.ok) {
        const d = await del.json().catch(() => ({}));
        throw new Error(d.error || "Failed to clear a subtask");
      }
    }

    for (const step of steps) {
      const res = await fetch(`/api/omnipulse/tasks/${taskId}/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: step.title,
          session_count: step.session_count,
          session_slot: Math.min(maxSlots, Math.max(1, Math.floor(Number(step.session_slot) || 1))),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to add a subtask from the template");
      }
    }
    setActiveTemplateId(templateId);
    onTaskChecklistMutated?.();
  }

  async function clearSubtasks() {
    if (isDraftMode && onDraftChange) {
      onDraftChange([]);
      setActiveTemplateId(null);
      return;
    }
    if (!taskId) throw new Error("Missing task");
    const listRes = await fetch(`/api/omnipulse/tasks/${taskId}/checklist`);
    if (!listRes.ok) {
      const d = await listRes.json().catch(() => ({}));
      throw new Error(d.error || "Failed to load subtasks");
    }
    const listData = await listRes.json();
    const existing = (listData.items || []) as Array<{ id: string }>;
    for (const item of existing) {
      const del = await fetch(`/api/omnipulse/tasks/${taskId}/checklist/${item.id}`, { method: "DELETE" });
      if (!del.ok) {
        const d = await del.json().catch(() => ({}));
        throw new Error(d.error || "Failed to delete a subtask");
      }
    }
    setActiveTemplateId(null);
    onTaskChecklistMutated?.();
  }

  async function openCreate() {
    setError("");
    setBusy(true);
    try {
      const steps = await loadSourceSteps();
      if (steps.length === 0) {
        setError("Add at least one subtask before creating a template");
        setPanel("create");
        return;
      }
      setTemplateName("");
      setPanel("create");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read subtasks");
      setPanel("create");
    } finally {
      setBusy(false);
    }
  }

  async function saveTemplate() {
    setError("");
    setBusy(true);
    try {
      const steps = await loadSourceSteps();
      if (steps.length === 0) throw new Error("Add at least one subtask before creating a template");
      const res = await fetch(`/api/omnipulse/boards/${resolvedBoardId}/checklist-templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: templateName.trim(), items: steps }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to create template");
      closeAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create template");
    } finally {
      setBusy(false);
    }
  }

  async function openCopy() {
    setError("");
    setPanel("copy");
    setTemplatesLoading(true);
    try {
      const res = await fetch(`/api/omnipulse/boards/${resolvedBoardId}/checklist-templates`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load templates");
      const list = (data.items || []) as BoardTemplateListItem[];
      setTemplates(list);
      const current = await loadSourceSteps();
      setActiveTemplateId(findActiveTemplateId(current, list));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
      setTemplates([]);
      setActiveTemplateId(null);
    } finally {
      setTemplatesLoading(false);
    }
  }

  async function deleteTemplate(templateId: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(
        `/api/omnipulse/boards/${resolvedBoardId}/checklist-templates/${templateId}`,
        { method: "DELETE" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to delete template");
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
      if (activeTemplateId === templateId) setActiveTemplateId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete template");
    } finally {
      setBusy(false);
    }
  }

  async function selectTemplate(tpl: BoardTemplateListItem) {
    if (tpl.id === activeTemplateId) return;

    const steps = templateSteps(tpl);
    if (steps.length === 0) {
      setError("That template has no steps");
      return;
    }

    setBusy(true);
    try {
      const existing = await loadSourceSteps();
      if (existing.length === 0) {
        await applySteps(steps, tpl.id);
        closeAll();
        return;
      }
      setPendingSteps(steps);
      setPendingTemplateId(tpl.id);
      setPanel("applyMode");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply template");
    } finally {
      setBusy(false);
    }
  }

  async function confirmReplace() {
    setBusy(true);
    setError("");
    try {
      await applySteps(pendingSteps, pendingTemplateId);
      closeAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply template");
    } finally {
      setBusy(false);
    }
  }

  async function confirmClear() {
    setBusy(true);
    setError("");
    try {
      await clearSubtasks();
      closeAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear subtasks");
      setClearOpen(false);
    } finally {
      setBusy(false);
    }
  }

  if (!enabled) return null;

  const hasDraftSubtasks = isDraftMode
    ? (draftItems || []).some((i) => (i.title || "").trim().length > 0)
    : true;
  const canClear = isDraftMode
    ? (draftItems || []).length > 0
    : !!hasSubtasks;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={tr("Subtask template menu")}
        aria-haspopup="menu"
        aria-expanded={panel === "menu"}
        onClick={() => setPanel((p) => (p === "menu" ? null : "menu"))}
        style={kebabBtnStyle}
      >
        &#8942;
      </button>

      {panel === "menu" && menuPos && typeof document !== "undefined" && createPortal(
        <div ref={menuRef} role="menu" style={{ ...menuPopoverStyle, top: menuPos.top, right: menuPos.right }}>
          <button
            type="button"
            role="menuitem"
            style={menuRowStyle}
            disabled={busy || (isDraftMode ? !hasDraftSubtasks : !hasSubtasks)}
            onClick={() => { void openCreate(); }}
          >
            {tr("Create a template")}
          </button>
          <button
            type="button"
            role="menuitem"
            style={menuRowStyle}
            disabled={busy}
            onClick={() => { void openCopy(); }}
          >
            {tr("Copy a template")}
          </button>
          <button
            type="button"
            role="menuitem"
            style={{ ...menuRowStyle, color: "var(--crit)" }}
            disabled={busy || !canClear}
            onClick={() => {
              setPanel(null);
              setClearOpen(true);
            }}
          >
            {tr("Delete")}
          </button>
        </div>,
        document.body,
      )}

      {(panel === "create" || panel === "copy" || panel === "applyMode") && typeof document !== "undefined" && createPortal(
        <div style={overlayStyle} onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) closeAll(); }}>
          <div style={dialogStyle} role="dialog" aria-modal="true">
            {panel === "create" && (
              <>
                <div style={dialogTitleStyle}>{tr("Create a template")}</div>
                <p style={dialogHintStyle}>{tr("Saves the current subtasks for this project/board.")}</p>
                <label style={labelStyle}>
                  {tr("Template name")}
                  <input
                    autoFocus
                    value={templateName}
                    maxLength={80}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder={tr("e.g. Media process")}
                    style={inputStyle}
                    disabled={busy}
                  />
                </label>
                {error && <div style={errorStyle}>{error}</div>}
                <div style={dialogActionsStyle}>
                  <button type="button" style={btnGhost} disabled={busy} onClick={closeAll}>{tr("Cancel")}</button>
                  <button
                    type="button"
                    style={btnPrimary}
                    disabled={busy || !templateName.trim()}
                    onClick={() => { void saveTemplate(); }}
                  >
                    {busy ? tr("Saving…") : tr("Save template")}
                  </button>
                </div>
              </>
            )}

            {panel === "copy" && (
              <>
                <div style={dialogTitleStyle}>{tr("Copy a template")}</div>
                <p style={dialogHintStyle}>{tr("Templates for this project. Use X to remove a saved template. The template in use is dimmed.")}</p>
                {templatesLoading ? (
                  <div style={dialogHintStyle}>{tr("Loading…")}</div>
                ) : templates.length === 0 ? (
                  <div style={dialogHintStyle}>{tr("No templates yet. Create one from current subtasks.")}</div>
                ) : (
                  <ul style={listStyle}>
                    {templates.map((tpl) => {
                      const isActive = activeTemplateId === tpl.id;
                      return (
                        <li
                          key={tpl.id}
                          style={{
                            ...listRowStyle,
                            ...(isActive ? activeListRowStyle : null),
                          }}
                        >
                          <button
                            type="button"
                            style={{
                              ...listPickStyle,
                              ...(isActive ? activeListPickStyle : null),
                            }}
                            disabled={busy || isActive}
                            aria-current={isActive ? "true" : undefined}
                            onClick={() => { void selectTemplate(tpl); }}
                          >
                            <span style={{ fontWeight: 600 }}>{tpl.name}</span>
                            <span style={{ color: "var(--ink-mute)", fontSize: 11, marginLeft: 8 }}>
                              {tpl.items?.length || 0} step{(tpl.items?.length || 0) === 1 ? "" : "s"}
                            </span>
                            {isActive && (
                              <span style={inUseBadgeStyle}>{tr("In use")}</span>
                            )}
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete template ${tpl.name}`}
                            style={xBtnStyle}
                            disabled={busy}
                            onClick={(e) => {
                              e.stopPropagation();
                              void deleteTemplate(tpl.id);
                            }}
                          >
                            ×
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {error && <div style={errorStyle}>{error}</div>}
                <div style={dialogActionsStyle}>
                  <button type="button" style={btnGhost} disabled={busy} onClick={closeAll}>{tr("Cancel")}</button>
                </div>
              </>
            )}

            {panel === "applyMode" && (
              <>
                <div style={dialogTitleStyle}>{tr("Replace subtasks?")}</div>
                <p style={dialogHintStyle}>
                  {tr("This task already has subtasks. One template at a time — replace them with this template, or cancel. You can still add more subtasks manually after.")}
                </p>
                {error && <div style={errorStyle}>{error}</div>}
                <div style={{ ...dialogActionsStyle, flexWrap: "wrap" }}>
                  <button type="button" style={btnGhost} disabled={busy} onClick={closeAll}>{tr("Cancel")}</button>
                  <button type="button" style={btnPrimary} disabled={busy} onClick={() => { void confirmReplace(); }}>
                    {tr("Replace")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}

      <ConfirmDialog
        open={clearOpen}
        title={tr("Clear all subtasks?")}
        description="Removes every subtask on this task. Saved templates are not deleted."
        confirmLabel={tr("Delete")}
        confirmTone="danger"
        busy={busy}
        onCancel={() => setClearOpen(false)}
        onConfirm={() => { void confirmClear(); }}
      />
    </>
  );
}

const kebabBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  padding: 0,
  fontSize: 16,
  lineHeight: 1,
  fontWeight: 700,
  background: "var(--surface)",
  border: "1px solid var(--rule)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
  color: "var(--ink-soft)",
  fontFamily: "var(--sans)",
  flexShrink: 0,
};

const menuPopoverStyle: CSSProperties = {
  position: "fixed",
  minWidth: 160,
  background: "var(--surface)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  borderRadius: "var(--r-sm)",
  boxShadow: "var(--shadow-md)",
  zIndex: 1200,
  padding: "4px 0",
};

const menuRowStyle: CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "7px 12px",
  fontSize: 12,
  background: "transparent",
  borderWidth: 0,
  cursor: "pointer",
  fontFamily: "var(--sans)",
  color: "var(--ink-soft)",
};

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.35)",
  zIndex: 1300,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const dialogStyle: CSSProperties = {
  width: "min(420px, 100%)",
  background: "var(--surface)",
  border: "1px solid var(--rule)",
  borderRadius: "var(--r-md)",
  boxShadow: "var(--shadow-md)",
  padding: 16,
};

const dialogTitleStyle: CSSProperties = {
  fontFamily: "var(--sans)",
  fontSize: 15,
  fontWeight: 700,
  color: "var(--ink)",
  marginBottom: 6,
};

const dialogHintStyle: CSSProperties = {
  fontFamily: "var(--sans)",
  fontSize: 12,
  color: "var(--ink-mute)",
  marginBottom: 12,
  marginTop: 0,
};

const labelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontFamily: "var(--sans)",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--ink-soft)",
  marginBottom: 12,
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  fontSize: 13,
  fontFamily: "var(--sans)",
  border: "1px solid var(--rule-strong)",
  borderRadius: "var(--r-sm)",
  background: "var(--page)",
  color: "var(--ink)",
};

const dialogActionsStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  marginTop: 8,
};

const btnGhost: CSSProperties = {
  padding: "7px 12px",
  fontSize: 12,
  fontFamily: "var(--sans)",
  background: "transparent",
  border: "1px solid var(--rule)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
  color: "var(--ink-soft)",
};

const btnPrimary: CSSProperties = {
  padding: "7px 12px",
  fontSize: 12,
  fontFamily: "var(--sans)",
  background: "var(--green-deep)",
  border: "1px solid var(--green-deep)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
  color: "#fff",
};

const errorStyle: CSSProperties = {
  fontFamily: "var(--sans)",
  fontSize: 12,
  color: "var(--crit)",
  marginBottom: 8,
};

const listStyle: CSSProperties = {
  listStyle: "none",
  margin: "0 0 12px",
  padding: 0,
  maxHeight: 280,
  overflowY: "auto",
  border: "1px solid var(--rule)",
  borderRadius: "var(--r-sm)",
};

const listRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  borderBottom: "1px solid var(--rule)",
};

const activeListRowStyle: CSSProperties = {
  opacity: 0.45,
  filter: "blur(0.6px)",
  background: "var(--surface-sunk)",
};

const listPickStyle: CSSProperties = {
  flex: 1,
  textAlign: "left",
  padding: "10px 12px",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontFamily: "var(--sans)",
  fontSize: 13,
  color: "var(--ink)",
};

const activeListPickStyle: CSSProperties = {
  cursor: "default",
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 4,
};

const inUseBadgeStyle: CSSProperties = {
  marginLeft: 8,
  fontFamily: "var(--mono)",
  fontSize: 10,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--ink-mute)",
};

const xBtnStyle: CSSProperties = {
  flexShrink: 0,
  width: 32,
  height: 32,
  marginRight: 6,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  fontSize: 18,
  lineHeight: 1,
  color: "var(--ink-mute)",
  borderRadius: "var(--r-sm)",
  fontFamily: "var(--sans)",
};
