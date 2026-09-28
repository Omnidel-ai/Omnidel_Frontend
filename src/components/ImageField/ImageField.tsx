import { useRef, useState } from "react";
import { emitToast } from "../Toast";
import { ImagePreview } from "./ImagePreview";
import { deleteBlob, uploadImage, type BlobArea, type UploadedImage } from "../../lib/blob";

export interface ImageFieldProps {
  /** Which prefix this picture belongs to — it decides public or private. */
  area: BlobArea;
  /** The record the picture belongs to. Becomes part of the stored key. */
  slug: string;
  /** What is there now: a blob URL, a stored key, or nothing. */
  value?: string | null;
  /** The stored key, when the caller has it — needed to remove the old one. */
  pathname?: string | null;
  onChange: (next: UploadedImage | null) => void;
  /** For the initials behind an empty frame. */
  name?: string;
  size?: number;
  shape?: "square" | "circle";
  /** Sent as `x-upload-secret` when the deployment asks for one. */
  secret?: string;
  disabled?: boolean;
}

/**
 * Pick a picture, see it, replace it, remove it.
 *
 * The same field the application puts on an acharya: the frame with the
 * initials behind it, one button that says Upload or Change depending on what
 * is there, and Remove only once there is something to remove.
 *
 * The upload itself is `uploadImage`, which tries the browser-direct route
 * first and the function second. Two things this field does with the result
 * are worth naming:
 *
 *   - **it replaces before it deletes.** The new key is written, the caller is
 *     told, and only then is the old one removed — so a failed delete leaves a
 *     stray blob rather than a record pointing at nothing.
 *   - **it says when nothing was stored.** With no Blob store the picture is an
 *     object URL that lasts as long as the tab, and the line under the field
 *     says so instead of letting it look saved.
 */
export function ImageField({
  area,
  slug,
  value,
  pathname,
  onChange,
  name = "",
  size = 88,
  shape = "square",
  secret,
  disabled = false,
}: ImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);

  async function pick(file: File) {
    setBusy(true);
    setError(null);
    try {
      const previous = pathname ?? "";
      const uploaded = await uploadImage(file, { area, slug, secret });
      onChange(uploaded);
      setDemo(uploaded.demo);
      if (previous && previous !== uploaded.pathname) {
        await deleteBlob(previous, secret);
      }
      emitToast(uploaded.demo ? "Picture shown — nothing was stored." : "Picture updated.", uploaded.demo ? "info" : "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      emitToast(message, "error");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      if (pathname) await deleteBlob(pathname, secret);
      onChange(null);
      setDemo(false);
      emitToast("Picture removed.", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      emitToast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flexShrink: 0 }}>
      <ImagePreview src={value} name={name} size={size} shape={shape} />

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          disabled={disabled || busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void pick(file);
          }}
          style={{ display: "none" }}
        />
        <button
          type="button"
          className="btn-ghost btn-sm"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Uploading…" : value ? "Change photo" : "Upload photo"}
        </button>
        {value && (
          <button
            type="button"
            className="btn-ghost btn-sm"
            disabled={disabled || busy}
            onClick={() => void remove()}
          >
            Remove
          </button>
        )}
      </div>

      {demo && !error && (
        <p style={{ fontSize: 11, color: "var(--ink-mute)", textAlign: "center", maxWidth: size + 90 }}>
          Shown from this tab — no Blob store is configured, so nothing was uploaded.
        </p>
      )}
      {error && (
        <p style={{ fontSize: 11, color: "var(--crit)", textAlign: "center", maxWidth: size + 90 }}>
          {error}
        </p>
      )}
    </div>
  );
}
