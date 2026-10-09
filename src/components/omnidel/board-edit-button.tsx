"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { LIST_COLOR_PALETTE } from "@/components/omnidel/task-board";
import { AcharyaPicker } from "@/components/omnidel/acharya-picker";
import { ConfirmDialog } from "@/components/omnidel/confirm-dialog";
import { MoveProjectDialog, type MovePreflight } from "@/components/omnidel/omnipulse/move-project-dialog";
import { tasksToCsv, downloadCsv, type ExportTask } from "@/lib/client/task-csv";
import { clampToMaxLength, BOARD_NAME_MAX } from "@/lib/field-limits";
import { fetchJson, FetchError } from "@/lib/client/fetch-json";
import { PermissionGate, usePermissions } from "@/lib/client/permissions";
import { CustomSelect } from "@/components/omnidel/custom-select";
import {
  isAnnouncementEligible,
  isTeamScopedProject,
  PROJECT_VISIBILITY,
  projectVisibilitySelectOptions,
  requiresTeamSelection,
  type ProjectVisibility,
} from "@/lib/project-visibility";
import { useTr } from "@/lib/client/language";

// Project (board) actions menu, rendered on each board card in the projects
// grid. A single 3-dot menu consolidating: Edit details (rename + settings —
// name / description / colour / acharya), Change visibility, Announcement
// channel (Everyone projects only — see below), Duplicate, Export
// CSV, Show archive (deep-links into the board where archived lists live),
// and Archive / Restore. Those two flip is_active — for a project that flag IS
// the archive state (the grid's "Show archived (N)" filter counts !is_active,
// and there is no hard delete), so they are worded Archive / Restore to match
// the filter and the rest of the app, not Deactivate / Reactivate.
// Each acts on /api/omnipulse/boards/<id> (+ /duplicate) then refreshes.

type Visibility = "workspace" | "org" | "private";
type Mode = "menu" | "edit" | "visibility" | "team" | "move";

export function BoardEditButton({
  board,
  canManage = true,
  canCreate = false,
}: {
  board: { id: string; name: string; description: string | null; color: string | null; visibility?: Visibility; visibility_type?: ProjectVisibility; workspace_id?: string | null; acharya_id?: string | null; is_active?: boolean; is_announcement?: boolean; project_lead_id?: string | null };
  // canManage gates edit / visibility / archive / delete. canCreate gates the
  // Duplicate row (it inserts a new board). Defaults keep older call sites safe.
  canManage?: boolean;
  canCreate?: boolean;
}) {
  const tr = useTr();
  const router = useRouter();
  const { isAdmin } = usePermissions();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("menu");
  const [confirm, setConfirm] = useState<null | "archive">(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const isArchived = board.is_active === false;

  const [name, setName] = useState(board.name);
  const [description, setDescription] = useState(board.description || "");
  const [color, setColor] = useState(board.color || "");
  const [acharyaId, setAcharyaId] = useState<string | null>(board.acharya_id ?? null);
  // Project lead. Options are the anchor team's members for a team-scoped
  // project (the server rejects a lead who isn't one); detached Private /
  // Everyone projects fall back to the org user list.
  const [projectLeadId, setProjectLeadId] = useState(board.project_lead_id ?? "");
  const [leadOptions, setLeadOptions] = useState<{ id: string; name: string }[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingVisibility, setPendingVisibility] = useState<ProjectVisibility>(PROJECT_VISIBILITY.TEAM);
  const [workspaceId, setWorkspaceId] = useState("");
  const [workspaceOptions, setWorkspaceOptions] = useState<{ id: string; name: string }[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const nameRef = useRef<HTMLInputElement | null>(null);

  // "Move to another Team" — destination team picker (mode "move") reuses
  // workspaceOptions/loadManagedWorkspaces above, but keeps its own selection +
  // preflight state so it never collides with the visibility "team" submenu.
  const [moveDestId, setMoveDestId] = useState("");
  const [movePreflightLoading, setMovePreflightLoading] = useState(false);
  const [moveError, setMoveError] = useState("");
  const [moveDialog, setMoveDialog] = useState<null | {
    destWorkspaceId: string;
    destTeamName: string;
    preflight: MovePreflight;
  }>(null);

  // Reset transient state whenever the menu/modal closes.
  useEffect(() => {
    if (open) return;
    setMode("menu");
    setBusy(false);
    setError("");
    setWorkspaceId("");
    setMoveDestId("");
    setMoveError("");
  }, [open]);

  // Close the menu (not the modal) on outside click.
  useEffect(() => {
    if (!open || mode !== "menu") return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, mode]);

  function openEdit() {
    setName(board.name);
    setDescription(board.description || "");
    setColor(board.color || "");
    setAcharyaId(board.acharya_id ?? null);
    setProjectLeadId(board.project_lead_id ?? "");
    setError("");
    setMode("edit");
    void loadLeadOptions();
    setTimeout(() => nameRef.current?.focus(), 50);
  }

  async function loadLeadOptions() {
    setLoadingLeads(true);
    try {
      if (board.workspace_id) {
        const data = await fetchJson<{ items?: { user_id: string; user_name: string | null }[] }>(
          `/api/omnipulse/workspaces/${board.workspace_id}/members`,
        );
        setLeadOptions((data.items || []).map((m) => ({ id: m.user_id, name: m.user_name || "Unnamed" })));
      } else {
        const data = await fetchJson<{ users?: { id: string; name: string }[] }>(
          "/api/omnipulse/tasks/options",
        );
        setLeadOptions(data.users || []);
      }
    } catch {
      // Non-fatal: the picker just shows whoever is already set.
      setLeadOptions([]);
    } finally {
      setLoadingLeads(false);
    }
  }

  async function patchBoard(body: Record<string, unknown>): Promise<boolean> {
    setBusy(true); setError("");
    try {
      await fetchJson(`/api/omnipulse/boards/${board.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return true;
    } catch (err) {
      setError(err instanceof FetchError ? err.message : "Update failed");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveDetails() {
    if (!name.trim()) { setError("Name is required."); return; }
    if (name.trim().length > BOARD_NAME_MAX) {
      setError(`Project name must be at most ${BOARD_NAME_MAX} characters.`);
      return;
    }
    // project_lead_id is a MANAGE-level field on the route, so sending it
    // unconditionally would make every rename require manager access — a
    // board member who may edit name/colour would start getting 403s. Only
    // include it when it actually changed.
    const leadChanged = (projectLeadId || null) !== (board.project_lead_id ?? null);
    const ok = await patchBoard({
      name: name.trim(),
      description: description.trim(),
      color: color || null,
      acharya_id: acharyaId,
      ...(leadChanged ? { project_lead_id: projectLeadId || null } : {}),
    });
    if (ok) { setOpen(false); router.refresh(); }
  }

  async function loadManagedWorkspaces() {
    setLoadingWorkspaces(true);
    setError("");
    try {
      const data = await fetchJson<{ items?: Array<{ id: string; name: string; role?: string }> }>(
        "/api/omnipulse/workspaces",
      );
      setWorkspaceOptions((data.items || [])
        .filter((workspace) => workspace.role === "manager")
        .map((workspace) => ({ id: workspace.id, name: workspace.name })));
    } catch (err) {
      setError(err instanceof FetchError ? err.message : "Could not load teams");
    } finally {
      setLoadingWorkspaces(false);
    }
  }

  async function chooseVisibility(v: ProjectVisibility) {
    const current = board.visibility_type || PROJECT_VISIBILITY.TEAM;
    if (requiresTeamSelection(current, v)) {
      setPendingVisibility(v);
      setWorkspaceId("");
      setMode("team");
      await loadManagedWorkspaces();
      return;
    }
    await changeVisibility(v);
  }

  async function changeVisibility(v: ProjectVisibility, selectedWorkspaceId?: string) {
    const ok = await patchBoard({
      visibility_type: v,
      workspace_id: isTeamScopedProject(v) ? selectedWorkspaceId : null,
    });
    if (ok) { setOpen(false); router.refresh(); }
  }

  // Preflight for "Move to another Team": fetches what the move would affect
  // (orphaned assignees + label count) BEFORE anything runs, so
  // MoveProjectDialog can ask the member/label questions with real data.
  async function loadMovePreflight(destId: string) {
    const destName = workspaceOptions.find((w) => w.id === destId)?.name || "";
    setMovePreflightLoading(true);
    setMoveError("");
    try {
      const { item: preflight } = await fetchJson<{ item: MovePreflight }>(
        `/api/omnipulse/boards/${board.id}/move?dest=${destId}`,
      );
      setMoveDialog({ destWorkspaceId: destId, destTeamName: destName, preflight });
      setOpen(false);
    } catch (err) {
      setMoveError(err instanceof FetchError ? err.message : "Couldn't check this move. Please try again.");
    } finally {
      setMovePreflightLoading(false);
    }
  }

  // Announcement channel toggle. Only meaningful on an Everyone project (the DB
  // CHECK enforces that pairing), and only founders/admins may flip it — the
  // same authority that grants Everyone visibility in the first place.
  const isAnnouncement = board.is_announcement === true;
  const canToggleAnnouncement =
    canManage && isAdmin && isAnnouncementEligible(board.visibility_type || PROJECT_VISIBILITY.TEAM);

  async function toggleAnnouncement() {
    const ok = await patchBoard({ is_announcement: !isAnnouncement });
    if (ok) { setOpen(false); router.refresh(); }
  }

  async function setArchived(active: boolean) {
    const ok = await patchBoard({ is_active: active });
    if (ok) { setConfirm(null); setOpen(false); router.refresh(); }
  }

  async function duplicate() {
    setBusy(true); setError("");
    try {
      await fetchJson(`/api/omnipulse/boards/${board.id}/duplicate`, { method: "POST" });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof FetchError ? err.message : "Duplicate failed");
    } finally {
      setBusy(false);
    }
  }

  async function exportCsv() {
    setBusy(true); setError("");
    try {
      const d = await fetchJson<{ items?: ExportTask[] }>(
        `/api/omnipulse/tasks?board_id=${board.id}&per_page=500`,
      );
      const csv = tasksToCsv((d.items || []) as ExportTask[]);
      downloadCsv(`${board.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "board"}-tasks.csv`, csv);
      setOpen(false);
    } catch (err) {
      setError(err instanceof FetchError ? err.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }

  const [hover, setHover] = useState(false);

  return (
    <div ref={wrapRef} style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        title={tr("Project actions")}
        aria-label={`Actions for ${board.name}`}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); setMode("menu"); }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          width: 26, height: 26, display: "inline-flex", alignItems: "center", justifyContent: "center",
          borderRadius: "var(--r-sm)", border: "none", cursor: "pointer",
          background: open || hover ? "var(--surface-sunk)" : "transparent",
          color: "var(--ink-mute)", transition: "background .14s ease",
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {open && mode === "menu" && (
        <div style={menuStyle} onClick={(e) => e.stopPropagation()}>
          {canManage && <MenuRow onClick={openEdit}>{tr("Edit details")}</MenuRow>}
          {canManage && <MenuRow onClick={() => setMode("visibility")}>{tr("Change visibility →")}</MenuRow>}
          {canManage && (
            <MenuRow
              onClick={() => {
                setMoveError("");
                setMoveDestId("");
                setMode("move");
                void loadManagedWorkspaces();
              }}
            >
              {tr("Move to another Team →")}
            </MenuRow>
          )}
          {canToggleAnnouncement && (
            <MenuRow
              onClick={() => void toggleAnnouncement()}
              disabled={busy}
              selected={isAnnouncement}
            >
              {busy ? tr("Saving…") : tr("Announcement channel")}
            </MenuRow>
          )}
          {canCreate && (
            <MenuRow onClick={() => void duplicate()} disabled={busy}>
              {busy ? tr("Duplicating…") : tr("Duplicate")}
            </MenuRow>
          )}
          <MenuRow onClick={() => void exportCsv()} disabled={busy}>{busy ? tr("Exporting…") : tr("Export CSV")}</MenuRow>
          <PermissionGate permission="omnipulse.boards.delete">
            <MenuRow onClick={() => { setOpen(false); router.push(`/omnipulse/boards/${board.id}?settings=1`); }}>
              {tr("Show archive →")}
            </MenuRow>
          </PermissionGate>
          {canManage && (
            <>
              <div style={dividerStyle} />
              {isArchived ? (
                <MenuRow onClick={() => void setArchived(true)} disabled={busy}>{tr("Restore project")}</MenuRow>
              ) : (
                <MenuRow danger onClick={() => { setError(""); setOpen(false); setConfirm("archive"); }}>{tr("Archive project")}</MenuRow>
              )}
            </>
          )}
          {error && <div style={menuErrorStyle}>{error}</div>}
        </div>
      )}

      {/* Visibility submenu */}
      {open && mode === "visibility" && (
        <div style={menuStyle} onClick={(e) => e.stopPropagation()}>
          <div style={captionStyle}>{tr("Visibility")}</div>
          {projectVisibilitySelectOptions({ includeEveryone: isAdmin }).map((opt) => (
            <MenuRow
              key={opt.value}
              onClick={() => void chooseVisibility(opt.value)}
              disabled={busy}
              selected={(board.visibility_type || PROJECT_VISIBILITY.TEAM) === opt.value}
            >
              {opt.label}
            </MenuRow>
          ))}
          {error && <div style={menuErrorStyle}>{error}</div>}
          <div style={dividerStyle} />
          <MenuRow onClick={() => setMode("menu")}>{tr("← Back")}</MenuRow>
        </div>
      )}

      {open && mode === "team" && (
        <div style={menuStyle} onClick={(e) => e.stopPropagation()}>
          <div style={captionStyle}>{tr("Select team")}</div>
          <div style={{ padding: "6px 10px" }}>
            <CustomSelect
              value={workspaceId}
              onChange={setWorkspaceId}
              options={workspaceOptions.map((workspace) => ({ value: workspace.id, label: workspace.name }))}
              placeholder={loadingWorkspaces ? "Loading teams..." : "Choose a team"}
              disabled={loadingWorkspaces}
            />
          </div>
          {error && <div style={menuErrorStyle}>{error}</div>}
          <MenuRow
            onClick={() => void changeVisibility(pendingVisibility, workspaceId)}
            disabled={busy || loadingWorkspaces || !workspaceId}
          >
            {busy ? tr("Saving...") : tr("Save")}
          </MenuRow>
          <div style={dividerStyle} />
          <MenuRow onClick={() => setMode("visibility")}>{tr("Back")}</MenuRow>
        </div>
      )}

      {/* Move-to-team submenu: pick the destination, then run the preflight
          before ever opening MoveProjectDialog. */}
      {open && mode === "move" && (
        <div style={menuStyle} onClick={(e) => e.stopPropagation()}>
          <div style={captionStyle}>{tr("Move to team")}</div>
          <div style={{ padding: "6px 10px" }}>
            <CustomSelect
              value={moveDestId}
              onChange={setMoveDestId}
              options={workspaceOptions.map((workspace) => ({ value: workspace.id, label: workspace.name }))}
              placeholder={loadingWorkspaces ? "Loading teams..." : "Choose a destination team"}
              disabled={loadingWorkspaces || movePreflightLoading}
            />
          </div>
          {moveError && <div style={menuErrorStyle}>{moveError}</div>}
          <MenuRow
            onClick={() => void loadMovePreflight(moveDestId)}
            disabled={movePreflightLoading || loadingWorkspaces || !moveDestId}
          >
            {movePreflightLoading ? tr("Checking…") : tr("Continue")}
          </MenuRow>
          <div style={dividerStyle} />
          <MenuRow onClick={() => setMode("menu")}>{tr("← Back")}</MenuRow>
        </div>
      )}

      {/* Move-to-team confirmation — asks what to do with members + labels
          before the move executes. Rendered independent of `open` (the
          dropdown menu closes once this opens) via its own portal. */}
      {moveDialog && (
        <MoveProjectDialog
          boardId={board.id}
          boardName={board.name}
          destWorkspaceId={moveDialog.destWorkspaceId}
          destTeamName={moveDialog.destTeamName}
          preflight={moveDialog.preflight}
          onClose={() => setMoveDialog(null)}
          onMoved={() => {
            setMoveDialog(null);
            router.refresh();
          }}
        />
      )}

      {/* Archive confirm */}
      <ConfirmDialog
        open={confirm === "archive"}
        title={`Archive ${board.name}?`}
        description={
          error ||
          "The project is archived and leaves the projects list. Tick “Show archived” under FILTERS to find it again, then Restore it from the project actions."
        }
        confirmLabel={tr("Archive")}
        confirmTone="danger"
        busy={busy}
        onCancel={() => { if (!busy) { setConfirm(null); setError(""); } }}
        onConfirm={() => setArchived(false)}
      />

      {/* Edit details modal */}
      {open && mode === "edit" && (
        <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div role="dialog" aria-modal="true" style={dialogStyle} onClick={(e) => e.stopPropagation()}>
            <div style={dialogBodyStyle}>
              <input
                ref={nameRef}
                value={name}
                maxLength={BOARD_NAME_MAX}
                onChange={(e) => setName(clampToMaxLength(e.target.value, BOARD_NAME_MAX))}
                onKeyDown={(e) => { if (e.key === "Enter") void saveDetails(); }}
                placeholder={tr("Project name")}
                style={titleInputStyle}
              />
              {error && <div style={errorStyle}>{error}</div>}
              <label style={labelStyle}>{tr("Description")}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={tr("What is this project for?")}
                style={textareaStyle}
              />
              {canManage && (
                <>
                  <label style={labelStyle}>{tr("Project lead")}</label>
                  <CustomSelect
                    value={projectLeadId}
                    onChange={setProjectLeadId}
                    options={[
                      { value: "", label: "— No lead —" },
                      ...leadOptions.map((u) => ({ value: u.id, label: u.name })),
                    ]}
                    placeholder={loadingLeads ? "Loading members..." : "— No lead —"}
                    disabled={loadingLeads}
                  />
                </>
              )}
              <div style={{ marginTop: 14 }}>
                <AcharyaPicker
                  value={acharyaId}
                  onChange={setAcharyaId}
                />
              </div>
              <label style={labelStyle}>{tr("Color")}</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {LIST_COLOR_PALETTE.map((c) => {
                  const selected = (color || "").toLowerCase() === c.value.toLowerCase();
                  return (
                    <button
                      key={c.value}
                      type="button"
                      title={c.name}
                      aria-label={c.name}
                      onClick={() => setColor(c.value)}
                      style={{
                        width: 28, height: 28, borderRadius: "50%", cursor: "pointer",
                        background: c.value, borderWidth: 2, borderStyle: "solid",
                        borderColor: selected ? "var(--ink)" : "transparent",
                        boxShadow: selected ? "0 0 0 2px var(--surface)" : "none", outline: "none", flexShrink: 0,
                      }}
                    />
                  );
                })}
              </div>
            </div>
            {/* Sticky footer — Project lead + acharya made the form taller than
                the viewport, which used to clip Save while Cancel still showed. */}
            <div style={dialogFooterStyle}>
              <button type="button" onClick={() => setOpen(false)} disabled={busy} style={cancelBtnStyle}>{tr("Cancel")}</button>
              <button type="button" onClick={() => void saveDetails()} disabled={busy || !name.trim()} style={saveBtnStyle}>
                {busy ? tr("Saving…") : tr("Save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuRow({ children, onClick, disabled, danger, selected }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean; selected?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
        padding: "8px 12px", fontSize: 13, fontFamily: "var(--sans)", textAlign: "left",
        border: "none", cursor: disabled ? "default" : "pointer",
        background: hover && !disabled ? "var(--surface-sunk)" : "transparent",
        color: danger ? "var(--crit)" : "var(--ink-soft)", opacity: disabled ? 0.6 : 1,
      }}
    >
      <span>{children}</span>
      {selected && (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--green-deep)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </button>
  );
}

const menuStyle: CSSProperties = {
  position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 1000, minWidth: 200,
  background: "var(--surface)", border: "1px solid var(--rule)", borderRadius: "var(--r-md)",
  boxShadow: "var(--shadow-md)", padding: "4px 0",
};
const dividerStyle: CSSProperties = { height: 1, background: "var(--rule)", margin: "4px 0" };
const captionStyle: CSSProperties = {
  padding: "6px 12px 4px", fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.1em",
  textTransform: "uppercase", color: "var(--ink-mute)",
};
const menuErrorStyle: CSSProperties = {
  padding: "4px 12px", fontSize: 11, color: "var(--crit)",
};
const overlayStyle: CSSProperties = {
  position: "fixed", inset: 0, zIndex: 1100, background: "rgba(35,29,20,0.45)",
  display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px",
  // Allow the dialog to scroll within the overlay when the viewport is short.
  overflowY: "auto",
};
const dialogStyle: CSSProperties = {
  width: "100%",
  maxWidth: 460,
  maxHeight: "min(90vh, calc(100dvh - 48px))",
  display: "flex",
  flexDirection: "column",
  background: "var(--surface)",
  border: "1px solid var(--rule)",
  borderRadius: "var(--r-lg)",
  boxShadow: "var(--shadow-md)",
  padding: 0,
  boxSizing: "border-box",
  margin: "auto",
  overflow: "hidden",
};
const dialogBodyStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  padding: "22px 24px 8px",
};
const dialogFooterStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  justifyContent: "flex-end",
  flexShrink: 0,
  padding: "12px 24px 18px",
  borderTopWidth: 1,
  borderTopStyle: "solid",
  borderTopColor: "var(--rule)",
  background: "var(--surface)",
};
const titleInputStyle: CSSProperties = {
  width: "100%", padding: "6px 10px", fontSize: 20, fontWeight: 600,
  fontFamily: "var(--serif)", color: "var(--ink)", boxSizing: "border-box",
  background: "var(--page)", border: "1px solid var(--rule-strong)", borderRadius: "var(--r-sm)",
};
const labelStyle: CSSProperties = {
  display: "block", fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.1em",
  textTransform: "uppercase", color: "var(--ink-mute)", margin: "16px 0 6px",
};
const textareaStyle: CSSProperties = {
  width: "100%", minHeight: 64, padding: 10, fontSize: 13, fontFamily: "var(--sans)",
  border: "1px solid var(--rule-strong)", borderRadius: "var(--r-sm)",
  background: "var(--page)", color: "var(--ink)", resize: "vertical", boxSizing: "border-box",
};
const errorStyle: CSSProperties = {
  color: "var(--crit)", fontSize: 13, marginTop: 12, padding: "8px 12px",
  background: "var(--crit-wash)", borderRadius: "var(--r-sm)",
};
const saveBtnStyle: CSSProperties = {
  padding: "8px 18px", fontSize: 12, fontWeight: 600, background: "var(--green-deep)",
  color: "#f4efdf", border: "1px solid var(--green-deep)", borderRadius: "var(--r-sm)",
  cursor: "pointer", fontFamily: "var(--sans)",
};
const cancelBtnStyle: CSSProperties = {
  padding: "8px 14px", fontSize: 12, fontWeight: 500, background: "transparent",
  color: "var(--ink-soft)", border: "1px solid var(--rule-strong)", borderRadius: "var(--r-sm)",
  cursor: "pointer", fontFamily: "var(--sans)",
};
