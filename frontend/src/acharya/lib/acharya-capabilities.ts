/**
 * Per-Acharya capability flags.
 *
 * Phase-1 static map keyed by Acharya slug. Decides which optional features
 * each persona supports (e.g. Anam live avatar). Acharyas not in this map
 * (or with the flag false) get the feature silently hidden — no broken UI,
 * no failed API calls.
 *
 * Phase 2 (when admin-driven Acharya creation ships): replace with a JSON
 * column on gunakul.mst_acharyas (e.g. `capabilities JSONB`).
 */

export interface AcharyaCapabilities {
  /** Anam live video avatar — requires ANAM_API_KEY + per-acharya avatar/voice/llm IDs. */
  anamEnabled: boolean;
  /** Tavus CVI live video avatar — requires TAVUS_API_KEY + a PAL id. FOUNDER/ADMIN ONLY. */
  tavusEnabled: boolean;
}

/**
 * Strict allowlist for Anam live avatar.
 * Only Vivek is configured locally for now — every other Acharya stays off
 * even if ANAM_* env vars are present on the deploy.
 */
const ANAM_LIVE_AVATAR_SLUGS = new Set(["vivek"]);

function normalizeSlug(slug: string | null | undefined): string {
  return (slug || "").trim().toLowerCase();
}

/** True only for Acharyas on the Anam live-avatar allowlist (currently Vivek). */
export function isAnamLiveAvatarEnabled(slug: string | null | undefined): boolean {
  return ANAM_LIVE_AVATAR_SLUGS.has(normalizeSlug(slug));
}

/**
 * Strict allowlist for the Tavus CVI video avatar — MahAcharya'ji only.
 *
 * This is HALF the gate. The other half is the viewer: the avatar is founder /
 * admin only (`KarigarSession.isAdmin`, already exactly `role === founder ||
 * role === admin`). Both must hold, and both are re-checked SERVER-side on every
 * Tavus route — a capability check that lives only in the client is a suggestion,
 * and creating a conversation costs real money and a concurrency slot.
 */
const TAVUS_VIDEO_AVATAR_SLUGS = new Set<string>([
  // OFF, 2026-09-11, by request. MahAcharya'ji was the only entry; put the slug
  // back to hand the avatar straight back — nothing else was removed, and both
  // halves of the gate read this one set, so an empty set is a complete off
  // switch rather than a hidden button with a live billable route behind it.
  // "mahacharya",
]);

/** True only for Acharyas on the Tavus allowlist. Does NOT check the viewer. */
export function isTavusVideoAvatarEnabled(slug: string | null | undefined): boolean {
  return TAVUS_VIDEO_AVATAR_SLUGS.has(normalizeSlug(slug));
}

export function getAcharyaCapabilities(slug: string | null | undefined): AcharyaCapabilities {
  return {
    anamEnabled: isAnamLiveAvatarEnabled(slug),
    tavusEnabled: isTavusVideoAvatarEnabled(slug),
  };
}
