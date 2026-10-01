/**
 * What may be stored, what kind it is, and how large — for both sides.
 *
 * This file is imported by the browser (`src/lib/blob.ts`) **and** by the
 * Vercel Functions (`api/_lib/media.ts`), and it is the only place these facts
 * exist. Before it, each side carried its own copy of the same thirty content
 * types. They agreed, but nothing made them agree: the next type added to one
 * table would have been missing from the other, and the failure that produces
 * is the nastiest kind — the browser accepts a file, the upload starts, and
 * the server rejects it at the end.
 *
 * It holds no React, no Node, no Vercel imports — nothing that would stop
 * either side from loading it.
 */

export type Kind = "image" | "video" | "audio" | "document" | "data";

/** Content type → kind. Anything absent is not storable through these routes. */
export const TYPE_KIND: Record<string, Kind> = {
  // Images — the app's avatar and storefront set, plus SVG, which is allowed
  // in but never served inline.
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  "image/avif": "image",
  "image/svg+xml": "image",

  // Video. Everything here is streamable, which is why the read routes answer
  // Range requests.
  "video/mp4": "video",
  "video/webm": "video",
  "video/quicktime": "video",
  "video/x-matroska": "video",

  // Audio — the set the app's speech routes produce and accept.
  "audio/mpeg": "audio",
  "audio/mp4": "audio",
  "audio/wav": "audio",
  "audio/x-wav": "audio",
  "audio/webm": "audio",
  "audio/ogg": "audio",
  "audio/flac": "audio",

  // Documents — what the knowledge base ingests, plus the Office set.
  "application/pdf": "document",
  "application/msword": "document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "document",
  "application/vnd.ms-excel": "document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "document",
  "application/vnd.ms-powerpoint": "document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "document",
  "application/rtf": "document",

  // Data — text a person or a parser reads.
  "text/plain": "data",
  "text/markdown": "data",
  "text/x-markdown": "data",
  "text/csv": "data",
  "application/json": "data",
};

export const ALL_TYPES = Object.keys(TYPE_KIND);

export function typesOfKind(kinds: readonly Kind[]): string[] {
  return ALL_TYPES.filter((t) => kinds.includes(TYPE_KIND[t]!));
}

export function kindOfType(contentType: string): Kind | null {
  return TYPE_KIND[contentType] ?? null;
}

/** Extension → content type, for a blob we only know the key of. */
export const EXT_TYPE: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  flac: "audio/flac",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  rtf: "application/rtf",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  json: "application/json",
};

export function typeForPath(pathname: string): string | null {
  const ext = pathname.split(".").pop()?.toLowerCase();
  return ext ? (EXT_TYPE[ext] ?? null) : null;
}

export function kindForPath(pathname: string): Kind | null {
  const type = typeForPath(pathname);
  return type ? kindOfType(type) : null;
}

/**
 * How large, per kind, by route.
 *
 * `fn` is what may pass through a function body — well under Vercel's ~4.5 MB
 * request limit. `client` is what may go browser-direct, where the bytes never
 * touch a function at all.
 */
export const LIMITS: Record<Kind, { fn: number; client: number }> = {
  image: { fn: 4 * 1024 * 1024, client: 25 * 1024 * 1024 },
  document: { fn: 4 * 1024 * 1024, client: 50 * 1024 * 1024 },
  data: { fn: 4 * 1024 * 1024, client: 25 * 1024 * 1024 },
  audio: { fn: 4 * 1024 * 1024, client: 200 * 1024 * 1024 },
  video: { fn: 4 * 1024 * 1024, client: 1024 * 1024 * 1024 },
};

/**
 * Where uploads may land.
 *
 * A prefix allowlist rather than a free path: a handler that accepts any
 * pathname lets one caller overwrite another's key, and "public" and "private"
 * stop meaning anything the moment the caller picks the prefix.
 *
 * Shared for the same reason as the types: the browser offers a file picker
 * from this list and the server enforces it, and the two must not disagree.
 */
export const PREFIXES = {
  "omnivarsity/acharya/": { access: "private", kinds: ["image"] },
  "omnivarsity/kaarigar/": { access: "private", kinds: ["image"] },
  "omnivarsity/kb/": { access: "private", kinds: ["document", "data"] },
  "omnimart/pipeline/": { access: "private", kinds: ["image", "document", "data"] },
  "omnimart/store/": { access: "public", kinds: ["image"] },
  "omnipulse/task/": { access: "private", kinds: ["image", "document", "data"] },
  "omnistudio/media/": { access: "private", kinds: ["image", "video", "audio"] },
  "omnistudio/brand/": { access: "public", kinds: ["image", "document"] },
} satisfies Record<string, { access: "public" | "private"; kinds: Kind[] }>;

export type Prefix = keyof typeof PREFIXES;

/** 1.4 MB, 812 KB, 340 bytes — sizes as a person reads them. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / 1024 / 1024;
  return mb < 100 ? `${Math.round(mb * 10) / 10} MB` : `${Math.round(mb)} MB`;
}

/** A content type without its parameters — `image/png;charset` → `image/png`. */
export function bareType(value: string | null | undefined): string {
  return (value ?? "").split(";")[0]!.trim().toLowerCase();
}
