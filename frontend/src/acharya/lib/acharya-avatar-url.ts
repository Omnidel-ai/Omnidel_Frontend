/**
 * OmniDel stores admin-uploaded acharya portraits as same-origin private-blob
 * proxy paths (`/api/omnistudio/blob/omnistudio/acharya/...`). Those only work
 * on the OmniDel host. Karigar rewrites them to a local authenticated proxy
 * that streams bytes via OMNIDEL_BOT_API_KEY.
 *
 * Absolute public URLs (legacy Supabase storage) pass through unchanged.
 */

export const OMNIDEL_BLOB_PROXY_PREFIX = "/api/omnistudio/blob/";
export const KARIGAR_AVATAR_BLOB_PREFIX = "/api/acharyas/avatar-blob/";

/** Paths the karigar proxy is allowed to fetch (acharya portraits only). */
export function isAllowedAcharyaBlobPath(pathname: string): boolean {
  if (!pathname || pathname.includes("..") || pathname.startsWith("/")) return false;
  if (pathname.startsWith("omnistudio/acharya/")) return true;
  // Seeded faces (e.g. MahAcharya'ji): omnistudio/asset/acharya-*.png
  if (pathname.startsWith("omnistudio/asset/acharya-")) return true;
  return false;
}

/**
 * Rewrite a stored `mst_acharyas.avatar_url` for <img src> in this app.
 * Returns null when the value cannot be rendered here.
 */
export function toKarigarAvatarUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith(KARIGAR_AVATAR_BLOB_PREFIX)) return trimmed;

  if (trimmed.startsWith(OMNIDEL_BLOB_PROXY_PREFIX)) {
    const rest = trimmed.slice(OMNIDEL_BLOB_PROXY_PREFIX.length);
    if (!isAllowedAcharyaBlobPath(rest)) return null;
    return `${KARIGAR_AVATAR_BLOB_PREFIX}${rest}`;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.pathname.startsWith(OMNIDEL_BLOB_PROXY_PREFIX)) {
        const rest = parsed.pathname.slice(OMNIDEL_BLOB_PROXY_PREFIX.length);
        if (!isAllowedAcharyaBlobPath(rest)) return null;
        return `${KARIGAR_AVATAR_BLOB_PREFIX}${rest}`;
      }
      // Public absolute (e.g. Supabase storage) — usable as <img src> directly.
      return trimmed;
    } catch {
      return null;
    }
  }

  // Other relative paths aren't serveable from this origin.
  return null;
}

export function canRenderAcharyaAvatarUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /^https?:\/\//i.test(url) || url.startsWith(KARIGAR_AVATAR_BLOB_PREFIX);
}
