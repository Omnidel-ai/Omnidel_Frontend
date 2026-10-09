"use client";

/**
 * Guide / Admin — Loom video grid + in-app player modal (official oEmbed HTML).
 * Comments / emoji stay inside Loom's frame; we only paste share URLs.
 * Add/edit/delete only when `manage` (Admin tab). Guide tab is view-only.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { fetchJson, FetchError } from "@/lib/client/fetch-json";
import { loadGuideWatchedIds, markGuideWatched } from "@/lib/client/guide-watched";
import { useIsMobile } from "@/lib/client/use-is-mobile";
import { usePermissions } from "@/lib/client/permissions";
import { ConfirmDialog } from "@/components/omnidel/confirm-dialog";
import {
  MultiFilter,
  type DateRange,
  type FilterSectionConfig,
} from "@/components/omnidel/multi-filter";
import {
  GUIDE_VIDEO_PAGE_SIZE,
  formatDurationLabel,
  isLoomOEmbedHtml,
  loomShareToEmbedHtml,
  normalizeLoomShareUrl,
  type GuideAreaOption,
  type GuidePlaylistDto,
  type GuideVideoDto,
} from "@/lib/guide-schema";
import { GuideVideoCard } from "./guide-video-card";
import { useTr } from "@/lib/client/language";

type Props = {
  initialVideos?: GuideVideoDto[];
  /** Admin tab only — add / edit / delete. Guide tab is always view-only. */
  manage?: boolean;
  /** From Playlist tab: pre-check this playlist in FILTERS. */
  seedPlaylistId?: string | null;
  /** Videos | Playlist switcher — sits on the search row, right side. */
  paneTabs?: ReactNode;
  /** Fixed header slot so search + tabs + Add share one row. */
  toolbarHost?: HTMLElement | null;
};

/** Start of local day ms for YYYY-MM-DD. */
function dayStartMs(isoDay: string): number {
  const [y, m, d] = isoDay.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

/** Inclusive local-day window as ISO bounds for the paged API. */
function addedBounds(
  range: DateRange,
  customFrom: string,
  customTo: string,
): { from: string; to: string } | null {
  if (!range) return null;
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endToday = startToday + 86_400_000;
  if (range === "today") {
    return { from: new Date(startToday).toISOString(), to: new Date(endToday).toISOString() };
  }
  if (range === "last_7") {
    return {
      from: new Date(startToday - 6 * 86_400_000).toISOString(),
      to: new Date(endToday).toISOString(),
    };
  }
  if (range === "custom") {
    if (!customFrom && !customTo) return null;
    return {
      from: customFrom
        ? new Date(dayStartMs(customFrom)).toISOString()
        : new Date(0).toISOString(),
      to: customTo
        ? new Date(dayStartMs(customTo) + 86_400_000).toISOString()
        : new Date(endToday).toISOString(),
    };
  }
  return null;
}

const GUIDE_DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: "", label: "Any added date" },
  { value: "today", label: "Added today" },
  { value: "last_7", label: "Added last 7 days" },
  { value: "custom", label: "Custom range…" },
];

export function GuideGrid({
  initialVideos = [],
  manage = false,
  seedPlaylistId = null,
  paneTabs,
  toolbarHost = null,
}: Props) {
  const tr = useTr();
  const isMobile = useIsMobile();
  const isTablet = useIsMobile("(max-width: 1100px)");
  const { isAdmin } = usePermissions();
  const canManage = manage && isAdmin;
  const [videos, setVideos] = useState<GuideVideoDto[]>(initialVideos);
  const [total, setTotal] = useState(initialVideos.length);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [active, setActive] = useState<GuideVideoDto | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>("");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [areaIds, setAreaIds] = useState<string[]>([]);
  const [playlistIds, setPlaylistIds] = useState<string[]>(
    () => (seedPlaylistId ? [seedPlaylistId] : []),
  );
  const [areaOptions, setAreaOptions] = useState<GuideAreaOption[]>([]);
  const [playlistOptions, setPlaylistOptions] = useState<GuidePlaylistDto[]>([]);
  const [watchedIds, setWatchedIds] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<GuideVideoDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GuideVideoDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setWatchedIds(loadGuideWatchedIds());
  }, []);

  useEffect(() => {
    if (seedPlaylistId) setPlaylistIds([seedPlaylistId]);
  }, [seedPlaylistId]);

  useEffect(() => {
    let cancelled = false;
    void fetchJson<{ items: GuideAreaOption[] }>("/api/guide/areas")
      .then((data) => {
        if (!cancelled) setAreaOptions(data.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setAreaOptions([]);
      });
    void fetchJson<{ items: GuidePlaylistDto[] }>("/api/guide/playlists")
      .then((data) => {
        if (!cancelled) setPlaylistOptions(data.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setPlaylistOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const onWatched = useCallback((id: string) => {
    setWatchedIds(markGuideWatched(id));
  }, []);

  const listQuery = useMemo(() => {
    const p = new URLSearchParams();
    p.set("limit", String(GUIDE_VIDEO_PAGE_SIZE));
    const q = debouncedSearch.trim();
    if (q) p.set("q", q);
    for (const id of areaIds) p.append("area", id);
    for (const id of playlistIds) p.append("playlist", id);
    const bounds = addedBounds(dateRange, customFrom, customTo);
    if (bounds) {
      p.set("from", bounds.from);
      p.set("to", bounds.to);
    }
    return p;
  }, [debouncedSearch, areaIds, playlistIds, dateRange, customFrom, customTo]);

  const fetchPage = useCallback(
    async (offset: number) => {
      const p = new URLSearchParams(listQuery);
      p.set("offset", String(offset));
      return fetchJson<{ items: GuideVideoDto[]; total: number }>(
        `/api/guide/videos?${p.toString()}`,
      );
    },
    [listQuery],
  );

  const reload = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const data = await fetchPage(0);
      const items = data.items ?? [];
      setVideos(items);
      setTotal(typeof data.total === "number" ? data.total : items.length);
    } catch (err) {
      const msg =
        err instanceof FetchError
          ? err.message
          : "Could not load guide videos.";
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const loadMore = useCallback(async () => {
    if (loadingMore || videos.length >= total) return;
    setLoadingMore(true);
    try {
      const data = await fetchPage(videos.length);
      setVideos((prev) => {
        const seen = new Set(prev.map((v) => v.id));
        return [...prev, ...(data.items ?? []).filter((item) => !seen.has(item.id))];
      });
      setTotal(data.total ?? total);
    } catch (err) {
      setLoadError(
        err instanceof FetchError ? err.message : "Could not load more videos.",
      );
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, loadingMore, videos.length, total]);

  const confirmDeleteVideo = useCallback(async () => {
    if (!deleteTarget || !canManage) return;
    setDeleting(true);
    try {
      await fetchJson(
        `/api/guide/videos?id=${encodeURIComponent(deleteTarget.id)}`,
        { method: "DELETE" },
      );
      const removedId = deleteTarget.id;
      setDeleteTarget(null);
      setVideos((prev) => prev.filter((v) => v.id !== removedId));
      setTotal((n) => Math.max(0, n - 1));
      if (active?.id === removedId) setActive(null);
      if (editing?.id === removedId) setEditing(null);
    } catch {
      // fetchJson toasts on 5xx
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, canManage, active?.id, editing?.id]);

  const filterSections = useMemo((): FilterSectionConfig[] => {
    return [
      {
        key: "area",
        label: "Area",
        type: "checklist",
        options: areaOptions.map((a) => ({
          value: a.id,
          label: a.title,
        })),
        value: areaIds,
        onChange: setAreaIds,
      },
      {
        key: "playlist",
        label: "Playlist",
        type: "checklist",
        divider: true,
        options: playlistOptions.map((p) => ({
          value: p.id,
          label: p.title,
        })),
        value: playlistIds,
        onChange: setPlaylistIds,
      },
      {
        key: "added_range",
        label: "Added",
        type: "daterange",
        divider: true,
        options: GUIDE_DATE_RANGE_OPTIONS,
        value: dateRange,
        onChange: setDateRange,
        customFrom,
        onCustomFromChange: setCustomFrom,
        customTo,
        onCustomToChange: setCustomTo,
      },
    ];
  }, [areaOptions, areaIds, playlistOptions, playlistIds, dateRange, customFrom, customTo]);

  const cols = isMobile
    ? "1fr"
    : isTablet
      ? "repeat(2, minmax(220px, 1fr))"
      : "repeat(3, minmax(200px, 1fr))";

  const filtersActive = !!search.trim() || !!dateRange || areaIds.length > 0 || playlistIds.length > 0;
  const remaining = Math.max(0, total - videos.length);
  const hasMore = remaining > 0;

  const toolbar = (
    <>
      <div style={toolbarSearchSlot}>
        <MultiFilter
          searchInput={search}
          onSearchChange={setSearch}
          searchPlaceholder={tr("Search guide titles...")}
          sections={filterSections}
        />
      </div>
      <div style={toolbarRightCluster}>
        {paneTabs}
        {canManage && (
          <button type="button" style={addBtn} onClick={() => setAddOpen(true)}>
            {tr("+ Add video")}
          </button>
        )}
      </div>
    </>
  );

  return (
    <div>
      {toolbarHost
        ? createPortal(toolbar, toolbarHost)
        : <div className="table-toolbar" style={toolbarFallbackStyle}>{toolbar}</div>}

      {loading && (
        <div className="table-wrap">
          <div className="table-empty">{tr("Loading...")}</div>
        </div>
      )}

      {!loading && loadError && (
        <div className="table-wrap">
          <div className="table-empty">{loadError}</div>
        </div>
      )}

      {!loading && !loadError && videos.length === 0 && (
        <div className="table-wrap">
          <div className="table-empty">
            {filtersActive
              ? tr("No videos match this filter.")
              : canManage
                ? tr("No videos yet. Add one with “+ Add video”.")
                : tr("No videos yet.")}
          </div>
        </div>
      )}

      {!loading && videos.length > 0 && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: cols,
              gap: isMobile ? 20 : 36,
              alignItems: "stretch",
              width: "100%",
            }}
          >
            {videos.map((v) => (
              <GuideVideoCard
                key={v.id}
                video={v}
                watched={watchedIds.has(v.id)}
                onOpen={() => setActive(v)}
                onEdit={canManage ? () => setEditing(v) : undefined}
                onDelete={canManage ? () => setDeleteTarget(v) : undefined}
              />
            ))}
          </div>
          {hasMore && (
            <div style={showMoreWrap}>
              <button
                type="button"
                style={showMoreBtn}
                onClick={() => void loadMore()}
                disabled={loadingMore}
              >
                {loadingMore
                  ? tr("Loading…")
                  : `Show more (${remaining} remaining)`}
              </button>
            </div>
          )}
        </>
      )}

      {active && (
        <GuidePlayerModal
          video={active}
          onWatched={onWatched}
          onClose={() => setActive(null)}
        />
      )}

      {editing && canManage && (
        <EditGuideVideoModal
          video={editing}
          areas={areaOptions}
          playlists={playlistOptions}
          onClose={() => setEditing(null)}
          onSaved={(item) => {
            setVideos((prev) => prev.map((x) => (x.id === item.id ? item : x)));
            setEditing(null);
          }}
        />
      )}

      {addOpen && canManage && (
        <AddGuideVideoModal
          areas={areaOptions}
          playlists={playlistOptions}
          onClose={() => setAddOpen(false)}
          onAdded={() => {
            setAddOpen(false);
            void reload();
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={tr("Delete video?")}
        description={
          deleteTarget
            ? `"${deleteTarget.title}" will be removed from this playlist.`
            : undefined
        }
        confirmLabel={tr("Delete")}
        confirmTone="danger"
        busy={deleting}
        onConfirm={() => void confirmDeleteVideo()}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      />
    </div>
  );
}

function formatAddedDate(iso: string): string | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function GuidePlayerModal({
  video,
  onClose,
  onWatched,
}: {
  video: GuideVideoDto;
  onClose: () => void;
  onWatched?: (id: string) => void;
}) {
  const tr = useTr();
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    onWatched?.(video.id);
  }, [video.id, onWatched]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    // Wait until the portal is in the DOM — otherwise hostRef is null and we
    // would exit once and never mount the player (stuck on "Loading…").
    if (!mounted) return;

    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;

    function paint(html: string) {
      if (cancelled || !hostRef.current) return;
      hostRef.current.innerHTML = html;
      // Make Loom's fixed-size iframe fill the modal.
      const iframe = hostRef.current.querySelector("iframe");
      if (iframe) {
        iframe.style.width = "100%";
        iframe.style.maxWidth = "100%";
        iframe.style.aspectRatio = "16 / 9";
        iframe.style.height = "auto";
        iframe.style.minHeight = "280px";
        iframe.style.border = "0";
        iframe.setAttribute("allowfullscreen", "true");
      }
      setStatus("ready");
    }

    function mountPlayer() {
      setStatus("loading");
      setErrorMsg(null);

      if (video.html && isLoomOEmbedHtml(video.html)) {
        paint(video.html);
        return;
      }

      const share = normalizeLoomShareUrl(video.shareUrl) || video.shareUrl;
      const fallbackHtml = loomShareToEmbedHtml(
        share,
        video.width ?? 960,
        video.height ?? 540,
      );
      if (fallbackHtml) {
        paint(fallbackHtml);
        return;
      }
      setStatus("error");
      setErrorMsg(
        "This video will not play here. It may be workspace-only — in Loom, set sharing to anyone with the link, then try again.",
      );
    }

    mountPlayer();
    return () => {
      cancelled = true;
      if (host) host.innerHTML = "";
    };
  }, [video, mounted]);

  if (!mounted) return null;

  return createPortal(
    <div style={overlay} role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={video.title}
        style={dialog}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={dialogHead}>
          <h2 style={dialogTitle}>{video.title}</h2>
          <button type="button" style={closeBtn} onClick={onClose} aria-label={tr("Close")}>
            {tr("Close")}
          </button>
        </div>
        <div style={playerShell}>
          {status === "loading" && (
            <p style={emptyHint}>{tr("Loading Loom player…")}</p>
          )}
          {status === "error" && (
            <p style={{ ...emptyHint, color: "var(--crit)" }}>{errorMsg}</p>
          )}
          <div
            ref={hostRef}
            style={{
              ...playerHost,
              display: status === "error" ? "none" : "block",
            }}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}

type LoomPreview = {
  shareUrl: string;
  title: string;
  thumbnailUrl: string | null;
  durationSec: number | null;
};

function AddGuideVideoModal({
  areas,
  playlists,
  onClose,
  onAdded,
}: {
  areas: GuideAreaOption[];
  playlists: GuidePlaylistDto[];
  onClose: () => void;
  onAdded: (item: GuideVideoDto) => void;
}) {
  const tr = useTr();
  const [step, setStep] = useState<"paste" | "preview">("paste");
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<LoomPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [summary, setSummary] = useState("");
  const [areaIds, setAreaIds] = useState<string[]>([]);
  const [playlistIds, setPlaylistIds] = useState<string[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  async function onPreview(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const normalised = normalizeLoomShareUrl(url);
    if (!normalised) {
      setError("Paste a full Loom share link, like https://www.loom.com/share/…");
      return;
    }
    setBusy(true);
    try {
      const oembed = await fetchJson<{
        shareUrl: string;
        title: string;
        thumbnailUrl: string | null;
        durationSec: number | null;
      }>(`/api/guide/oembed?url=${encodeURIComponent(normalised)}`);
      setPreview({
        shareUrl: oembed.shareUrl,
        title: oembed.title || "Loom video",
        thumbnailUrl: oembed.thumbnailUrl,
        durationSec: oembed.durationSec,
      });
      setStep("preview");
    } catch (err) {
      setError(
        err instanceof FetchError
          ? err.message
          : "This Loom will not load. It may be workspace-only — in Loom, set sharing to anyone with the link, then try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onSave() {
    if (!preview) return;
    if (areaIds.length === 0) {
      setError("Pick at least one area.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const data = await fetchJson<{ item: GuideVideoDto }>("/api/guide/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shareUrl: preview.shareUrl,
          summary,
          areaIds,
          playlistIds,
        }),
      });
      onAdded(data.item);
    } catch (err) {
      setError(
        err instanceof FetchError
          ? err.message
          : "Could not save that video. Check the link and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  function backToPaste() {
    setStep("paste");
    setPreview(null);
    setError(null);
  }

  if (!mounted) return null;

  const durationLabel = preview ? formatDurationLabel(preview.durationSec) : null;

  return createPortal(
    <div style={overlay} role="presentation" onClick={() => !busy && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={tr("Add guide video")}
        style={addDialog}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={dialogTitle}>
          {step === "paste" ? tr("Add guide video") : tr("Confirm guide video")}
        </h2>

        {step === "paste" && (
          <>
            <p style={emptyHint}>
              {tr("Paste a Loom share URL. No file upload — the video stays on Loom. Set the Loom to anyone with the link so the team can watch it.")}
            </p>
            <form onSubmit={onPreview} style={{ marginTop: 16 }}>
              <label style={label}>
                {tr("Loom share link")}
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.loom.com/share/…"
                  style={input}
                  disabled={busy}
                  autoFocus
                />
              </label>
              {error && (
                <p style={{ ...emptyHint, color: "var(--crit)", marginTop: 10 }}>
                  {error}
                </p>
              )}
              <div style={addActions}>
                <button
                  type="button"
                  style={secondaryBtn}
                  onClick={onClose}
                  disabled={busy}
                >
                  {tr("Cancel")}
                </button>
                <button type="submit" style={addBtn} disabled={busy}>
                  {busy ? tr("Loading…") : tr("Preview")}
                </button>
              </div>
            </form>
          </>
        )}

        {step === "preview" && preview && (
          <>
            <p style={emptyHint}>
              {tr("Check this is the right walkthrough. Nothing is saved until you click Save.")}
            </p>
            <div style={previewCard}>
              <div style={thumbWrap}>
                {preview.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview.thumbnailUrl} alt="" style={thumbImg} />
                ) : (
                  <div style={thumbFallback}>{tr("No preview")}</div>
                )}
                {durationLabel && (
                  <span style={durationChip}>{durationLabel}</span>
                )}
              </div>
              <div style={cardBody}>
                <div style={cardTitle}>{preview.title}</div>
                <div style={cardMeta}>{preview.shareUrl}</div>
              </div>
            </div>
            <GuideVideoMetaFields
              areas={areas}
              areaIds={areaIds}
              onAreaIds={setAreaIds}
              playlists={playlists}
              playlistIds={playlistIds}
              onPlaylistIds={setPlaylistIds}
              summary={summary}
              onSummary={setSummary}
              addedLabel={formatAddedDate(new Date().toISOString())}
              disabled={busy}
            />
            {error && (
              <p style={{ ...emptyHint, color: "var(--crit)", marginTop: 10 }}>
                {error}
              </p>
            )}
            <div style={addActions}>
              <button
                type="button"
                style={secondaryBtn}
                onClick={backToPaste}
                disabled={busy}
              >
                {tr("Change link")}
              </button>
              <button
                type="button"
                style={secondaryBtn}
                onClick={onClose}
                disabled={busy}
              >
                {tr("Cancel")}
              </button>
              <button
                type="button"
                style={addBtn}
                onClick={() => void onSave()}
                disabled={busy}
              >
                {busy ? tr("Saving…") : tr("Save")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

function GuideMultiSelect({
  label,
  hint,
  options,
  value,
  onChange,
  placeholder,
  emptyText,
  disabled,
}: {
  label: string;
  hint?: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  emptyText: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !ref.current) {
      setPos(null);
      return;
    }
    function update() {
      if (!ref.current) return;
      const r = ref.current.getBoundingClientRect();
      const top = r.bottom + 4;
      setPos({
        top,
        left: r.left,
        width: r.width,
        maxHeight: Math.min(240, window.innerHeight - top - 12),
      });
    }
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (ref.current?.contains(t)) return;
      if (popoverRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onDown);
      document.addEventListener("keydown", onKey);
    }
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selectedLabels = options.filter((o) => value.includes(o.value)).map((o) => o.label);
  const triggerText =
    selectedLabels.length === 0
      ? placeholder
      : selectedLabels.length <= 2
        ? selectedLabels.join(", ")
        : `${selectedLabels.length} selected`;

  return (
    <div ref={ref}>
      <div style={checkListLegend}>
        {label}
        {hint ? <span style={checkListHint}> — {hint}</span> : null}
      </div>
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        style={{
          ...input,
          width: "100%",
          textAlign: "left",
          cursor: disabled ? "default" : "pointer",
          color: selectedLabels.length > 0 ? "var(--ink)" : "var(--ink-mute)",
          paddingRight: 32,
          position: "relative",
        }}
      >
        {triggerText}
        <svg
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
          aria-hidden="true"
          style={{
            position: "absolute",
            right: 12,
            top: "50%",
            transform: `translateY(-50%) rotate(${open ? 0 : -90}deg)`,
            pointerEvents: "none",
          }}
        >
          <path d="M1 1l4 4 4-4" stroke="var(--ink-mute)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && pos && typeof document !== "undefined" && createPortal(
        <div
          ref={popoverRef}
          role="listbox"
          aria-multiselectable="true"
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            width: pos.width,
            maxHeight: pos.maxHeight,
            overflowY: "auto",
            background: "var(--surface)",
            border: "1px solid var(--rule)",
            borderRadius: "var(--r-sm)",
            boxShadow: "var(--shadow-md)",
            zIndex: 2000,
            padding: "4px 0",
          }}
        >
          {options.length === 0 ? (
            <div style={{ padding: "8px 12px", fontSize: 12, color: "var(--ink-mute)", fontFamily: "var(--sans)" }}>
              {emptyText}
            </div>
          ) : (
            options.map((opt) => {
              const checked = value.includes(opt.value);
              return (
                <label
                  key={opt.value}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "7px 12px",
                    fontSize: 13,
                    fontFamily: "var(--sans)",
                    cursor: "pointer",
                    background: checked ? "var(--surface-sunk)" : "transparent",
                    color: "var(--ink-soft)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onChange(toggleId(value, opt.value))}
                    style={{ accentColor: "var(--green-deep)", cursor: "pointer", width: 15, height: 15 }}
                  />
                  {opt.label}
                </label>
              );
            })
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}

function GuideVideoMetaFields({
  areas,
  areaIds,
  onAreaIds,
  playlists,
  playlistIds,
  onPlaylistIds,
  summary,
  onSummary,
  addedLabel,
  disabled,
}: {
  areas: GuideAreaOption[];
  areaIds: string[];
  onAreaIds: (v: string[]) => void;
  playlists: GuidePlaylistDto[];
  playlistIds: string[];
  onPlaylistIds: (v: string[]) => void;
  summary: string;
  onSummary: (v: string) => void;
  addedLabel: string | null;
  disabled?: boolean;
}) {
  const tr = useTr();
  return (
    <div style={metaFields}>
      <GuideMultiSelect
        label={tr("Area")}
        options={areas.map((a) => ({ value: a.id, label: a.title }))}
        value={areaIds}
        onChange={onAreaIds}
        placeholder={tr("Select area…")}
        emptyText={tr("No areas yet — add them in Admin → Guide")}
        disabled={disabled}
      />
      <GuideMultiSelect
        label={tr("Playlist")}
        hint="optional"
        options={playlists.map((p) => ({ value: p.id, label: p.title }))}
        value={playlistIds}
        onChange={onPlaylistIds}
        placeholder={tr("Select playlist…")}
        emptyText={tr("No playlists yet — a video can be saved without one.")}
        disabled={disabled}
      />
      <label style={label}>
        {tr("Description (optional)")}
        <input
          type="text"
          value={summary}
          onChange={(e) => onSummary(e.target.value)}
          placeholder={tr("What this walkthrough covers")}
          maxLength={200}
          style={input}
          disabled={disabled}
        />
      </label>
      {addedLabel ? (
        <p style={emptyHint}>{tr("Added")} {addedLabel} {tr("— set automatically when you save.")}</p>
      ) : null}
    </div>
  );
}

function EditGuideVideoModal({
  video,
  areas,
  playlists,
  onClose,
  onSaved,
}: {
  video: GuideVideoDto;
  areas: GuideAreaOption[];
  playlists: GuidePlaylistDto[];
  onClose: () => void;
  onSaved: (item: GuideVideoDto) => void;
}) {
  const tr = useTr();
  const [summary, setSummary] = useState(video.summary ?? "");
  const [areaIds, setAreaIds] = useState<string[]>(
    () => video.areas.map((a) => a.id).filter(Boolean).length
      ? video.areas.map((a) => a.id)
      : video.areaId
        ? [video.areaId]
        : [],
  );
  const [playlistIds, setPlaylistIds] = useState<string[]>(
    () => video.playlists.map((p) => p.id).filter(Boolean).length
      ? video.playlists.map((p) => p.id)
      : video.playlistId
        ? [video.playlistId]
        : [],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  async function onSave() {
    if (areaIds.length === 0) {
      setError("Pick at least one area.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const data = await fetchJson<{ item: GuideVideoDto }>("/api/guide/videos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: video.id, summary, areaIds, playlistIds }),
      });
      onSaved(data.item);
    } catch (err) {
      setError(
        err instanceof FetchError
          ? err.message
          : "Could not save those details.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div style={overlay} role="presentation" onClick={() => !busy && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={tr("Edit guide video details")}
        style={addDialog}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={dialogTitle}>{tr("Edit details")}</h2>
        <p style={emptyHint}>{video.title}</p>
        <GuideVideoMetaFields
          areas={areas}
          areaIds={areaIds}
          onAreaIds={setAreaIds}
          playlists={playlists}
          playlistIds={playlistIds}
          onPlaylistIds={setPlaylistIds}
          summary={summary}
          onSummary={setSummary}
          addedLabel={formatAddedDate(video.addedOn)}
          disabled={busy}
        />
        {error && (
          <p style={{ ...emptyHint, color: "var(--crit)", marginTop: 10 }}>
            {error}
          </p>
        )}
        <div style={addActions}>
          <button type="button" style={secondaryBtn} onClick={onClose} disabled={busy}>
            {tr("Cancel")}
          </button>
          <button type="button" style={addBtn} onClick={() => void onSave()} disabled={busy}>
            {busy ? tr("Saving…") : tr("Save")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
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

const addBtn: CSSProperties = {
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
  flexShrink: 0,
};

const secondaryBtn: CSSProperties = {
  ...addBtn,
  minWidth: 0,
  background: "var(--surface)",
  color: "var(--ink-soft)",
  border: "1px solid var(--rule-strong)",
};

const emptyHint: CSSProperties = {
  margin: 0,
  fontFamily: "var(--sans)",
  fontSize: 13,
  color: "var(--ink-mute)",
  lineHeight: 1.45,
};

const checkListLegend: CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 10,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--ink-mute)",
  marginBottom: 6,
};

const checkListHint: CSSProperties = {
  letterSpacing: "0.04em",
  textTransform: "none",
  fontFamily: "var(--sans)",
  fontSize: 11,
  color: "var(--ink-mute)",
};

const thumbWrap: CSSProperties = {
  position: "relative",
  aspectRatio: "16 / 9",
  background: "var(--surface-sunk)",
  overflow: "hidden",
  borderRadius: "var(--r-sm)",
  flexShrink: 0,
};

const thumbImg: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
};

const thumbFallback: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "grid",
  placeItems: "center",
  fontFamily: "var(--mono)",
  fontSize: 12,
  color: "var(--ink-mute)",
};

const durationChip: CSSProperties = {
  position: "absolute",
  right: 6,
  bottom: 6,
  fontFamily: "var(--mono)",
  fontSize: 10,
  padding: "2px 6px",
  borderRadius: "var(--r-sm)",
  background: "var(--ink)",
  color: "var(--surface)",
};

const cardBody: CSSProperties = {
  padding: "2px 2px 4px",
  display: "flex",
  flexDirection: "column",
  gap: 4,
  minWidth: 0,
};

const cardTitle: CSSProperties = {
  fontFamily: "var(--sans)",
  fontSize: 16,
  fontWeight: 650,
  color: "var(--ink)",
  lineHeight: 1.35,
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  minWidth: 0,
  flex: 1,
};

const cardMeta: CSSProperties = {
  fontFamily: "var(--sans)",
  fontSize: 12,
  fontWeight: 500,
  color: "var(--ink-soft)",
  overflowWrap: "anywhere",
};

const metaFields: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  marginTop: 14,
};

const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "color-mix(in srgb, var(--ink) 45%, transparent)",
  zIndex: 1200,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const dialog: CSSProperties = {
  width: "min(960px, 100%)",
  maxHeight: "90dvh",
  overflow: "auto",
  background: "var(--surface)",
  borderRadius: "var(--r-sm)",
  border: "1px solid var(--rule)",
  padding: 16,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const addDialog: CSSProperties = {
  ...dialog,
  width: "min(480px, 100%)",
};

const previewCard: CSSProperties = {
  marginTop: 14,
  border: "1px solid var(--rule)",
  borderRadius: "var(--r-sm)",
  background: "var(--surface)",
  overflow: "hidden",
};

const dialogHead: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const dialogTitle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--serif)",
  fontSize: 22,
  fontWeight: 600,
  color: "var(--ink)",
};

const closeBtn: CSSProperties = {
  fontFamily: "var(--sans)",
  fontSize: 13,
  padding: "6px 10px",
  background: "transparent",
  border: "1px solid var(--rule)",
  borderRadius: "var(--r-sm)",
  color: "var(--ink-soft)",
  cursor: "pointer",
};

const playerShell: CSSProperties = {
  background: "var(--surface-sunk)",
  borderRadius: "var(--r-sm)",
  minHeight: 200,
  padding: 4,
};

const playerHost: CSSProperties = {
  width: "100%",
  lineHeight: 0,
};

const label: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontFamily: "var(--sans)",
  fontSize: 13,
  color: "var(--ink-soft)",
};

const input: CSSProperties = {
  fontFamily: "var(--sans)",
  fontSize: 13,
  padding: "10px 12px",
  border: "1px solid var(--rule-strong)",
  borderRadius: "var(--r-sm)",
  background: "var(--surface)",
  color: "var(--ink)",
  outline: "none",
  boxSizing: "border-box",
};

const addActions: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  marginTop: 16,
  flexWrap: "wrap",
};

const showMoreWrap: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  marginTop: 24,
};

const showMoreBtn: CSSProperties = {
  padding: "8px 18px",
  minWidth: 140,
  background: "var(--surface)",
  color: "var(--green-deep)",
  border: "1px solid var(--green-deep)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
  fontFamily: "var(--sans)",
  fontSize: 12,
  fontWeight: 600,
};
