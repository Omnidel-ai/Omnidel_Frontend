"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/lib/client/permissions";
import { ConfirmDialog } from "@/components/omnidel/confirm-dialog";
import { CustomSelect } from "@/components/omnidel/custom-select";
import { DatePicker } from "@/components/omnidel/date-picker";
import { MultiFilter, type FilterSectionConfig } from "@/components/omnidel/multi-filter";
import { useDebouncedSearch } from "@/components/omnidel/table-controls";
import { TableScroll } from "@/components/omnidel/table-scroll";
import { TableAddButton } from "@/components/omnidel/table-add-button";
import { tableActBtnDangerStyle, tableActBtnStyle } from "@/components/omnidel/table-ui";
import { addSubtaskTriggerStyle } from "@/components/omnidel/task-checklist";
import { ChangelogDetailModal } from "@/components/omnidel/whats-new/approve-detail-client";
import { useIsMobile } from "@/lib/client/use-is-mobile";
import {
  CHANGELOG_ITEM_TEXT_MAX,
  CHANGELOG_SUMMARY_MAX,
  CHANGELOG_TITLE_MAX,
  clampToMaxLength,
} from "@/lib/field-limits";
import type {
  CreateReleaseNoteItemInput,
  ReleaseNote,
  WhatsNewApp,
  WhatsNewChangeType,
  WhatsNewModule,
} from "@/lib/whats-new-schema";
import {
  WHATS_NEW_APP_LABELS,
  WHATS_NEW_CHANGE_TYPE_LABELS,
  WHATS_NEW_CHANGE_TYPES,
  WHATS_NEW_MODULE_LABELS,
  WHATS_NEW_MODULES,
} from "@/lib/whats-new-schema";
import { useTr } from "@/lib/client/language";

/** "" = Drafts (default; Clear in MultiFilter resets here). */
type StatusFilter = "" | "published" | "all";

const COLS = "110px 1.4fr 1.6fr 150px 60px 90px 200px";

/** Solid green Publish — stands out from Edit / Archive. */
const publishActBtnStyle: CSSProperties = {
  padding: "4px 10px",
  fontSize: 11,
  fontWeight: 600,
  background: "var(--green-deep)",
  border: "1px solid var(--green-deep)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
  color: "var(--surface)",
  fontFamily: "var(--sans)",
};

const STATUS_OPTIONS = [
  { value: "", label: "Drafts" },
  { value: "published", label: "Published" },
  { value: "all", label: "All" },
];

const APP_OPTIONS: { value: WhatsNewApp; label: string }[] = [
  { value: "omnidel", label: WHATS_NEW_APP_LABELS.omnidel },
  { value: "acharya", label: WHATS_NEW_APP_LABELS.acharya },
];

const CHANGE_TYPE_OPTIONS = WHATS_NEW_CHANGE_TYPES.map((v) => ({
  value: v,
  label: WHATS_NEW_CHANGE_TYPE_LABELS[v],
}));

/** Product modules only — `platform` is a meta label, not an item module choice. */
const MODULE_OPTIONS = WHATS_NEW_MODULES.filter((m) => m !== "platform").map((v) => ({
  value: v,
  label: WHATS_NEW_MODULE_LABELS[v],
}));

const DEFAULT_ITEM_MODULE: WhatsNewModule = "omnipulse";

/** Type · Module line; omit Platform (meta label, not shown on items). */
function itemMetaLine(changeType: WhatsNewChangeType, module: WhatsNewModule | string): string {
  const type = WHATS_NEW_CHANGE_TYPE_LABELS[changeType as WhatsNewChangeType] ?? changeType;
  if (!module || module === "platform") return type;
  const mod = WHATS_NEW_MODULE_LABELS[module as WhatsNewModule] ?? module;
  return `${type} · ${mod}`;
}

function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function truncate(s: string | null | undefined, n: number): string {
  if (!s) return "—";
  const t = s.trim();
  if (!t) return "—";
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}

export function WhatsNewApproveClient() {
  const tr = useTr();
  const router = useRouter();
  const { can } = usePermissions();
  const [items, setItems] = useState<ReleaseNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const { searchInput, setSearchInput, debouncedSearch: search } = useDebouncedSearch();
  const [creating, setCreating] = useState(false);
  const [detailNote, setDetailNote] = useState<ReleaseNote | null>(null);
  const [editNote, setEditNote] = useState<ReleaseNote | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ReleaseNote | null>(null);
  const [publishTarget, setPublishTarget] = useState<ReleaseNote | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);

  const filterSections: FilterSectionConfig[] = useMemo(
    () => [
      {
        key: "status",
        type: "radio",
        label: "Status",
        options: STATUS_OPTIONS,
        value: statusFilter,
        onChange: (next) => setStatusFilter((next as StatusFilter) || ""),
      },
    ],
    [statusFilter],
  );

  const fetchRows = useCallback(() => {
    setLoading(true);
    setActionErr(null);
    fetch("/api/admin/whats-new/entries")
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "Failed to load release notes");
        setItems((d.items as ReleaseNote[]) || []);
      })
      .catch((err) => {
        setActionErr(err instanceof Error ? err.message : "Failed to load");
        setItems([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const filtered = useMemo(() => {
    let rows = items;
    if (statusFilter === "published") rows = rows.filter((n) => n.is_published);
    else if (statusFilter === "all") {
      /* no status filter */
    } else {
      rows = rows.filter((n) => !n.is_published);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((n) => {
        const hay = [
          n.title,
          n.summary ?? "",
          n.body ?? "",
          n.report_id ?? "",
          ...(n.items?.map((it) => it.text) ?? []),
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    return rows;
  }, [items, statusFilter, search]);

  async function handlePublish() {
    if (!publishTarget) return;
    setBusy(true);
    setActionErr(null);
    try {
      const res = await fetch(`/api/admin/whats-new/entries/${publishTarget.id}/publish`, {
        method: "PATCH",
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionErr(d.error || "Publish failed");
        return;
      }
      setPublishTarget(null);
      fetchRows();
    } catch {
      setActionErr("Publish failed — network error");
    } finally {
      setBusy(false);
    }
  }

  async function handleArchive() {
    if (!archiveTarget) return;
    setBusy(true);
    setActionErr(null);
    try {
      const res = await fetch(`/api/admin/whats-new/entries/${archiveTarget.id}`, {
        method: "DELETE",
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionErr(d.error || "Archive failed");
        return;
      }
      if (detailNote?.id === archiveTarget.id) setDetailNote(null);
      if (editNote?.id === archiveTarget.id) setEditNote(null);
      setArchiveTarget(null);
      fetchRows();
    } catch {
      setActionErr("Archive failed — network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    /* No page padding — DashboardShell already applies gutter/32px. */
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontFamily: "var(--serif)", marginBottom: 6 }}>
          {tr("Approve What's new")}
        </h2>
        <p style={{ fontSize: 13, color: "var(--ink-mute)", maxWidth: 640, lineHeight: 1.45 }}>
          {tr("All drafts land here — manual and daily report. Click a title to review, then Edit, Archive, or Publish to the public What's new page.")}
        </p>
      </div>

      <div className="table-toolbar">
        <MultiFilter
          searchInput={searchInput}
          onSearchChange={setSearchInput}
          searchPlaceholder={tr("Search release notes...")}
          sections={filterSections}
        />
        {can("admin.approve.create") && (
          <TableAddButton label={tr("+ New changelog")} onClick={() => setCreating(true)} />
        )}
      </div>

      <TableScroll minWidth={820}>
        <div className="table-header" style={{ gridTemplateColumns: COLS }}>
          <span>{tr("Date")}</span>
          <span>{tr("Title")}</span>
          <span>{tr("Summary")}</span>
          <span>{tr("Apps")}</span>
          <span>{tr("Items")}</span>
          <span>{tr("Status")}</span>
          <span style={{ textAlign: "right" }}>{tr("Actions")}</span>
        </div>
        {loading ? (
          <div className="table-empty" style={{ padding: 30, color: "var(--ink-mute)" }}>
            {tr("Loading...")}
          </div>
        ) : filtered.length === 0 ? (
          <div className="table-empty" style={{ padding: 30, color: "var(--ink-mute)", fontSize: 14 }}>
            {statusFilter === ""
              ? tr("No drafts waiting. Create one with “+ New changelog”, or wait for the daily report.")
              : tr("No release notes match this filter.")}
          </div>
        ) : (
          filtered.map((note) => (
            <div key={note.id} className="table-row" style={{ gridTemplateColumns: COLS }}>
              <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-mute)" }}>
                {note.released_on}
              </span>
              <button
                type="button"
                onClick={() => setDetailNote(note)}
                title={tr("View details")}
                style={{
                  fontWeight: 500,
                  fontSize: 13,
                  fontFamily: "var(--sans)",
                  color: "var(--green-deep)",
                  background: "none",
                  border: "none",
                  padding: 0,
                  margin: 0,
                  textAlign: "left",
                  cursor: "pointer",
                  textDecoration: "underline",
                  textUnderlineOffset: 2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: "100%",
                }}
              >
                {note.title}
              </button>
              <span style={{ color: "var(--ink-soft)", fontSize: 13 }}>
                {truncate(note.summary, 80)}
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: "var(--ink-soft)",
                  whiteSpace: "nowrap",
                }}
              >
                {(note.apps?.length
                  ? note.apps.map((a) => WHATS_NEW_APP_LABELS[a] ?? a).join(" · ")
                  : "—")}
              </span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                {note.items?.length ?? 0}
              </span>
              <PublishStatus published={note.is_published} />
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  justifyContent: "flex-end",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                {can("admin.approve.update") && <button
                  type="button"
                  onClick={() => setEditNote(note)}
                  style={tableActBtnStyle}
                >
                  {tr("Edit")}
                </button>}
                {can("admin.approve.delete") && <button
                  type="button"
                  onClick={() => {
                    setActionErr(null);
                    setArchiveTarget(note);
                  }}
                  style={tableActBtnDangerStyle}
                >
                  {tr("Archive")}
                </button>}
                {!note.is_published && can("admin.approve.publish") && (
                  <button
                    type="button"
                    onClick={() => {
                      setActionErr(null);
                      setPublishTarget(note);
                    }}
                    style={publishActBtnStyle}
                  >
                    {tr("Publish")}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </TableScroll>

      {actionErr && !publishTarget && !archiveTarget && (
        <div
          style={{
            fontSize: 12,
            color: "var(--crit)",
            background: "var(--crit-wash)",
            border: "1px solid var(--crit)",
            borderRadius: "var(--r-sm)",
            padding: "8px 12px",
            marginTop: 8,
          }}
        >
          {actionErr}
        </div>
      )}

      {creating && (
        <CreateChangelogForm
          onClose={(saved) => {
            setCreating(false);
            if (saved) fetchRows();
          }}
        />
      )}

      {editNote && (
        <CreateChangelogForm
          key={editNote.id}
          initial={editNote}
          onClose={(saved) => {
            setEditNote(null);
            if (saved) fetchRows();
          }}
        />
      )}

      {detailNote && (
        <ChangelogDetailModal
          note={detailNote}
          onClose={() => setDetailNote(null)}
          onPublished={(updated) => {
            setDetailNote(updated);
            fetchRows();
          }}
        />
      )}

      <ConfirmDialog
        open={!!publishTarget}
        title={tr("Publish to What's new?")}
        description={
          publishTarget
            ? `Publish "${publishTarget.title}" (${publishTarget.released_on}). It will appear on the public What's new page for everyone.`
            : ""
        }
        confirmLabel={tr("Publish")}
        confirmTone="primary"
        busy={busy}
        error={actionErr}
        onCancel={() => {
          setPublishTarget(null);
          setActionErr(null);
        }}
        onConfirm={handlePublish}
      />

      <ConfirmDialog
        open={!!archiveTarget}
        title={tr("Archive this changelog?")}
        description={
          archiveTarget
            ? `Archive "${archiveTarget.title}"? It will leave the Approve list${
                archiveTarget.is_published ? " and the public What's new page" : ""
              }. This can be undone only from the database.`
            : ""
        }
        confirmLabel={tr("Archive")}
        confirmTone="danger"
        busy={busy}
        error={actionErr}
        onCancel={() => {
          setArchiveTarget(null);
          setActionErr(null);
        }}
        onConfirm={handleArchive}
      />
    </div>
  );
}

function PublishStatus({ published }: { published: boolean }) {
  const tr = useTr();
  return (
    <span
      className="tag"
      style={{
        background: published ? "var(--ok-wash)" : "var(--surface)",
        color: published ? "var(--ok)" : "var(--ink-mute)",
        border: published ? undefined : "1px solid var(--rule)",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: published ? "var(--ok)" : "var(--ink-mute)",
        }}
      />
      {published ? tr("Published") : tr("Draft")}
    </span>
  );
}

type DraftItem = {
  key: string;
  change_type: WhatsNewChangeType;
  module: WhatsNewModule;
  text: string;
};

function CreateChangelogForm({
  onClose,
  initial,
}: {
  onClose: (saved: boolean) => void;
  initial?: ReleaseNote | null;
}) {
  const tr = useTr();
  const isEdit = !!initial;
  const isMobile = useIsMobile();
  const [releasedOn, setReleasedOn] = useState(initial?.released_on ?? todayYmd());
  const [title, setTitle] = useState(initial?.title ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [appChoice, setAppChoice] = useState<WhatsNewApp[]>(
    initial?.apps?.length ? [...initial.apps] : ["omnidel"],
  );
  const [items, setItems] = useState<DraftItem[]>(() =>
    (initial?.items ?? []).map((it) => ({
      key: it.id,
      change_type: it.change_type,
      module: (it.module === "platform" ? DEFAULT_ITEM_MODULE : it.module) as WhatsNewModule,
      text: it.text,
    })),
  );
  const [addOpen, setAddOpen] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [draftType, setDraftType] = useState<WhatsNewChangeType>("new");
  const [draftModule, setDraftModule] = useState<WhatsNewModule>(DEFAULT_ITEM_MODULE);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function resetAddForm() {
    setDraftText("");
    setDraftType("new");
    setDraftModule(DEFAULT_ITEM_MODULE);
    setAddOpen(false);
  }

  function commitAddItem() {
    const text = draftText.trim();
    if (!text) return;
    setItems((prev) => [
      ...prev,
      {
        key: String(Date.now()),
        change_type: draftType,
        module: draftModule,
        text,
      },
    ]);
    setDraftText("");
    setDraftType("improved");
    setDraftModule(DEFAULT_ITEM_MODULE);
    setAddOpen(false);
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((it) => it.key !== key));
  }

  async function save() {
    if (!title.trim()) {
      setErr("Title is required");
      return;
    }
    if (!summary.trim()) {
      setErr("Summary is required");
      return;
    }
    if (!releasedOn.trim()) {
      setErr("Release date is required");
      return;
    }
    const apps = appChoice;
    if (apps.length === 0) {
      setErr("Select at least one app");
      return;
    }
    const pending =
      addOpen && draftText.trim()
        ? [
            ...items,
            {
              key: "pending",
              change_type: draftType,
              module: draftModule,
              text: draftText.trim(),
            },
          ]
        : items;
    const payloadItems: CreateReleaseNoteItemInput[] = pending.map((it, i) => ({
      change_type: it.change_type,
      module: it.module,
      text: it.text.trim(),
      sort_order: i,
    }));
    if (payloadItems.length === 0) {
      setErr("Add at least one item with text");
      return;
    }

    setSaving(true);
    setErr(null);
    const payload = {
      released_on: releasedOn.trim(),
      title: title.trim(),
      summary: summary.trim(),
      body: null,
      apps,
      items: payloadItems,
    };
    try {
      const res = await fetch(
        isEdit && initial ? `/api/admin/whats-new/entries/${initial.id}` : "/api/admin/whats-new/entries",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || (isEdit ? "Update failed" : "Create failed"));
      onClose(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        overflowY: "auto",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? "Edit changelog" : "New changelog"}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: isMobile ? "100%" : 720,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "var(--surface)",
          border: "1px solid var(--rule)",
          borderRadius: "var(--r-md)",
          boxShadow: "var(--shadow-md)",
          position: "relative",
        }}
      >
        <div style={{ flex: "1 1 auto", overflowY: "auto", padding: "22px 24px" }}>
          <div style={{ marginBottom: 14 }}>
            <input
              value={title}
              maxLength={CHANGELOG_TITLE_MAX}
              onChange={(e) => setTitle(clampToMaxLength(e.target.value, CHANGELOG_TITLE_MAX))}
              placeholder={tr("Changelog title")}
              autoFocus
              style={{
                width: "100%",
                padding: "6px 10px",
                fontSize: 22,
                fontWeight: 600,
                fontFamily: "var(--serif)",
                color: "var(--ink)",
                background: "var(--page)",
                border: `1px solid ${title.length >= CHANGELOG_TITLE_MAX ? "var(--crit)" : "var(--rule-strong)"}`,
                borderRadius: "var(--r-sm)",
                boxSizing: "border-box",
              }}
            />
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span
                style={{
                  padding: "3px 10px",
                  fontSize: 11,
                  fontFamily: "var(--mono)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  borderRadius: 999,
                  minWidth: 72,
                  textAlign: "center",
                  background: initial?.is_published ? "var(--ok-wash)" : "var(--surface-sunk)",
                  color: initial?.is_published ? "var(--ok)" : "var(--ink-mute)",
                }}
              >
                {initial?.is_published ? tr("Published") : tr("Draft")}
              </span>
              <span style={{ fontSize: 12, color: "var(--ink-mute)", fontFamily: "var(--sans)" }}>
                {isEdit
                  ? initial?.is_published
                    ? tr("Editing a published note — save updates What's new.")
                    : tr("Editing a draft — save, then publish from the list when ready.")
                  : tr("Saves as a draft. Publish it from the list when ready.")}
              </span>
            </div>
          </div>

          <section style={{ marginTop: 6 }}>
            <SectionTitle>{tr("Summary")}</SectionTitle>
            <textarea
              value={summary}
              maxLength={CHANGELOG_SUMMARY_MAX}
              onChange={(e) => setSummary(clampToMaxLength(e.target.value, CHANGELOG_SUMMARY_MAX))}
              placeholder={tr("One plain-English sentence")}
              rows={2}
              style={{
                ...fieldInputStyle,
                resize: "vertical",
                minHeight: 64,
                borderColor: summary.length >= CHANGELOG_SUMMARY_MAX ? "var(--crit)" : "var(--rule-strong)",
              }}
            />
          </section>

          <section style={{ marginTop: 20 }}>
            <SectionTitle>{tr("Details")}</SectionTitle>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1fr) minmax(0, 1fr)",
                gap: "12px 24px",
              }}
            >
              <DI label={tr("RELEASE DATE")}>
                <DatePicker
                  value={releasedOn}
                  onChange={setReleasedOn}
                  placeholder="dd-mm-yyyy"
                  style={{
                    padding: "10px 12px",
                    fontSize: 13,
                    minHeight: 40,
                    boxSizing: "border-box",
                  }}
                />
              </DI>
              <DI label={tr("APP")}>
                <AppChecklistSelect
                  value={appChoice}
                  onChange={setAppChoice}
                  options={APP_OPTIONS}
                  placeholder={tr("Select apps")}
                />
              </DI>
            </div>
          </section>

          <section style={{ marginTop: 20 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
                marginBottom: addOpen || items.length > 0 ? 10 : 0,
              }}
            >
              <SectionTitle inline>{tr("Items")}</SectionTitle>
              {!addOpen && (
                <button
                  type="button"
                  onClick={() => setAddOpen(true)}
                  style={addSubtaskTriggerStyle}
                >
                  {tr("+ Add item")}
                </button>
              )}
            </div>

            {items.length === 0 && !addOpen ? (
              <div style={{ fontSize: 13, color: "var(--ink-mute)", padding: "4px 0 2px" }}>
                {tr("No items yet")}
              </div>
            ) : items.length > 0 ? (
              <div style={{ display: "grid", gap: 2, marginBottom: addOpen ? 10 : 0 }}>
                {items.map((it) => (
                  <div
                    key={it.key}
                    style={{
                      padding: "8px 4px",
                      borderBottom: "1px solid var(--rule)",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontFamily: "var(--sans)",
                          color: "var(--ink)",
                          lineHeight: 1.45,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {it.text}
                      </div>
                      <div
                        style={{
                          marginTop: 2,
                          fontSize: 11,
                          fontFamily: "var(--mono)",
                          color: "var(--ink-mute)",
                          letterSpacing: "0.02em",
                        }}
                      >
                        {itemMetaLine(it.change_type, it.module)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(it.key)}
                      aria-label={tr("Remove item")}
                      title={tr("Remove")}
                      style={itemRowDeleteStyle}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            {addOpen && (
              <div style={{ display: "grid", gap: 8, marginTop: items.length === 0 ? 8 : 0 }}>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "flex-start",
                    flexWrap: isMobile ? "wrap" : "nowrap",
                  }}
                >
                  <div style={{ flex: "1 1 180px", minWidth: isMobile ? "100%" : 0 }}>
                    <GrowingTextarea
                      autoFocus
                      value={draftText}
                      maxLength={CHANGELOG_ITEM_TEXT_MAX}
                      onChange={(v) => setDraftText(clampToMaxLength(v, CHANGELOG_ITEM_TEXT_MAX))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          commitAddItem();
                        }
                        if (e.key === "Escape") resetAddForm();
                      }}
                      placeholder={tr("What changed...")}
                    />
                  </div>
                  <div style={{ flex: "0 0 auto", width: isMobile ? "calc(50% - 4px)" : 140 }}>
                    <CustomSelect
                      value={draftType}
                      onChange={(v) => setDraftType((v as WhatsNewChangeType) || "new")}
                      options={CHANGE_TYPE_OPTIONS}
                      placeholder={tr("Type")}
                      minWidth={120}
                      style={itemAddSelectStyle}
                    />
                  </div>
                  <div style={{ flex: "0 0 auto", width: isMobile ? "calc(50% - 4px)" : 150 }}>
                    <CustomSelect
                      value={draftModule}
                      onChange={(v) => setDraftModule((v as WhatsNewModule) || DEFAULT_ITEM_MODULE)}
                      options={MODULE_OPTIONS}
                      placeholder={tr("Module")}
                      minWidth={130}
                      style={itemAddSelectStyle}
                    />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={commitAddItem}
                    disabled={!draftText.trim()}
                    style={{
                      ...itemAddBtnPrimary,
                      opacity: draftText.trim() ? 1 : 0.5,
                      cursor: draftText.trim() ? "pointer" : "not-allowed",
                    }}
                  >
                    {tr("Add")}
                  </button>
                  <button type="button" onClick={resetAddForm} style={itemAddBtnGhost}>
                    {tr("Cancel")}
                  </button>
                </div>
              </div>
            )}
          </section>

          {err && (
            <div style={{ color: "var(--crit)", fontSize: 12, marginTop: 14, fontFamily: "var(--sans)" }}>
              {err}
            </div>
          )}
        </div>

        <div
          style={{
            flexShrink: 0,
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            padding: "12px 24px",
            borderTop: "1px solid var(--rule)",
            background: "var(--surface)",
          }}
        >
          <button
            type="button"
            onClick={() => onClose(false)}
            disabled={saving}
            style={{ ...cancelBtnStyle, opacity: saving ? 0.6 : 1 }}
          >
            {tr("Cancel")}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            style={{ ...saveBtnStyle, opacity: saving ? 0.7 : 1 }}
          >
            {saving ? tr("Saving...") : isEdit ? tr("Save changes") : tr("Save draft")}
          </button>
        </div>
      </div>
    </div>
  );
}

function GrowingTextarea({
  value,
  onChange,
  onKeyDown,
  placeholder,
  maxLength,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  maxLength: number;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.max(36, el.scrollHeight)}px`;
  }, [value]);

  const atLimit = value.length >= maxLength;

  return (
    <textarea
      ref={ref}
      autoFocus={autoFocus}
      value={value}
      maxLength={maxLength}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      rows={1}
      style={{
        ...itemAddInputStyle,
        width: "100%",
        minHeight: 36,
        resize: "none",
        overflow: "hidden",
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
        wordBreak: "break-word",
        lineHeight: 1.45,
        borderColor: atLimit ? "var(--crit)" : "var(--rule-strong)",
      }}
    />
  );
}

function SectionTitle({ children, inline }: { children: ReactNode; inline?: boolean }) {
  return (
    <h3
      style={{
        fontFamily: "var(--serif)",
        fontSize: 14,
        margin: 0,
        marginBottom: inline ? 0 : 8,
        color: "var(--ink)",
      }}
    >
      {children}
    </h3>
  );
}

function DI({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: 10,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--ink-mute)",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 13, color: "var(--ink)", minWidth: 0 }}>{children}</div>
    </div>
  );
}

/** Checklist dropdown — toggle one or more apps (stays open while checking). */
function AppChecklistSelect({
  value,
  onChange,
  options,
  placeholder = "Select apps",
}: {
  value: WhatsNewApp[];
  onChange: (next: WhatsNewApp[]) => void;
  options: { value: WhatsNewApp; label: string }[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const label =
    value.length === 0
      ? placeholder
      : value
          .map((v) => options.find((o) => o.value === v)?.label ?? v)
          .join(", ");

  useLayoutEffect(() => {
    if (!open || !ref.current) {
      setPos(null);
      return;
    }
    function update() {
      if (!ref.current) return;
      const r = ref.current.getBoundingClientRect();
      const estimatedH = options.length * 36 + 8;
      const spaceBelow = window.innerHeight - r.bottom - 8;
      const openUp = estimatedH > spaceBelow && r.top > spaceBelow;
      const top = openUp ? r.top - estimatedH - 4 : r.bottom + 4;
      setPos({ top, left: r.left, width: r.width });
    }
    update();
    requestAnimationFrame(update);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (ref.current?.contains(t) || popoverRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function toggle(app: WhatsNewApp) {
    if (value.includes(app)) onChange(value.filter((v) => v !== app));
    else onChange([...value, app]);
  }

  return (
    <div ref={ref} style={{ width: "100%" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          width: "100%",
          padding: "10px 32px 10px 12px",
          fontSize: 13,
          fontFamily: "var(--sans)",
          background: "var(--page)",
          color: value.length ? "var(--ink-soft)" : "var(--ink-mute)",
          border: "1px solid var(--rule-strong)",
          borderRadius: "var(--r-sm)",
          cursor: "pointer",
          textAlign: "left",
          position: "relative",
          outline: "none",
          boxSizing: "border-box",
          minHeight: 40,
        }}
      >
        <span
          style={{
            display: "block",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
        <span
          aria-hidden
          style={{
            position: "absolute",
            right: 10,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--ink-mute)",
            fontSize: 10,
            lineHeight: 1,
          }}
        >
          ▾
        </span>
      </button>
      {open &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popoverRef}
            role="listbox"
            aria-multiselectable
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: pos.width,
              zIndex: 2600,
              background: "var(--surface)",
              border: "1px solid var(--rule)",
              borderRadius: "var(--r-sm)",
              boxShadow: "var(--shadow-md)",
              padding: 4,
              maxHeight: 220,
              overflowY: "auto",
            }}
          >
            {options.map((opt) => {
              const checked = value.includes(opt.value);
              return (
                <label
                  key={opt.value}
                  role="option"
                  aria-selected={checked}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    borderRadius: "var(--r-sm)",
                    cursor: "pointer",
                    background: checked ? "var(--surface-sunk)" : "transparent",
                    fontFamily: "var(--sans)",
                    fontSize: 13,
                    color: "var(--ink-soft)",
                    userSelect: "none",
                  }}
                  onMouseEnter={(e) => {
                    if (!checked) e.currentTarget.style.background = "var(--page)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = checked ? "var(--surface-sunk)" : "transparent";
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(opt.value)}
                    style={{ accentColor: "var(--green-deep)", width: 14, height: 14 }}
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}

const fieldInputStyle: CSSProperties = {
  width: "100%",
  padding: "7px 9px",
  fontSize: 12,
  background: "var(--page)",
  color: "var(--ink-soft)",
  border: "1px solid var(--rule-strong)",
  borderRadius: "var(--r-sm)",
  fontFamily: "var(--sans)",
  boxSizing: "border-box",
};

const saveBtnStyle: CSSProperties = {
  padding: "8px 20px",
  fontSize: 12,
  fontWeight: 500,
  background: "var(--green-deep)",
  color: "var(--surface)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--green-deep)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
  fontFamily: "var(--sans)",
};

const cancelBtnStyle: CSSProperties = {
  padding: "8px 14px",
  fontSize: 12,
  fontWeight: 500,
  background: "var(--surface)",
  color: "var(--ink-soft)",
  border: "1px solid var(--rule-strong)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
  fontFamily: "var(--sans)",
};

const itemAddInputStyle: CSSProperties = {
  minWidth: 0,
  padding: "7px 10px",
  fontSize: 13,
  fontFamily: "var(--sans)",
  border: "1px solid var(--rule-strong)",
  borderRadius: "var(--r-sm)",
  background: "var(--page)",
  color: "var(--ink)",
  outline: "none",
  boxSizing: "border-box",
};

const itemAddSelectStyle: CSSProperties = {
  background: "var(--page)",
  border: "1px solid var(--rule-strong)",
  borderRadius: "var(--r-sm)",
  color: "var(--ink-soft)",
  fontSize: 12,
  fontFamily: "var(--sans)",
  padding: "6px 28px 6px 10px",
};

const itemAddBtnPrimary: CSSProperties = {
  padding: "6px 16px",
  border: "none",
  borderRadius: "var(--r-sm)",
  background: "var(--green-deep)",
  color: "#f4efdf",
  fontSize: 13,
  fontWeight: 600,
  fontFamily: "var(--sans)",
};

const itemAddBtnGhost: CSSProperties = {
  padding: "6px 10px",
  border: "none",
  background: "none",
  color: "var(--ink-mute)",
  fontSize: 13,
  fontFamily: "var(--sans)",
  cursor: "pointer",
};

const itemRowDeleteStyle: CSSProperties = {
  flexShrink: 0,
  width: 26,
  height: 26,
  padding: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid var(--crit)",
  borderRadius: "var(--r-sm)",
  background: "var(--crit-wash)",
  color: "var(--crit)",
  cursor: "pointer",
  fontSize: 16,
  lineHeight: 1,
};

const ghostBtn: CSSProperties = {
  padding: "6px 12px",
  background: "transparent",
  border: "1px solid var(--rule)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
  fontSize: 12,
  fontFamily: "var(--sans)",
  color: "var(--ink-soft)",
};
