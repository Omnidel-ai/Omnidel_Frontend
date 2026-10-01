/**
 * The browser half of the handlers in `api/`.
 *
 * One function to put a file in the store, one to turn a stored key into
 * something an element can load, and the small vocabulary a field needs to
 * talk about files: their kind, their size, how to download one.
 *
 * Everything a screen needs to know about public versus private lives here, so
 * a field can ask for "a portrait" or "an attachment" and not care which store
 * it lands in or how it comes back.
 *
 * This workspace normally runs with no Blob store at all. That is not an error
 * state to hide: `uploadFile` falls back to an object URL, the file appears,
 * the screen works, and the result says `demo: true` so the field can say so
 * rather than implying the file went somewhere.
 */

import {
  EXT_TYPE,
  LIMITS,
  PREFIXES,
  TYPE_KIND,
  bareType as bare,
  formatBytes,
  kindOfType,
  type Kind,
} from "../../shared/media";

/**
 * The browser's names for the shared facts.
 *
 * `FileKind` and `BLOB_AREAS` are re-spellings of `Kind` and `PREFIXES` so a
 * screen reads naturally — "which area does this picture belong to" — without
 * a second copy of either existing.
 */
export type FileKind = Kind;
export { LIMITS, formatBytes };

/** Each area, with the prefix it writes under and what it accepts. */
export const BLOB_AREAS = {
  acharya: { prefix: "omnivarsity/acharya/", ...PREFIXES["omnivarsity/acharya/"] },
  kaarigar: { prefix: "omnivarsity/kaarigar/", ...PREFIXES["omnivarsity/kaarigar/"] },
  kb: { prefix: "omnivarsity/kb/", ...PREFIXES["omnivarsity/kb/"] },
  pipeline: { prefix: "omnimart/pipeline/", ...PREFIXES["omnimart/pipeline/"] },
  store: { prefix: "omnimart/store/", ...PREFIXES["omnimart/store/"] },
  task: { prefix: "omnipulse/task/", ...PREFIXES["omnipulse/task/"] },
  media: { prefix: "omnistudio/media/", ...PREFIXES["omnistudio/media/"] },
  brand: { prefix: "omnistudio/brand/", ...PREFIXES["omnistudio/brand/"] },
} as const;

export type BlobArea = keyof typeof BLOB_AREAS;

/** The kind of a file, from its type and then, failing that, its name. */
export function kindOf(file: { type?: string; name?: string }): FileKind | null {
  const byType = kindOfType(bare(file.type));
  if (byType) return byType;
  const ext = file.name?.split(".").pop()?.toLowerCase();
  const byExt = ext ? EXT_TYPE[ext] : undefined;
  return byExt ? kindOfType(byExt) : null;
}

/** The kind of a stored key, which is all a listing gives you. */
export function kindOfPath(pathname: string): FileKind | null {
  const ext = pathname.split(".").pop()?.toLowerCase();
  const type = ext ? EXT_TYPE[ext] : undefined;
  return type ? kindOfType(type) : null;
}

/** The types an area accepts, as an `<input accept>` string. */
export function acceptFor(area: BlobArea): string {
  const kinds = BLOB_AREAS[area].kinds as readonly FileKind[];
  return Object.entries(TYPE_KIND)
    .filter(([, k]) => kinds.includes(k))
    .map(([t]) => t)
    .join(",");
}

export interface StoredFile {
  /** What to put in `src` or `href`. Already proxied when the blob is private. */
  src: string;
  /** The blob's own URL, or the object URL in demo mode. */
  url: string;
  /** The key inside the store. Empty in demo mode — nothing was stored. */
  pathname: string;
  name: string;
  size: number;
  type: string;
  kind: FileKind;
  /** True when nothing left the browser. */
  demo: boolean;
}

/**
 * A private blob, addressed so the browser can load it.
 *
 * A private blob's own URL wants an Authorization header and no element can
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

/**
 * The same file, but saved rather than shown.
 *
 * `?download=1` is the one thing a caller gets to decide about how the read
 * routes respond — a PDF renders inline by default, and a download link needs
 * it not to.
 */
export function downloadUrl(src: string): string {
  if (!src.startsWith("/api/blob/")) return src;
  return `${src}${src.includes("?") ? "&" : "?"}download=1`;
}

/** The extension to store under, from the type and then the name. */
function extFor(file: File): string {
  const type = bare(file.type);
  for (const [ext, t] of Object.entries(EXT_TYPE)) {
    if (t === type) return ext;
  }
  return file.name.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ?? "bin";
}

/** A file name reduced to something safe to put in a key. */
function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export interface UploadOptions {
  /** Which prefix to write under. Decides public or private, and what fits. */
  area: BlobArea;
  /** The record this file belongs to. Becomes part of the key. */
  slug: string;
  /**
   * One file per record (a portrait), or many (attachments).
   *
   * A record's single file keeps a fixed key and overwrites itself; one of
   * many gets its own name in the key, so a second upload does not silently
   * replace the first.
   */
  multiple?: boolean;
  /** Sent as `x-upload-secret` when the deployment asks for one. */
  secret?: string;
  /** Progress, 0–1, on the browser-direct route. */
  onProgress?: (fraction: number) => void;
  /**
   * Cancels the upload.
   *
   * Passed to Blob's own client, which stops the parts in flight, and to the
   * multipart fallback's fetch. Without it a cancelled 200 MB upload keeps
   * paying for itself in the background.
   */
  signal?: AbortSignal;
}

/**
 * Put a file in the store and hand back something displayable.
 *
 * Three routes, in the order the application prefers them:
 *
 *   1. **browser → Vercel Blob directly**, with a token from the function. The
 *      only route that clears the ~4.5 MB function body limit, so the only one
 *      that can carry a video or a long recording. Large files go up in parts
 *      that retry individually, which is what makes one survive a phone
 *      network.
 *   2. **multipart through the function**, when the direct route cannot
 *      connect — which on some localhost setups is a CORS failure, not a bug.
 *      Only attempted for what fits in a request body.
 *   3. **no store at all**: an object URL, and `demo: true`.
 *
 * Validation happens here as well as in the function. The check in the browser
 * is a courtesy — it fails in a tenth of a second instead of after a gigabyte —
 * and the one in the function is the one that counts.
 */
export async function uploadFile(file: File, options: UploadOptions): Promise<StoredFile> {
  const area = BLOB_AREAS[options.area];
  const kind = kindOf(file);
  const type = bare(file.type) || "application/octet-stream";

  if (!kind) {
    throw new Error(`${file.name} is not a type this workspace stores.`);
  }
  if (!(area.kinds as readonly FileKind[]).includes(kind)) {
    throw new Error(`This field takes ${area.kinds.join(", ")} — not ${kind}.`);
  }
  if (file.size > LIMITS[kind].client) {
    throw new Error(
      `${file.name} is ${formatBytes(file.size)}, over the ${formatBytes(LIMITS[kind].client)} limit for ${kind}.`,
    );
  }

  const slug = options.slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  if (!slug) throw new Error("This record has no slug to store a file under.");

  const leaf = options.multiple ? `${Date.now()}-${slugify(file.name) || "file"}` : "file";
  const pathname = `${area.prefix}${slug}/${leaf}.${extFor(file)}`;
  const headers = options.secret ? { "x-upload-secret": options.secret } : undefined;
  const isPublic = area.access === "public";

  // 1 — browser-direct.
  try {
    const { upload } = await import("@vercel/blob/client");
    const blob = await upload(pathname, file, {
      access: isPublic ? "public" : "private",
      handleUploadUrl: "/api/blob/upload-token",
      contentType: type,
      // The function reads this to pick the right ceiling for the kind. Blob
      // still enforces the type on the bytes, so a lie only buys a lower one.
      clientPayload: type,
      multipart: file.size > 5 * 1024 * 1024,
      ...(options.signal ? { abortSignal: options.signal } : {}),
      ...(options.onProgress
        ? {
            onUploadProgress: (p: { percentage: number }) =>
              options.onProgress!(p.percentage / 100),
          }
        : {}),
      ...(headers ? { headers } : {}),
    });
    return {
      src: isPublic ? blob.url : blobViewUrl(blob.url),
      url: blob.url,
      pathname: blob.pathname,
      name: file.name,
      size: file.size,
      type,
      kind,
      demo: false,
    };
  } catch (err) {
    if (isRefusal(err)) throw asError(err);
  }

  // 2 — through the function, for what fits in a body.
  if (file.size <= LIMITS[kind].fn) {
    const form = new FormData();
    form.set("file", file);
    form.set("pathname", pathname);
    const res = await fetch("/api/blob/upload", {
      method: "POST",
      body: form,
      headers,
      ...(options.signal ? { signal: options.signal } : {}),
    }).catch(() => null);
    if (res && res.ok) {
      const data = (await res.json()) as { url: string; pathname: string };
      return {
        src: isPublic ? data.url : blobViewUrl(data.url),
        url: data.url,
        pathname: data.pathname,
        name: file.name,
        size: file.size,
        type,
        kind,
        demo: false,
      };
    }
    if (res && res.status !== 501 && res.status !== 404) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error || `Upload failed (${res.status}).`);
    }
  }

  // 3 — no store. Show the file, say plainly that it went nowhere.
  return {
    src: URL.createObjectURL(file),
    url: "",
    pathname: "",
    name: file.name,
    size: file.size,
    type,
    kind,
    demo: true,
  };
}

/** `uploadFile` for the common case of one picture on a record. */
export async function uploadImage(
  file: File,
  options: Omit<UploadOptions, "multiple">,
): Promise<StoredFile> {
  if (kindOf(file) !== "image") {
    throw new Error("Only JPEG, PNG, GIF, WebP and AVIF images are allowed here.");
  }
  return uploadFile(file, options);
}

/** Remove one blob. A no-op in demo mode, where nothing was stored. */
export async function deleteBlob(pathname: string, secret?: string): Promise<void> {
  if (!pathname) return;
  await fetch("/api/blob/upload", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { "x-upload-secret": secret } : {}),
    },
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
  return /not allowed|too large|unauthor|forbidden|disabled|not one this workspace|takes /i.test(
    message,
  );
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
