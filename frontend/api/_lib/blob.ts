import { LIMITS, TYPE_KIND, kindOf, typesOfKind, type Kind } from "./media.js";

/**
 * What every blob handler in this workspace shares.
 *
 * Which prefixes may be written, what kinds of file each takes, how large, and
 * which of the two stores a prefix belongs to. Five handlers enforce these,
 * and a rule that lives in five files is a rule that drifts.
 *
 * The file-type vocabulary itself is in `media.ts`; this module is about
 * **where** things go and **who** may put them there.
 */

export { LIMITS, kindOf } from "./media.js";
export type { Kind } from "./media.js";

/**
 * Where uploads may land.
 *
 * A prefix allowlist rather than a free path: a handler that accepts any
 * pathname lets one caller overwrite another's key, and "public" and "private"
 * stop meaning anything the moment the caller picks the prefix.
 *
 * Each prefix mirrors a place the application already stores something, and
 * takes only the kinds that make sense there — a knowledge base has no use for
 * a video, and a storefront has no use for a spreadsheet.
 */
export const PREFIXES = {
  /** Acharya portraits — private, read back through the view proxy. */
  "omnivarsity/acharya/": { access: "private", kinds: ["image"] },
  /** Kaarigar portraits — private, same treatment. */
  "omnivarsity/kaarigar/": { access: "private", kinds: ["image"] },
  /** The acharya knowledge base — what an acharya has been given to read. */
  "omnivarsity/kb/": { access: "private", kinds: ["document", "data"] },
  /** Pipeline attachments — a lead's paperwork and site photos. */
  "omnimart/pipeline/": { access: "private", kinds: ["image", "document", "data"] },
  /** Storefront images — public, cached hard, embedded elsewhere. */
  "omnimart/store/": { access: "public", kinds: ["image"] },
  /** Task attachments on a board. */
  "omnipulse/task/": { access: "private", kinds: ["image", "document", "data"] },
  /** Studio media — the one prefix that takes video and audio. */
  "omnistudio/media/": { access: "private", kinds: ["image", "video", "audio"] },
  /** Brand assets — public, because they are used off this origin. */
  "omnistudio/brand/": { access: "public", kinds: ["image", "document"] },
} satisfies Record<string, { access: "public" | "private"; kinds: Kind[] }>;

export type Prefix = keyof typeof PREFIXES;

export interface PathRule {
  prefix: Prefix;
  access: "public" | "private";
  kinds: readonly Kind[];
  /** The content types this prefix accepts, derived from its kinds. */
  types: string[];
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
      return {
        prefix: prefix as Prefix,
        access: rule.access,
        kinds: rule.kinds,
        types: typesOfKind(rule.kinds),
      };
    }
  }
  return null;
}

/**
 * Whether this prefix takes this type, and how much of it.
 *
 * Returns the reason when it does not, because "file type not allowed" without
 * saying what is allowed sends the caller to the source to find out.
 */
export function checkType(
  rule: PathRule,
  contentType: string,
  size: number,
  route: "fn" | "client",
): { ok: true; kind: Kind } | { ok: false; status: number; error: string; hint?: string } {
  const kind = kindOf(contentType);
  if (!kind || !TYPE_KIND[contentType]) {
    return { ok: false, status: 415, error: `Type ${contentType || "(none)"} is not stored here.` };
  }
  if (!rule.kinds.includes(kind)) {
    return {
      ok: false,
      status: 415,
      error: `This path takes ${rule.kinds.join(", ")} — not ${kind}.`,
    };
  }
  const cap = LIMITS[kind][route];
  if (size > cap) {
    return {
      ok: false,
      status: 413,
      error: `Too large: ${mb(size)} against a ${mb(cap)} limit for ${kind} on this route.`,
      hint:
        route === "fn"
          ? "Anything this size goes browser-direct with a token from /api/blob/upload-token."
          : undefined,
    };
  }
  return { ok: true, kind };
}

function mb(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/** A content type without its parameters, lowercased — `image/png;charset` → `image/png`. */
export function bareType(value: string | null | undefined): string {
  return (value ?? "").split(";")[0]!.trim().toLowerCase();
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
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Range",
    // Without this a cross-origin player cannot see the range headers it needs
    // to seek, and falls back to downloading the whole file.
    "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
  };
}

/** The key inside the store, from a full blob URL. */
export function pathnameOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith(".blob.vercel-storage.com")) return null;
    return decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  } catch {
    return null;
  }
}
