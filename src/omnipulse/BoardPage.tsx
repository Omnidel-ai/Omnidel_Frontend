import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  CustomSelect,
  DragHandle,
  Input,
  Menu,
  Modal,
  MultiFilter,
  Skeleton,
  Table,
  emitToast,
  type BadgeTone,
  type Column,
} from "../components";
import type { OmniPulseBoard, OmniPulseCard, OmniPulseData, OmniPulseList } from "./types";
import { BoardHeader } from "./BoardHeader";
import { ViewToggle } from "./cards";
import { CardChips, formatDue, listToneClass } from "./boardBits";
import { TaskModal } from "./TaskModal";

const VIEWS = ["Card", "Table", "Calendar"];

/** A card flattened out of its list, for the table and calendar views. */
type BoardRow = OmniPulseCard & { list: string; listId: string; status: string };

export interface BoardPageProps {
  board: OmniPulseBoard;
  data: OmniPulseData;
  onBack: () => void;
}

/**
 * A project board — three views of the same lists.
 *
 * Card is the kanban, Table is every task flat with its list as a column, and
 * Calendar plots the dated ones on a month grid. The application offers the
 * same three from the same strip, and they read one set of lists, so nothing
 * has to be kept in step between them.
 *
 * Cards move with the card menu rather than by dragging: drag-and-drop needs
 * `@dnd-kit`, and a workspace that exists to show the design should not take a
 * dependency to fake one.
 */
export function BoardPage({ board, data, onBack }: BoardPageProps) {
  const [lists, setLists] = useState<OmniPulseList[]>(board.lists);
  const [view, setView] = useState("Card");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(() => typeof window !== "undefined");
  const [adding, setAdding] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [moving, setMoving] = useState<{ card: OmniPulseCard; listId: string } | null>(null);
  const [openTask, setOpenTask] = useState<{ card: OmniPulseCard; listId: string } | null>(null);

  useEffect(() => {
    setLists(board.lists);
    setLoading(true);
    const id = window.setTimeout(() => setLoading(false), 600);
    return () => window.clearTimeout(id);
  }, [board]);

  const q = search.trim().toLowerCase();

  const match = useMemo(
    () => (c: OmniPulseCard) => {
      if (q && !c.title.toLowerCase().includes(q)) return false;
      const pri = filters.priority ?? [];
      if (pri.length > 0 && !pri.includes(c.priority)) return false;
      const who = filters.assignee ?? [];
      if (who.length > 0 && !c.assignees.some((a) => who.includes(a))) return false;
      const lab = filters.label ?? [];
      if (lab.length > 0 && !c.labels.some((l) => lab.includes(l))) return false;
      return true;
    },
    [q, filters],
  );

  const visible = useMemo(
    () => lists.map((l) => ({ ...l, cards: l.cards.filter(match) })),
    [lists, match],
  );
  const flat: BoardRow[] = useMemo(
    () =>
      visible.flatMap((l) =>
        l.cards.map((c) => ({ ...c, list: l.title, listId: l.id, status: l.status ?? "Planned" })),
      ),
    [visible],
  );
  const shownCount = flat.length;
  const narrowed = Boolean(q) || Object.values(filters).some((v) => v.length > 0);

  function addCard(listId: string) {
    const title = draft.trim();
    if (!title) return;
    setLists((ls) =>
      ls.map((l) =>
        l.id === listId
          ? {
              ...l,
              count: (l.count ?? l.cards.length) + 1,
              cards: [
                ...l.cards,
                {
                  id: `new-${Date.now()}`,
                  title,
                  labels: [],
                  priority: "Med",
                  due: "",
                  overdue: false,
                  assignees: [],
                  comments: 0,
                  attachments: 0,
                  done: false,
                },
              ],
            }
          : l,
      ),
    );
    setDraft("");
    setAdding(null);
    emitToast("Task added", "success");
  }

  function moveCard(card: OmniPulseCard, fromId: string, toId: string) {
    if (fromId === toId) return;
    setLists((ls) =>
      ls.map((l) => {
        if (l.id === fromId) {
          return { ...l, count: Math.max(0, (l.count ?? l.cards.length) - 1), cards: l.cards.filter((c) => c.id !== card.id) };
        }
        if (l.id === toId) {
          return { ...l, count: (l.count ?? l.cards.length) + 1, cards: [...l.cards, card] };
        }
        return l;
      }),
    );
    setMoving(null);
    emitToast(`Moved to ${lists.find((l) => l.id === toId)?.title}`, "success");
  }

  function toggleDone(card: OmniPulseCard, listId: string) {
    setLists((ls) =>
      ls.map((l) =>
        l.id === listId
          ? { ...l, cards: l.cards.map((c) => (c.id === card.id ? { ...c, done: !c.done } : c)) }
          : l,
      ),
    );
  }

  const tableColumns: Column<BoardRow>[] = [
    {
      key: "seq",
      header: "#",
      width: "56px",
      render: (_c, i) => (
        <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--ink-mute)" }}>
          {i + 1}
        </span>
      ),
    },
    {
      key: "title",
      header: "Title",
      width: "minmax(240px, 2.4fr)",
      render: (c) => (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <button
            type="button"
            role="checkbox"
            aria-checked={c.done}
            aria-label={c.done ? `Reopen ${c.title}` : `Mark ${c.title} done`}
            className={`tsk__check tsk__check--sm${c.done ? " tsk__check--on" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              toggleDone(c, c.listId);
            }}
          >
            {c.done && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
          <span
            className="picker-truncate"
            style={{
              color: c.done ? "var(--ink-mute)" : "var(--ink)",
              textDecoration: c.done ? "line-through" : "none",
            }}
          >
            {c.title}
          </span>
        </span>
      ),
    },
    { key: "list", header: "Card", width: "150px", render: (c) => <span className="opx-tag">{c.list}</span> },
    {
      key: "status",
      header: "Status",
      width: "130px",
      render: (c) => <span className={`opx-tag opx-tag--${c.status.toLowerCase()}`}>{c.status}</span>,
    },
    {
      key: "priority",
      header: "Priority",
      width: "120px",
      render: (c) => <span className={`opx-pill opx-pill--${c.priority.toLowerCase()}`}>{longPriority(c.priority)}</span>,
    },
    {
      key: "owner",
      header: "Owner",
      width: "minmax(150px, 1fr)",
      render: (c) =>
        c.assignees.length > 0 ? (
          <span className="opx-owner">{c.assignees[0]}</span>
        ) : (
          <span style={{ color: "var(--ink-faint)" }}>—</span>
        ),
    },
    {
      key: "due",
      header: "Deadline",
      width: "130px",
      render: (c) =>
        c.due ? (
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 11.5,
              color: c.overdue ? "var(--crit)" : "var(--ink-soft)",
            }}
          >
            {formatDue(c.due)}
          </span>
        ) : (
          <span style={{ color: "var(--ink-faint)" }}>—</span>
        ),
    },
    {
      key: "__actions",
      header: "Actions",
      width: "110px",
      align: "right",
      render: (c) => (
        <button
          type="button"
          className="opx-view"
          onClick={(e) => {
            e.stopPropagation();
            setOpenTask({ card: c, listId: c.listId });
          }}
        >
          View
        </button>
      ),
    },
  ];

  return (
    <div>
      <BoardHeader board={board} shown={shownCount} onBack={onBack} />

      <div className="opx-boardbar">
        <ViewToggle value={view} onChange={setView} options={VIEWS} label="Board view" />
        <span className="opx-taskcount">
          {narrowed ? `${shownCount} of ${board.taskCount}` : `${board.taskCount}`} tasks
        </span>

        <div className="opx-boardbar__right">
          <MultiFilter
            searchInput={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search tasks & filters..."
            align="right"
            sections={(data.boardFilters ?? []).map((f) => ({
              kind: "checklist" as const,
              key: f.key,
              label: f.label,
              selected: filters[f.key] ?? [],
              onChange: (next: string[]) => setFilters((v) => ({ ...v, [f.key]: next })),
              options: f.options.map((o) => ({ value: o, label: o })),
            }))}
          />
          <Button size="sm" onClick={() => setAdding(lists[0]?.id ?? null)}>
            + Add Task
          </Button>
          <Button variant="secondary" size="sm" onClick={() => emitToast("Board settings — demo", "info")}>
            Settings
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setCollapsed((c) => !c)}>
            {collapsed ? "Expand" : "Collapse"}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="opx-board">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="opx-list opx-list--neutral">
              <Skeleton width="50%" height={11} />
              <Skeleton shape="block" height={72} style={{ marginTop: 12 }} />
              <Skeleton shape="block" height={72} style={{ marginTop: 8 }} />
            </div>
          ))}
        </div>
      ) : view === "Table" ? (
        <Table
          columns={tableColumns}
          data={flat}
          rowKey={(c) => c.id}
          minWidth={1000}
          emptyVariant={narrowed ? "no-results" : "empty"}
          emptyMessage={narrowed ? "No tasks match this view" : "This board has no tasks yet"}
          emptyHint={narrowed ? "Clear the search and the filters." : "Add one to the first list."}
        />
      ) : view === "Calendar" ? (
        <CalendarView cards={flat} onOpen={(c) => setOpenTask({ card: c, listId: c.listId })} />
      ) : (
        <div className="opx-board themed-scroll-x">
          {visible.map((list) => (
            <section key={list.id} className={`opx-list ${listToneClass(list.tone)}`} aria-label={list.title}>
              <header className="opx-list__head">
                <DragHandle label={`Reorder ${list.title}`} />
                <span className={`opx-list__dot opx-dot--${list.tone ?? "neutral"}`} aria-hidden="true" />
                <span className="opx-list__title">{list.title}</span>
                <span className="opx-list__count">{narrowed ? list.cards.length : (list.count ?? list.cards.length)}</span>
                <Menu
                  size="sm"
                  label={`${list.title} actions`}
                  items={[
                    { label: "Add a task", onClick: () => setAdding(list.id) },
                    { label: "Rename list", onClick: () => emitToast("Rename — demo", "info") },
                    { label: "Archive list", onClick: () => emitToast("Archive — demo", "info"), tone: "danger", separated: true },
                  ]}
                />
              </header>

              {!collapsed && (
                <>
                  <div className="opx-list__cards">
                    {list.cards.length === 0 ? (
                      <p className="opx-list__drop">{narrowed ? "No matching tasks" : "Drop tasks here"}</p>
                    ) : (
                      list.cards.map((card) => (
                        <article key={card.id} className="opx-card-item">
                          {card.labels.length > 0 && (
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
                              {card.labels.map((l) => (
                                <Badge key={l} tone={(data.labelTones[l] as BadgeTone) ?? "neutral"}>
                                  {l}
                                </Badge>
                              ))}
                            </div>
                          )}

                          <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                            <button
                              type="button"
                              className="opx-card-item__title"
                              onClick={() => setOpenTask({ card, listId: list.id })}
                              style={{
                                color: card.done ? "var(--ink-mute)" : "var(--ink)",
                                textDecoration: card.done ? "line-through" : "none",
                              }}
                            >
                              {card.title}
                            </button>
                            <Menu
                              size="sm"
                              label={`${card.title} actions`}
                              items={[
                                { label: "Open task", onClick: () => setOpenTask({ card, listId: list.id }) },
                                {
                                  label: card.done ? "Mark not done" : "Mark done",
                                  onClick: () => toggleDone(card, list.id),
                                },
                                { label: "Move to list…", onClick: () => setMoving({ card, listId: list.id }) },
                                {
                                  label: "Archive task",
                                  onClick: () => emitToast("Archive — demo", "info"),
                                  tone: "danger",
                                  separated: true,
                                },
                              ]}
                            />
                          </div>

                          <CardChips card={card} />
                        </article>
                      ))
                    )}
                  </div>

                  {adding === list.id ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        addCard(list.id);
                      }}
                      style={{ display: "grid", gap: 6, marginTop: 8 }}
                    >
                      <Input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder="Task title"
                        aria-label="Task title"
                      />
                      <div style={{ display: "flex", gap: 6 }}>
                        <Button size="sm" type="submit">
                          Add
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setAdding(null);
                            setDraft("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <button
                      type="button"
                      className="opx-list__add"
                      onClick={() => {
                        setAdding(list.id);
                        setDraft("");
                      }}
                    >
                      + Add a task
                    </button>
                  )}
                </>
              )}
            </section>
          ))}

          <button
            type="button"
            className="opx-addlist"
            onClick={() => emitToast("New list — demo", "info")}
          >
            + Add list
          </button>
        </div>
      )}

      {openTask && (
        <TaskModal
          card={openTask.card}
          status={lists.find((l) => l.id === openTask.listId)?.status ?? "Planned"}
          meta={data.taskMeta}
          people={data.people}
          onClose={() => setOpenTask(null)}
          onSave={(next) =>
            setLists((ls) =>
              ls.map((l) =>
                l.id === openTask.listId
                  ? {
                      ...l,
                      cards: l.cards.map((c) => (c.id === openTask.card.id ? { ...c, ...next } : c)),
                    }
                  : l,
              ),
            )
          }
        />
      )}

      <Modal
        open={moving != null}
        onClose={() => setMoving(null)}
        title="Move task"
        description={moving?.card.title}
        footer={
          <Button variant="ghost" onClick={() => setMoving(null)}>
            Cancel
          </Button>
        }
      >
        {moving && (
          <div className="picker-field">
            <CustomSelect
              value={moving.listId}
              onChange={(to) => moveCard(moving.card, moving.listId, to)}
              options={lists.map((l) => ({ value: l.id, label: l.title }))}
              aria-label="Destination list"
            />
            <p style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 10, lineHeight: 1.55 }}>
              Dragging needs a drag-and-drop library; the menu does the same job without one.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}

/**
 * Month grid of the dated tasks — the board's third view.
 *
 * Today is a filled circle on a tinted cell, the date sits top-right, and days
 * outside the month are dimmed rather than hidden, so the grid keeps its shape
 * from month to month.
 */
function CalendarView({ cards, onOpen }: { cards: BoardRow[]; onOpen?: (c: BoardRow) => void }) {
  const dated = cards.filter((c) => c.due);
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));

  const days = useMemo(() => {
    const first = startOfMonth(cursor);
    // Monday-first, padded with the neighbouring days.
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - offset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);

  const byDay = useMemo(() => {
    const map = new Map<string, BoardRow[]>();
    for (const c of dated) {
      const list = map.get(c.due) ?? [];
      list.push(c);
      map.set(c.due, list);
    }
    return map;
  }, [dated]);

  const todayIso = isoOf(new Date());
  const undated = cards.length - dated.length;

  return (
    <div>
      <div className="opx-cal__bar">
        <button
          type="button"
          className="opx-cal__nav"
          aria-label="Previous month"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
        >
          ‹
        </button>
        <button
          type="button"
          className="opx-cal__nav"
          aria-label="Next month"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
        >
          ›
        </button>
        <span className="opx-cal__month">
          {cursor.toLocaleString("en-GB", { month: "long", year: "numeric" })}
        </span>
        <button type="button" className="opx-cal__today" onClick={() => setCursor(startOfMonth(new Date()))}>
          Today
        </button>
        <span className="opx-cal__hint">dated tasks only · click one to open it</span>
      </div>

      <div className="opx-cal">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="opx-cal__head">
            {d}
          </div>
        ))}
        {days.map((d) => {
          const iso = isoOf(d);
          const items = byDay.get(iso) ?? [];
          const dim = d.getMonth() !== cursor.getMonth();
          const isToday = iso === todayIso;
          return (
            <div
              key={iso}
              className={`opx-cal__cell${isToday ? " opx-cal__cell--today" : ""}`}
              style={{ opacity: dim ? 0.45 : 1 }}
            >
              <span className={`opx-cal__date${isToday ? " opx-cal__date--today" : ""}`}>
                {d.getDate()}
              </span>
              {items.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="opx-cal__task"
                  title={`${c.title} · ${c.list}`}
                  onClick={() => onOpen?.(c)}
                >
                  <span className="opx-cal__task-day">{d.getDate()}</span>
                  <span className="picker-truncate">{c.title}</span>
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {undated > 0 && (
        <p className="opx-cal__empty">
          {undated} {undated === 1 ? "task has" : "tasks have"} no deadline (not shown). Set a
          deadline to place one on the calendar.
        </p>
      )}
    </div>
  );
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Local-time ISO — `toISOString()` would shift the day either side of UTC. */
function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The table spells the priority out where the card abbreviates it. */
function longPriority(p: string): string {
  if (p === "Med") return "Medium";
  return p;
}

