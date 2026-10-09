"use client";

/**
 * Guide / Admin landing — table of playlists.
 * Guide is view-only. Pass manage to show add/delete (Admin tab).
 */

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { fetchJson, FetchError } from "@/lib/client/fetch-json";
import { usePermissions } from "@/lib/client/permissions";
import {
  MultiFilter,
  type DateRange,
  type FilterSectionConfig,
} from "@/components/omnidel/multi-filter";
import { ConfirmDialog } from "@/components/omnidel/confirm-dialog";
import { Pagination, useTablePagination } from "@/components/omnidel/table-controls";
import type { GuidePlaylistDto } from "@/lib/guide-schema";
import { useTr } from "@/lib/client/language";

/** Same grid language as OmniMart Sales Pipeline (not TableScroll). */
const COLS = "56px minmax(180px, 1.6fr) 100px 140px 168px";
const COLS_READONLY = "56px minmax(180px, 1.6fr) 100px 140px 88px";
const TABLE_MIN_WIDTH = 760;

type Props = {
  onOpenPlaylist: (playlist: GuidePlaylistDto) => void;
  onCountChange?: (count: number) => void;
  /** Admin tab only — add / delete playlists. Guide tab is always view-only. */
  manage?: boolean;
  /** Videos | Playlist switcher — sits on the search row, right side. */
  paneTabs?: ReactNode;
  /** Fixed header slot so search + tabs + Add share one row. */
  toolbarHost?: HTMLElement | null;
};

function matchesAddedRange(
  addedOn: string,
  range: DateRange,
  customFrom: string,
  customTo: string,
): boolean {
  if (!range) return true;
  const t = Date.parse(addedOn);
  if (!Number.isFinite(t)) return false;
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endToday = startToday + 86_400_000;
  if (range === "today") return t >= startToday && t < endToday;
  if (range === "last_7") return t >= startToday - 6 * 86_400_000 && t < endToday;
  if (range === "custom") {
    if (customFrom) {
      const [y, m, d] = customFrom.split("-").map(Number);
      if (t < new Date(y, m - 1, d).getTime()) return false;
    }
    if (customTo) {
      const [y, m, d] = customTo.split("-").map(Number);
      if (t >= new Date(y, m - 1, d).getTime() + 86_400_000) return false;
    }
    return !!(customFrom || customTo);
  }
  return true;
}

function formatAdded(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  return new Date(t).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const DATE_OPTS: { value: DateRange; label: string }[] = [
  { value: "", label: "Any added date" },
  { value: "today", label: "Added today" },
  { value: "last_7", label: "Added last 7 days" },
  { value: "custom", label: "Custom range…" },
];

export function GuidePlaylistsTable({
  onOpenPlaylist,
  onCountChange,
  manage = false,
  paneTabs,
  toolbarHost = null,
}: Props) {
  const tr = useTr();
  const { isAdmin } = usePermissions();
  const canManage = manage && isAdmin;
  const [playlists, setPlaylists] = useState<GuidePlaylistDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>("");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GuidePlaylistDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await fetchJson<{ items: GuidePlaylistDto[] }>("/api/guide/playlists");
      setPlaylists(data.items ?? []);
    } catch (err) {
      setLoadError(
        err instanceof FetchError ? err.message : "Could not load playlists.",
      );
      setPlaylists([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (loading || loadError) return;
    onCountChange?.(playlists.length);
  }, [playlists.length, loading, loadError, onCountChange]);

  const filterSections = useMemo((): FilterSectionConfig[] => {
    return [
      {
        key: "added_range",
        label: "Added",
        type: "daterange",
        options: DATE_OPTS,
        value: dateRange,
        onChange: setDateRange,
        customFrom,
        onCustomFromChange: setCustomFrom,
        customTo,
        onCustomToChange: setCustomTo,
      },
    ];
  }, [dateRange, customFrom, customTo]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return playlists.filter((p) => {
      if (q && !p.title.toLowerCase().includes(q)) return false;
      if (!matchesAddedRange(p.addedOn, dateRange, customFrom, customTo)) return false;
      return true;
    });
  }, [playlists, search, dateRange, customFrom, customTo]);

  const { page, setPage, perPage, setPerPage } = useTablePagination(
    25,
    filtered.length,
    `${search}:${dateRange}:${customFrom}:${customTo}`,
  );
  const rows = filtered.slice((page - 1) * perPage, page * perPage);
  const filtersActive = !!search.trim() || !!dateRange;

  async function createPlaylist() {
    const title = newTitle.trim();
    if (!title) {
      setAddError("Enter a playlist title");
      return;
    }
    setSaving(true);
    setAddError(null);
    try {
      const data = await fetchJson<{ item: GuidePlaylistDto }>("/api/guide/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      setAddOpen(false);
      setNewTitle("");
      await reload();
    } catch (err) {
      setAddError(
        err instanceof FetchError ? err.message : "Could not create playlist",
      );
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetchJson(
        `/api/guide/playlists?id=${encodeURIComponent(deleteTarget.id)}`,
        { method: "DELETE" },
      );
      setDeleteTarget(null);
      await reload();
    } catch {
      // fetchJson toasts on 5xx
    } finally {
      setDeleting(false);
    }
  }

  const cols = canManage ? COLS : COLS_READONLY;

  const toolbar = (
    <>
      <div style={toolbarSearchSlot}>
        <MultiFilter
          searchInput={search}
          onSearchChange={setSearch}
          searchPlaceholder={tr("Search playlists...")}
          sections={filterSections}
        />
      </div>
      <div style={toolbarRightCluster}>
        {paneTabs}
        {canManage ? (
          <button
            type="button"
            style={addLeadBtnStyle}
            onClick={() => {
              setNewTitle("");
              setAddError(null);
              setAddOpen(true);
            }}
          >
            {tr("+ Add playlist")}
          </button>
        ) : null}
      </div>
    </>
  );

  return (
    <div>
      {toolbarHost
        ? createPortal(toolbar, toolbarHost)
        : <div className="table-toolbar" style={toolbarFallbackStyle}>{toolbar}</div>}

      <div className="table-wrap">
        <div
          className="themed-scroll-x"
          style={{
            overflowX: "auto",
            overflowY: "hidden",
            position: "relative",
            zIndex: 1,
            background: "var(--surface)",
          }}
        >
          <div
            className="table-header"
            style={{ gridTemplateColumns: cols, minWidth: TABLE_MIN_WIDTH, paddingRight: 0 }}
          >
            <span>{tr("SR.NO")}</span>
            <span>{tr("TITLE")}</span>
            <span>{tr("VIDEOS")}</span>
            <span>{tr("ADDED")}</span>
            <span style={actionsHeaderStyle}>{tr("ACTIONS")}</span>
          </div>
          {rows.map((playlist, i) => (
            <div
              key={playlist.id}
              className="table-row"
              style={{ gridTemplateColumns: cols, minWidth: TABLE_MIN_WIDTH, paddingRight: 0 }}
            >
              <span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 500, color: "var(--ink-soft)" }}>
                {(page - 1) * perPage + i + 1}
              </span>
              <button
                type="button"
                onClick={() => onOpenPlaylist(playlist)}
                title={tr("Open playlist")}
                style={titleLinkStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.textDecorationColor = "var(--green-deep)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.textDecorationColor = "var(--rule-strong)";
                }}
              >
                {playlist.title}
              </button>
              <span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 500 }}>
                {playlist.videoCount}
              </span>
              <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                {formatAdded(playlist.addedOn)}
              </span>
              <div style={actionsCellStyle}>
                <button
                  type="button"
                  onClick={() => onOpenPlaylist(playlist)}
                  style={actionBtnStyle}
                >
                  {canManage ? tr("Manage") : tr("View")}
                </button>
                {canManage ? (
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(playlist)}
                    style={{ ...actionBtnStyle, color: "var(--crit)" }}
                  >
                    {tr("Delete")}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        {rows.length === 0 && (
          <div className="table-empty">
            {loading
              ? tr("Loading...")
              : loadError
                ? loadError
                : playlists.length === 0
                  ? canManage
                    ? tr("No playlists yet. Create one with “+ Add playlist”.")
                    : tr("No playlists found")
                  : filtersActive
                    ? tr("No playlists match this filter.")
                    : tr("No playlists found")}
          </div>
        )}
      </div>

      <Pagination
        page={page}
        perPage={perPage}
        total={filtered.length}
        onChange={setPage}
        onPerPageChange={setPerPage}
        hideTotal
      />

      {addOpen && canManage && (
        <div
          role="presentation"
          onClick={() => {
            if (!saving) setAddOpen(false);
          }}
          style={overlay}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={tr("Add playlist")}
            style={dialog}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={dialogTitle}>{tr("Add playlist")}</h2>
            <p style={emptyHint}>
              {tr("Name the playlist, then add Loom videos inside it.")}
            </p>
            <label style={label}>
              {tr("Title")}
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void createPlaylist();
                }}
                placeholder={tr("e.g. OmniPulse team guides")}
                autoFocus
                disabled={saving}
                style={input}
              />
            </label>
            {addError && (
              <p style={{ ...emptyHint, color: "var(--crit)", marginTop: 10 }}>{addError}</p>
            )}
            <div style={actions}>
              <button
                type="button"
                style={secondaryBtn}
                disabled={saving}
                onClick={() => setAddOpen(false)}
              >
                {tr("Cancel")}
              </button>
              <button
                type="button"
                style={{
                  ...addBtn,
                  opacity: saving || !newTitle.trim() ? 0.45 : 1,
                  cursor: saving || !newTitle.trim() ? "not-allowed" : "pointer",
                }}
                disabled={saving || !newTitle.trim()}
                onClick={() => void createPlaylist()}
              >
                {saving ? tr("Creating…") : tr("Create")}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={tr("Delete playlist?")}
        description={
          deleteTarget
            ? `"${deleteTarget.title}" and its videos will be removed from Guide.`
            : undefined
        }
        confirmLabel={tr("Delete")}
        confirmTone="danger"
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      />
    </div>
  );
}

const toolbarSearchSlot: CSSProperties = {
  flex: "1 1 auto",
  minWidth: 0,
};

const toolbarFallbackStyle: CSSProperties = {
  flexWrap: "nowrap",
};

const toolbarRightCluster: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexShrink: 0,
  flexWrap: "nowrap",
  marginLeft: "auto",
};

const emptyHint: CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: "var(--ink-mute)",
  maxWidth: 420,
  lineHeight: 1.45,
};

/** Same labelled CTA as Sales Pipeline “+ Add lead”. */
const addLeadBtnStyle: CSSProperties = {
  padding: "8px 14px",
  fontSize: 12,
  fontWeight: 500,
  minWidth: 130,
  background: "var(--green-deep)",
  color: "var(--surface)",
  border: "1px solid var(--green-deep)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
  fontFamily: "var(--sans)",
  textAlign: "center",
};

const addBtn: CSSProperties = addLeadBtnStyle;

/** Pipeline row action chips (View / Archive). */
const actionBtnStyle: CSSProperties = {
  padding: "4px 8px",
  fontSize: 11,
  fontWeight: 500,
  background: "var(--surface-sunk)",
  border: "1px solid var(--rule-strong)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
  color: "var(--ink)",
  fontFamily: "var(--sans)",
};

const titleLinkStyle: CSSProperties = {
  fontFamily: "var(--sans)",
  fontSize: 13,
  fontWeight: 500,
  color: "var(--green-deep)",
  cursor: "pointer",
  background: "none",
  border: "none",
  padding: 0,
  textAlign: "left",
  textDecoration: "underline",
  textUnderlineOffset: 3,
  textDecorationColor: "var(--rule-strong)",
  textDecorationThickness: "1px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  maxWidth: "100%",
};

const actionsHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  paddingRight: 16,
};

const actionsCellStyle: CSSProperties = {
  display: "flex",
  gap: 6,
  justifyContent: "flex-end",
  alignItems: "center",
  paddingRight: 16,
};

const secondaryBtn: CSSProperties = {
  ...addBtn,
  background: "var(--surface)",
  color: "var(--ink)",
  border: "1px solid var(--rule-strong)",
};

const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 80,
  background: "color-mix(in srgb, var(--ink) 45%, transparent)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const dialog: CSSProperties = {
  width: "100%",
  maxWidth: 420,
  background: "var(--surface)",
  borderRadius: "var(--r-md)",
  border: "1px solid var(--rule)",
  padding: 20,
};

const dialogTitle: CSSProperties = {
  margin: "0 0 8px",
  fontFamily: "var(--serif)",
  fontSize: 22,
  fontWeight: 600,
  color: "var(--ink)",
};

const label: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  marginTop: 14,
  fontSize: 12,
  fontWeight: 600,
  color: "var(--ink-soft)",
  fontFamily: "var(--sans)",
};

const input: CSSProperties = {
  height: 40,
  padding: "0 12px",
  borderRadius: "var(--r-sm)",
  border: "1px solid var(--rule-strong)",
  background: "var(--page)",
  color: "var(--ink)",
  fontSize: 13,
  outline: "none",
  fontFamily: "var(--sans)",
};

const actions: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  marginTop: 16,
};
