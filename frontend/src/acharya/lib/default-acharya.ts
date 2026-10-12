/**
 * Platform default acharya for the karigar app.
 *
 * Source of truth is OmniDel admin:
 *   OmniVarsity → Acharyas → Identity → "Platform default fallback"
 *   (gunakul.mst_acharyas.is_platform_default).
 *
 * Used when a requested slug is missing/disabled, or when every assigned
 * acharya in the task → list → board → workspace cascade is inactive.
 * Read-time only — never rewrite stored acharya_id.
 */
export const FALLBACK_ACHARYA_SLUG = "mahacharya";
