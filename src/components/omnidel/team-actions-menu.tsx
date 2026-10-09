"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { LIST_COLOR_PALETTE } from "@/components/omnidel/task-board";
import { ConfirmDialog } from "@/components/omnidel/confirm-dialog";
import { fetchJson, FetchError } from "@/lib/client/fetch-json";
import { useTr } from "@/lib/client/language";
import { PermissionGate } from "@/lib/client/permissions";

// ============================================================================
// Team (workspace) actions menu — rendered on each team card in the teams grid.
// A single 3-dot menu: Rename (name + slug), Team Settings (description / color
// / icon_hint / visibility), Activate / Deactivate (is_active flip), Delete.
//
// All ops hit /api/omnipulse/workspaces/<id> via fetchJson; FetchError messages
// are surfaced inline. Destructive rows are hidden for system / protected teams
// (the API 403s authoritatively; this is the UI-side secondary defence). The
// whole menu is gated on canManage, passed from the server (global admin
// bypass OR workspace manager). Managers are shown the menu optimistically and
// rely on the API gate — surfaced errors cover any 403 mismatch.
//
// Styling mirrors BoardEditButton: 3-dot trigger, dropdown menu, edit modal.
// ============================================================================

type Visibility = "public" | "private";
type Mode = "menu" | "rename" | "settings";

const VIS_LABEL: Record<Visibility, string> = {
  public: "Discoverable by anyone with module access",
  private: "Visible only to members",
};

export interface TeamActionTarget {
  id: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  color?: string | null;
  icon_hint?: string | null;
  visibility?: Visibility;
  is_system?: boolean;
  is_protected?: boolean;
  is_active?: boolean;
}

export function TeamActionsMenu({ team }: { team: TeamActionTarget }) {
  const tr = useTr();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("menu");
  const [confirm, setConfirm] = useState<null | "deactivate" | "delete">(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState(team.name);
  const [slug, setSlug] = useState(team.slug || "");
  const [description, setDescription] = useState(team.description || "");
  const [color, setColor] = useState(team.color || "");
  const [iconHint, setIconHint] = useState(team.icon_hint || "");
  const [visibility, setVisibility] = useState<Visibility>(team.visibility || "public");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const nameRef = useRef<HTMLInputElement | null>(null);

  const isSystem = !!team.is_system;
  const isInactive = team.is_active === false;

  useEffect(() => {
    if (open) return;
    setMode("menu");
    setBusy(false);
    setError("");
  }, [open]);

  useEffect(() => {
    if (!open || mode !== "menu") return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, mode]);

  function openMode(m: "rename" | "settings") {
    setName(team.name);
    setSlug(team.slug || "");
    setDescription(team.description || "");
    setColor(team.color || "");
    setIconHint(team.icon_hint || "");
    setVisibility(team.visibility || "public");
    setError("");
    setMode(m);
    setTimeout(() => nameRef.current?.focus(), 50);
  }

  async function patchTeam(body: Record<string, unknown>): Promise<boolean> {
    setBusy(true); setError("");
    try {
      await fetchJson(`/api/omnipulse/workspaces/${team.id}`, {
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

  async function saveRename() {
    if (!name.trim()) { setError("Name is required."); return; }
    const body: Record<string, unknown> = { name: name.trim() };
    if (slug.trim()) body.slug = slug.trim();
    const ok = await patchTeam(body);
    if (ok) { setOpen(false); router.refresh(); }
  }

  async function saveSettings() {
    const ok = await patchTeam({
      description: description.trim(),
      color: color || null,
      icon_hint: iconHint.trim() || null,
      visibility,
    });
    if (ok) { setOpen(false); router.refresh(); }
  }

  async function setArchived(active: boolean) {
    const ok = await patchTeam({ is_active: active });
    if (ok) { setConfirm(null); setOpen(false); router.refresh(); }
  }

  async function deleteTeam() {
    setBusy(true); setError("");
    try {
      await fetchJson(`/api/omnipulse/workspaces/${team.id}`, { method: "DELETE" });
      setConfirm(null);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof FetchError ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  const [hover, setHover] = useState(false);

  return (
    <PermissionGate permission="omnipulse.workspaces.manage">
      <div ref={wrapRef} style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        title={tr("Team actions")}
        aria-label={`Actions for ${team.name}`}
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
          {!isSystem && <MenuRow onClick={() => openMode("rename")}>{tr("Rename")}</MenuRow>}
          <MenuRow onClick={() => openMode("settings")}>{tr("Team settings")}</MenuRow>
          {!isSystem && (
            <>
              <div style={dividerStyle} />
              {isInactive ? (
                <MenuRow onClick={() => void setArchived(true)} disabled={busy}>{tr("Activate team")}</MenuRow>
              ) : (
                <MenuRow onClick={() => { setError(""); setOpen(false); setConfirm("deactivate"); }}>{tr("Deactivate team")}</MenuRow>
              )}
              <MenuRow danger onClick={() => { setError(""); setOpen(false); setConfirm("delete"); }}>
                {tr("Delete team")}
              </MenuRow>
            </>
          )}
          {error && <div style={menuErrorStyle}>{error}</div>}
        </div>
      )}

      {/* Rename modal */}
      {open && mode === "rename" && (
        <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div role="dialog" aria-modal="true" style={dialogStyle} onClick={(e) => e.stopPropagation()}>
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void saveRename(); }}
              placeholder={tr("Team name")}
              style={titleInputStyle}
            />
            <label style={labelStyle}>{tr("Slug")}</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="team-slug"
              style={textInputStyle}
            />
            {error && <div style={errorStyle}>{error}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setOpen(false)} disabled={busy} style={cancelBtnStyle}>{tr("Cancel")}</button>
              <button type="button" onClick={() => void saveRename()} disabled={busy || !name.trim()} style={saveBtnStyle}>
                {busy ? tr("Saving…") : tr("Save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings modal */}
      {open && mode === "settings" && (
        <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div role="dialog" aria-modal="true" style={dialogStyle} onClick={(e) => e.stopPropagation()}>
            <label style={labelStyle}>{tr("Description")}</label>
            <textarea
              autoFocus
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={tr("What is this team for?")}
              style={textareaStyle}
            />
            <label style={labelStyle}>{tr("Icon hint")}</label>
            <input
              value={iconHint}
              onChange={(e) => setIconHint(e.target.value)}
              placeholder={tr("e.g. users, briefcase")}
              style={textInputStyle}
            />
            {!isSystem && (
              <>
                <label style={labelStyle}>{tr("Visibility")}</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {(["public", "private"] as Visibility[]).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setVisibility(v)}
                      style={{
                        textAlign: "left", padding: "8px 10px", fontSize: 12.5, cursor: "pointer",
                        background: visibility === v ? "var(--surface-sunk)" : "transparent",
                        border: `1px solid ${visibility === v ? "var(--rule-strong)" : "var(--rule)"}`,
                        borderRadius: "var(--r-sm)", color: "var(--ink-soft)", fontFamily: "var(--sans)",
                      }}
                    >
                      <strong style={{ color: "var(--ink)", textTransform: "capitalize" }}>{v}</strong>
                      <span style={{ display: "block", color: "var(--ink-mute)", marginTop: 2 }}>{VIS_LABEL[v]}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
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
            {error && <div style={errorStyle}>{error}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setOpen(false)} disabled={busy} style={cancelBtnStyle}>{tr("Cancel")}</button>
              <button type="button" onClick={() => void saveSettings()} disabled={busy} style={saveBtnStyle}>
                {busy ? tr("Saving…") : tr("Save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate confirm */}
      <ConfirmDialog
        open={confirm === "deactivate"}
        title={`Deactivate ${team.name}?`}
        description={
          error ||
          "The team becomes inactive but remains available for activation later."
        }
        confirmLabel={tr("Deactivate")}
        confirmTone="primary"
        busy={busy}
        onCancel={() => { if (!busy) { setConfirm(null); setError(""); } }}
        onConfirm={() => setArchived(false)}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        title={`Delete ${team.name}?`}
        description={
          error ||
          "This archives the team with a soft delete. Its records are kept, but it disappears from standard team lists."
        }
        confirmLabel={tr("Delete")}
        confirmTone="danger"
        busy={busy}
        onCancel={() => { if (!busy) { setConfirm(null); setError(""); } }}
        onConfirm={() => deleteTeam()}
      />
      </div>
    </PermissionGate>
  );
}

function MenuRow({ children, onClick, disabled, danger }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean;
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
    </button>
  );
}

const menuStyle: CSSProperties = {
  position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 1000, minWidth: 200,
  background: "var(--surface)", border: "1px solid var(--rule)", borderRadius: "var(--r-md)",
  boxShadow: "var(--shadow-md)", padding: "4px 0",
};
const dividerStyle: CSSProperties = { height: 1, background: "var(--rule)", margin: "4px 0" };
const menuErrorStyle: CSSProperties = { padding: "4px 12px", fontSize: 11, color: "var(--crit)" };
const overlayStyle: CSSProperties = {
  position: "fixed", inset: 0, zIndex: 1100, background: "rgba(35,29,20,0.45)",
  display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px",
};
const dialogStyle: CSSProperties = {
  width: "100%", maxWidth: 460, background: "var(--surface)", border: "1px solid var(--rule)",
  borderRadius: "var(--r-lg)", boxShadow: "var(--shadow-md)", padding: "22px 24px",
  maxHeight: "85vh", overflowY: "auto",
};
const titleInputStyle: CSSProperties = {
  width: "100%", padding: "6px 10px", fontSize: 20, fontWeight: 600,
  fontFamily: "var(--serif)", color: "var(--ink)", boxSizing: "border-box",
  background: "var(--page)", border: "1px solid var(--rule-strong)", borderRadius: "var(--r-sm)",
};
const textInputStyle: CSSProperties = {
  width: "100%", padding: "8px 10px", fontSize: 13, fontFamily: "var(--sans)",
  color: "var(--ink)", boxSizing: "border-box", background: "var(--page)",
  border: "1px solid var(--rule-strong)", borderRadius: "var(--r-sm)",
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
