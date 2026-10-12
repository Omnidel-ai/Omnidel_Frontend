/**
 * Private Vercel Blob URLs need a session-gated proxy — browsers cannot add
 * Authorization to <img src>. Wrap any proof/attachment URL before display.
 */

const VERCEL_BLOB_HOST = ".blob.vercel-storage.com";

/** True for any Vercel Blob host (private or public store subdomain). */
export function isVercelBlobUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "https:" && parsed.hostname.endsWith(VERCEL_BLOB_HOST);
  } catch {
    return url.includes(VERCEL_BLOB_HOST);
  }
}

export function blobViewUrl(url: string | null | undefined): string {
  if (!url) return "";
  const trimmed = url.trim();
  // Always proxy Vercel blobs — private stores 401 without Authorization, and
  // store.*.blob hosts also need the app proxy for consistency.
  if (isVercelBlobUrl(trimmed) || trimmed.includes(".private.blob.vercel-storage.com")) {
    return `/api/work/uploads/view?url=${encodeURIComponent(trimmed)}`;
  }
  return trimmed;
}
