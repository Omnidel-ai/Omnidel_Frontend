"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent, pointerWithin,
  PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core";
import type { TaskBoardTask } from "@/components/omnidel/task-board";
import { useTr } from "@/lib/client/language";

// ============================================================================
// TaskCalendar — month-grid calendar for an OmniPulse board. Tasks render as
// horizontal bars INSIDE the day cells, spanning assigned_on (start) → due_date
// (end). Bars stack in lanes within each week and the week row grows to fit
// however many overlap that week (no fixed height / no "+N more" truncation).
//
//   • Drag a bar      → moves the whole range (start follows the dropped day,
//                       duration preserved).
//   • Drag left edge  → changes the start (assigned_on).
//   • Drag right edge → changes the end (due_date).
//
// The day under the cursor is the drop target (pointerWithin), so move + resize
// work across week boundaries. Parent persists via onReschedule(id, start, end).
// ============================================================================

interface TaskCalendarProps {
  tasks: TaskBoardTask[];
  loading?: boolean;
  onOpenTask?: (taskId: string) => void;
  onReschedule?: (taskId: string, startDate: string, endDate: string) => void;
  // Click an empty day → create a task with that day as the assigned date.
  onCreateOnDate?: (dateYmd: string) => void;
  // Right-click context menu (Open / Move… / Archive) — mirrors the kanban card.
  lists?: { id: string; name: string }[];
  onMoveTask?: (taskId: string, listId: string) => void;
  onArchiveTask?: (taskId: string) => Promise<void> | void;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HEADER_H = 24;   // space at the top of a week cell for the date number
const LANE_H = 22;     // height of one task bar
const LANE_GAP = 3;    // vertical gap between stacked bars
const WEEK_PAD = 6;    // bottom padding under the last bar
const HANDLE_W = 9;    // edge-resize hit zone

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function parseYMD(s: string): Date {
  const t = /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s;
  const [y, m, d] = t.split("-").map(Number);
  if (y && m && d) return new Date(y, m - 1, d);
  const dt = new Date(s);
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

const AV_PALETTE = ["#a5711a", "#254a33", "#8b3320", "#3b6f49", "#6a5acd", "#0f7b6c", "#3d93d6", "#9b59c6"];
function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0]).toUpperCase();
}
function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AV_PALETTE[h % AV_PALETTE.length];
}
function firstAssignee(task: TaskBoardTask): { id: string; name: string } | null {
  if (task.assignees && task.assignees.length > 0) return task.assignees[0];
  if (task.assigned_to_name) return { id: "primary", name: task.assigned_to_name };
  return null;
}

function isOverdue(end: Date, done: boolean): boolean {
  if (done) return false;
  const today = new Date();
  return ymd(end) < ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
}
function barColors(task: TaskBoardTask, end: Date): { bar: string; text: string } {
  const done = task.status === "done";
  if (isOverdue(end, done)) return { bar: "var(--crit)", text: "#f4efdf" };
  if (done) return { bar: "var(--ok)", text: "#f4efdf" };
  const listHex = /^#[0-9a-fA-F]{6}$/.test(task.list_color || "") ? task.list_color! : null;
  if (listHex) return { bar: listHex, text: "#f4efdf" };
  if (task.status === "doing") return { bar: "var(--ochre)", text: "#f4efdf" };
  return { bar: "var(--green-deep)", text: "#f4efdf" };
}

interface Range { task: TaskBoardTask; start: Date; end: Date; }
interface Segment {
  task: TaskBoardTask;
  colStart: number;   // 0..6
  colEnd: number;     // 0..6
  lane: number;
  continuesLeft: boolean;
  continuesRight: boolean;
}

export function TaskCalendar({ tasks, loading, onOpenTask, onReschedule, onCreateOnDate, lists, onMoveTask, onArchiveTask }: TaskCalendarProps) {
  const tr = useTr();
  const [cursor, setCursor] = useState<Date>(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const todayKey = ymd(new Date());

  // Monday-based 6-week grid.
  const gridStart = useMemo(() => {
    const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const lead = (monthStart.getDay() + 6) % 7;
    return addDays(monthStart, -lead);
  }, [cursor]);

  const ranges = useMemo<Range[]>(() => {
    const out: Range[] = [];
    for (const t of tasks) {
      // Completed tasks are hidden from the calendar.
      if (t.status === "done") continue;
      if (!t.due_date) continue;
      const end = parseYMD(t.due_date);
      let start = t.assigned_on ? parseYMD(t.assigned_on) : end;
      if (start.getTime() > end.getTime()) start = end;
      out.push({ task: t, start, end });
    }
    return out;
  }, [tasks]);

  const undated = useMemo(
    () => tasks.filter((t) => t.status !== "done" && !t.due_date).length,
    [tasks],
  );
  const rangeById = useMemo(() => {
    const m = new Map<string, Range>();
    for (const r of ranges) m.set(r.task.id, r);
    return m;
  }, [ranges]);

  // Per-week segments with lane assignment + the resulting row height.
  const weeks = useMemo(() => {
    const result: { days: Date[]; segments: Segment[]; laneCount: number }[] = [];
    for (let w = 0; w < 6; w++) {
      const weekStartIdx = w * 7;
      const days = Array.from({ length: 7 }, (_, i) => addDays(gridStart, weekStartIdx + i));
      const weekStartAbs = weekStartIdx;
      const weekEndAbs = weekStartIdx + 6;

      // Build this week's segments.
      const raw: Omit<Segment, "lane">[] = [];
      for (const r of ranges) {
        const aStart = diffDays(gridStart, r.start);
        const aEnd = diffDays(gridStart, r.end);
        const segStart = Math.max(aStart, weekStartAbs);
        const segEnd = Math.min(aEnd, weekEndAbs);
        if (segStart > segEnd) continue;
        raw.push({
          task: r.task,
          colStart: segStart - weekStartAbs,
          colEnd: segEnd - weekStartAbs,
          continuesLeft: aStart < weekStartAbs,
          continuesRight: aEnd > weekEndAbs,
        });
      }
      // Lane packing — sort by start then length; first lane whose last column
      // is before this segment's start gets it.
      raw.sort((a, b) => a.colStart - b.colStart || b.colEnd - a.colEnd || a.task.title.localeCompare(b.task.title));
      const laneLastCol: number[] = [];
      const segments: Segment[] = raw.map((s) => {
        let lane = laneLastCol.findIndex((last) => last < s.colStart);
        if (lane === -1) { lane = laneLastCol.length; laneLastCol.push(s.colEnd); }
        else laneLastCol[lane] = s.colEnd;
        return { ...s, lane };
      });
      result.push({ days, segments, laneCount: laneLastCol.length });
    }
    return result;
  }, [ranges, gridStart]);

  const monthLabel = cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const goPrev = () => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1));
  const goNext = () => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1));
  const goToday = () => { const t = new Date(); setCursor(new Date(t.getFullYear(), t.getMonth(), 1)); };

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String((e.active.data.current as { taskId?: string })?.taskId || ""));
  }
  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const data = e.active.data.current as { taskId?: string; mode?: "move" | "start" | "end" } | undefined;
    if (!data?.taskId || !data.mode || !e.over) return;
    const dropDay = parseYMD(String(e.over.id));
    const range = rangeById.get(data.taskId);
    if (!range) return;
    let s = range.start;
    let en = range.end;
    if (data.mode === "move") {
      const dur = diffDays(range.start, range.end);
      s = dropDay;
      en = addDays(dropDay, dur);
    } else if (data.mode === "start") {
      s = dropDay.getTime() > range.end.getTime() ? range.end : dropDay;
    } else {
      en = dropDay.getTime() < range.start.getTime() ? range.start : dropDay;
    }
    if (ymd(s) === ymd(range.start) && ymd(en) === ymd(range.end)) return;
    onReschedule?.(data.taskId, ymd(s), ymd(en));
  }

  if (loading) {
    return <div style={{ color: "var(--ink-mute)", fontSize: 13, padding: 20 }}>{tr("Loading project...")}</div>;
  }

  const activeTask = activeId ? rangeById.get(activeId)?.task : null;

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveId(null)}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* On phones the drag hint (a mouse-only affordance) squished into a
            tall column beside the month nav — hide it there and let the nav
            keep its own row. The month label also drops its 150px floor on
            phones so the nav fits; !important beats the inline minWidth.
            Desktop keeps the floor so "Today" doesn't slide left/right as the
            month name changes length. */}
        <style>{`
          @media (max-width: 767px) {
            .cal-toolbar { flex-wrap: wrap; }
            .cal-drag-hint { display: none; }
            .cal-month { min-width: 0 !important; white-space: nowrap; }
          }
        `}</style>
        {/* Toolbar */}
        <div className="cal-toolbar" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button type="button" onClick={goPrev} aria-label={tr("Previous month")} style={navBtnStyle}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <button type="button" onClick={goNext} aria-label={tr("Next month")} style={navBtnStyle}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
          <div className="cal-month" style={{ fontFamily: "var(--serif)", fontSize: 20, color: "var(--ink)", minWidth: 150, marginLeft: 4 }}>{monthLabel}</div>
          <button type="button" onClick={goToday} style={todayBtnStyle}>{tr("Today")}</button>
          <span style={{ flex: 1 }} />
          <span className="cal-drag-hint" style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-mute)", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
            {tr("Drag a task to move · drag an edge to resize")}
          </span>
        </div>

        <div className="themed-scroll-x" style={{ overflowX: "auto", overflowY: "hidden" }}>
          <div style={{ minWidth: 760, border: "1px solid var(--rule)", borderRadius: "var(--r-md)", overflow: "hidden", background: "var(--surface)" }}>
            {/* Weekday header */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
              {WEEKDAYS.map((wd, i) => (
                <div key={wd} style={{ ...weekdayCellStyle, borderRight: i === 6 ? "none" : "1px solid var(--rule)" }}>{wd}</div>
              ))}
            </div>
            {/* Weeks */}
            {weeks.map((week, wi) => {
              const rowH = HEADER_H + (week.laneCount > 0 ? week.laneCount * (LANE_H + LANE_GAP) + WEEK_PAD : 30);
              return (
                <div key={wi} style={{ position: "relative", minHeight: rowH, borderTop: wi === 0 ? "none" : "1px solid var(--rule)" }}>
                  {/* Day backgrounds (droppable) */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", position: "absolute", inset: 0 }}>
                    {week.days.map((d, di) => (
                      <DayCell
                        key={di}
                        date={d}
                        lastCol={di === 6}
                        inMonth={d.getMonth() === cursor.getMonth()}
                        isToday={ymd(d) === todayKey}
                        onCreate={onCreateOnDate ? () => onCreateOnDate(ymd(d)) : undefined}
                      />
                    ))}
                  </div>
                  {/* Task bars overlay */}
                  <div style={{ position: "relative", height: rowH, pointerEvents: "none" }}>
                    {week.segments.map((seg) => (
                      <SegmentBar
                        key={`${seg.task.id}-${wi}`}
                        seg={seg}
                        weekIdx={wi}
                        onOpenTask={onOpenTask}
                        lists={lists}
                        onMoveTask={onMoveTask}
                        onArchiveTask={onArchiveTask}
                        dimmed={activeId === seg.task.id}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {undated > 0 && (
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-mute)", letterSpacing: "0.04em" }}>
            {undated} task{undated === 1 ? "" : "s"} {tr("with no deadline (not shown). Set a deadline to place one on the calendar.")}
          </div>
        )}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 9px",
            background: barColors(activeTask, rangeById.get(activeTask.id)!.end).bar,
            color: "#f4efdf", borderRadius: 6, fontSize: 12, fontWeight: 600,
            boxShadow: "var(--shadow-md)", maxWidth: 240, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {activeTask.title}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// DayCell — droppable background cell with date number. One flat background for
// every day; only today (and the active drop target) is highlighted. Clicking
// an empty area creates a task on that day (onCreate).
function DayCell({ date, lastCol, inMonth, isToday, onCreate }: {
  date: Date; lastCol: boolean; inMonth: boolean; isToday: boolean; onCreate?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: ymd(date) });
  const bg = isOver ? "var(--green-wash)" : isToday ? "var(--ochre-wash)" : "var(--surface)";
  return (
    <div
      ref={setNodeRef}
      onClick={onCreate}
      title={onCreate ? "Add a task on this day" : undefined}
      style={{
        borderRight: lastCol ? "none" : "1px solid var(--rule)",
        background: bg,
        boxShadow: isOver ? "inset 0 0 0 2px var(--green-deep)" : "none",
        transition: "background .1s",
        padding: "3px 5px",
        cursor: onCreate ? "pointer" : "default",
      }}>
      <div style={{ textAlign: "right" }}>
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          minWidth: 20, height: 20, padding: "0 5px", borderRadius: 999,
          fontFamily: "var(--mono)", fontSize: 11, fontWeight: isToday ? 700 : 500,
          background: isToday ? "var(--green-deep)" : "transparent",
          color: isToday ? "var(--surface)" : inMonth ? "var(--ink)" : "var(--ink-faint)",
        }}>
          {date.getDate()}
        </span>
      </div>
    </div>
  );
}

// SegmentBar — one week-slice of a task. Three draggable zones (move / resize
// start / resize end) sit over a coloured visual. dnd-kit drives the drag; the
// zones never transform (DragOverlay shows the moving chip), so the grid stays
// put under the cursor for pointerWithin drop resolution.
function SegmentBar({ seg, weekIdx, onOpenTask, lists, onMoveTask, onArchiveTask, dimmed }: {
  seg: Segment; weekIdx: number; onOpenTask?: (id: string) => void;
  lists?: { id: string; name: string }[];
  onMoveTask?: (taskId: string, listId: string) => void;
  onArchiveTask?: (taskId: string) => Promise<void> | void;
  dimmed: boolean;
}) {
  const tr = useTr();
  const { task, colStart, colEnd, lane, continuesLeft, continuesRight } = seg;
  const end = parseYMD(task.due_date!);
  const colors = barColors(task, end);
  const isDone = task.status === "done";
  const assignee = firstAssignee(task);
  const span = colEnd - colStart + 1;

  // Right-click context menu (Open / Move… / Archive), positioned at the cursor.
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  function openMenu(e: React.MouseEvent) {
    if (!onMoveTask && !onArchiveTask && !onOpenTask) return;
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY });
  }

  const move = useDraggable({ id: `${task.id}|move|${weekIdx}`, data: { taskId: task.id, mode: "move" } });
  const startH = useDraggable({ id: `${task.id}|start|${weekIdx}`, data: { taskId: task.id, mode: "start" } });
  const endH = useDraggable({ id: `${task.id}|end|${weekIdx}`, data: { taskId: task.id, mode: "end" } });

  const leftPad = continuesLeft ? 0 : HANDLE_W;
  const rightPad = continuesRight ? 0 : HANDLE_W;

  return (
    <div
      onContextMenu={openMenu}
      style={{
        position: "absolute",
        left: `calc(${(colStart / 7) * 100}% + 3px)`,
        width: `calc(${(span / 7) * 100}% - 6px)`,
        top: HEADER_H + lane * (LANE_H + LANE_GAP),
        height: LANE_H,
        pointerEvents: "auto",
        opacity: dimmed ? 0.4 : 1,
      }}>
      {/* Visual bar (no pointer events — the zones above handle interaction) */}
      <div style={{
        position: "absolute", inset: 0,
        background: colors.bar, color: colors.text,
        borderRadius: 6,
        borderTopLeftRadius: continuesLeft ? 0 : 6, borderBottomLeftRadius: continuesLeft ? 0 : 6,
        borderTopRightRadius: continuesRight ? 0 : 6, borderBottomRightRadius: continuesRight ? 0 : 6,
        display: "flex", alignItems: "center", gap: 5,
        padding: `0 ${rightPad + 4}px 0 ${leftPad + 6}px`,
        boxShadow: "var(--shadow-sm)", opacity: isDone ? 0.78 : 1,
        pointerEvents: "none", overflow: "hidden",
      }}>
        {!continuesLeft && (
          <span style={{
            fontSize: 10, fontFamily: "var(--mono)", opacity: 0.85, flexShrink: 0,
          }}>
            {parseYMD(task.assigned_on || task.due_date!).getDate()}
          </span>
        )}
        <span style={{
          flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: 500,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          textDecorationLine: isDone ? "line-through" : "none",
        }}>
          {task.title}
        </span>
        {assignee && span >= 2 && (
          <span title={assignee.name} style={{
            width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
            background: avatarColor(assignee.id || assignee.name), color: "#f4efdf",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: 8, fontWeight: 700, fontFamily: "var(--sans)", border: "1.5px solid rgba(255,255,255,0.5)",
          }}>{initials(assignee.name)}</span>
        )}
      </div>

      {/* Move zone (covers the middle) */}
      <div
        ref={move.setNodeRef}
        {...move.attributes}
        {...move.listeners}
        onClick={() => onOpenTask?.(task.id)}
        title={task.title}
        style={{
          position: "absolute", top: 0, bottom: 0,
          left: leftPad, right: rightPad,
          cursor: "grab", touchAction: "none",
        }}
      />
      {/* Resize start (only on the true start week) */}
      {!continuesLeft && (
        <div
          ref={startH.setNodeRef}
          {...startH.attributes}
          {...startH.listeners}
          aria-label={tr("Resize start")}
          style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: HANDLE_W, cursor: "ew-resize", touchAction: "none" }}
        />
      )}
      {/* Resize end (only on the true end week) */}
      {!continuesRight && (
        <div
          ref={endH.setNodeRef}
          {...endH.attributes}
          {...endH.listeners}
          aria-label={tr("Resize end")}
          style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: HANDLE_W, cursor: "ew-resize", touchAction: "none" }}
        />
      )}

      {menu && (
        <TaskContextMenu
          x={menu.x}
          y={menu.y}
          task={task}
          lists={lists}
          onClose={() => setMenu(null)}
          onOpenTask={onOpenTask}
          onMoveTask={onMoveTask}
          onArchiveTask={onArchiveTask}
        />
      )}
    </div>
  );
}

// TaskContextMenu — cursor-anchored popover (portalled to body) with the same
// actions as the kanban card's 3-dot menu: Open task / Move… / Archive task.
function TaskContextMenu({
  x, y, task, lists, onClose, onOpenTask, onMoveTask, onArchiveTask,
}: {
  x: number; y: number; task: TaskBoardTask;
  lists?: { id: string; name: string }[];
  onClose: () => void;
  onOpenTask?: (id: string) => void;
  onMoveTask?: (taskId: string, listId: string) => void;
  onArchiveTask?: (taskId: string) => Promise<void> | void;
}) {
  const tr = useTr();
  const [mode, setMode] = useState<"menu" | "move">("menu");
  const [busy, setBusy] = useState(false);
  const moveTargets = (lists || []).filter((l) => l.id !== task.list_id);

  // Close on any outside interaction.
  useEffect(() => {
    function close() { onClose(); }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    // Defer so the opening right-click doesn't immediately close it.
    const t = window.setTimeout(() => {
      document.addEventListener("mousedown", close);
      document.addEventListener("scroll", close, true);
      window.addEventListener("resize", close);
      window.addEventListener("blur", close);
    }, 0);
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", close);
      document.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("blur", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Keep the menu on-screen.
  const W = 200;
  const left = Math.min(x, window.innerWidth - W - 8);
  const top = Math.min(y, window.innerHeight - 180);

  return createPortal(
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: "fixed", top, left, width: W, zIndex: 2000,
        background: "var(--surface)", border: "1px solid var(--rule)",
        borderRadius: "var(--r-sm)", boxShadow: "var(--shadow-md)", padding: "4px 0",
      }}
    >
      {mode === "menu" && (
        <>
          {onOpenTask && (
            <button style={ctxRowStyle} onClick={() => { onClose(); onOpenTask(task.id); }}>{tr("Open task")}</button>
          )}
          {onMoveTask && moveTargets.length > 0 && (
            <button style={ctxRowStyle} onClick={() => setMode("move")}>{tr("Move…")}</button>
          )}
          {onArchiveTask && (
            <button
              style={{ ...ctxRowStyle, color: "var(--crit)" }}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try { await onArchiveTask(task.id); onClose(); } finally { setBusy(false); }
              }}
            >{busy ? tr("Archiving…") : tr("Archive task")}</button>
          )}
        </>
      )}
      {mode === "move" && (
        <>
          <div style={{ padding: "6px 12px 4px", fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-mute)" }}>{tr("Move to")}</div>
          <div style={{ maxHeight: 240, overflowY: "auto" }}>
            {moveTargets.map((l) => (
              <button key={l.id} style={ctxRowStyle} onClick={() => { onMoveTask?.(task.id, l.id); onClose(); }}>{l.name}</button>
            ))}
          </div>
          <div style={{ borderTop: "1px solid var(--rule)", margin: "4px 0" }} />
          <button style={ctxRowStyle} onClick={() => setMode("menu")}>{tr("← Back")}</button>
        </>
      )}
    </div>,
    document.body,
  );
}

const ctxRowStyle: CSSProperties = {
  display: "block", width: "100%", textAlign: "left",
  padding: "7px 12px", fontSize: 12,
  background: "transparent", borderWidth: 0, cursor: "pointer",
  fontFamily: "var(--sans)", color: "var(--ink-soft)",
};

const navBtnStyle: CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: 30, height: 30, padding: 0,
  background: "var(--surface)", color: "var(--ink-soft)",
  border: "1px solid var(--rule)", borderRadius: "var(--r-sm)", cursor: "pointer",
};
const todayBtnStyle: CSSProperties = {
  padding: "5px 12px", fontSize: 11, fontFamily: "var(--mono)",
  letterSpacing: "0.08em", textTransform: "uppercase",
  background: "var(--surface)", color: "var(--ink-soft)",
  border: "1px solid var(--rule)", borderRadius: "var(--r-sm)", cursor: "pointer",
};
const weekdayCellStyle: CSSProperties = {
  padding: "6px 8px",
  borderBottom: "1px solid var(--rule)",
  background: "var(--surface-sunk)",
  fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.08em",
  textTransform: "uppercase", color: "var(--ink-mute)", fontWeight: 700,
};
