import { useEffect, useMemo, useState } from "react";
import {
  AvatarStack,
  Badge,
  Button,
  CustomSelect,
  DragHandle,
  Input,
  Menu,
  Modal,
  MultiFilter,
  Skeleton,
  SubTabs,
  Table,
  emitToast,
  type BadgeTone,
  type Column,
} from "../components";
import type { OmniPulseBoard, OmniPulseCard, OmniPulseData, OmniPulseList } from "./types";
import { BoardHeader } from "./BoardHeader";
import { CardChips, listToneClass } from "./boardBits";

const VIEWS = ["Card", "Table", "Calendar"];

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
  const flat = useMemo(
    () => visible.flatMap((l) => l.cards.map((c) => ({ ...c, list: l.title }))),
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

  const tableColumns: Column<OmniPulseCard & { list: string }>[] = [
    { key: "title", header: "Task", width: "minmax(220px, 2.4fr)" },
    { key: "list", header: "List", width: "150px", render: (c) => <Badge tone="neutral">{c.list}</Badge> },
    {
      key: "priority",
      header: "Priority",
      width: "110px",
      render: (c) => <Badge tone={priorityTone(c.priority)}>{c.priority}</Badge>,
    },
    {
      key: "due",
      header: "Due",
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
      key: "assignees",
      header: "Assignees",
      width: "140px",
      render: (c) => <AvatarStack names={c.assignees} size={22} max={3} />,
    },
    {
      key: "meta",
      header: "Notes",
      width: "110px",
      align: "right",
      render: (c) => (
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-mute)" }}>
          {c.comments > 0 && `💬 ${c.comments} `}
          {c.attachments > 0 && `📎 ${c.attachments}`}
          {c.comments === 0 && c.attachments === 0 && "—"}
        </span>
      ),
    },
  ];

  return (
    <div>
      <BoardHeader board={board} shown={shownCount} onBack={onBack} />

      <div className="opx-boardbar">
        <SubTabs tabs={VIEWS} active={view} onChange={setView} ariaLabel="Board view" />
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
        <CalendarView cards={flat} />
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
                            <span
                              style={{
                                flex: 1,
                                fontSize: 13.5,
                                lineHeight: 1.4,
                                color: card.done ? "var(--ink-mute)" : "var(--ink)",
                                textDecoration: card.done ? "line-through" : "none",
                              }}
                            >
                              {card.title}
                            </span>
                            <Menu
                              size="sm"
                              label={`${card.title} actions`}
                              items={[
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
function CalendarView({ cards }: { cards: (OmniPulseCard & { list: string })[] }) {
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
    const map = new Map<string, (OmniPulseCard & { list: string })[]>();
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
        <span className="opx-cal__hint">
          {undated > 0 ? `${undated} with no due date · ` : ""}dated tasks only
        </span>
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
                <span
                  key={c.id}
                  className="opx-cal__task"
                  title={`${c.title} · ${c.list}`}
                  style={{
                    background: c.overdue ? "var(--crit-wash)" : "var(--green-wash)",
                    color: c.overdue ? "var(--crit)" : "var(--green-deep)",
                  }}
                >
                  {c.title}
                </span>
              ))}
            </div>
          );
        })}
      </div>

      {dated.length === 0 && (
        <p className="opx-cal__empty">
          No task on this board carries a due date, so the grid is empty. Dates set on a card show
          up here.
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

export function priorityTone(priority: string): BadgeTone {
  if (priority === "High") return "crit";
  if (priority === "Low") return "neutral";
  return "ochre";
}

export function formatDue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
