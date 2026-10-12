import type { BlobArea, FileKind, StoredFile } from "../blob";

/**
 * The seam between an upload control and whatever actually stores the bytes.
 *
 * Without it, every field imports `uploadFile` directly and there is no way to
 * see the states that matter — a slow upload, a cancelled one, a failure worth
 * retrying — without a Blob store, a large file and a throttled connection.
 * With it, the same components run against `mockUploadClient`, which simulates
 * all of them on demand.
 *
 * It is deliberately small. Everything a control needs and nothing about how
 * the bytes travel: the real client uses `@vercel/blob/client`'s `upload()`,
 * the mock uses a timer, and neither shows through.
 */
export interface UploadClient {
  /** What this area accepts, for the picker and the line under it. */
  policy(area: BlobArea): UploadPolicy;

  /**
   * Whether this file is allowed, before a byte moves.
   *
   * The same rules the function enforces, checked in the browser first — it
   * fails in a tenth of a second instead of after a gigabyte. The check in the
   * function is still the one that counts.
   */
  check(file: File, area: BlobArea): PolicyProblem | null;

  /** Store one file. Rejects with `CancelledError` when the signal aborts. */
  start(file: File, options: StartOptions): Promise<StoredFile>;

  /** Remove one, by the key `start` returned. */
  remove(pathname: string): Promise<void>;

  /**
   * A stored id → something `<img src>` can load.
   *
   * A private blob cannot be addressed directly, so a screen that holds ids
   * rather than URLs needs this to render one at all.
   */
  resolveUrl(fileId: string): string;

  /** True when nothing actually leaves the browser. */
  readonly demo: boolean;
}

export interface StartOptions {
  area: BlobArea;
  /** The record this file belongs to; becomes part of the key. */
  slug: string;
  /** Many files per record keep their own names; one file overwrites itself. */
  multiple?: boolean;
  /** 0–1. Called often enough to animate, not often enough to thrash. */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

export interface UploadPolicy {
  area: BlobArea;
  kinds: FileKind[];
  /** For `<input accept>`. */
  accept: string;
  maxBytes: number;
  /** One line a person can read: "JPEG, PNG, WebP or GIF, up to 25 MB". */
  describe: string;
}

export interface PolicyProblem {
  code: "type" | "size";
  message: string;
}

export type UploadStatus = "queued" | "uploading" | "done" | "failed" | "cancelled";

/** One file's journey, which is what an upload list draws. */
export interface UploadTask {
  id: string;
  name: string;
  size: number;
  kind: FileKind | null;
  status: UploadStatus;
  /** 0–1. Meaningful while uploading; 1 once done. */
  progress: number;
  error?: string;
  result?: StoredFile;
}

/** Thrown when an upload is cancelled, so a retry can tell it from a failure. */
export class CancelledError extends Error {
  constructor() {
    super("Upload cancelled.");
    this.name = "CancelledError";
  }
}

export function isCancelled(err: unknown): boolean {
  return (
    err instanceof CancelledError ||
    (err instanceof Error && (err.name === "AbortError" || /abort|cancel/i.test(err.message)))
  );
}
