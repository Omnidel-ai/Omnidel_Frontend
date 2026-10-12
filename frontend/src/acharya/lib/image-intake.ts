"use client";

import { upload } from "@vercel/blob/client";

/**
 * Two ways an image enters this app, and they have DIFFERENT correct answers.
 *
 * A serverless function request body is capped at roughly 4.5 MB by the
 * platform — it answers `FUNCTION_PAYLOAD_TOO_LARGE` with a plain-text 413
 * before any of our code runs. Every path below used to claim a 10 MB limit
 * while silently failing well under it.
 *
 *  1. EVIDENCE (proof photos, chat photos posted as task notes)
 *     Must not be recompressed — a reviewer may need the detail. So the file
 *     goes browser→Blob with a client token and never touches a function body.
 *     10 MB is then genuinely available. See uploadViaClientToken().
 *
 *  2. VISION INPUT (a photo attached to an Acharya chat turn)
 *     Sent inline as a base64 data URL in the chat JSON, which INFLATES it by
 *     about a third — so a 3.4 MB photo already exceeds the body cap. Here
 *     downscaling is the right answer rather than a lower limit: the vision
 *     model reduces resolution internally anyway, so full-resolution bytes buy
 *     nothing but latency and cost. See toVisionDataUrl().
 */

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_MB = 10;

export function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Strip anything that could confuse a blob pathname; keep it recognisable. */
function safeName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(-64);
  return cleaned || "photo.jpg";
}

export type BlobFolder = "proof" | "chat";

/**
 * Upload one file browser→Blob. The token route requires a karigar session and
 * pins the pathname, so the folder cannot be used to write elsewhere.
 * Throws with a message naming the file — never a bare status code.
 */
export async function uploadViaClientToken(
  picked: File,
  folder: BlobFolder,
): Promise<{ url: string; mime: string; name: string }> {
  // Oversize → shrunk by the smallest step that fits; HEIC/HEIF/AVIF → JPEG
  // (the token route refuses those, and a reviewer's browser cannot paint
  // them). Anything already fine passes through untouched. Every caller gets
  // this, so no picker can hand a raw phone photo straight to the store.
  const file = await prepareForUpload(picked);
  try {
    try {
      const blob = await upload(`${folder}/${Date.now()}-${safeName(file.name)}`, file, {
        access: "private",
        contentType: file.type || "image/jpeg",
        handleUploadUrl: "/api/work/uploads/token",
      });
      return { url: blob.url, mime: file.type || "image/jpeg", name: file.name };
    } catch (directErr) {
      const raw = directErr instanceof Error ? directErr.message : "";
      // Production must surface the real reason. Retrying through the
      // function would only hit the ~4.5 MB body cap and replace the actual
      // error with a meaningless "Upload failed (413)".
      if (/unauthor/i.test(raw) || !ALLOW_SERVER_UPLOAD_FALLBACK) throw directErr;
      return await uploadViaServerProxy(file);
    }
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    if (/unauthor/i.test(raw)) throw new Error("Your session expired — please sign in again.");
    throw new Error(`“${picked.name}” could not be uploaded. ${raw || "Please try again."}`.trim());
  }
}

/**
 * Local dev often has no BLOB_READ_WRITE_TOKEN, so the client-token route
 * cannot issue a token there; the multipart hop through OmniDel still works
 * for small files. NEVER in production: that path sends the file through a
 * function body and dies at ~4.5 MB — the exact mobile failure this module
 * exists to avoid. `process.env.NODE_ENV` is inlined at build time.
 */
export const ALLOW_SERVER_UPLOAD_FALLBACK = process.env.NODE_ENV !== "production";

/** Multipart hop through /api/work/uploads → OmniDel. Dev fallback only. */
export async function uploadViaServerProxy(
  file: File,
): Promise<{ url: string; mime: string; name: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/work/uploads", { method: "POST", body: form });
  const data = (await res.json().catch(() => null)) as
    | { url?: string; type?: string; error?: string }
    | null;
  if (!res.ok || !data?.url) {
    throw new Error(data?.error || `Upload failed (${res.status})`);
  }
  return { url: data.url, mime: data.type || file.type || "image/jpeg", name: file.name };
}

/**
 * Make one picked file uploadable: images are fitted under the limit and
 * re-encoded if unpaintable; PDFs only get the size check. Throws a message
 * naming the file when it cannot be made to fit or cannot be decoded.
 */
export async function prepareForUpload(file: File): Promise<File> {
  const isImage = file.type === "" || /^image\//i.test(file.type) || needsReencoding(file);
  if (!isImage) {
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error(
        `“${file.name}” is ${formatMb(file.size)} — each file must be under ${MAX_IMAGE_MB} MB.`,
      );
    }
    return file;
  }
  const fitted = await fitWithinLimit(file);
  if (!fitted) {
    throw new Error(
      `Could not read “${file.name}” (${formatMb(file.size)}) — please retake it or pick another photo.`,
    );
  }
  return fitted.file;
}

/**
 * Shrink a photo JUST ENOUGH to get under the limit, and only when it is over.
 *
 * Evidence should not be recompressed — but a photo that is refused outright is
 * worse than a slightly lighter one, because the karigar loses the proof
 * entirely and often cannot retake it. So: files already within the limit are
 * passed through UNTOUCHED, and only an oversize file is reduced, by the
 * smallest step that fits.
 *
 * Returns null when the browser cannot decode the file (HEIC on some Androids),
 * in which case the caller reports it rather than silently dropping it.
 */
const FIT_EDGE_STEPS = [4096, 3200, 2600, 2000, 1600];
const FIT_QUALITY_STEPS = [0.92, 0.86, 0.8, 0.72];

/**
 * Formats a reviewer's browser cannot paint. A phone may hand us HEIC/HEIF even
 * when the file is small, and Chrome on desktop shows a broken image for it even
 * though the bytes arrive intact — so these must be re-encoded regardless of size.
 */
const UNPAINTABLE = /^image\/(heic|heif|avif)$/i;

export function needsReencoding(file: File): boolean {
  return UNPAINTABLE.test(file.type) || /\.(heic|heif|avif)$/i.test(file.name);
}

export async function fitWithinLimit(
  file: File,
): Promise<{ file: File; originalBytes: number } | null> {
  // Within the limit AND paintable → pass through untouched. This is what keeps
  // ordinary evidence at full fidelity.
  if (file.size <= MAX_IMAGE_BYTES && !needsReencoding(file)) {
    return { file, originalBytes: file.size };
  }
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return null;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }

  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Largest edge first, highest quality first — stop at the first fit so we
    // give away as little detail as possible.
    for (const edge of FIT_EDGE_STEPS) {
      const longest = Math.max(bitmap.width, bitmap.height);
      const scale = longest > edge ? edge / longest : 1;
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      for (const quality of FIT_QUALITY_STEPS) {
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", quality),
        );
        if (!blob) return null;
        if (blob.size <= MAX_IMAGE_BYTES) {
          const renamed = file.name.replace(/\.[^.]+$/, "") + ".jpg";
          return {
            file: new File([blob], renamed, { type: "image/jpeg" }),
            originalBytes: file.size,
          };
        }
      }
    }
    return null; // even the smallest step could not fit — vanishingly unlikely
  } finally {
    bitmap.close?.();
  }
}

/** Longest edge for a vision input. Beyond this the model gains nothing. */
const VISION_MAX_EDGE = 1600;
const VISION_QUALITY = 0.82;

/**
 * Downscale a photo and return a JPEG data URL fit to travel inside a chat
 * request. A 4000px phone photo lands around 200–500 KB, so the body cap stops
 * being reachable and slow connections stop timing out.
 *
 * Falls back to the original file if the browser cannot decode it, so an
 * unusual format degrades to the old behaviour instead of failing outright.
 */
export async function toVisionDataUrl(file: File): Promise<string> {
  const asDataUrl = () =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not read that image."));
      reader.readAsDataURL(file);
    });

  if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
    return asDataUrl();
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return asDataUrl();
  }

  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = longest > VISION_MAX_EDGE ? VISION_MAX_EDGE / longest : 1;
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return asDataUrl();
    ctx.drawImage(bitmap, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", VISION_QUALITY);
  } finally {
    bitmap.close?.();
  }
}
