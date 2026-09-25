import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  CustomSelect,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  SearchBar,
  Skeleton,
  emitToast,
  type BadgeTone,
} from "../components";
import type { OmniPulseBoard, OmniPulseCard, OmniPulseList } from "./types";
import { Avatars } from "./cards";

const PRIORITY_TONE: Record<string, BadgeTone> = {
  High: "crit",
  Normal: "amber",
  Low: "neutral",
};

export interface BoardPageProps {
  board: OmniPulseBoard;
  labelTones: Record<string, string>;
  onBack: () => void;
}

/**
 * A project board — lists of cards, left to right.
 *
 * Cards move with the card menu rather than by dragging: drag-and-drop needs
 * `@dnd-kit`, and a demo workspace that exists to show the design should not
 * take a dependency to fake one. Everything else a board does at rest is here
 * — counts, labels, priority, due dates, assignees, comment and attachment
 * badges, add-a-card, and the done state.
 */
export function BoardPage({ board, labelTones, onBack }: BoardPageProps) {
  const [lists, setLists] = useState<OmniPulseList[]>(board.lists);
  const [search, setSearch] = useState("");
// Loaded on the server (the rows are already in hand); in the browser the
  // screen opens through its skeleton, which is where the read will go.
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
  const total = useMemo(() => lists.reduce((n, l) => n + l.cards.length, 0), [lists]);
  const doneCount = useMemo(
    () => lists.reduce((n, l) => n + l.cards.filter((c) => c.done).length, 0),
    [lists],
  );

  function addCard(listId: string) {
    const title = draft.trim();
    if (!title) return;
    setLists((ls) =>
      ls.map((l) =>
        l.id === listId
          ? {
              ...l,
              cards: [
                ...l.cards,
                {
                  id: `new-${Date.now()}`,
                  title,
                  labels: [],
                  priority: "Normal",
                  due: "",
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
    emitToast("Card added", "success");
  }

  function moveCard(card: OmniPulseCard, fromId: string, toId: string) {
    if (fromId === toId) return;
    setLists((ls) =>
      ls.map((l) => {
        if (l.id === fromId) return { ...l, cards: l.cards.filter((c) => c.id !== card.id) };
        if (l.id === toId) return { ...l, cards: [...l.cards, card] };
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

  return (
    <div>
      <PageHeader
        eyebrow={`${board.team} · ${board.lead}`}
        crumbs={[
          { label: "OmniPulse" },
          { label: "Projects", href: "/omnipulse/projects" },
          { label: board.name },
        ]}
        onNavigate={onBack}
        actions={
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-mute)" }}>
            {doneCount} / {total} done
          </span>
        }
      />

      <div className="opx-toolbar">
        <SearchBar value={search} onChange={setSearch} placeholder="Search cards..." width={280} />
        <div className="opx-toolbar__actions">
          <Button variant="secondary" size="sm" onClick={onBack}>
            All projects
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="opx-board">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="opx-list">
              <Skeleton width="50%" height={11} />
              <Skeleton shape="block" height={72} style={{ marginTop: 12 }} />
              <Skeleton shape="block" height={72} style={{ marginTop: 8 }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="opx-board themed-scroll-x">
          {lists.map((list) => {
            const cards = q
              ? list.cards.filter((c) => c.title.toLowerCase().includes(q))
              : list.cards;
            return (
              <section key={list.id} className="opx-list" aria-label={list.title}>
                <header className="opx-list__head">
                  <span className="opx-list__title">{list.title}</span>
                  <span className="opx-list__count">{cards.length}</span>
                </header>

                <div className="opx-list__cards">
                  {cards.length === 0 ? (
                    <p
                      style={{
                        fontSize: 12,
                        color: "var(--ink-faint)",
                        padding: "10px 2px",
                        lineHeight: 1.5,
                      }}
                    >
                      {q ? "No cards match the search." : "Nothing here."}
                    </p>
                  ) : (
                    cards.map((card) => (
                      <article key={card.id} className="opx-card-item">
                        {card.labels.length > 0 && (
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
                            {card.labels.map((l) => (
                              <Badge key={l} tone={(labelTones[l] as BadgeTone) ?? "neutral"}>
                                {l}
                              </Badge>
                            ))}
                          </div>
                        )}

                        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                          <input
                            type="checkbox"
                            checked={card.done}
                            onChange={() => toggleDone(card, list.id)}
                            aria-label={card.done ? `Reopen ${card.title}` : `Mark ${card.title} done`}
                            style={{ accentColor: "var(--green-deep)", marginTop: 2, flexShrink: 0 }}
                          />
                          <span
                            style={{
                              flex: 1,
                              fontSize: 13,
                              lineHeight: 1.45,
                              color: card.done ? "var(--ink-mute)" : "var(--ink)",
                              textDecoration: card.done ? "line-through" : "none",
                            }}
                          >
                            {card.title}
                          </span>
                          <button
                            type="button"
                            onClick={() => setMoving({ card, listId: list.id })}
                            aria-label={`Move ${card.title}`}
                            title="Move to another list"
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "var(--ink-mute)",
                              cursor: "pointer",
                              padding: 0,
                              lineHeight: 1,
                              fontSize: 15,
                              flexShrink: 0,
                            }}
                          >
                            ⋯
                          </button>
                        </div>

                        <footer className="opx-card-item__foot">
                          {card.priority !== "Normal" && (
                            <Badge tone={PRIORITY_TONE[card.priority] ?? "neutral"}>
                              {card.priority}
                            </Badge>
                          )}
                          {card.due && <span className="opx-meta">Due {card.due.slice(5)}</span>}
                          {card.comments > 0 && <span className="opx-meta">💬 {card.comments}</span>}
                          {card.attachments > 0 && <span className="opx-meta">📎 {card.attachments}</span>}
                          <span style={{ marginLeft: "auto" }}>
                            <Avatars names={card.assignees} size={20} />
                          </span>
                        </footer>
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
                      placeholder="Card title"
                      aria-label="Card title"
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
                    + Add a card
                  </button>
                )}
              </section>
            );
          })}
        </div>
      )}

      {!loading && total === 0 && (
        <EmptyState
          size="card"
          title="This board has no cards yet"
          description="Add one to the first list to get started."
        />
      )}

      <Modal
        open={moving != null}
        onClose={() => setMoving(null)}
        title="Move card"
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
