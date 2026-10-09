"use client";

import { useState, useEffect, useMemo, useRef, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  MouseSensor, TouchSensor, closestCorners, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable,
  horizontalListSortingStrategy, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useIsMobile } from "@/lib/client/use-is-mobile";
import { AcharyaPicker } from "@/components/omnidel/acharya-picker";
import { CustomSelect } from "@/components/omnidel/custom-select";
import { DatePicker } from "@/components/omnidel/date-picker";
import { MemberMultiSelect } from "@/components/omnidel/member-multi-select";
import { isSimpleTaskType } from "@/lib/simple-task";
import {
  isValidListLifecycleOrder,
  LIST_FLOW_BLOCKED_MESSAGE,
  type ListLifecycleState,
} from "@/lib/list-lifecycle";
import { useTr } from "@/lib/client/language";

// ============================================================================
// TaskBoard — Kanban view used by the omnimart board page.
//
// Lifecycle:
//   - If `lists` is provided (per-board mode), use it as the columns.
//   - If `lists` is absent, fall back to fetching mst_task_statuses through the
//     legacy `/api/omnimart/tasks/options` endpoint so existing callers keep
//     working.
//
// Drag-drop is wired through @dnd-kit so two interactions coexist on one
// DndContext:
//   - card move between lists  — drag a card body, drop on a column droppable
//   - list reorder              — drag a list header by its 6-dot handle,
//                                 SortableContext arranges the columns
//
// Per-column actions (rename / change color / add card / delete) live in the
// `canManage`-gated ColumnMenu. The parent owns the network calls and passes
// them as `onUpdateList`, `onDeleteList`, `onAddCardToList`. List creation +
// list reorder use the new `onCreateList`/`onReorderLists` callbacks so the
// parent owns those API calls too.
// ============================================================================

export interface TaskBoardLabel {
  id: string;
  label: string;
  color: string | null;
}

export interface TaskBoardList {
  id: string;
  name: string;
  color: string | null;
  sort_order: number;
  acharya_id?: string | null;
}

export interface TaskBoardTask {
  id: string;
  title: string;
  list_id: string | null;
  list_color?: string | null;
  status?: string | null;
  status_label?: string | null;
  status_color?: string | null;
  priority?: string | null;
  assigned_to_name?: string | null;
  // Full multi-assign set (preferred); assigned_to_name is the legacy primary.
  assignees?: { id: string; name: string }[];
  // assigned_on doubles as the Timeline bar's START (due_date is the END).
  assigned_on?: string | null;
  due_date?: string | null;
  labels?: TaskBoardLabel[];
  /** User comments — Trello-style badge; hide when 0. */
  comment_count?: number;
  /** File attachments — Trello-style badge; hide when 0. */
  attachment_count?: number;
  task_type_id?: string | null;
  task_type_slug?: string | null;
  task_type_name?: string | null;
}

interface TaskBoardProps {
  tasks: TaskBoardTask[];
  lists?: TaskBoardList[];
  /**
   * Move/reorder a card. `toIndex` is the 0-based position inside the
   * destination list (where the user dropped). Omit to append at the end
   * (e.g. card menu "Move to …").
   */
  onMoveTask?: (taskId: string, listId: string, toIndex?: number) => void;
  onOpenTask?: (taskId: string) => void;
  loading?: boolean;
  // Per-column management — only shown when canManage is true. Parent owns
  // the network calls so this component stays presentational.
  canManage?: boolean;
  // Task actions are intentionally separate from board/list management.
  canCreateTask?: boolean;
  canUpdateTask?: boolean;
  canDeleteTask?: boolean;
  onUpdateList?: (listId: string, patch: { name?: string; color?: string; acharya_id?: string | null }) => Promise<void>;
  onDeleteList?: (listId: string) => Promise<void>;
  onAddCardToList?: (listId: string) => void;
  // List create/reorder — added in T28. Parent POSTs to /lists and PATCHes
  // /lists/reorder and refetches; this component is presentational.
  onCreateList?: (name: string, color: string) => Promise<void>;
  onReorderLists?: (orderedIds: string[]) => Promise<void> | void;
  /** Planned → Doing → Review → Done flow. Null infers from list titles. */
  listLifecycle?: ListLifecycleState | null;
  onListFlowBlocked?: (message: string) => void;
  // Accepted from the board page (list archiving / add-column modal from the
  // workspace-board work). This Trello-style board surfaces list creation via
  // the inline AddListTile instead, so these are accepted but not wired here.
  onArchiveList?: (listId: string) => Promise<void>;
  onAddColumnClick?: () => void;
  // Archive a single card (soft-delete the task) from its 3-dot menu.
  onArchiveTask?: (taskId: string) => Promise<void> | void;
  // Toggle a task's status from the card's status glyph (e.g. mark done).
  onToggleStatus?: (taskId: string, nextStatus: string) => Promise<void> | void;
  // Fired when a drag begins/ends so the parent can pause scroll-snap on the
  // mobile board (snap fights dnd-kit's auto-scroll-to-other-lists otherwise).
  onDragActiveChange?: (active: boolean) => void;
  // ─── Multi-select (bulk actions) ──────────────────────────────────────────
  // When `selectable` is true each card shows a checkbox; the parent owns the
  // selected set and the bulk-action network calls. All single-task
  // interactions (drag, open, 3-dot menu) stay unchanged.
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (taskId: string, selected: boolean) => void;
}

interface StatusOption {
  slug: string;
  label: string;
  color: string | null;
  sort_order: number;
}

export function TaskBoard({
  tasks, lists, onMoveTask, onOpenTask, loading,
  canManage, canCreateTask, canUpdateTask, canDeleteTask, onUpdateList, onAddCardToList,
  onCreateList, onReorderLists, listLifecycle, onListFlowBlocked, onArchiveList, onArchiveTask, onToggleStatus,
  onDragActiveChange,
  selectable, selectedIds, onToggleSelect,
}: TaskBoardProps) {
  const tr = useTr();
  // Mobile shows one full-width list per screen (Trello app): swipe horizontally
  // between lists, each scrolling its own cards. Desktop keeps the wide rail.
  const isMobile = useIsMobile();
  const [fallbackLists, setFallbackLists] = useState<TaskBoardList[] | null>(null);
  const [dragCardId, setDragCardId] = useState<string | null>(null);
  // Optimistic column order so a drop slots the column into place immediately,
  // even while the parent's PATCH/refetch is still in flight.
  const [optimisticOrder, setOptimisticOrder] = useState<string[] | null>(null);

  // Legacy mode: when no per-board `lists` arrive, hydrate columns from the
  // status master via the existing options endpoint.
  useEffect(() => {
    if (lists !== undefined) return;
    let alive = true;
    fetch("/api/omnipulse/tasks/options")
      .then(r => r.json())
      .then(d => {
        if (!alive) return;
        const statuses = (d.statuses || []) as Array<StatusOption | string>;
        const cols: TaskBoardList[] = statuses.map((s, i) => {
          if (typeof s === "string") {
            return { id: s, name: s.replace(/_/g, " "), color: null, sort_order: i };
          }
          return { id: s.slug, name: s.label, color: s.color, sort_order: s.sort_order ?? i };
        });
        setFallbackLists(cols);
      })
      .catch(() => setFallbackLists([]));
    return () => { alive = false; };
  }, [lists]);

  // Drop the optimistic order once the parent's list order matches it. Keeps
  // the source-of-truth in sync without flicker when both arrive in the same
  // render frame.
  useEffect(() => {
    if (!optimisticOrder || lists === undefined) return;
    const incoming = [...lists].sort((a, b) => a.sort_order - b.sort_order).map(l => l.id);
    const matches =
      incoming.length === optimisticOrder.length &&
      incoming.every((id, i) => id === optimisticOrder[i]);
    if (matches) setOptimisticOrder(null);
  }, [lists, optimisticOrder]);

  const columns = useMemo<TaskBoardList[]>(() => {
    const base = lists !== undefined
      ? [...lists].sort((a, b) => a.sort_order - b.sort_order)
      : (fallbackLists ?? []);
    if (!optimisticOrder) return base;
    const byId = new Map(base.map(l => [l.id, l]));
    const out: TaskBoardList[] = [];
    for (const id of optimisticOrder) {
      const l = byId.get(id);
      if (l) out.push(l);
    }
    // Append any columns that aren't in the optimistic order (e.g. a fresh
    // list appeared from another tab) so nothing disappears mid-drag.
    for (const l of base) if (!optimisticOrder.includes(l.id)) out.push(l);
    return out;
  }, [lists, fallbackLists, optimisticOrder]);

  const tasksByList = useMemo(() => {
    const map = new Map<string, TaskBoardTask[]>();
    for (const col of columns) map.set(col.id, []);
    // Keep parent array order only — no title/status re-sort. Auto-sorting
    // made new and moved cards jump mid-column (felt like alphabetical order).
    for (const t of tasks) {
      const key = t.list_id ?? t.status ?? "";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return map;
  }, [columns, tasks]);

  // Mouse: drag starts after a 5px move (desktop, unchanged feel). Touch:
  // press-and-hold ~200ms then drag — so a quick swipe still scrolls/pages the
  // board and only a deliberate hold picks up a card (Trello-app behavior).
  // Mouse: drag after a 5px move (desktop, unchanged). Touch: drag after an 8px
  // move — reliable because touch drags only start from elements with
  // touch-action:none (the card grip handle and the column reorder handle), so
  // the browser never steals the gesture for scrolling. A tap/swipe elsewhere
  // still scrolls and pages the board.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 8 } }),
  );
  const dragCard = dragCardId ? tasks.find(t => t.id === dragCardId) : null;

  function handleDragStart(e: DragStartEvent) {
    onDragActiveChange?.(true);
    const dragType = e.active.data.current?.type as string | undefined;
    if (dragType === "card") setDragCardId(String(e.active.id));
  }

  function handleDragEnd(e: DragEndEvent) {
    onDragActiveChange?.(false);
    const activeType = e.active.data.current?.type as string | undefined;
    setDragCardId(null);
    if (!e.over) return;

    // Column reorder — fired when a column header drag handle drops on another
    // column. Both source and target carry data.type === "column".
    if (activeType === "column") {
      const activeId = String(e.active.id);
      const overId = String(e.over.id);
      if (activeId === overId) return;
      const oldIdx = columns.findIndex(c => c.id === activeId);
      const newIdx = columns.findIndex(c => c.id === overId);
      if (oldIdx === -1 || newIdx === -1) return;
      const reorderedIds = arrayMove(columns.map(c => c.id), oldIdx, newIdx);
      const nextCols = reorderedIds
        .map((id) => columns.find((c) => c.id === id))
        .filter((c): c is TaskBoardList => !!c);
      if (!isValidListLifecycleOrder(nextCols, listLifecycle ?? null)) {
        onListFlowBlocked?.(LIST_FLOW_BLOCKED_MESSAGE);
        return;
      }
      setOptimisticOrder(reorderedIds);
      // If the parent's persist call rejects (network/403/409), drop the
      // optimistic order so the columns snap back to the parent's real order
      // (the parent refetches on failure). Otherwise a failed reorder would
      // stick visually forever.
      Promise.resolve(onReorderLists?.(reorderedIds)).catch(() => setOptimisticOrder(null));
      return;
    }

    // Card move / reorder — drop on another card (insert at that index) or on
    // a column body (append). Never force-sort by title or date.
    if (activeType === "card") {
      const activeId = String(e.active.id);
      const overId = String(e.over.id);
      if (activeId === overId) return;
      const task = tasks.find((t) => t.id === activeId);
      if (!task) return;

      const overData = e.over.data.current as { type?: string; listId?: string } | undefined;
      let destListId: string;
      let toIndex: number;

      if (overData?.type === "list" && overData.listId) {
        // Dropped on column body (incl. empty) → append at end.
        destListId = overData.listId;
        const destItems = tasksByList.get(destListId) ?? [];
        toIndex = destItems.some((t) => t.id === activeId)
          ? destItems.length - 1
          : destItems.length;
      } else if (columns.some((c) => c.id === overId)) {
        destListId = overId;
        const destItems = tasksByList.get(destListId) ?? [];
        toIndex = destItems.some((t) => t.id === activeId)
          ? destItems.length - 1
          : destItems.length;
      } else {
        // Dropped on another card → take that card's index (arrayMove style).
        const overTask = tasks.find((t) => t.id === overId);
        if (!overTask) return;
        destListId = overData?.listId
          ?? overTask.list_id
          ?? overTask.status
          ?? "";
        const destItems = tasksByList.get(destListId) ?? [];
        const overIdx = destItems.findIndex((t) => t.id === overId);
        if (overIdx < 0) {
          // Cross-list: over card is in dest; if not found, append.
          const withoutActive = destItems.filter((t) => t.id !== activeId);
          toIndex = withoutActive.length;
        } else {
          toIndex = overIdx;
        }
      }

      const fromList = task.list_id ?? task.status ?? "";
      if (fromList === destListId) {
        const fromItems = tasksByList.get(fromList) ?? [];
        const fromIdx = fromItems.findIndex((t) => t.id === activeId);
        if (fromIdx === toIndex || fromIdx < 0) return;
      }

      onMoveTask?.(activeId, destListId, toIndex);
    }
  }

  if (loading || (lists === undefined && fallbackLists === null)) {
    return <div style={{ color: "var(--ink-mute)", fontSize: 13, padding: 20 }}>{tr("Loading project...")}</div>;
  }
  if (columns.length === 0 && !canManage) {
    return <div style={{ color: "var(--ink-mute)", fontSize: 13, padding: 20 }}>{tr("No cards configured for this project.")}</div>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => { onDragActiveChange?.(false); setDragCardId(null); }}
    >
      <SortableContext items={columns.map(c => c.id)} strategy={horizontalListSortingStrategy}>
        <div className={isMobile ? undefined : "themed-scroll-x"} style={isMobile ? {
          // Mobile: one list per screen. Width is 100% of the board scrollport
          // (not 88vw) — vw includes page chrome and left a tan scrollbar strip
          // beside the column. The parent wrap owns horizontal paging + snap.
          display: "grid",
          gridAutoFlow: "column",
          gridAutoColumns: "100%",
          gridTemplateRows: "100%",
          gap: 12,
          padding: "4px 0 0",
          alignItems: "flex-start",
          height: "100%",
          minHeight: 0,
        } : {
          display: "grid",
          gridAutoFlow: "column",
          gridAutoColumns: "minmax(260px, 1fr)",
          // Single explicit row at a DEFINITE height (100% of the fixed-height
          // board area). Without this the implicit row is auto-sized, so a
          // column's maxHeight:100% has nothing to resolve against and a tall
          // column grows unbounded instead of capping + scrolling.
          gridTemplateRows: "100%",
          gap: 14,
          padding: "4px 2px 24px",
          // flex-start (not stretch): each column sizes to its own card count
          // instead of all columns being forced to equal full height.
          alignItems: "flex-start",
          height: "100%",
          minHeight: 0,
        }}>
          {columns.map(col => (
            <BoardColumn
              key={col.id}
              list={col}
              allLists={columns}
              items={tasksByList.get(col.id) ?? []}
              canManage={!!canManage}
              canCreateTask={!!canCreateTask}
              canUpdateTask={!!canUpdateTask}
              canDeleteTask={!!canDeleteTask}
              isMobile={isMobile}
              onOpenTask={onOpenTask}
              onUpdateList={onUpdateList}
              onArchiveList={onArchiveList}
              onAddCardToList={onAddCardToList}
              onMoveTask={onMoveTask}
              onArchiveTask={onArchiveTask}
              onToggleStatus={onToggleStatus}
              selectable={selectable}
              selectedIds={selectedIds}
              onToggleSelect={onToggleSelect}
            />
          ))}
          {canManage && onCreateList && (
            <AddListTile onCreate={onCreateList} isMobile={isMobile} />
          )}
        </div>
      </SortableContext>
      <DragOverlay>
        {dragCard ? <Card task={dragCard} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

// Curated list colours — earthy, harmonious tones that read well as a faint
// column tint (free-form hex tended to look garish). Shared with the create
// modal so both pickers offer the same palette.
export const LIST_COLOR_PALETTE: { name: string; value: string }[] = [
  { name: "Red",       value: "#e05252" },
  { name: "Orange",    value: "#e8843a" },
  { name: "Amber",     value: "#e0a82e" },
  { name: "Yellow",    value: "#d8c233" },
  { name: "Lime",      value: "#84b93f" },
  { name: "Green",     value: "#3ea35a" },
  { name: "Teal",      value: "#2fa39a" },
  { name: "Sky",       value: "#3d93d6" },
  { name: "Blue",      value: "#4d6fd1" },
  { name: "Indigo",    value: "#6c5ce0" },
  { name: "Purple",    value: "#9b59c6" },
  { name: "Pink",      value: "#e0609a" },
  { name: "Slate",     value: "#64748b" },
  { name: "Brown",     value: "#a8704f" },
];

// Swatch grid for picking a list colour from the curated palette.
function ColorSwatches({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {LIST_COLOR_PALETTE.map((c) => {
        const selected = value.toLowerCase() === c.value.toLowerCase();
        return (
          <button
            key={c.value}
            type="button"
            title={c.name}
            aria-label={c.name}
            onClick={() => onChange(c.value)}
            style={{
              width: 26, height: 26, borderRadius: "50%", cursor: "pointer",
              background: c.value,
              borderWidth: 2, borderStyle: "solid",
              borderColor: selected ? "var(--ink)" : "transparent",
              boxShadow: selected ? "0 0 0 2px var(--surface)" : "none",
              outline: "none", flexShrink: 0,
            }}
          />
        );
      })}
    </div>
  );
}

// Faint translucent wash from a list's hex colour, for column tinting. Returns
// null for non-hex values (CSS vars / empty) so the caller falls back cleanly.
function hexTint(color: string | null | undefined, alpha: number): string | null {
  if (!color) return null;
  const m = /^#([0-9a-fA-F]{6})$/.exec(color.trim());
  if (!m) return null;
  const a = Math.round(Math.min(Math.max(alpha, 0), 1) * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${m[1]}${a}`;
}

// BoardColumn — sortable column. The header is the drag activator (for list
// reorder); the body is a droppable target (for card moves). Cards inside are
// draggable.
function BoardColumn({
  list, allLists, items, canManage, canCreateTask, canUpdateTask, canDeleteTask, isMobile, onOpenTask, onUpdateList, onArchiveList, onAddCardToList,
  onMoveTask, onArchiveTask, onToggleStatus,
  selectable, selectedIds, onToggleSelect,
}: {
  list: TaskBoardList;
  allLists: TaskBoardList[];
  items: TaskBoardTask[];
  canManage: boolean;
  canCreateTask: boolean;
  canUpdateTask: boolean;
  canDeleteTask: boolean;
  isMobile?: boolean;
  onOpenTask?: (id: string) => void;
  onUpdateList?: (listId: string, patch: { name?: string; color?: string; acharya_id?: string | null }) => Promise<void>;
  onArchiveList?: (listId: string) => Promise<void>;
  onAddCardToList?: (listId: string) => void;
  onMoveTask?: (taskId: string, listId: string, toIndex?: number) => void;
  onArchiveTask?: (taskId: string) => Promise<void> | void;
  onToggleStatus?: (taskId: string, nextStatus: string) => Promise<void> | void;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (taskId: string, selected: boolean) => void;
}) {
  const tr = useTr();
  const sortable = useSortable({
    id: list.id,
    data: { type: "column" },
    disabled: !canManage,
  });
  // Separate droppable id so empty-column drops don't fight card sortable ids.
  // Prefix keeps it unique from task UUIDs and from the column sortable id.
  const listDropId = `list-drop:${list.id}`;
  const { setNodeRef: setBodyRef, isOver } = useDroppable({
    id: listDropId,
    data: { type: "list", listId: list.id },
  });

  const headerColor = list.color || "var(--ink-mute)";
  // Tint the recessed column surface with a faint wash of the list's chosen
  // colour (hex only) + a colour accent strip, so columns read distinctly.
  const tintWash = hexTint(list.color, 0.30);
  const columnBg = tintWash || "var(--surface-sunk)";
  const transformStyle: CSSProperties = sortable.transform
    ? { transform: `translate3d(${sortable.transform.x}px, 0, 0)` }
    : {};

  return (
    <div
      ref={sortable.setNodeRef}
      style={{
        // Trello layering: the list sits in a recessed surface (tinted with the
        // list's own colour); the cards on top are the lighter --surface so they
        // read as raised tiles.
        background: columnBg,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: isOver ? "var(--green-deep)" : "transparent",
        borderRadius: "var(--r-lg)",
        padding: 8,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        // Height follows the card count (Trello style); cap at the board area
        // (maxHeight:100%) so a long column scrolls internally instead of
        // pushing past the viewport. No fixed height → short columns stay short.
        maxHeight: "100%",
        // Mobile: each full-width list snaps into view when swiped (Trello app).
        ...(isMobile ? { scrollSnapAlign: "start" } : null),
        transition: sortable.transition ?? "border-color .15s",
        opacity: sortable.isDragging ? 0.5 : 1,
        ...transformStyle,
      }}
    >
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "4px 4px 2px",
          flex: "0 0 auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
          {canManage && (
            <span
              ref={sortable.setActivatorNodeRef}
              {...sortable.attributes}
              {...sortable.listeners}
              title={tr("Drag to reorder list")}
              style={{
                cursor: "grab", color: "var(--ink-soft)",
                display: "inline-flex", alignItems: "center",
                flexShrink: 0, padding: "0 2px",
                // touch-action:none so touch-dragging the handle reorders the
                // list instead of the browser scrolling the board.
                touchAction: "none",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <circle cx="9" cy="6" r="1.4" /><circle cx="9" cy="12" r="1.4" /><circle cx="9" cy="18" r="1.4" />
                <circle cx="15" cy="6" r="1.4" /><circle cx="15" cy="12" r="1.4" /><circle cx="15" cy="18" r="1.4" />
              </svg>
            </span>
          )}
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: headerColor, flexShrink: 0,
          }} />
          <span style={{
            fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.1em",
            textTransform: "uppercase", color: "var(--ink)", fontWeight: 700,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {list.name}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <span style={{
            fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-soft)", fontWeight: 600,
          }}>
            {items.length}
          </span>
          {canManage && (
            <ColumnMenu
              list={list}
              cardCount={items.length}
              onUpdate={onUpdateList}
              onArchive={onArchiveList}
              onAddCard={onAddCardToList}
            />
          )}
        </div>
      </div>
      <div ref={setBodyRef} style={{
        display: "flex", flexDirection: "column", gap: 8,
        // 0 1 auto: take natural (content) height, but allow shrinking when the
        // column hits its maxHeight so the card list scrolls inside it.
        flex: "0 1 auto", minHeight: 60, overflowY: "auto",
        padding: "2px 2px 0",
      }}>
        {items.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--ink-soft)", padding: "10px 6px" }}>
            {tr("Drop tasks here")}
          </div>
        ) : (
          <SortableContext items={items.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            {items.map((t) => (
              <Card
                key={t.id}
                task={t}
                listId={list.id}
                canManage={canUpdateTask}
                isMobile={isMobile}
                onClick={onOpenTask ? () => onOpenTask(t.id) : undefined}
                allLists={allLists}
                onMove={canUpdateTask ? onMoveTask : undefined}
                onArchive={canDeleteTask ? onArchiveTask : undefined}
                onToggleStatus={canUpdateTask ? onToggleStatus : undefined}
                selectable={selectable}
                selected={selectedIds?.has(t.id) ?? false}
                onToggleSelect={onToggleSelect}
              />
            ))}
          </SortableContext>
        )}
      </div>

      {/* Trello-style add-card footer — pinned below the scrollable card list. */}
      {onAddCardToList && canCreateTask && (
        <button
          type="button"
          onClick={() => onAddCardToList(list.id)}
          className="nav-link"
          style={{
            display: "flex", alignItems: "center", gap: 6,
            width: "100%", flex: "0 0 auto", textAlign: "left",
            padding: "8px 8px", marginTop: 2,
            background: "transparent", border: "none", borderRadius: "var(--r-md)",
            cursor: "pointer", color: "var(--ink-soft)",
            fontSize: 13, fontFamily: "var(--sans)", fontWeight: 500,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {tr("Add a task")}
        </button>
      )}
    </div>
  );
}

// Card — Trello-style task tile. Top: label colour bars. Then the title. Then a
// footer badge row (priority chip + due-date pill on the left, member avatar on
// the right). Only renders the features our task data carries.
function Card({
  task, listId, onClick, dragging, allLists, onMove, onArchive, onToggleStatus, isMobile,
  canManage, selectable, selected, onToggleSelect,
}: {
  task: TaskBoardTask;
  /** Owning list id (for sortable data). Optional on the drag overlay. */
  listId?: string;
  onClick?: () => void;
  dragging?: boolean;
  // Mobile uses an explicit drag handle (touch-action:none) so the card body
  // stays free to tap/scroll; desktop drags from anywhere on the card.
  isMobile?: boolean;
  // Cards stay draggable for everyone — server enforces move permissions on
  // the move route. Setting canManage:false on the board only locks list-
  // reorder and ColumnMenu actions, not card movement.
  canManage?: boolean;
  // 3-dot card menu (Open / Move / Archive). Omitted on the drag overlay.
  allLists?: TaskBoardList[];
  onMove?: (taskId: string, listId: string, toIndex?: number) => void;
  onArchive?: (taskId: string) => Promise<void> | void;
  onToggleStatus?: (taskId: string, nextStatus: string) => Promise<void> | void;
  // Bulk-select: when `selectable`, a checkbox at the top-left toggles the card
  // in the parent's selection set. Single-task interactions are unaffected.
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (taskId: string, selected: boolean) => void;
}) {
  const tr = useTr();
  const [hover, setHover] = useState(false);
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: "card",
      listId: listId ?? task.list_id ?? task.status ?? "",
    },
    disabled: !!dragging,
  });
  const transformStyle: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? undefined,
  };

  const isDone = task.status === "done";
  const hasLabels = !!(task.labels && task.labels.length > 0);
  // Prefer the full multi-assign set; fall back to the legacy primary name.
  const assignees = (task.assignees && task.assignees.length > 0)
    ? task.assignees
    : (task.assigned_to_name ? [{ id: "primary", name: task.assigned_to_name }] : []);
  const commentCount = task.comment_count ?? 0;
  const attachmentCount = task.attachment_count ?? 0;
  const hasNoteBadges = commentCount > 0 || attachmentCount > 0;
  const isSimple = isSimpleTaskType({
    id: task.task_type_id,
    slug: task.task_type_slug,
    name: task.task_type_name,
  });
  const hasFooter = !!(isSimple || task.priority || task.due_date || assignees.length > 0 || hasNoteBadges);
  // Archiving a task is manage-gated (server: canManageBoard on DELETE). A
  // non-manager (e.g. an editor who can Move) must NOT see "Archive task" — it
  // would only 403. Mirrors the manage-gate on the board's "Show archive" panel.
  const canArchive = !!onArchive && !!canManage;
  // The card menu only renders off the drag overlay (allLists is passed there).
  const hasMenu = !dragging && (canArchive || (!!onMove && !!allLists));

  const showStatus = !dragging && !!onToggleStatus;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...(isMobile && !dragging ? {} : listeners)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        background: "var(--surface)",
        borderWidth: 1, borderStyle: "solid",
        borderColor: selectable && selected ? "var(--green-deep)" : "var(--rule)",
        borderRadius: "var(--r-lg)",
        // Use longhand only — mixing `padding` with `paddingLeft` warns in React.
        // When selectable, indent the left edge so the checkbox doesn't overlap
        // the title / label bars. Otherwise keep a comfortable left padding
        // (the cards looked cramped at the 12px base once the always-on
        // checkbox gutter went away with bulk-select-by-default).
        paddingTop: hasLabels ? 8 : 10,
        // Keep card chrome tight to the edges so assignee avatars sit flush
        // with the right border. Title clearance for ⋯ is on the title row only.
        paddingRight: 12,
        paddingBottom: hasLabels ? 10 : 12,
        paddingLeft: selectable ? 34 : 18,
        cursor: onClick ? "pointer" : "grab",
        fontSize: 14,
        color: "var(--ink)",
        boxShadow: selectable && selected
          ? "0 0 0 1px var(--green-deep)"
          : dragging || isDragging ? "var(--shadow-md)" : "var(--shadow-sm)",
        opacity: isDragging ? 0.4 : dragging ? 0.95 : 1,
        ...transformStyle,
      }}
      onClick={(e) => {
        if (!onClick) return;
        // Suppress the click that pointer-up emits after a drag (dnd-kit's
        // activationConstraint should already do this, but be defensive).
        if (isDragging) return;
        e.stopPropagation();
        onClick();
      }}
    >
      {/* Bulk-select checkbox — top-left. stopPropagation on pointerdown AND
          click so checking never starts a dnd-kit drag or opens the task (same
          defensive pattern as CardMenu's `stop`). */}
      {selectable && !dragging && (
        <span
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{ position: "absolute", top: 8, left: 8, zIndex: 5, display: "inline-flex" }}
        >
          <input
            type="checkbox"
            aria-label={selected ? "Deselect task" : "Select task"}
            checked={selected ?? false}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onToggleSelect?.(task.id, e.target.checked)}
            style={{ width: 16, height: 16, cursor: "pointer", accentColor: "var(--green-deep)", margin: 0 }}
          />
        </span>
      )}

      {/* Mobile drag handle — touch-action:none so a touch here always starts a
          drag (never a scroll); the rest of the card stays tap/scroll-friendly. */}
      {isMobile && !dragging && (
        <div
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          aria-label={tr("Drag to move task")}
          style={{
            touchAction: "none",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "-2px 0 6px", padding: "2px 0", cursor: "grab",
            color: "var(--ink-faint)",
          }}
        >
          <svg width="22" height="12" viewBox="0 0 24 16" fill="currentColor" aria-hidden="true">
            <circle cx="6" cy="6" r="1.5" /><circle cx="12" cy="6" r="1.5" /><circle cx="18" cy="6" r="1.5" />
            <circle cx="6" cy="11" r="1.5" /><circle cx="12" cy="11" r="1.5" /><circle cx="18" cy="11" r="1.5" />
          </svg>
        </div>
      )}

      {hasMenu && (
        <CardMenu
          task={task}
          allLists={allLists ?? []}
          onOpen={onClick}
          onMove={onMove}
          onArchive={canArchive ? onArchive : undefined}
        />
      )}

      {/* Label colour bars (Trello collapsed style) */}
      {hasLabels && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
          {task.labels!.map(l => (
            <span
              key={l.id}
              title={l.label}
              style={{
                height: 8, minWidth: 40, borderRadius: 4,
                background: l.color || "var(--ink-faint)",
              }}
            />
          ))}
        </div>
      )}

      {/* Title — the status glyph (P / D / ✓) reveals on hover at the left and
          collapses away otherwise. Click it to toggle done. */}
      <div style={{
        display: "flex", alignItems: "flex-start", gap: 0,
        // Only the title row clears the absolute ⋯ (24px + right:4), not the
        // whole card — so priority/assignee stay near the card border.
        ...(hasMenu ? { paddingRight: 24 } : null),
      }}>
        {showStatus && (
          <HoverStatus
            status={task.status || "planned"}
            visible={hover}
            onToggle={() => onToggleStatus!(task.id, isDone ? "planned" : "done")}
          />
        )}
        <div
          style={{
          flex: 1, minWidth: 0,
          fontSize: 14, fontWeight: 500, color: "var(--ink)", lineHeight: 1.35,
          // Trello-style: wrap long titles onto the next line — never ellipsis.
          whiteSpace: "normal",
          overflowWrap: "anywhere",
          wordBreak: "break-word",
          textDecorationLine: isDone ? "line-through" : "none",
          textDecorationColor: "var(--ink-faint)",
        }}>
          {task.title}
        </div>
      </div>

      {/* Footer badge row — Trello-style: priority/due + comment/file counts left, assignees right.
          Keep meta badges on one line (no wrap) so attachment doesn't drop alone. */}
      {hasFooter && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 6, marginTop: 8, flexWrap: "nowrap",
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 5, flexWrap: "nowrap",
            minWidth: 0, flex: "1 1 auto",
          }}>
            {isSimple && <SimpleTaskBadge name={task.task_type_name} />}
            {!isSimple && task.priority && <PriorityBadge priority={task.priority} />}
            {task.due_date && <DueBadge due={task.due_date} done={isDone} />}
            {commentCount > 0 && (
              <CardMetaBadge
                title={`${commentCount} comment${commentCount === 1 ? "" : "s"}`}
                count={commentCount}
                icon="comment"
              />
            )}
            {attachmentCount > 0 && (
              <CardMetaBadge
                title={`${attachmentCount} attachment${attachmentCount === 1 ? "" : "s"}`}
                count={attachmentCount}
                icon="attachment"
              />
            )}
          </div>
          {assignees.length > 0 && (
            <span style={{ flexShrink: 0 }}>
              <AvatarStack people={assignees} />
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Trello-style comment / attachment count chip on the card footer. */
function CardMetaBadge({
  title, count, icon,
}: {
  title: string;
  count: number;
  icon: "comment" | "attachment";
}) {
  return (
    <span
      title={title}
      style={{
        display: "inline-flex", alignItems: "center", gap: 3,
        color: "var(--ink-soft)",
        fontSize: 11, fontWeight: 500, fontFamily: "var(--sans)",
        whiteSpace: "nowrap", flexShrink: 0,
      }}
    >
      {icon === "comment" ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
      )}
      {count}
    </span>
  );
}

// CardMenu — Trello-style 3-dot card actions: Open / Move (to another list) /
// Archive. Lives at the card's top-right. Pointer events are stopped so opening
// the menu never starts a drag or fires the card's open-on-click.
function CardMenu({
  task, allLists, onOpen, onMove, onArchive,
}: {
  task: TaskBoardTask;
  allLists: TaskBoardList[];
  onOpen?: () => void;
  onMove?: (taskId: string, listId: string) => void;
  onArchive?: (taskId: string) => Promise<void> | void;
}) {
  const tr = useTr();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"menu" | "move">("menu");
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const moveTargets = allLists.filter((l) => l.id !== task.list_id);
  const moveTargetsLen = moveTargets.length;

  // Position the menu via a body portal with FIXED coords so it can never be
  // clipped by the column's scrollable card list (overflow:auto). Right-aligns
  // to the trigger and flips upward when there isn't room below.
  useEffect(() => {
    if (!open) { setMode("menu"); setBusy(false); setPos(null); return; }
    const MENU_W = 200;
    const estH = mode === "move" ? Math.min(moveTargetsLen * 34 + 60, 320) : 150;
    function place() {
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const left = Math.max(8, Math.min(r.right - MENU_W, window.innerWidth - MENU_W - 8));
      const spaceBelow = window.innerHeight - r.bottom - 8;
      const openUp = estH > spaceBelow && r.top - 8 > spaceBelow;
      const top = openUp ? Math.max(8, r.top - estH - 4) : r.bottom + 4;
      setPos({ top, left });
    }
    place();
    const raf = requestAnimationFrame(place);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (popoverRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
      document.removeEventListener("mousedown", onDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);

  const stop = (e: React.SyntheticEvent) => { e.stopPropagation(); };

  return (
    <div
      ref={wrapRef}
      onPointerDown={stop}
      onClick={stop}
      style={{ position: "absolute", top: 4, right: 4, zIndex: 5 }}
    >
      <button
        type="button"
        aria-label={tr("Task actions")}
        onClick={(e) => { stop(e); setOpen((o) => !o); }}
        style={{
          width: 24, height: 24, padding: 0, lineHeight: 1,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          background: open ? "var(--surface-sunk)" : "transparent",
          border: "none", borderRadius: "var(--r-sm)", cursor: "pointer",
          color: "var(--ink-mute)", fontSize: 15, fontWeight: 700,
        }}
      >…</button>
      {open && pos && typeof document !== "undefined" && createPortal(
        <div
          ref={popoverRef}
          onPointerDown={stop}
          onClick={stop}
          style={{ ...menuPopoverStyle, position: "fixed", top: pos.top, left: pos.left, right: "auto" }}
        >
          {mode === "menu" && (
            <>
              {onOpen && <button style={menuRowStyle} onClick={(e) => { stop(e); setOpen(false); onOpen(); }}>{tr("Open task")}</button>}
              {onMove && moveTargets.length > 0 && (
                <button style={menuRowStyle} onClick={(e) => { stop(e); setMode("move"); }}>{tr("Move…")}</button>
              )}
              {onArchive && (
                <button
                  style={{ ...menuRowStyle, color: "var(--crit)" }}
                  disabled={busy}
                  onClick={async (e) => {
                    stop(e); setBusy(true);
                    try { await onArchive(task.id); setOpen(false); } finally { setBusy(false); }
                  }}
                >{busy ? tr("Archiving…") : tr("Archive task")}</button>
              )}
            </>
          )}
          {mode === "move" && (
            <>
              <div style={{
                padding: "6px 12px 4px", fontFamily: "var(--mono)", fontSize: 9,
                letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-mute)",
              }}>{tr("Move to")}</div>
              {moveTargets.map((l) => (
                <button
                  key={l.id}
                  style={menuRowStyle}
                  onClick={(e) => { stop(e); onMove?.(task.id, l.id); setOpen(false); }}
                >{l.name}</button>
              ))}
              <div style={{ borderTop: "1px solid var(--rule)", margin: "4px 0" }} />
              <button style={menuRowStyle} onClick={(e) => { stop(e); setMode("menu"); }}>{tr("← Back")}</button>
            </>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}

// Priority badge colours — solid fill (no left dot), matching low→critical scale:
// green → yellow-green → orange → red.
const PRIORITY_BADGE: Record<string, { label: string; bg: string; fg: string }> = {
  low:    { label: "LOW",  bg: "#7cb342", fg: "#ffffff" },
  medium: { label: "MED",  bg: "#c9a227", fg: "#ffffff" },
  high:   { label: "HIGH", bg: "#f09020", fg: "#ffffff" },
  urgent: { label: "URG",  bg: "#e53935", fg: "#ffffff" },
};

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

// HoverStatus — the per-card status control at the left of the title. It stays
// collapsed (zero width, invisible) until the card is hovered, then slides open
// to show the status: slate "P" (planned), amber "D" (doing), green ✓ (done).
// Click toggles done ⇄ planned. Motion is width/opacity/transform, reduced-
// motion aware.
function HoverStatus({ status, visible, onToggle }: {
  status: string; visible: boolean; onToggle: () => void;
}) {
  const reduced = useReducedMotion();
  const [btnHover, setBtnHover] = useState(false);
  const isDone = status === "done";
  const meta = isDone
    ? { bg: "var(--ok-wash)", fg: "var(--ok)", bd: "var(--ok)" }
    : status === "doing"
    ? { bg: "var(--ochre-wash)", fg: "var(--ochre)", bd: "var(--ochre)" }
    : { bg: "var(--surface-sunk)", fg: "var(--ink-mute)", bd: "var(--rule-strong)" };
  const wrapTrans = reduced ? "none" : "width 160ms ease, opacity 160ms ease";
  const btnTrans = reduced ? "none" : "background 130ms ease, border-color 130ms ease, color 130ms ease";
  // Hovering the control previews the "tick" action: green ring + check.
  const previewTick = btnHover && !isDone;

  return (
    <div style={{
      width: visible ? 24 : 0, opacity: visible ? 1 : 0, overflow: "hidden",
      flexShrink: 0, display: "flex", alignItems: "center", marginTop: 1,
      transition: wrapTrans,
    }}>
      <button
        type="button"
        aria-label={isDone ? "Mark not done" : "Mark done"}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        onMouseEnter={() => setBtnHover(true)}
        onMouseLeave={() => setBtnHover(false)}
        style={{
          flexShrink: 0, width: 18, height: 18, padding: 0, borderRadius: "50%",
          border: `1.5px solid ${previewTick ? "var(--ok)" : meta.bd}`,
          background: previewTick ? "var(--ok-wash)" : meta.bg,
          color: previewTick ? "var(--ok)" : meta.fg,
          cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700,
          transition: btnTrans,
        }}
      >
        {(isDone || previewTick) ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : status === "doing" ? "D" : "P"}
      </button>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const key = (priority || "").toLowerCase();
  const meta = PRIORITY_BADGE[key] ?? {
    label: (priority || "?").slice(0, 4).toUpperCase(),
    bg: "var(--surface-sunk)",
    fg: "var(--ink-soft)",
  };
  return (
    <span
      title={`Priority: ${priority}`}
      style={{
        // Same typography as the previous chip — only fill/label text changed.
        display: "inline-flex", alignItems: "center",
        padding: "2px 8px", borderRadius: 999,
        background: meta.bg, color: meta.fg,
        fontSize: 11, fontFamily: "var(--mono)", letterSpacing: "0.04em",
        textTransform: "uppercase", whiteSpace: "nowrap", flexShrink: 0,
      }}
    >
      {meta.label}
    </span>
  );
}

/** Compact chip so Simple tasks are obvious on the board without opening the card. */
function SimpleTaskBadge({ name }: { name?: string | null }) {
  const tr = useTr();
  return (
    <span
      title={name || "Simple task"}
      style={{
        display: "inline-flex", alignItems: "center",
        padding: "2px 8px", borderRadius: 999,
        background: "var(--green-wash)", color: "var(--green-deep)",
        fontSize: 11, fontWeight: 700, fontFamily: "var(--mono)", letterSpacing: "0.04em",
        textTransform: "uppercase", whiteSpace: "nowrap", flexShrink: 0,
      }}
    >
      {tr("Simple")}
    </span>
  );
}

// DueBadge — Trello-style due-date pill with a clock icon; turns green with a
// check when the task is done, amber when due soon, red when overdue.
function DueBadge({ due, done }: { due: string; done: boolean }) {
  const tone = dueTone(due);
  const bg = done ? "var(--ok-wash)"
    : tone === "overdue" ? "var(--crit-wash)"
    : tone === "soon" ? "var(--ochre-wash)"
    : "var(--surface-sunk)";
  const fg = done ? "var(--ok)"
    : tone === "overdue" ? "var(--crit)"
    : tone === "soon" ? "var(--ochre)"
    : "var(--ink-soft)";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 999,
      background: bg, color: fg,
      fontSize: 11, fontWeight: 500, fontFamily: "var(--sans)",
      whiteSpace: "nowrap", flexShrink: 0,
    }}>
      {done ? (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 16 14" />
        </svg>
      )}
      {formatDate(due)}
    </span>
  );
}

// DoneBadge — standalone green check for done cards that have no due date.
function DoneBadge() {
  const tr = useTr();
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 999,
      background: "var(--ok-wash)", color: "var(--ok)",
      fontSize: 11, fontWeight: 500, fontFamily: "var(--sans)",
    }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      {tr("Done")}
    </span>
  );
}

// Member avatar palette — deterministic colour per name. Mirrors the board
// header's avatar palette so the same person reads consistently.
const AVATAR_PALETTE = ["#a5711a", "#254a33", "#8b3320", "#3b6f49", "#6a5acd", "#0f7b6c"];

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function avatarColorForName(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

// AvatarStack — overlapped member avatars (multi-assign). Shows up to 3 then a
// "+N" counter chip.
function AvatarStack({ people }: { people: { id: string; name: string }[] }) {
  const shown = people.slice(0, 3);
  const extra = people.length - shown.length;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }} title={people.map((p) => p.name).join(", ")}>
      {shown.map((p, i) => (
        <span
          key={p.id + i}
          style={{
            width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
            background: avatarColorForName(p.name), color: "#f4efdf",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700, fontFamily: "var(--sans)", letterSpacing: "0.02em",
            border: "2px solid var(--surface)",
            marginLeft: i === 0 ? 0 : -8,
          }}
        >
          {initialsFromName(p.name)}
        </span>
      ))}
      {extra > 0 && (
        <span style={{
          height: 28, minWidth: 28, padding: "0 6px", borderRadius: 999, marginLeft: -8,
          background: "var(--surface-sunk)", color: "var(--ink-soft)",
          border: "2px solid var(--surface)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 700, fontFamily: "var(--sans)",
        }}>
          +{extra}
        </span>
      )}
    </span>
  );
}

// ============================================================================
// SelectionBar — right-side dock when bulk mode is on (beside the board, not
// overlaying cards). One action per row. Dropdowns / due date / labels STAGE
// locally; nothing hits the network until Save. Archive still fires immediately.
// Parent owns the bulk POSTs via onSave(draft) / onArchive.
// ============================================================================

/** Width of the right-side bulk dock (also used by board layout for flex gap). */
export const SELECTION_BAR_WIDTH_PX = 280;

/** @deprecated Prefer SELECTION_BAR_WIDTH_PX — kept for any leftover imports. */
export const SELECTION_BAR_CLEARANCE_PX = SELECTION_BAR_WIDTH_PX;

const BULK_STATUS_OPTIONS = [
  { value: "planned", label: "Planned" },
  { value: "doing", label: "Doing" },
  { value: "done", label: "Done" },
];

const BULK_PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

/** Staged bulk edits — applied together when the user clicks Save. */
export type SelectionBarDraft = {
  status?: string;
  priority?: string;
  /** Teammate assignee ids (replaces set). Acharya is separate. */
  assign?: string[];
  /** Acharya id to set on selected tasks. */
  acharyaId?: string;
  listId?: string;
  /** Set when the due-date control was touched; null means clear. */
  dueDate?: string | null;
  dueDateTouched?: boolean;
  labelAddId?: string;
};

function emptyDraft(): SelectionBarDraft {
  return {};
}

function draftHasChanges(d: SelectionBarDraft): boolean {
  return !!(
    d.status ||
    d.priority ||
    d.assign ||
    d.acharyaId ||
    d.listId ||
    d.dueDateTouched ||
    d.labelAddId
  );
}

function clearDraftField<K extends keyof SelectionBarDraft>(
  d: SelectionBarDraft,
  key: K,
): SelectionBarDraft {
  const next = { ...d };
  delete next[key];
  return next;
}

export function SelectionBar({
  count, busy, canAssignAcharya, users, lists, labels, boardId,
  onSave, onArchive, onClear,
}: {
  count: number;
  busy?: boolean;
  canAssignAcharya?: boolean;
  users: { id: string; name: string }[];
  lists: { id: string; name: string }[];
  labels: { id: string; label: string }[];
  boardId?: string;
  onSave: (draft: SelectionBarDraft) => void;
  onArchive: () => void;
  onClear: () => void;
}) {
  const tr = useTr();
  const noSel = count === 0;
  const listOpts = lists.map((l) => ({ value: l.id, label: l.name }));

  const [draft, setDraft] = useState<SelectionBarDraft>(emptyDraft);
  const [fetchedLabels, setFetchedLabels] = useState<{ id: string; label: string }[]>([]);
  const [acharyas, setAcharyas] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!canAssignAcharya) return;
    let cancelled = false;
    fetch("/api/omnipulse/acharyas")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) {
          setAcharyas(
            ((d.items || []) as { id: string; display_name: string }[]).map((a) => ({
              id: a.id,
              name: a.display_name,
            })),
          );
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [canAssignAcharya]);

  useEffect(() => {
    if (!boardId) return;
    let cancelled = false;
    fetch(`/api/omnimart/task-labels?board_id=${encodeURIComponent(boardId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const items = ((d.items || []) as { id: string; label: string }[])
          .map((l) => ({ id: l.id, label: l.label }))
          .filter((l) => l.id && l.label);
        setFetchedLabels(items);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [boardId]);

  useEffect(() => {
    if (count === 0) setDraft(emptyDraft());
  }, [count]);

  const labelSource = (() => {
    const map = new Map<string, { id: string; label: string }>();
    for (const l of labels) if (l.id) map.set(l.id, l);
    for (const l of fetchedLabels) if (l.id) map.set(l.id, l);
    return [...map.values()];
  })();
  const labelOpts = labelSource.map((l) => ({ value: l.id, label: l.label }));
  const acharyaOpts = acharyas.map((a) => ({ value: a.id, label: a.name }));
  const memberOpts = users.map((u) => ({ id: u.id, name: u.name }));

  function stageAssignees(ids: string[]) {
    if (ids.length === 0) {
      setDraft((d) => clearDraftField(d, "assign"));
      return;
    }
    setDraft((d) => ({ ...d, assign: ids }));
  }

  function stageDue(iso: string) {
    setDraft((d) => ({
      ...d,
      dueDateTouched: true,
      dueDate: iso.trim() ? iso.slice(0, 10) : null,
    }));
  }

  const hasChanges = draftHasChanges(draft);
  const canSave = !busy && !noSel && hasChanges;
  const isMobile = useIsMobile();

  const fieldStyle: CSSProperties = {
    width: "100%",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
  };

  return (
    <aside
      role="toolbar"
      aria-label={tr("Bulk task actions")}
      style={{
        ...(isMobile
          ? {
              position: "fixed" as const,
              left: 12,
              right: 12,
              bottom: 12,
              zIndex: 1200,
              maxHeight: "min(70vh, 520px)",
              width: "auto",
            }
          : {
              position: "relative" as const,
              flex: `0 0 ${SELECTION_BAR_WIDTH_PX}px`,
              width: SELECTION_BAR_WIDTH_PX,
              alignSelf: "stretch",
              height: "100%",
              maxHeight: "100%",
              zIndex: 1,
            }),
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "12px 14px",
        boxSizing: "border-box",
        background: "var(--surface)",
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "var(--rule)",
        borderRadius: "var(--r-lg)",
        boxShadow: isMobile ? "var(--shadow-md)" : "var(--shadow-sm)",
        opacity: busy ? 0.7 : 1,
        pointerEvents: busy ? "none" : "auto",
        // Mobile sheet scrolls; desktop keeps overflow visible so absolute
        // menus (MemberMultiSelect) are not clipped.
        overflowY: isMobile ? "auto" : "visible",
        overflowX: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexShrink: 0 }}>
        <span style={{ fontFamily: "var(--sans)", fontSize: 13, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap" }}>
          {count} selected
          {hasChanges ? (
            <span style={{ fontWeight: 500, color: "var(--ink-mute)", marginLeft: 6 }}>
              {tr("(unsaved)")}
            </span>
          ) : null}
        </span>
        <button
          type="button"
          aria-label={tr("Clear selection")}
          onClick={onClear}
          disabled={busy}
          style={selectionCloseBtnStyle}
        >
          <SelectionCloseIcon />
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minHeight: 0 }}>
        <div style={fieldStyle}>
          <CustomSelect
            value={draft.status || ""}
            onChange={(v) => setDraft((d) => (v ? { ...d, status: v } : clearDraftField(d, "status")))}
            options={BULK_STATUS_OPTIONS}
            placeholder={tr("Change status")}
            disabled={busy || noSel}
            allowDeselect
            splitLabel
          />
        </div>
        <div style={fieldStyle}>
          <CustomSelect
            value={draft.priority || ""}
            onChange={(v) => setDraft((d) => (v ? { ...d, priority: v } : clearDraftField(d, "priority")))}
            options={BULK_PRIORITY_OPTIONS}
            placeholder={tr("Update priority")}
            disabled={busy || noSel}
            allowDeselect
            splitLabel
          />
        </div>
        <div style={fieldStyle}>
          <MemberMultiSelect
            value={draft.assign || []}
            onChange={stageAssignees}
            options={memberOpts}
            placeholder={tr("Assign to")}
            disabled={busy || noSel}
            chipColumns={1}
            splitLabel
          />
        </div>
        <div style={fieldStyle}>
          <CustomSelect
            value={draft.listId || ""}
            onChange={(v) => setDraft((d) => (v ? { ...d, listId: v } : clearDraftField(d, "listId")))}
            options={listOpts}
            placeholder={tr("Move to list")}
            disabled={busy || noSel || listOpts.length === 0}
            allowDeselect
            splitLabel
          />
        </div>
        <div style={fieldStyle}>
          <DatePicker
            value={draft.dueDateTouched ? (draft.dueDate || "") : ""}
            onChange={stageDue}
            placeholder={tr("Due date")}
            disabled={busy || noSel}
            allowClear
            splitLabel
            style={{
              width: "100%",
              minHeight: 42,
              padding: "10px 12px",
              fontSize: 13,
              boxSizing: "border-box",
            }}
          />
        </div>
        <div style={fieldStyle}>
          <CustomSelect
            value={draft.labelAddId || ""}
            onChange={(v) => setDraft((d) => (v ? { ...d, labelAddId: v } : clearDraftField(d, "labelAddId")))}
            options={labelOpts.length > 0 ? labelOpts : [{ value: "", label: "No labels on this project", disabled: true }]}
            placeholder={tr("Add label")}
            disabled={busy || noSel}
            allowDeselect
            splitLabel
          />
        </div>
        <div style={fieldStyle}>
          <CustomSelect
            value={draft.acharyaId || ""}
            onChange={(v) => setDraft((d) => (v ? { ...d, acharyaId: v } : clearDraftField(d, "acharyaId")))}
            options={acharyaOpts}
            placeholder={tr("Acharya")}
            disabled={busy || noSel || !canAssignAcharya || acharyaOpts.length === 0}
            allowDeselect
            splitLabel
          />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0, marginTop: 4 }}>
        <button
          type="button"
          onClick={onArchive}
          disabled={busy || noSel}
          style={{ ...selectionBtnStyle, width: "100%", ...(busy || noSel ? disabledBtnStyle : null) }}
        >
          {tr("Archive")}
        </button>
        <button
          type="button"
          onClick={() => {
            if (!canSave) return;
            onSave(draft);
          }}
          disabled={!canSave}
          style={{
            ...selectionBtnStyle,
            width: "100%",
            background: canSave ? "var(--green-deep)" : "transparent",
            color: canSave ? "var(--surface)" : "var(--ink-mute)",
            borderColor: canSave ? "var(--green-deep)" : "var(--rule)",
            fontWeight: 600,
            ...(!canSave ? disabledBtnStyle : null),
          }}
        >
          {tr("Save")}
        </button>
      </div>
    </aside>
  );
}

function SelectionCloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

const selectionCloseBtnStyle: CSSProperties = {
  width: 26, height: 26, padding: 0, lineHeight: 1,
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  background: "transparent", borderWidth: 1, borderStyle: "solid",
  borderColor: "var(--rule)", borderRadius: "var(--r-sm)",
  cursor: "pointer", color: "var(--ink-mute)", flexShrink: 0,
};

const selectionBtnStyle: CSSProperties = {
  padding: "10px 14px", fontSize: 12, fontFamily: "var(--sans)", fontWeight: 500,
  background: "transparent", color: "var(--ink-soft)",
  borderWidth: 1, borderStyle: "solid", borderColor: "var(--rule-strong)",
  borderRadius: "var(--r-sm)", cursor: "pointer", whiteSpace: "nowrap",
};
const disabledBtnStyle: CSSProperties = {
  opacity: 0.45, cursor: "not-allowed", color: "var(--ink-mute)", borderColor: "var(--rule)",
};
// AddListTile — dashed-border tile at the end of the columns row. Click to
// expand into a small name + color form. Parent owns the API call.
function AddListTile({ onCreate, isMobile }: { onCreate: (name: string, color: string) => Promise<void>; isMobile?: boolean }) {
  const tr = useTr();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(LIST_COLOR_PALETTE[0].value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  async function handleSubmit() {
    if (!name.trim()) return;
    setBusy(true); setError("");
    try {
      await onCreate(name.trim(), color);
      setName(""); setColor(LIST_COLOR_PALETTE[0].value); setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create list");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          background: "transparent",
          borderWidth: 1, borderStyle: "dashed", borderColor: "var(--rule)",
          borderRadius: "var(--r-md)",
          color: "var(--ink-mute)",
          cursor: "pointer", fontFamily: "var(--sans)", fontSize: 13,
          display: "flex", alignItems: "center", justifyContent: "center",
          minWidth: isMobile ? 0 : 200, minHeight: 60,
          width: isMobile ? "100%" : undefined,
          height: isMobile ? undefined : "100%",
        }}
      >{tr("+ Add list")}</button>
    );
  }

  return (
    <div style={{
      background: "var(--surface)",
      borderWidth: 1, borderStyle: "solid", borderColor: "var(--rule)",
      borderRadius: "var(--r-md)", padding: 12,
      minWidth: isMobile ? 0 : 260,
      width: isMobile ? "100%" : undefined,
      display: "flex", flexDirection: "column",
    }}>
      <div style={{
        fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.1em",
        textTransform: "uppercase", color: "var(--ink-mute)", marginBottom: 8,
      }}>
        {tr("NEW LIST")}
      </div>
      {error && (
        <div style={{ fontSize: 11, color: "var(--crit)", marginBottom: 8 }}>{error}</div>
      )}
      <input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder={tr("Column name")}
        style={{
          width: "100%", padding: "6px 8px", fontSize: 12,
          background: "var(--page)", color: "var(--ink)",
          borderWidth: 1, borderStyle: "solid", borderColor: "var(--rule-strong)",
          borderRadius: "var(--r-sm)",
          fontFamily: "var(--sans)", marginBottom: 8,
        }}
      />
      <div style={{ marginBottom: 10 }}>
        <ColorSwatches value={color} onChange={setColor} />
      </div>
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <button onClick={() => setOpen(false)} disabled={busy} style={menuCancelBtn}>{tr("Cancel")}</button>
        <button onClick={handleSubmit} disabled={busy || !name.trim()} style={menuPrimaryBtn}>
          {busy ? "..." : tr("Add")}
        </button>
      </div>
    </div>
  );
}

// ColumnMenu — three-dots popover bolted onto each column header. The list
// reorder is now drag-only (per T28 spec), so this menu only exposes rename /
// recolor / add card / delete.
function ColumnMenu({
  list, cardCount, onUpdate, onArchive, onAddCard,
}: {
  list: TaskBoardList;
  cardCount: number;
  onUpdate?: (listId: string, patch: { name?: string; color?: string; acharya_id?: string | null }) => Promise<void>;
  onArchive?: (listId: string) => Promise<void>;
  onAddCard?: (listId: string) => void;
}) {
  const tr = useTr();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"menu" | "rename" | "recolor" | "acharya" | "confirm-archive">("menu");
  const [nameInput, setNameInput] = useState(list.name);
  const [colorInput, setColorInput] = useState(list.color || "#94a3b8");
  const [acharyaInput, setAcharyaInput] = useState<string | null>(list.acharya_id ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      setMode("menu"); setError(""); setBusy(false);
      setNameInput(list.name); setColorInput(list.color || "#94a3b8");
      setAcharyaInput(list.acharya_id ?? null);
    }
  }, [open, list.name, list.color, list.acharya_id]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function submitUpdate(patch: { name?: string; color?: string; acharya_id?: string | null }) {
    if (!onUpdate) return;
    setBusy(true); setError("");
    try {
      await onUpdate(list.id, patch);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update list");
    } finally {
      setBusy(false);
    }
  }

  async function submitArchive() {
    if (!onArchive) return;
    setBusy(true); setError("");
    try {
      await onArchive(list.id);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive list");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={wrapRef} style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        aria-label={tr("List actions")}
        style={{
          background: "transparent",
          borderWidth: 0,
          padding: "2px 6px",
          color: "var(--ink-soft)",
          cursor: "pointer",
          fontSize: 16,
          lineHeight: 1,
          fontWeight: 700,
          borderRadius: "var(--r-sm)",
        }}
      >...</button>
      {open && (
        <div style={menuPopoverStyle} onClick={(e) => e.stopPropagation()}>
          {mode === "menu" && (
            <>
              <button style={menuRowStyle} onClick={() => setMode("rename")}>{tr("Rename card")}</button>
              <button style={menuRowStyle} onClick={() => setMode("recolor")}>{tr("Change color")}</button>
              <button style={menuRowStyle} onClick={() => setMode("acharya")}>{tr("Assign Acharya")}</button>
              <button
                style={menuRowStyle}
                onClick={() => { setOpen(false); onAddCard?.(list.id); }}
              >{tr("Add task")}</button>
              <div style={{
                borderTopWidth: 1, borderTopStyle: "solid", borderTopColor: "var(--rule)",
                margin: "4px 0",
              }} />
              {onArchive && (
                <button
                  style={menuRowStyle}
                  onClick={() => setMode("confirm-archive")}
                >{tr("Archive card")}</button>
              )}
            </>
          )}

          {mode === "rename" && (
            <div style={{ padding: 10, display: "grid", gap: 8 }}>
              <input
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && nameInput.trim()) submitUpdate({ name: nameInput.trim() });
                  if (e.key === "Escape") setMode("menu");
                }}
                style={menuInputStyle}
              />
              {error && <div style={{ fontSize: 11, color: "var(--crit)" }}>{error}</div>}
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                <button onClick={() => setMode("menu")} disabled={busy} style={menuCancelBtn}>{tr("Cancel")}</button>
                <button
                  onClick={() => submitUpdate({ name: nameInput.trim() })}
                  disabled={busy || !nameInput.trim() || nameInput.trim() === list.name}
                  style={menuPrimaryBtn}
                >{busy ? "..." : tr("Save")}</button>
              </div>
            </div>
          )}

          {mode === "recolor" && (
            <div style={{ padding: 10, display: "grid", gap: 10 }}>
              <ColorSwatches value={colorInput} onChange={setColorInput} />
              {error && <div style={{ fontSize: 11, color: "var(--crit)" }}>{error}</div>}
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                <button onClick={() => setMode("menu")} disabled={busy} style={menuCancelBtn}>{tr("Cancel")}</button>
                <button
                  onClick={() => submitUpdate({ color: colorInput })}
                  disabled={busy || colorInput === (list.color || "")}
                  style={menuPrimaryBtn}
                >{busy ? "..." : tr("Save")}</button>
              </div>
            </div>
          )}

          {mode === "acharya" && (
            <div style={{ padding: 10, display: "grid", gap: 10, minWidth: 240 }}>
              <AcharyaPicker
                value={acharyaInput}
                onChange={setAcharyaInput}
              />
              {error && <div style={{ fontSize: 11, color: "var(--crit)" }}>{error}</div>}
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                <button onClick={() => setMode("menu")} disabled={busy} style={menuCancelBtn}>{tr("Cancel")}</button>
                <button
                  onClick={() => submitUpdate({ acharya_id: acharyaInput })}
                  disabled={busy || acharyaInput === (list.acharya_id ?? null)}
                  style={menuPrimaryBtn}
                >{busy ? "..." : tr("Save")}</button>
              </div>
            </div>
          )}

          {mode === "confirm-archive" && (
            <div style={{ padding: 10, display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.4 }}>
                {cardCount > 0
                  ? `Archive "${list.name}"? Its ${cardCount} task${cardCount === 1 ? "" : "s"} are hidden with it — restore the card to bring them back.`
                  : `Archive the "${list.name}" card?`}
              </div>
              {error && <div style={{ fontSize: 11, color: "var(--crit)" }}>{error}</div>}
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                <button onClick={() => setMode("menu")} disabled={busy} style={menuCancelBtn}>{tr("Cancel")}</button>
                <button
                  onClick={submitArchive}
                  disabled={busy}
                  style={menuPrimaryBtn}
                >{busy ? "..." : tr("Archive")}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Inlined from main's `src/lib/client/due-date.ts` — the helper isn't present
// in this worktree and copying it would step outside the task's `owns` list.
// Same calendar-day-bucketing semantics as the original.
type DueTone = "overdue" | "soon" | "normal" | "none";

function dueTone(due: string | null | undefined): DueTone {
  if (!due) return "none";
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return "none";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diffDays <= 0) return "overdue";
  if (diffDays === 1) return "soon";
  return "normal";
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  } catch {
    return iso;
  }
}

const menuPopoverStyle: CSSProperties = {
  position: "absolute", top: "calc(100% + 4px)", right: 0,
  minWidth: 200, background: "var(--surface)",
  borderWidth: 1, borderStyle: "solid", borderColor: "var(--rule)",
  borderRadius: "var(--r-sm)",
  boxShadow: "var(--shadow-md)", zIndex: 1100, padding: "4px 0",
};

const menuRowStyle: CSSProperties = {
  display: "block", width: "100%", textAlign: "left",
  padding: "7px 12px", fontSize: 12,
  background: "transparent", borderWidth: 0, cursor: "pointer",
  fontFamily: "var(--sans)", color: "var(--ink-soft)",
  textTransform: "none", letterSpacing: 0,
};

const menuInputStyle: CSSProperties = {
  width: "100%", padding: "6px 8px", fontSize: 12,
  background: "var(--page)", color: "var(--ink)",
  borderWidth: 1, borderStyle: "solid", borderColor: "var(--rule-strong)",
  borderRadius: "var(--r-sm)",
  fontFamily: "var(--sans)",
};

const menuPrimaryBtn: CSSProperties = {
  padding: "5px 12px", fontSize: 11, fontWeight: 500,
  background: "var(--green-deep)", color: "var(--surface)",
  borderWidth: 1, borderStyle: "solid", borderColor: "var(--green-deep)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer", fontFamily: "var(--sans)",
};

const menuCancelBtn: CSSProperties = {
  padding: "5px 10px", fontSize: 11,
  background: "transparent", color: "var(--ink-mute)",
  borderWidth: 1, borderStyle: "solid", borderColor: "var(--rule)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer", fontFamily: "var(--sans)",
};
