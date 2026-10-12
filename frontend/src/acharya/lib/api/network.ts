"use client";

import { apiFetch } from "./profile";

// Client data layer for the Karigar Network tabs on /profile.
// Mirrors the shapes returned by /api/network/* and /api/masters/*.

export interface NetworkProfile {
  id: string;
  user_id: string;
  slug: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  photo_url: string | null;
  trade: string | null;
  city: string | null;
  bio: string | null;
  is_public: boolean;
  /** OmniPulse tasks with status done (karigar board). */
  tasks_done: number;
  jobs_done: number;
  avg_score: number | string | null;
  created_on: string | null;
  trade_id: string | null;
  city_id: string | null;
  city_state_id: string | null;
  state_name: string | null;
  address_line: string | null;
  pincode: string | null;
  trade_master: { name: string } | null;
  city_master: { name: string; state_id: string } | null;
  /** OmniDel admin user fields (mst_users + locations/workspaces). */
  account_role_name: string | null;
  account_branch_name: string | null;
  account_primary_team_name: string | null;
}

export interface NetworkExperienceEntry {
  id: string;
  org_id: string | null;
  task_title: string | null;
  acharya_slug: string | null;
  verdict: string | null;
  score: number | string | null;
  summary: string | null;
  artifact_url: string | null;
  occurred_on: string | null;
}

export type LinkStatus = "invited" | "requested" | "active" | "declined" | "ended";

export interface NetworkOrgLink {
  id: string;
  org_id: string;
  status: LinkStatus;
  initiated_by: string | null;
  workspace_id: string | null;
  created_on: string | null;
  responded_on: string | null;
  ended_on: string | null;
  org: { name: string; slug: string } | null;
}

export interface NetworkSheet {
  profile: NetworkProfile;
  experience: NetworkExperienceEntry[];
  links: NetworkOrgLink[];
}

export interface InviteRow extends NetworkOrgLink {
  org: { name: string; slug: string; city: string | null; about: string | null } | null;
}

export interface OrgRow {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  about: string | null;
  myLink: { id: string; status: LinkStatus; initiated_by: string | null } | null;
}

export interface StateOption { id: string; name: string; code: string | null }
export interface TradeOption { id: string; name: string; slug: string }
export interface CityOption { id: string; name: string }
export interface Masters { states: StateOption[]; trades: TradeOption[] }

export interface NetworkProfilePatch {
  first_name?: string;
  last_name?: string;
  email?: string;
  bio?: string;
  is_public?: boolean;
  trade_id?: string | null;
  city_id?: string | null;
  address_line?: string;
  pincode?: string;
}

export function fetchNetworkSheet(): Promise<NetworkSheet> {
  return apiFetch<NetworkSheet>("/api/network/me");
}

export function patchNetworkProfile(patch: NetworkProfilePatch): Promise<{ profile: NetworkProfile }> {
  return apiFetch<{ profile: NetworkProfile }>("/api/network/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

export function fetchInvites(): Promise<{ items: InviteRow[] }> {
  return apiFetch<{ items: InviteRow[] }>("/api/network/invites");
}

export function respondToInvite(linkId: string, action: "accept" | "decline"): Promise<{ link: NetworkOrgLink }> {
  return apiFetch<{ link: NetworkOrgLink }>(`/api/network/invites/${linkId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
}

export function fetchOrgs(): Promise<{ items: OrgRow[] }> {
  return apiFetch<{ items: OrgRow[] }>("/api/network/orgs");
}

export function requestJoin(orgId: string): Promise<{ link: NetworkOrgLink }> {
  return apiFetch<{ link: NetworkOrgLink }>("/api/network/requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orgId }),
  });
}

export function cancelJoinRequest(orgId: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/api/network/requests?orgId=${encodeURIComponent(orgId)}`, {
    method: "DELETE",
  });
}

export function fetchMasters(): Promise<Masters> {
  return apiFetch<Masters>("/api/masters");
}

export function fetchCities(stateId: string): Promise<{ cities: CityOption[] }> {
  return apiFetch<{ cities: CityOption[] }>(`/api/masters/cities?state_id=${encodeURIComponent(stateId)}`);
}

export async function uploadPhoto(file: File): Promise<{ photo_url: string }> {
  const form = new FormData();
  form.append("file", file);
  return apiFetch<{ photo_url: string }>("/api/network/photo", { method: "POST", body: form });
}

export function removePhoto(): Promise<{ ok: true; photo_url: null }> {
  return apiFetch<{ ok: true; photo_url: null }>("/api/network/photo", { method: "DELETE" });
}
