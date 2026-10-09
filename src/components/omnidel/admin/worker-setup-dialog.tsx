"use client";

import { useEffect, useMemo, useState } from "react";
import { CustomSelect } from "@/components/omnidel/custom-select";
import { useTr } from "@/lib/client/language";

export interface PendingSetupLink {
  link_id: string;
  user_id: string;
  profile_id: string;
  display_name: string;
  phone: string | null;
  trade: string | null;
  approved_on: string;
}

interface RoleOption {
  id: string;
  slug: string;
  name: string;
}

interface BranchOption {
  id: string;
  label: string;
}

interface WorkspaceOption {
  id: string;
  slug: string;
  name: string;
  is_system: boolean;
  is_protected: boolean;
}

export function WorkerSetupDialog({
  link,
  roles,
  branches,
  workspaces,
  onClose,
  onDone,
}: {
  link: PendingSetupLink;
  roles: RoleOption[];
  branches: BranchOption[];
  workspaces: WorkspaceOption[];
  onClose: () => void;
  onDone: () => void;
}) {
  const tr = useTr();
  const karigarRoleId = useMemo(() => roles.find((r) => r.slug === "karigar")?.id || "", [roles]);
  const [roleId, setRoleId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [primaryWorkspaceId, setPrimaryWorkspaceId] = useState("");
  const [workspaceIds, setWorkspaceIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRoleId(karigarRoleId || roles[0]?.id || "");
  }, [karigarRoleId, roles]);

  function toggleWorkspace(id: string) {
    setWorkspaceIds((prev) => (prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]));
  }

  const primaryCandidates = workspaces.filter((w) => !w.is_system);

  async function handleSave() {
    setError("");
    if (!roleId) {
      setError("Role is required.");
      return;
    }
    const effectiveIds = [...workspaceIds];
    if (primaryWorkspaceId && !effectiveIds.includes(primaryWorkspaceId)) {
      effectiveIds.push(primaryWorkspaceId);
    }
    if (effectiveIds.length === 0) {
      setError("Select at least one team membership or a primary team.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/omnivarsity/workers/links/${link.link_id}/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role_id: roleId,
          branch_id: branchId || null,
          primary_workspace_id: primaryWorkspaceId || null,
          workspace_ids: effectiveIds,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Worker setup failed.");
        return;
      }
      onDone();
    } catch {
      setError("Worker setup failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card" style={{ width: 560 }}>
        <h3 style={{ fontFamily: "var(--serif)", marginBottom: 8 }}>{tr("Set up kaarigar")}</h3>
        <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 16 }}>
          {link.display_name}
          {link.phone ? <span style={{ color: "var(--ink-mute)" }}> · {link.phone}</span> : null}
        </div>

        {error && <div className="form-error">{error}</div>}

        <div style={{ display: "grid", gap: 12 }}>
          <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div>
              <label className="form-label">{tr("Role *")}</label>
              <CustomSelect
                value={roleId}
                onChange={setRoleId}
                options={roles.map((r) => ({ value: r.id, label: r.name }))}
                placeholder={tr("Select role")}
              />
            </div>
            <div>
              <label className="form-label">{tr("Branch")}</label>
              <CustomSelect
                value={branchId}
                onChange={setBranchId}
                options={[{ value: "", label: "No branch" }, ...branches.map((b) => ({ value: b.id, label: b.label }))]}
                placeholder={tr("Select branch")}
              />
            </div>
          </div>

          <div>
            <label className="form-label">{tr("Primary Team")}</label>
            <CustomSelect
              value={primaryWorkspaceId}
              onChange={setPrimaryWorkspaceId}
              placeholder={tr("No primary team")}
              options={[
                { value: "", label: "No primary team" },
                ...primaryCandidates.map((w) => ({ value: w.id, label: w.name })),
              ]}
            />
            <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 4 }}>
              {tr("Default team the kaarigar lands in. Only non-system teams are listed.")}
            </div>
          </div>

          <div>
            <label className="form-label">{tr("Team Memberships *")}</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {workspaces.length === 0 && (
                <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{tr("No teams configured")}</span>
              )}
              {workspaces.map((w) => {
                const selected = workspaceIds.includes(w.id) || w.id === primaryWorkspaceId;
                const disabled = w.id === primaryWorkspaceId;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => !disabled && toggleWorkspace(w.id)}
                    title={disabled ? "Already set as primary team" : w.is_system ? "Auto-managed team" : ""}
                    style={{
                      padding: "4px 10px",
                      fontSize: 12,
                      fontFamily: "var(--sans)",
                      background: selected ? "var(--green-wash)" : "var(--surface)",
                      color: selected ? "var(--green-deep)" : "var(--ink-soft)",
                      border: `1px solid ${selected ? "var(--green-deep)" : "var(--rule)"}`,
                      borderRadius: "var(--r-sm)",
                      cursor: disabled ? "not-allowed" : "pointer",
                      opacity: disabled ? 0.4 : 1,
                    }}
                  >
                    {w.name}
                    {w.is_system && (
                      <span style={{ marginLeft: 4, fontSize: 9, color: "var(--ochre)", textTransform: "uppercase" }}>sys</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <button className="btn-secondary" onClick={onClose} disabled={saving}>{tr("Cancel")}</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? tr("Saving...") : tr("Complete setup")}
          </button>
        </div>
      </div>
    </div>
  );
}
