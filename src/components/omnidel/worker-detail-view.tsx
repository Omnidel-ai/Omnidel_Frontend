"use client";

import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/omnidel/page-header";
import { PermissionGate } from "@/lib/client/permissions";
import { ConfirmDialog } from "@/components/omnidel/confirm-dialog";
import { WorkerAvatar } from "@/components/omnidel/worker-avatar";
import { SubTabs } from "@/components/omnidel/sub-tabs";
import { FormField, FieldGrid } from "@/components/omnidel/master-form";
import { TableScroll } from "@/components/omnidel/table-scroll";
import { useIsMobile } from "@/lib/client/use-is-mobile";
import { formatScore } from "@/lib/score";
import { useTr } from "@/lib/client/language";

const KARMYOG_ORG_ID = "a0a0a0a0-0000-4000-8000-000000000001";
const WORKER_TABS = ["Profile details", "Report", "History"] as const;
type WorkerTab = (typeof WORKER_TABS)[number];

export type WorkerDetailContext = "omnivarsity" | "admin_pending_setup" | "admin_users";

interface WorkerProfile {
  id: string; user_id: string; slug: string; display_name: string;
  photo_url: string | null; trade: string | null; bio: string | null; city: string | null;
  first_name: string | null; last_name: string | null; email: string | null;
  trade_id: string | null; city_id: string | null;
  address_line: string | null; pincode: string | null;
  trade_master: { name: string } | { name: string }[] | null;
  city_master: { name: string } | { name: string }[] | null;
  is_public: boolean; jobs_done: number; avg_score: number | string | null;
  is_active: boolean; created_on: string;
}

interface LinkRow {
  id: string; org_id: string; user_id: string; status: string;
  initiated_by: string; invited_by_user_id: string | null; workspace_id: string | null;
  responded_on: string | null; ended_on: string | null; created_on: string;
  org?: { name: string; slug: string } | { name: string; slug: string }[] | null;
}

interface ExperienceRow {
  id: string; user_id: string; org_id: string | null; task_id: string | null;
  task_title: string | null; acharya_slug: string | null; evaluation_id: string | null;
  verdict: "approved" | "rejected" | null; score: number | string | null;
  summary: string | null; artifact_url: string | null; occurred_on: string;
}

function scoreLabel(score: number | string | null): string {
  return formatScore(score);
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function orgName(link: LinkRow): string {
  const o = link.org;
  if (!o) return "—";
  const row = Array.isArray(o) ? o[0] : o;
  return row?.name || "—";
}

function masterName(m: { name: string } | { name: string }[] | null | undefined): string | null {
  if (!m) return null;
  const row = Array.isArray(m) ? m[0] : m;
  return row?.name || null;
}

function pageHeaderForContext(context: WorkerDetailContext) {
  if (context === "admin_pending_setup") {
    return {
      moduleSlug: "admin" as const,
      sectionLabel: "Pending setup",
      sectionHref: "/admin/users?tab=pending_setup",
    };
  }
  if (context === "admin_users") {
    return {
      moduleSlug: "admin" as const,
      sectionLabel: "Users & Access",
      sectionHref: "/admin/users",
    };
  }
  return {
    moduleSlug: "omnivarsity" as const,
    sectionKey: "workers" as const,
    sectionHref: "/omnivarsity/workers",
  };
}

export function WorkerDetailView({
  workerId,
  context,
  heroActions,
}: {
  workerId: string;
  context: WorkerDetailContext;
  heroActions?: ReactNode;
}) {
  const tr = useTr();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();
  const showLinkActions = context === "omnivarsity";

  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [experience, setExperience] = useState<ExperienceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const requestIdRef = useRef(0);

  const [activeTab, setActiveTab] = useState<WorkerTab>(() => {
    const t = searchParams.get("tab");
    return t && WORKER_TABS.includes(t as WorkerTab) ? (t as WorkerTab) : "Profile details";
  });

  function changeTab(next: WorkerTab) {
    setActiveTab(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next !== "Profile details") params.set("tab", next);
    else params.delete("tab");
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
  }

  const fetchSheet = useCallback(() => {
    const thisRequest = ++requestIdRef.current;
    setLoading(true);
    fetch(`/api/omnivarsity/workers/${workerId}`)
      .then(r => r.json())
      .then(d => {
        if (thisRequest === requestIdRef.current) {
          setProfile(d.profile || null);
          setLinks(d.links || []);
          setExperience(d.experience || []);
        }
      })
      .catch(() => {
        if (thisRequest === requestIdRef.current) setProfile(null);
      })
      .finally(() => {
        if (thisRequest === requestIdRef.current) setLoading(false);
      });
  }, [workerId]);

  useEffect(() => { fetchSheet(); }, [fetchSheet]);

  const openLink = links.find(
    (l) => l.org_id === KARMYOG_ORG_ID && (l.status === "invited" || l.status === "active"),
  ) || null;
  const linkState: "none" | "invited" | "active" =
    openLink ? (openLink.status === "active" ? "active" : "invited") : "none";

  async function invite() {
    setActionBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/omnivarsity/workers/${workerId}/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.status === 409) {
        setActionError("Already invited or linked.");
      } else if (!res.ok) {
        const d = await res.json().catch(() => null);
        setActionError(d?.error || "Invite failed.");
      }
      fetchSheet();
    } finally {
      setActionBusy(false);
    }
  }

  async function endLink() {
    setActionBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/omnivarsity/workers/${workerId}/link`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end" }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setActionError(d?.error || "Action failed.");
      }
      setConfirmEnd(false);
      fetchSheet();
    } finally {
      setActionBusy(false);
    }
  }

  // Admin → Users & Access exit for a kaarigar: end the KarmYog link, not the
  // account. Same call as "End link" above, but the row leaves Users & Access
  // (which lists linked kaarigars only), so we return to that list.
  async function unlinkKaarigar() {
    setActionBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/omnivarsity/workers/${workerId}/link`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end" }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setActionError(d?.error || "Unlink failed.");
        return;
      }
      setConfirmUnlink(false);
      router.push("/admin/users");
    } finally {
      setActionBusy(false);
    }
  }

  // minmax(0, …) keeps each row’s fr tracks the same width even when domain /
  // org text is long — otherwise RESULT/STATUS badges drift per row on swipe.
  const expCols = "110px minmax(0, 1.6fr) minmax(0, 1fr) 110px 80px minmax(0, 1.6fr)";
  const historyCols = "minmax(0, 1.4fr) 100px 110px 110px 110px";
  const tradeLabel = profile ? (masterName(profile.trade_master) ?? profile.trade) : null;
  const cityLabel = profile ? (masterName(profile.city_master) ?? profile.city) : null;

  return (
    <div>
      <PageHeader
        {...pageHeaderForContext(context)}
        crumbs={[{ label: profile?.display_name || "Worker" }]}
        marginBottom={20}
      />

      {loading && !profile && <div className="table-empty">{tr("Loading...")}</div>}
      {!loading && !profile && <div className="table-empty">{tr("Worker profile not found.")}</div>}

      {profile && (
        <>
          <div style={{
            background: "var(--surface)", border: "1px solid var(--rule)",
            borderRadius: "var(--r-md)", padding: isMobile ? "18px 16px" : "24px 28px",
            marginBottom: 16,
            display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap",
          }}>
            <WorkerAvatar photoUrl={profile.photo_url} name={profile.display_name} size={56} />
            <div style={{ flex: 1, minWidth: 200 }}>
              <h2 style={{
                fontFamily: "var(--serif)", fontSize: 22, fontWeight: 600, marginBottom: 4,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {profile.display_name}
              </h2>
              <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 8 }}>
                {[tradeLabel, cityLabel].filter(Boolean).join(" · ") || tr("No trade or city on record")}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span className="tag" style={{ background: "var(--ok-wash)", color: "var(--ok)" }}>
                  {profile.jobs_done} job{profile.jobs_done === 1 ? "" : "s"} done
                </span>
                <span className="tag" style={{ background: "var(--ok-wash)", color: "var(--ok)" }}>
                  {tr("Avg score")} {scoreLabel(profile.avg_score)}
                </span>
                {linkState === "invited" && (
                  <span className="tag" style={{ background: "var(--ochre-wash)", color: "var(--ochre)" }}>{tr("Invite pending")}</span>
                )}
                {linkState === "active" && (
                  <span className="tag" style={{ background: "var(--ok-wash)", color: "var(--ok)" }}>{tr("Linked")}</span>
                )}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
              {heroActions}
              {context === "admin_users" && (
                <PermissionGate permission="admin.users">
                  <button
                    type="button"
                    onClick={() => setConfirmUnlink(true)}
                    disabled={actionBusy || !profile?.user_id}
                    style={{ ...quietBtnStyle, color: "var(--crit)" }}
                  >
                    {tr("Unlink kaarigar")}
                  </button>
                </PermissionGate>
              )}
              {showLinkActions && (
                <PermissionGate permission="workers.manage">
                  {linkState === "none" && (
                    <button onClick={invite} disabled={actionBusy} style={primaryBtnStyle}>
                      {actionBusy ? tr("Working…") : tr("Invite to KarmYog")}
                    </button>
                  )}
                  {linkState === "invited" && (
                    <button onClick={endLink} disabled={actionBusy} style={quietBtnStyle}>
                      {actionBusy ? tr("Working…") : tr("Cancel invite")}
                    </button>
                  )}
                  {linkState === "active" && (
                    <button onClick={() => setConfirmEnd(true)} disabled={actionBusy} style={{ ...quietBtnStyle, color: "var(--crit)" }}>
                      {tr("End link")}
                    </button>
                  )}
                </PermissionGate>
              )}
              {actionError && (
                <span style={{ fontSize: 12, color: "var(--crit)" }}>{actionError}</span>
              )}
            </div>
          </div>

          <div style={{ marginBottom: 4 }}>
            <SubTabs
              tabs={[...WORKER_TABS]}
              active={activeTab}
              onChange={(t) => changeTab(t as WorkerTab)}
            />
          </div>

          {activeTab === "Profile details" && (
            <div style={profileCardStyle(isMobile)}>
              <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.5, margin: "0 0 20px" }}>
                {tr("Contact, location, and account metadata for this kaarigar profile.")}
              </p>
              <FieldGrid>
                <FormField label={tr("Display name")} value={profile.display_name || ""} readOnly placeholder="—" />
                <FormField label={tr("First name")} value={profile.first_name || ""} readOnly placeholder="—" />
                <FormField label={tr("Last name")} value={profile.last_name || ""} readOnly placeholder="—" />
                <FormField label={tr("Email")} value={profile.email || ""} readOnly placeholder="—" />
                <FormField label={tr("Trade")} value={tradeLabel || ""} readOnly placeholder="—" />
                <FormField label={tr("City")} value={cityLabel || ""} readOnly placeholder="—" />
                <FormField label={tr("Address")} value={profile.address_line || ""} readOnly placeholder="—" />
                <FormField label={tr("Pincode")} value={profile.pincode || ""} readOnly placeholder="—" />
                <FormField
                  label={tr("Slug")}
                  value={profile.slug ? `@${profile.slug}` : ""}
                  readOnly
                  placeholder="—"
                  mono
                />
                <FormField label={tr("Jobs done")} value={String(profile.jobs_done)} readOnly />
                <FormField label={tr("Average score")} value={scoreLabel(profile.avg_score)} readOnly />
                <FormField
                  label={tr("KarmYog link")}
                  value={
                    linkState === "active"
                      ? "Linked"
                      : linkState === "invited"
                        ? "Invite pending"
                        : "Not linked"
                  }
                  readOnly
                />
                <FormField
                  label={tr("Profile visibility")}
                  value={profile.is_public ? "Public" : "Private"}
                  readOnly
                />
                <FormField
                  label={tr("Account status")}
                  value={profile.is_active ? "Active" : "Inactive"}
                  readOnly
                />
                <FormField label={tr("Member since")} value={fmtDate(profile.created_on)} readOnly />
              </FieldGrid>
              <div style={{ marginTop: 20 }}>
                <FormField
                  label={tr("Bio")}
                  value={profile.bio || ""}
                  readOnly
                  textarea
                  rows={4}
                  full
                  placeholder={tr("No bio on record")}
                />
              </div>
            </div>
          )}

          {activeTab === "Report" && (
            <div style={{ marginBottom: 20 }}>
              <TableScroll minWidth={720}>
                <div className="table-header" style={{ gridTemplateColumns: expCols }}>
                  <span>{tr("DATE")}</span>
                  <span>{tr("TASK")}</span>
                  <span>{tr("DOMAIN")}</span>
                  <span>{tr("RESULT")}</span>
                  <span>{tr("SCORE")}</span>
                  <span>{tr("NOTE")}</span>
                </div>
                {experience.map((e) => (
                  <div key={e.id} className="table-row" style={{ gridTemplateColumns: expCols }}>
                    <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{fmtDate(e.occurred_on)}</span>
                    <span style={{
                      fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }} title={e.task_title || undefined}>
                      {e.task_title || (e.task_id ? `Task ${e.task_id.slice(0, 8)}` : "—")}
                    </span>
                    <span style={{
                      color: e.acharya_slug ? "var(--ink)" : "var(--ink-faint)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }} title={e.acharya_slug || undefined}>
                      {e.acharya_slug || "—"}
                    </span>
                    <span>
                      {e.verdict ? (
                        <span className="tag" style={{
                          background: e.verdict === "approved" ? "var(--ok-wash)" : "var(--crit-wash)",
                          color: e.verdict === "approved" ? "var(--ok)" : "var(--crit)",
                        }}>
                          {e.verdict.toUpperCase()}
                        </span>
                      ) : (
                        <span style={{ color: "var(--ink-faint)" }}>—</span>
                      )}
                    </span>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{scoreLabel(e.score)}</span>
                    <span style={{
                      fontSize: 12, color: "var(--ink-soft)", overflow: "hidden",
                      textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }} title={e.summary || undefined}>
                      {e.summary || "—"}
                    </span>
                  </div>
                ))}
                {experience.length === 0 && (
                  <div className="table-empty">{loading ? tr("Loading...") : tr("No task evaluations on this report sheet yet.")}</div>
                )}
              </TableScroll>
            </div>
          )}

          {activeTab === "History" && (
            <div style={{ marginBottom: 20 }}>
              <TableScroll minWidth={640}>
                <div className="table-header" style={{ gridTemplateColumns: historyCols }}>
                  <span>{tr("ORGANISATION")}</span>
                  <span>{tr("STATUS")}</span>
                  <span>{tr("INVITED")}</span>
                  <span>{tr("RESPONDED")}</span>
                  <span>{tr("ENDED")}</span>
                </div>
                {links.map((l) => (
                  <div key={l.id} className="table-row" style={{ gridTemplateColumns: historyCols }}>
                    <span style={{
                      fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }} title={orgName(l)}>
                      {orgName(l)}
                    </span>
                    <span>
                      <span className="tag" style={{
                        background: l.status === "active" ? "var(--ok-wash)" : l.status === "invited" ? "var(--ochre-wash)" : "var(--surface-sunk)",
                        color: l.status === "active" ? "var(--ok)" : l.status === "invited" ? "var(--ochre)" : "var(--ink-mute)",
                      }}>
                        {l.status.toUpperCase()}
                      </span>
                    </span>
                    <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{fmtDate(l.created_on)}</span>
                    <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{fmtDate(l.responded_on)}</span>
                    <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{fmtDate(l.ended_on)}</span>
                  </div>
                ))}
                {links.length === 0 && (
                  <div className="table-empty">{loading ? tr("Loading...") : tr("No org links yet.")}</div>
                )}
              </TableScroll>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmEnd}
        title={tr("End link")}
        description={`End ${profile?.display_name || "this worker"}'s link with KarmYog? Their report sheet stays on their profile, but they will no longer be linked to this org.`}
        confirmLabel={tr("End link")}
        confirmTone="danger"
        busy={actionBusy}
        onCancel={() => setConfirmEnd(false)}
        onConfirm={endLink}
      />

      <ConfirmDialog
        open={confirmUnlink}
        title={tr("Unlink kaarigar?")}
        description={
          profile
            ? `Do you want to unlink "${profile.display_name}" from KarmYog? This ends their current contract with the org and they will be notified. Their profile and login stay active in the Kaarigars directory, so they can be invited again later.`
            : ""
        }
        confirmLabel={tr("Unlink")}
        confirmTone="danger"
        busy={actionBusy}
        onCancel={() => { if (!actionBusy) setConfirmUnlink(false); }}
        onConfirm={unlinkKaarigar}
      />
    </div>
  );
}

function profileCardStyle(isMobile: boolean): React.CSSProperties {
  return {
    background: "var(--surface)",
    border: "1px solid var(--rule)",
    borderRadius: "var(--r-md)",
    padding: isMobile ? "18px 16px" : "28px 32px",
    marginBottom: 16,
  };
}

const primaryBtnStyle: React.CSSProperties = {
  padding: "8px 14px", fontSize: 12, fontWeight: 500,
  background: "var(--green-deep)", color: "#f4efdf",
  border: "1px solid var(--green-deep)", borderRadius: "var(--r-sm)",
  cursor: "pointer", fontFamily: "var(--sans)",
};

const quietBtnStyle: React.CSSProperties = {
  padding: "8px 14px", fontSize: 12, fontWeight: 500,
  background: "var(--surface)", color: "var(--ink-soft)",
  border: "1px solid var(--rule-strong)", borderRadius: "var(--r-sm)",
  cursor: "pointer", fontFamily: "var(--sans)",
};
