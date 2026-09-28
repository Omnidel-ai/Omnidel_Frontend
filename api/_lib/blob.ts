/**
 * What every blob handler in this workspace shares.
 *
 * The rules are the application's, kept in one place because four handlers
 * enforce them and a rule that lives in four files is a rule that drifts:
 * which prefixes may be written, what may be uploaded, how big, and which of
 * the two stores — public or private — a prefix belongs to.
 *
 * Nothing here talks to a database or a session, because this workspace has
 * neither. What replaces them is `guard()`: see the note on it.
 */

/** The image types every image handler accepts. Matches the app's avatar route. */
export const IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

/** Documents the pipeline accepts alongside images, as in the app's /api/uploads. */
export const FILE_TYPES = [
  ...IMAGE_TYPES,
  "application/pdf",
  "text/csv",
  "text/plain",
  "text/markdown",
] as const;

/** 5 MB for an image, the app's avatar cap. */
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
/**
 * 10 MB for a file that travels through this function.
 *
 * A Vercel function body is capped around 4.5 MB, so anything above that has
 * to go browser → Blob directly with a token from `upload-token`. This cap is
 * for the multipart fallback and is deliberately below the client-upload cap.
 */
export const FILE_MAX_BYTES = 10 * 1024 * 1024;
/** 50 MB for a browser-direct upload, which never passes through a function. */
export const CLIENT_MAX_BYTES = 50 * 1024 * 1024;

/**
 * Where uploads may land, and which store each prefix uses.
 *
 * A prefix allowlist rather than a free path: a handler that accepts any
 * pathname lets one caller overwrite another's key, and "public" and "private"
 * stop meaning anything the moment a caller picks the prefix.
 */
export const PREFIXES = {
  /** Acharya portraits — private, read back through the view proxy. */
  "omnivarsity/acharya/": { access: "private" as const, types: IMAGE_TYPES },
  /** Kaarigar portraits — private, same treatment. */
  "omnivarsity/kaarigar/": { access: "private" as const, types: IMAGE_TYPES },
  /** Pipeline attachments — private, and not all of them are images. */
  "omnimart/pipeline/": { access: "private" as const, types: FILE_TYPES },
  /** Storefront images — public, served with a long cache and no session. */
  "omnimart/store/": { access: "public" as const, types: IMAGE_TYPES },
};

export type Prefix = keyof typeof PREFIXES;

export interface PathRule {
  prefix: Prefix;
  access: "public" | "private";
  types: readonly string[];
}

/**
 * The rule for a pathname, or null if nothing claims it.
 *
 * Rejects traversal and absolute keys before matching, so `omnimart/store/../`
 * cannot walk out of the prefix it matched.
 */
export function ruleFor(pathname: string): PathRule | null {
  if (!pathname || pathname.startsWith("/") || pathname.includes("..")) return null;
  if (!/^[a-zA-Z0-9/._-]+$/.test(pathname)) return null;
  for (const [prefix, rule] of Object.entries(PREFIXES)) {
    if (pathname.startsWith(prefix) && pathname.length > prefix.length) {
      return { prefix: prefix as Prefix, access: rule.access, types: rule.types };
    }
  }
  return null;
}

/** Extension → content type, for serving a blob we only know the key of. */
const BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  csv: "text/csv",
  txt: "text/plain",
  md: "text/markdown",
};

export function contentTypeFor(pathname: string): string | null {
  const ext = pathname.split(".").pop()?.toLowerCase();
  return ext ? (BY_EXT[ext] ?? null) : null;
}

/** A content type without its parameters, lowercased — `image/png;charset` → `image/png`. */
export function bareType(value: string | null | undefined): string {
  return (value ?? "").split(";")[0]!.trim().toLowerCase();
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/** Whether a Blob store is wired to this deployment at all. */
export function hasStore(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/**
 * The stand-in for the application's session check.
 *
 * In the app every one of these routes sits behind `withAuth` and a permission
 * slug. This workspace has no users, so a write handler here would be an open
 * door onto a real Blob store — anyone who found the URL could fill it. Two
 * things keep that shut:
 *
 *   - with no `BLOB_READ_WRITE_TOKEN`, the handlers refuse and the UI runs in
 *     demo mode, which is how this workspace is normally deployed;
 *   - with a token but no `BLOB_UPLOAD_SECRET`, writes still refuse, so wiring
 *     a store is not by itself enough to open one.
 *
 * When both are set, a write must carry the secret in `x-upload-secret`. It is
 * a shared secret, not a session: enough for a demo behind a link, and
 * deliberately not what the application does, which is a session and a
 * permission per route.
 */
export function guard(request: Request): Response | null {
  if (!hasStore()) {
    return json(
      {
        error: "No Blob store configured.",
        hint: "Set BLOB_READ_WRITE_TOKEN to enable uploads. Without it this workspace runs on demo data.",
        demo: true,
      },
      501,
    );
  }
  const secret = process.env.BLOB_UPLOAD_SECRET;
  if (!secret) {
    return json(
      {
        error: "Uploads are disabled.",
        hint: "A Blob store is configured but BLOB_UPLOAD_SECRET is not set, so this endpoint will not accept writes.",
      },
      503,
    );
  }
  if (request.headers.get("x-upload-secret") !== secret) {
    return json({ error: "Unauthorized." }, 401);
  }
  return null;
}

/** CORS for the public store only — the private handlers are same-origin. */
export function publicCors(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
