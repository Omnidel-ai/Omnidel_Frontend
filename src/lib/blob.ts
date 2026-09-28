/**
 * The browser half of the Blob handlers in `api/`.
 *
 * One function to upload an image and one to turn a stored key into something
 * `<img src>` accepts. Everything a screen needs to know about public versus
 * private lives here, so a field can ask for "a portrait" and not care which
 * store it lands in or how it comes back.
 *
 * This workspace normally runs with no Blob store at all. That is not an error
 * state to hide: `uploadImage` falls back to an object URL, the picture
 * appears, the screen works, and the result says `demo: true` so the field can
 * say so rather than implying the file went somewhere.
 */

/** The prefixes `api/_lib/blob.ts` declares. Kept in step by name, not import. */
export const BLOB_PREFIXES = {
  acharya: "omnivarsity/acharya/",
  kaarigar: "omnivarsity/kaarigar/",
  pipeline: "omnimart/pipeline/",
  store: "omnimart/store/",
} as const;

export type BlobArea = keyof typeof BLOB_PREFIXES;

/** Which of the two stores an area writes to — the same split the API enforces. */
const PUBLIC_AREAS: BlobArea[] = ["store"];

export interface UploadedImage {
  /** What to put in `<img src>`. Already proxied when the blob is private. */
  src: string;
  /** The blob's own URL, or the object URL in demo mode. */
  url: string;
  /** The key inside the store. Empty in demo mode — nothing was stored. */
  pathname: string;
  name: string;
  size: number;
  type: string;
  /** True when nothing left the browser. */
  demo: boolean;
}

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/**
 * A private blob, addressed so the browser can load it.
 *
 * A private blob's own URL wants an Authorization header and `<img>` cannot
 * send one, so it goes through the view function. A public URL, a data URL or
 * anything else is already loadable and passes through untouched.
 */
export function blobViewUrl(value: string | null | undefined): string {
  const url = (value ?? "").trim();
  if (!url) return "";
  if (url.includes(".private.blob.vercel-storage.com")) {
    return `/api/blob/view?url=${encodeURIComponent(url)}`;
  }
  // Anything already addressable — a public blob, a data or object URL, a path
  // on this origin — is left alone. What is left is a bare key, and a screen
  // only holds one of those for a private blob.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(url) && !url.startsWith("/")) {
    return `/api/blob/view?pathname=${encodeURIComponent(url)}`;
  }
  return url;
}

/** A public key, addressed through the cached read route. */
export function publicBlobUrl(pathname: string): string {
  return `/api/blob/public/${pathname.split("/").map(encodeURIComponent).join("/")}`;
}

/** The extension to store an image under, from its type and then its name. */
function extFor(file: File): string {
  const type = bare(file.type);
  if (type === "image/png") return "png";
  if (type === "image/jpeg") return "jpg";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return file.name.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ?? "png";
}

function bare(value: string | null | undefined): string {
  return (value ?? "").split(";")[0]!.trim().toLowerCase();
}

export interface UploadOptions {
  /** Which prefix to write under. */
  area: BlobArea;
  /** The record this image belongs to — it becomes part of the key. */
  slug: string;
  /** Sent as `x-upload-secret` when the deployment asks for one. */
  secret?: string;
}

/**
 * Put an image in the store and hand back something displayable.
 *
 * Three routes, in the order the application prefers them:
 *
 *   1. browser → Vercel Blob directly, with a token from the function. The
 *      only route that clears the ~4.5 MB function body limit.
 *   2. multipart through the function, when the direct one cannot connect —
 *      which on some localhost setups is a CORS failure, not a bug.
 *   3. no store at all: an object URL, and `demo: true`.
 *
 * Validation happens here as well as in the function. The check in the browser
 * is a courtesy — it fails in a tenth of a second instead of after the upload —
 * and the one in the function is the one that counts.
 */
export async function uploadImage(file: File, options: UploadOptions): Promise<UploadedImage> {
  const type = bare(file.type);
  if (!IMAGE_TYPES.includes(type)) {
    throw new Error("Only JPEG, PNG, GIF and WebP images are allowed.");
  }
  if (file.size > IMAGE_MAX_BYTES) {
    throw new Error("Image too large (max 5 MB). Choose a smaller one.");
  }

  const slug = options.slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  if (!slug) throw new Error("This record has no slug to store an image under.");

  const isPublic = PUBLIC_AREAS.includes(options.area);
  const pathname = `${BLOB_PREFIXES[options.area]}${slug}/image.${extFor(file)}`;
  const headers = options.secret ? { "x-upload-secret": options.secret } : undefined;

  // 1 — browser-direct.
  try {
    const { upload } = await import("@vercel/blob/client");
    const blob = await upload(pathname, file, {
      access: isPublic ? "public" : "private",
      handleUploadUrl: "/api/blob/upload-token",
      contentType: type,
      ...(headers ? { headers } : {}),
    });
    return {
      src: isPublic ? blob.url : blobViewUrl(blob.url),
      url: blob.url,
      pathname: blob.pathname,
      name: file.name,
      size: file.size,
      type,
      demo: false,
    };
  } catch (err) {
    if (isRefusal(err)) throw asError(err);
  }

  // 2 — through the function.
  const form = new FormData();
  form.set("file", file);
  form.set("pathname", pathname);
  const res = await fetch("/api/blob/upload", { method: "POST", body: form, headers }).catch(
    () => null,
  );
  if (res && res.ok) {
    const data = (await res.json()) as { url: string; pathname: string };
    return {
      src: isPublic ? data.url : blobViewUrl(data.url),
      url: data.url,
      pathname: data.pathname,
      name: file.name,
      size: file.size,
      type,
      demo: false,
    };
  }
  if (res && res.status !== 501 && res.status !== 404) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || `Upload failed (${res.status}).`);
  }

  // 3 — no store. Show the file, say plainly that it went nowhere.
  return {
    src: URL.createObjectURL(file),
    url: "",
    pathname: "",
    name: file.name,
    size: file.size,
    type,
    demo: true,
  };
}

/** Remove one blob. A no-op in demo mode, where nothing was stored. */
export async function deleteBlob(pathname: string, secret?: string): Promise<void> {
  if (!pathname) return;
  await fetch("/api/blob/upload", {
    method: "DELETE",
    headers: { "Content-Type": "application/json", ...(secret ? { "x-upload-secret": secret } : {}) },
    body: JSON.stringify({ pathname }),
  }).catch(() => null);
}

/**
 * A refusal, as opposed to "this route is not here".
 *
 * A 4xx from the token route is a decision — wrong type, wrong path, no
 * secret — and repeating the upload through the other route would only get the
 * same answer more slowly. A network or CORS failure is not a decision, so
 * that one falls through to the multipart route.
 */
function isRefusal(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /not allowed|too large|unauthor|forbidden|disabled|not one this workspace/i.test(message);
}

function asError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

export interface ApiStatus {
  demo: boolean;
  writable: boolean;
  store: string;
}

/** What `GET /api` says. Treated as demo mode whenever it cannot be reached. */
export async function readApiStatus(): Promise<ApiStatus> {
  const res = await fetch("/api").catch(() => null);
  if (!res || !res.ok) return { demo: true, writable: false, store: "absent" };
  const data = (await res.json().catch(() => null)) as ApiStatus | null;
  return data ?? { demo: true, writable: false, store: "absent" };
}
