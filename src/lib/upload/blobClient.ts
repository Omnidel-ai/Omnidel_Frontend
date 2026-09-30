import {
  BLOB_AREAS,
  LIMITS,
  acceptFor,
  blobViewUrl,
  deleteBlob,
  formatBytes,
  kindOf,
  uploadFile,
  type BlobArea,
  type FileKind,
} from "../blob";
import { CancelledError, type PolicyProblem, type UploadClient, type UploadPolicy } from "./types";

/**
 * The real client: Vercel Blob, through the handlers in `api/`.
 *
 * Thin on purpose — `uploadFile` already knows the three routes and which one
 * a file should take. What this adds is the two things a control needs and
 * that function does not provide: a policy it can show, and a cancel.
 */
export function createBlobUploadClient(secret?: string): UploadClient {
  return {
    demo: false,

    policy(area) {
      return policyFor(area);
    },

    check(file, area) {
      return checkAgainst(file, area);
    },

    async start(file, options) {
      const problem = checkAgainst(file, options.area);
      if (problem) throw new Error(problem.message);

      // Cancellation is cooperative: `upload()` takes the signal and stops
      // in-flight parts, and this race makes the rejection immediate rather
      // than waiting for the current part to notice.
      const upload = uploadFile(file, {
        area: options.area,
        slug: options.slug,
        multiple: options.multiple,
        secret,
        onProgress: options.onProgress,
        signal: options.signal,
      });

      if (!options.signal) return upload;
      return Promise.race([upload, rejectOnAbort(options.signal)]);
    },

    async remove(pathname) {
      await deleteBlob(pathname, secret);
    },

    resolveUrl(fileId) {
      return blobViewUrl(fileId);
    },
  };
}

function rejectOnAbort(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    if (signal.aborted) return reject(new CancelledError());
    signal.addEventListener("abort", () => reject(new CancelledError()), { once: true });
  });
}

/** Shared by both clients, so the mock refuses exactly what the real one does. */
export function policyFor(area: BlobArea): UploadPolicy {
  const kinds = BLOB_AREAS[area].kinds as FileKind[];
  const maxBytes = Math.max(...kinds.map((k) => LIMITS[k].client));
  return {
    area,
    kinds,
    accept: acceptFor(area),
    maxBytes,
    describe: `${kinds.join(", ")} — up to ${formatBytes(maxBytes)}`,
  };
}

export function checkAgainst(file: File, area: BlobArea): PolicyProblem | null {
  const kinds = BLOB_AREAS[area].kinds as readonly FileKind[];
  const kind = kindOf(file);
  if (!kind) {
    return { code: "type", message: `${file.name} is not a type this workspace stores.` };
  }
  if (!kinds.includes(kind)) {
    return { code: "type", message: `${file.name} is a ${kind}; this field takes ${kinds.join(", ")}.` };
  }
  const cap = LIMITS[kind].client;
  if (file.size > cap) {
    return {
      code: "size",
      message: `${file.name} is ${formatBytes(file.size)}, over the ${formatBytes(cap)} limit for ${kind}.`,
    };
  }
  return null;
}
