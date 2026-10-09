"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { CustomSelect } from "@/components/omnidel/custom-select";
import { AcharyaPicker } from "@/components/omnidel/acharya-picker";
import {
  MemberMultiSelect,
  normalizeMemberOptions,
  type MemberOption,
} from "@/components/omnidel/member-multi-select";
import { clampToMaxLength, BOARD_NAME_MAX } from "@/lib/field-limits";
import {
  PROJECT_VISIBILITY,
  type ProjectVisibility,
  isTeamScopedProject,
  projectVisibilityCopy,
  projectVisibilitySelectOptions,
  formatBoardVisibilityError,
} from "@/lib/project-visibility";
import { usePermissions } from "@/lib/client/permissions";
import { DEFAULT_TEMPLATE_CARDS, ensureReviewTemplateCard } from "@/lib/board-template-cards";
import { useTr } from "@/lib/client/language";

// ============================================================================
// CreateBoardModal — board creation as a pop modal (replaces /boards/new page).
//
// Visibility-first flow:
//   1. Pick visibility. Options depend on the caller's role:
//        • Private — ALWAYS available (any user can make a private board).
//        • Team    — only if the user manages ≥1 workspace; shows a dropdown of
//                    the workspaces they manage (the board's parent team).
//        • All      — org-wide; only if the user manages ≥1 workspace.
//   2. Private → org-user member picker (members can be ANY org user, the
//      creator is added as manager automatically server-side).
//   3. Team/All anchor to a workspace for module inheritance: Team uses the
//      chosen managed workspace; Private/All anchor to the user's home
//      (current) workspace.
//
// POSTs /api/omnipulse/boards with { visibility, workspace_id, member_ids?,
// name, slug, description, mission_id?, seed_cards? }. The route enforces the
// same gating server-side (private=any, team=manage chosen ws, org=manage any).
// ============================================================================

type Visibility = ProjectVisibility;

interface WorkspaceOption {
  id: string;
  name: string;
  role?: "member" | "manager";
  acharya_id?: string | null;
}

interface SeedCard {
  name: string;
  color?: string | null;
}

interface OrderedSeedCard extends SeedCard {
  id: string;
  selected: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  // Called after a successful create with the new board id. Default behaviour
  // (if omitted) routes to the new board.
  onCreated?: (boardId: string) => void;
  // When set, the board is pre-scoped to this team: visibility defaults to
  // "workspace", the team is anchored to it, and the Team picker is locked
  // (shown read-only) so the user can't re-pick a team they already chose.
  // Falls back to a Restricted board in this team when the user can't publish
  // team-wide (isn't a manager of it).
  presetWorkspaceId?: string;
  presetWorkspaceName?: string;
}

function MoveUpIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path d="M12 19V5M6 13l6-6 6 6" />
    </svg>
  );
}

function MoveDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path d="M12 5v14M6 11l6 6 6-6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0 }} aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function deriveSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export function CreateBoardModal({ open, onClose, onCreated, presetWorkspaceId, presetWorkspaceName }: Props) {
  const tr = useTr();
  const router = useRouter();
  const { isAdmin, userId } = usePermissions();

  const [managedWorkspaces, setManagedWorkspaces] = useState<WorkspaceOption[]>([]);
  const [orgUsers, setOrgUsers] = useState<MemberOption[]>([]);
  const [teamMemberIds, setTeamMemberIds] = useState<Set<string>>(new Set());
  const [missions, setMissions] = useState<{ id: string; name_en: string }[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<Visibility>(PROJECT_VISIBILITY.TEAM);
  const [teamWorkspaceId, setTeamWorkspaceId] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [guestIds, setGuestIds] = useState<string[]>([]);
  const [missionId, setMissionId] = useState("");
  const [acharyaId, setAcharyaId] = useState<string | null>(null);
  // Project lead. Options come from the anchor team's members when the project
  // is team-scoped (a lead who isn't on the team couldn't review its work, and
  // the server rejects it), and fall back to org users for detached
  // Private/Everyone projects.
  const [projectLeadId, setProjectLeadId] = useState("");
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string }[]>([]);
  const [loadingTeamMembers, setLoadingTeamMembers] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // AI seed-card suggestions (carried over from the old /boards/new page).
  // listSeedMode: none = default template on create; suggested = send selected
  // AI cards; template = user discarded AI and asked for mst default lists.
  const [orderedCards, setOrderedCards] = useState<OrderedSeedCard[]>([]);
  const [templateCards, setTemplateCards] = useState<SeedCard[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [listSeedMode, setListSeedMode] = useState<"none" | "suggested" | "template">("none");
  const [suggestSource, setSuggestSource] = useState<"ai" | "fallback" | "template" | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const fetchGenRef = useRef(0);

  const canPublishToTeams = managedWorkspaces.length > 0;
  // When pre-scoped, team-wide visibility is only offered if the user manages
  // THE preset team (org-wide still only needs managing any team). Without a
  // preset this collapses to the original all-or-nothing behaviour.
  const managesPresetTeam = presetWorkspaceId
    ? managedWorkspaces.some((w) => w.id === presetWorkspaceId)
    : canPublishToTeams;
  const presetTeamName =
    presetWorkspaceName ||
    managedWorkspaces.find((w) => w.id === presetWorkspaceId)?.name ||
    "this team";

  // Reset on open + load metadata.
  useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
    // Pre-scoped create defaults to team-wide; corrected to Restricted after
    // metadata loads if the user can't manage the preset team.
    setVisibility(presetWorkspaceId ? PROJECT_VISIBILITY.TEAM : PROJECT_VISIBILITY.PRIVATE);
    setTeamWorkspaceId(presetWorkspaceId ?? "");
    setMemberIds([]);
    setGuestIds([]);
    setMissionId("");
    setAcharyaId(null);
    setTeamMemberIds(new Set());
    setProjectLeadId("");
    setTeamMembers([]);
    setOrderedCards([]);
    setTemplateCards([]);
    setShowSuggestions(false);
    setListSeedMode("none");
    setSuggestSource(null);
    setSuggestError(null);
    setError(null);
    setTimeout(() => titleInputRef.current?.focus(), 50);

    let cancelled = false;
    setLoadingMeta(true);
    (async () => {
      try {
        const [wsRes, missionsRes, optionsRes] = await Promise.all([
          fetch("/api/omnipulse/workspaces"),
          fetch("/api/omnipulse/missions"),
          fetch("/api/omnipulse/tasks/options"),
        ]);
        if (cancelled) return;

        const wsData = wsRes.ok ? await wsRes.json() : { items: [] };
        const allWs = (wsData.items || []) as WorkspaceOption[];
        const managed = allWs.filter((w) => w.role === "manager");
        setManagedWorkspaces(managed);
        // Pre-scoped create anchors to the preset team; otherwise default the
        // team picker to the first team the user manages.
        if (presetWorkspaceId) {
          setTeamWorkspaceId(presetWorkspaceId);
          // Can't publish team-wide to a team you don't manage — fall back to a
          // Restricted board (still anchored to that team via homeWorkspaceId).
          if (!managed.some((w) => w.id === presetWorkspaceId)) setVisibility(PROJECT_VISIBILITY.PRIVATE);
        } else if (managed.length > 0) {
          setTeamWorkspaceId(managed[0].id);
        }

        const missionsData = missionsRes.ok ? await missionsRes.json() : { items: [] };
        setMissions((missionsData.items || []) as { id: string; name_en: string }[]);

        const optionsData = optionsRes.ok ? await optionsRes.json() : { users: [] };
        // Real fields from Backend #418: primary_workspace_id/name + role {id,slug,name}.
        setOrgUsers(normalizeMemberOptions(optionsData.users));
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Load linked-team roster for Selected Members (default-all) and Team+Guests
  // (outsider pool). Same pattern as OmniStudio guests.
  useEffect(() => {
    if (!open) return;
    if (!isTeamScopedProject(visibility) || !teamWorkspaceId) {
      setTeamMemberIds(new Set());
      return;
    }
    let cancelled = false;
    fetch(`/api/omnipulse/workspaces/${teamWorkspaceId}/members`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => {
        if (cancelled) return;
        const ids = new Set(
          ((d.items || []) as { user_id: string }[])
            .map((m) => m.user_id)
            .filter(Boolean),
        );
        setTeamMemberIds(ids);
        if (visibility === PROJECT_VISIBILITY.TEAM_SELECTED_MEMBERS) {
          // Default-all in-team selection; creator always included.
          const next = [...ids];
          if (userId && !ids.has(userId)) next.unshift(userId);
          setMemberIds(next);
          setGuestIds((prev) => prev.filter((id) => !ids.has(id)));
        } else if (visibility === PROJECT_VISIBILITY.TEAM_GUESTS) {
          // Outsiders only — drop anyone who is on the linked team.
          setGuestIds((prev) => prev.filter((id) => !ids.has(id)));
          setMemberIds([]);
        }
      })
      .catch(() => {
        if (!cancelled) setTeamMemberIds(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [open, visibility, teamWorkspaceId, userId]);

  // Keep keyboard focus inside the form while it is the active modal.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      )).filter((element) => element.tabIndex >= 0);
      if (focusable.length === 0) {
        e.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !dialogRef.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !dialogRef.current.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [open, onClose]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [open]);

  // FLIP reorder animation for suggested cards.
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const prevTops = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const newTops = new Map<string, number>();
    rowRefs.current.forEach((el, id) => newTops.set(id, el.offsetTop));
    if (!reduceMotion) {
      newTops.forEach((newTop, id) => {
        const prevTop = prevTops.current.get(id);
        if (prevTop === undefined || prevTop === newTop) return;
        const el = rowRefs.current.get(id);
        if (!el) return;
        el.getAnimations().forEach((a) => a.cancel());
        el.animate(
          [
            { transform: `translateY(${prevTop - newTop}px)` },
            { transform: "translateY(0)" },
          ],
          { duration: 220, easing: "cubic-bezier(0.32, 0.72, 0, 1)" },
        );
      });
    }
    prevTops.current = newTops;
  });

  const anchorWorkspaceId = isTeamScopedProject(visibility) ? teamWorkspaceId : "";

  // Load the anchor team's members whenever it changes, for the lead picker.
  // Detached (Private/Everyone) projects skip this and pick from org users.
  useEffect(() => {
    if (!open || !anchorWorkspaceId) {
      setTeamMembers([]);
      return;
    }
    let cancelled = false;
    setLoadingTeamMembers(true);
    (async () => {
      try {
        const res = await fetch(`/api/omnipulse/workspaces/${anchorWorkspaceId}/members`);
        if (cancelled) return;
        const data = res.ok ? await res.json() : { items: [] };
        const members = ((data.items || []) as { user_id: string; user_name: string | null }[])
          .map((m) => ({ id: m.user_id, name: m.user_name || "Unnamed" }));
        setTeamMembers(members);
        // A lead picked for a different team can't stay selected.
        setProjectLeadId((cur) => (cur && !members.some((m) => m.id === cur) ? "" : cur));
      } finally {
        if (!cancelled) setLoadingTeamMembers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, anchorWorkspaceId]);

  const leadOptions = anchorWorkspaceId ? teamMembers : orgUsers;

  async function fetchSuggestions() {
    const title = name.trim();
    const desc = description.trim();
    if (title.length < 2) {
      setSuggestError("Enter a project name (at least 2 characters) before suggesting cards.");
      return;
    }
    if (!desc) {
      setSuggestError("Add a description first so AI can suggest cards.");
      return;
    }
    const gen = ++fetchGenRef.current;
    setShowSuggestions(true);
    setLoadingSuggestions(true);
    setSuggestError(null);
    try {
      const res = await fetch("/api/omnipulse/boards/seed-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description: desc }),
      });
      if (gen !== fetchGenRef.current) return;
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load card suggestions");
      const cards = (data.cards || []) as SeedCard[];
      const templates = ensureReviewTemplateCard((data.template_cards || []) as SeedCard[]);
      setTemplateCards(templates);
      setOrderedCards(
        cards.map((c, i) => ({ ...c, id: `${c.name}-${i}-${Date.now()}`, selected: true })),
      );
      setListSeedMode("suggested");
      setSuggestSource(data.source === "ai" ? "ai" : "fallback");
      setSuggestError(data.source !== "ai" && data.message ? String(data.message) : null);
    } catch (e) {
      if (gen !== fetchGenRef.current) return;
      setSuggestError(e instanceof Error ? e.message : String(e));
      const fallback: SeedCard[] = DEFAULT_TEMPLATE_CARDS;
      setOrderedCards(fallback.map((c, i) => ({ ...c, id: `${c.name}-${i}`, selected: true })));
      setListSeedMode("suggested");
      setSuggestSource("fallback");
    } finally {
      if (gen === fetchGenRef.current) setLoadingSuggestions(false);
    }
  }

  async function useTemplateCards() {
    fetchGenRef.current += 1;
    setLoadingSuggestions(false);
    setSuggestError(null);
    setListSeedMode("template");
    setSuggestSource("template");
    setShowSuggestions(true);
    let next = templateCards;
    if (next.length === 0) {
      try {
        const res = await fetch("/api/omnipulse/boards/seed-suggestions");
        const data = res.ok ? await res.json() : { cards: [] };
        next = (data.cards || data.template_cards || []) as SeedCard[];
      } catch {
        next = [];
      }
    }
    next = ensureReviewTemplateCard(next.length > 0 ? next : DEFAULT_TEMPLATE_CARDS);
    setTemplateCards(next);
    setOrderedCards(
      next.map((c, i) => ({ ...c, id: `template-${c.name}-${i}`, selected: true })),
    );
  }

  function toggleCard(id: string) {
    setOrderedCards((prev) => prev.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c)));
  }

  function moveCard(index: number, direction: -1 | 1) {
    setOrderedCards((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function setCardRank(index: number, rank: number) {
    setOrderedCards((prev) => {
      if (prev.length === 0) return prev;
      const clamped = Math.min(Math.max(1, rank), prev.length);
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(clamped - 1, 0, item);
      return next;
    });
  }

  // The workspace the board anchors to (module inheritance): Team → chosen
  // managed workspace; Private/All → home workspace.

  const canSuggest = !loadingSuggestions && name.trim().length >= 2 && description.trim().length > 0;
  const selectedMembersReady =
    visibility !== PROJECT_VISIBILITY.TEAM_SELECTED_MEMBERS ||
    (memberIds.length >= 1 && (!!userId ? memberIds.includes(userId) : true));
  const canSubmit =
    name.trim().length >= 2 &&
    (!isTeamScopedProject(visibility) || !!anchorWorkspaceId) &&
    selectedMembersReady;

  const teamMemberOptions = orgUsers.filter((u) => teamMemberIds.has(u.id));
  const outsiderOptions = orgUsers.filter((u) => !teamMemberIds.has(u.id) && u.id !== userId);

  async function submit() {
    setError(null);
    if (!canSubmit) {
      if (!anchorWorkspaceId) setError("No team to anchor this project to. Ask an admin to add you to a team.");
      else if (visibility === PROJECT_VISIBILITY.TEAM_SELECTED_MEMBERS && memberIds.length < 1) {
        setError(formatBoardVisibilityError("EMPTY_MEMBERS"));
      } else if (
        visibility === PROJECT_VISIBILITY.TEAM_SELECTED_MEMBERS &&
        userId &&
        !memberIds.includes(userId)
      ) {
        setError(formatBoardVisibilityError("CREATOR_MISSING"));
      }
      return;
    }
    const slug = deriveSlug(name);
    if (name.trim().length > BOARD_NAME_MAX) {
      setError(`Project name must be at most ${BOARD_NAME_MAX} characters.`);
      return;
    }
    if (slug.length < 2) {
      setError("Name too short. Use at least 2 letters or numbers.");
      return;
    }
    const seedCards =
      listSeedMode === "suggested"
        ? orderedCards
            .filter((c) => c.selected)
            .map(({ name: cardName, color }) => ({ name: cardName, color }))
        : [];

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        workspace_id: isTeamScopedProject(visibility) ? anchorWorkspaceId : null,
        slug,
        name: name.trim(),
        description: description.trim() || undefined,
        visibility_type: visibility,
        mission_id: missionId || undefined,
        acharya_id: acharyaId,
        project_lead_id: projectLeadId || null,
        seed_cards: seedCards.length > 0 ? seedCards : undefined,
      };
      if (visibility === PROJECT_VISIBILITY.TEAM_SELECTED_MEMBERS) {
        // Canonical: member_ids = in-team Selected; guest_ids = Others.
        // Never send other_ids.
        const members = uniqueIdsWithCreator(memberIds, userId);
        body.member_ids = members;
        body.guest_ids = guestIds.filter((id) => id && !members.includes(id));
      } else if (visibility === PROJECT_VISIBILITY.TEAM_GUESTS) {
        // Same outsider field as Selected Others — guest_ids only.
        body.guest_ids = guestIds;
      } else if (visibility === PROJECT_VISIBILITY.PRIVATE) {
        body.member_ids = memberIds;
      }
      const res = await fetch("/api/omnipulse/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          formatBoardVisibilityError(
            typeof data.code === "string" ? data.code : null,
            typeof data.error === "string" ? data.error : "Create failed",
          ),
        );
      }
      const newId = data.item.id as string;
      if (onCreated) onCreated(newId);
      else router.push(`/omnipulse/boards/${newId}`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const visibilityOptions = projectVisibilitySelectOptions({
    includeEveryone: isAdmin,
    includeTeamScoped: managesPresetTeam,
  });
  const visibilityHelper = projectVisibilityCopy(visibility).helper;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px 16px", overflowY: "auto",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        style={{
          width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto",
          background: "var(--surface)", border: "1px solid var(--rule)",
          borderRadius: "var(--r-md)", boxShadow: "var(--shadow-md)",
          padding: "22px 24px", position: "relative",
        }}
      >
        <button
          onClick={onClose}
          aria-label={tr("Close")}
          style={{
            position: "absolute", top: 14, right: 14, width: 30, height: 30,
            borderRadius: "var(--r-sm)", background: "transparent",
            borderWidth: 0, cursor: "pointer", color: "var(--ink-soft)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, lineHeight: 1,
          }}
        >×</button>

        <div style={{ marginBottom: 16, paddingRight: 40 }}>
          <input
            ref={titleInputRef}
            value={name}
            maxLength={BOARD_NAME_MAX}
            onChange={(e) => setName(clampToMaxLength(e.target.value, BOARD_NAME_MAX))}
            placeholder={tr("Project name")}
            style={{
              width: "100%", padding: "6px 10px", fontSize: 22, fontWeight: 600,
              fontFamily: "var(--serif)", color: "var(--ink)", marginTop: 6,
              background: "var(--page)", border: "1px solid var(--rule-strong)",
              borderRadius: "var(--r-sm)",
            }}
          />
        </div>

        {error && (
          <div style={{
            color: "var(--crit)", fontSize: 13, marginBottom: 16,
            padding: "8px 12px", background: "var(--surface-sunk)", borderRadius: "var(--r-sm)",
          }}>{error}</div>
        )}

        {loadingMeta ? (
          <div style={{ color: "var(--ink-mute)", fontSize: 13, padding: "8px 0" }}>{tr("Loading…")}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={labelStyle}>{tr("Description")}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={tr("Describe the workflow so AI can suggest cards.")}
                style={{
                  width: "100%", minHeight: 64, padding: 10, fontSize: 13,
                  fontFamily: "var(--sans)", border: "1px solid var(--rule-strong)",
                  borderRadius: "var(--r-sm)", background: "var(--page)", color: "var(--ink)",
                  resize: "vertical", boxSizing: "border-box",
                }}
              />
            </div>

            {/* Visibility — asked first, drives the conditional fields below. */}
            <div>
              <label style={labelStyle}>{tr("Visibility")}</label>
              <CustomSelect
                value={visibility}
                onChange={(v) => {
                  const next = v as Visibility;
                  setVisibility(next);
                  if (
                    next !== PROJECT_VISIBILITY.TEAM_SELECTED_MEMBERS &&
                    next !== PROJECT_VISIBILITY.TEAM_GUESTS
                  ) {
                    setGuestIds([]);
                  }
                  if (
                    next !== PROJECT_VISIBILITY.PRIVATE &&
                    next !== PROJECT_VISIBILITY.TEAM_SELECTED_MEMBERS
                  ) {
                    setMemberIds([]);
                  }
                }}
                options={visibilityOptions}
                dropdownMinWidth={280}
              />
              <div style={hintStyle}>{visibilityHelper}</div>
              {!canPublishToTeams && (
                <div style={hintStyle}>
                  {tr("Team projects need workspace-manager rights.")}
                </div>
              )}
              {!isAdmin && (
                <div style={hintStyle}>{tr("Organisation projects are available only to admins and founders.")}</div>
              )}
            </div>

            {/* Team selector — only for team-scoped visibility, listing managed teams.
                Pre-scoped create locks it to the chosen team (read-only). */}
            {isTeamScopedProject(visibility) && (
              <div>
                <label style={labelStyle}>{tr("Team")}</label>
                {presetWorkspaceId ? (
                  <div style={lockedTeamStyle} aria-label={`Team locked to ${presetTeamName}`}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {presetTeamName}
                    </span>
                    <LockIcon />
                  </div>
                ) : (
                  <CustomSelect
                    value={teamWorkspaceId}
                    onChange={(id) => {
                      setTeamWorkspaceId(id);
                      setMemberIds([]);
                      setGuestIds([]);
                    }}
                    options={managedWorkspaces.map((w) => ({ value: w.id, label: w.name }))}
                    dropdownMinWidth={240}
                  />
                )}
                <div style={hintStyle}>
                  {visibility === PROJECT_VISIBILITY.TEAM_SELECTED_MEMBERS
                    ? tr("Project inherits this team's module. Only selected members (and Others) can see it.")
                    : visibility === PROJECT_VISIBILITY.TEAM_GUESTS
                      ? tr("Project inherits this team's module. All team members plus selected Others can see it.")
                      : tr("Project inherits this team's module and is visible to all its members.")}
                </div>
              </div>
            )}
            {/* Pre-scoped Restricted/Everyone create still anchors to the chosen
                team — surface that so the fixed team context stays visible even
                when the Team picker above isn't rendered. */}
            {presetWorkspaceId && !isTeamScopedProject(visibility) && (
              <div style={hintStyle}>{tr("This project will not be attached to")} {presetTeamName}.</div>
            )}

            {/* Selected Members: in-team multi-select (default-all) + Others guest picker. */}
            {visibility === PROJECT_VISIBILITY.TEAM_SELECTED_MEMBERS && (
              <>
                <div style={{ minWidth: 0 }}>
                  <label style={labelStyle}>{tr("Team members")}</label>
                  <MemberMultiSelect
                    value={memberIds}
                    onChange={(ids) => {
                      const next = uniqueIdsWithCreator(ids, userId);
                      setMemberIds(next);
                    }}
                    options={teamMemberOptions.length > 0 ? teamMemberOptions : orgUsers.filter((u) => memberIds.includes(u.id) || u.id === userId)}
                    placeholder={tr("Select team members (all selected by default)")}
                    groupByPrimaryTeam
                    lockedIds={userId ? [userId] : undefined}
                  />
                  <div style={hintStyle}>
                    {tr("Everyone on the linked team starts selected — deselect people who should not see this project. You stay selected as creator.")}
                  </div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <label style={labelStyle}>{tr("Others")}</label>
                  <MemberMultiSelect
                    value={guestIds}
                    onChange={setGuestIds}
                    options={outsiderOptions}
                    placeholder={tr("Add people outside the team (optional)")}
                    groupByPrimaryTeam
                  />
                  <div style={hintStyle}>
                    {tr("People outside the linked team are added as External Guests.")}
                  </div>
                </div>
              </>
            )}

            {/* Team + Guests — outsiders via guest_ids (same field as Selected Others). */}
            {visibility === PROJECT_VISIBILITY.TEAM_GUESTS && (
              <div style={{ minWidth: 0 }}>
                <label style={labelStyle}>{tr("Guests")}</label>
                <MemberMultiSelect
                  value={guestIds}
                  onChange={setGuestIds}
                  options={outsiderOptions}
                  placeholder={tr("Add people outside the team")}
                  groupByPrimaryTeam
                />
                <div style={hintStyle}>
                  {tr("People outside the selected team will be added as External Guests.")}
                </div>
              </div>
            )}

            {/* Private — explicit in-project members (member_ids). */}
            {visibility === PROJECT_VISIBILITY.PRIVATE && (
              <div style={{ minWidth: 0 }}>
                <label style={labelStyle}>{tr("Members")}</label>
                <MemberMultiSelect
                  value={memberIds}
                  onChange={setMemberIds}
                  options={orgUsers}
                  placeholder={tr("Add people (you're added automatically)")}
                  groupByPrimaryTeam
                />
                <div style={hintStyle}>
                  {tr("Only the creator, admins, managers, and selected members can see this project.")}
                </div>
              </div>
            )}

            {visibility === PROJECT_VISIBILITY.EVERYONE && (
              <div style={hintStyle}>
                {tr("Everyone in the organisation will be able to see this project.")}
              </div>
            )}

            <div>
              <label style={labelStyle}>{tr("Project lead")}</label>
              <CustomSelect
                value={projectLeadId}
                onChange={setProjectLeadId}
                options={[
                  { value: "", label: "— No lead —" },
                  ...leadOptions.map((u) => ({ value: u.id, label: u.name })),
                ]}
                placeholder={loadingTeamMembers ? "Loading team members..." : "— No lead —"}
                disabled={loadingTeamMembers}
              />
              <div style={hintStyle}>
                {tr("The lead can review task submissions on this project, alongside the team manager.")}
              </div>
            </div>

            <div>
              <AcharyaPicker
                value={acharyaId}
                onChange={setAcharyaId}
              />
            </div>

            <div>
              <label style={labelStyle}>{tr("Mission it serves")}</label>
              <CustomSelect
                value={missionId}
                onChange={setMissionId}
                options={[
                  { value: "", label: "— No mission —" },
                  ...missions.map((m) => ({ value: m.id, label: m.name_en })),
                ]}
              />
            </div>

            <div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => void fetchSuggestions()}
                  disabled={!canSuggest}
                  style={{
                    padding: "8px 14px", fontSize: 12, fontWeight: 500, fontFamily: "var(--sans)",
                    background: "var(--surface)", color: "var(--green-deep)",
                    borderWidth: 1, borderStyle: "solid", borderColor: "var(--green-deep)",
                    borderRadius: "var(--r-sm)",
                    cursor: canSuggest ? "pointer" : "not-allowed", opacity: canSuggest ? 1 : 0.6,
                  }}
                >
                  {loadingSuggestions ? "Suggesting cards..." : "Suggest cards"}
                </button>
                {(showSuggestions || listSeedMode === "suggested") && (
                  <button
                    type="button"
                    onClick={() => void useTemplateCards()}
                    disabled={listSeedMode === "template"}
                    style={{
                      padding: "8px 14px", fontSize: 12, fontWeight: 500, fontFamily: "var(--sans)",
                      background: "var(--surface)", color: "var(--ink-soft)",
                      border: "1px solid var(--rule-strong)",
                      borderRadius: "var(--r-sm)",
                      cursor: listSeedMode === "template" ? "not-allowed" : "pointer",
                      opacity: listSeedMode === "template" ? 0.6 : 1,
                    }}
                  >
                    Use template cards instead
                  </button>
                )}
              </div>
              {listSeedMode === "template" && (
                <div style={hintStyle}>
                  This project will use the default template cards. Click Suggest cards if you want AI columns.
                </div>
              )}
            </div>

            {showSuggestions && (
              <div style={{
                padding: 16, background: "var(--surface-sunk)",
                borderRadius: "var(--r-md)", border: "1px solid var(--rule)",
              }}>
                <div style={{ marginBottom: 10 }}>
                  <div style={labelStyle}>
                    {listSeedMode === "template" ? "Template cards" : "Suggested cards"}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>
                    {listSeedMode === "template"
                      ? "These default lists will be added when you create the project."
                      : "Set order with the rank number or arrows. Deselect any you don\u2019t want."}
                  </div>
                </div>

                {loadingSuggestions && (
                  <div style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 8 }}>
                    {tr("Updating suggestions...")}
                  </div>
                )}
                {suggestError && !loadingSuggestions && (
                  <div style={{ fontSize: 12, color: "var(--ochre)", marginBottom: 8 }}>{suggestError}</div>
                )}
                {suggestSource && !loadingSuggestions && (
                  <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 10 }}>
                    Source:{" "}
                    {suggestSource === "ai"
                      ? "AI"
                      : suggestSource === "template"
                        ? "default template"
                        : "fallback columns"}
                  </div>
                )}

                {orderedCards.length > 0 ? (
                  <div style={{ display: "grid", gap: 6 }}>
                    {orderedCards.map((card, index) => {
                      const bg = card.color ? `${card.color}22` : "var(--surface)";
                      const templateView = listSeedMode === "template";
                      return (
                        <div
                          key={card.id}
                          ref={(el) => {
                            if (el) rowRefs.current.set(card.id, el);
                            else rowRefs.current.delete(card.id);
                          }}
                          style={{
                            display: "flex", alignItems: "center", gap: 8,
                            padding: "6px 8px", borderRadius: "var(--r-sm)",
                            background: templateView || card.selected ? bg : "var(--surface)",
                            border: `1px solid ${templateView || card.selected ? "var(--green-deep)" : "var(--rule)"}`,
                            opacity: templateView || card.selected ? 1 : 0.55,
                          }}
                        >
                          {templateView ? (
                            <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-mute)", width: 24 }}>
                              {index + 1}
                            </span>
                          ) : (
                            <label style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                              <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-mute)" }}>#</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={index + 1}
                                onChange={(e) => {
                                  const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
                                  if (!Number.isNaN(n)) setCardRank(index, n);
                                }}
                                style={{
                                  width: 40, padding: "4px 6px", fontSize: 12,
                                  fontFamily: "var(--mono)", textAlign: "center",
                                  border: "1px solid var(--rule)", borderRadius: "var(--r-sm)",
                                  background: "var(--page)",
                                }}
                                aria-label={`Rank for ${card.name}`}
                              />
                            </label>
                          )}
                          {templateView ? (
                            <span
                              style={{
                                flex: 1, textAlign: "left", padding: "4px 8px", fontSize: 13,
                                fontFamily: "var(--sans)", color: "var(--green-deep)", fontWeight: 600,
                              }}
                            >
                              {card.name}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => toggleCard(card.id)}
                              style={{
                                flex: 1, textAlign: "left", padding: "4px 8px", fontSize: 13,
                                fontFamily: "var(--sans)", background: "transparent", border: "none",
                                color: card.selected ? "var(--green-deep)" : "var(--ink-soft)",
                                cursor: "pointer", fontWeight: card.selected ? 600 : 400,
                              }}
                            >
                              {card.name}
                            </button>
                          )}
                          {!templateView && (
                            <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                              <button type="button" onClick={() => moveCard(index, -1)} disabled={index === 0} title="Move up" style={arrowBtnStyle} aria-label="Move up">
                                <MoveUpIcon />
                              </button>
                              <button type="button" onClick={() => moveCard(index, 1)} disabled={index === orderedCards.length - 1} title="Move down" style={arrowBtnStyle} aria-label="Move down">
                                <MoveDownIcon />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : !loadingSuggestions ? (
                  <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>
                    {listSeedMode === "template"
                      ? "Default template cards will be added when you create the project."
                      : "No suggestions yet. Click \"Suggest cards\" above."}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={cancelBtnStyle}>{tr("Cancel")}</button>
          <button onClick={() => void submit()} disabled={saving || !canSubmit} style={{ ...saveBtnStyle, opacity: saving || !canSubmit ? 0.6 : 1, cursor: saving || !canSubmit ? "not-allowed" : "pointer" }}>
            {saving ? tr("Creating...") : tr("Create project")}
          </button>
        </div>
      </div>
    </div>
  );
}

const labelStyle: CSSProperties = {
  display: "block", fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.1em",
  textTransform: "uppercase", color: "var(--ink-mute)", marginBottom: 6,
};

const hintStyle: CSSProperties = {
  fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-faint)", marginTop: 4,
};

// Read-only team field for the pre-scoped (locked) create flow — styled like a
// disabled input so it reads as "fixed" rather than editable.
const lockedTeamStyle: CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
  padding: "8px 12px", fontSize: 13, fontFamily: "var(--sans)",
  background: "var(--surface-sunk)", color: "var(--ink-soft)",
  border: "1px solid var(--rule)", borderRadius: "var(--r-sm)",
};

const arrowBtnStyle: CSSProperties = {
  width: 28, height: 28, padding: 0,
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  background: "var(--surface)", border: "1px solid var(--rule)",
  borderRadius: "var(--r-sm)", cursor: "pointer", color: "var(--ink-soft)",
};

const saveBtnStyle: CSSProperties = {
  padding: "8px 20px", fontSize: 12, fontWeight: 500, background: "var(--green-deep)",
  color: "#f4efdf", borderWidth: 1, borderStyle: "solid", borderColor: "var(--green-deep)",
  borderRadius: "var(--r-sm)", fontFamily: "var(--sans)",
};

const cancelBtnStyle: CSSProperties = {
  padding: "8px 14px", fontSize: 12, fontWeight: 500, background: "var(--surface)",
  color: "var(--ink-soft)", border: "1px solid var(--rule-strong)",
  borderRadius: "var(--r-sm)", cursor: "pointer", fontFamily: "var(--sans)",
};

/** Ensure creator is present and ids are unique (Selected Members contract). */
function uniqueIdsWithCreator(ids: string[], creatorId?: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  if (creatorId) {
    seen.add(creatorId);
    out.push(creatorId);
  }
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
