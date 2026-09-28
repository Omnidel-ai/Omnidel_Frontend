import { useRef, useState } from "react";
import { emitToast } from "../Toast";
import { FileKindIcon } from "./FileKindIcon";
import { MediaPlayer } from "./MediaPlayer";
import {
  acceptFor,
  deleteBlob,
  downloadUrl,
  formatBytes,
  uploadFile,
  type BlobArea,
  type StoredFile,
} from "../../lib/blob";

export interface FileFieldProps {
  /** Which prefix these files belong to — it decides the store and the kinds. */
  area: BlobArea;
  /** The record they belong to. Becomes part of each stored key. */
  slug: string;
  value: StoredFile[];
  onChange: (next: StoredFile[]) => void;
  label?: string;
  /** Cap on how many may be attached. */
  max?: number;
  /** Sent as `x-upload-secret` when the deployment asks for one. */
  secret?: string;
  disabled?: boolean;
}

/**
 * Attachments: pick files, see what is attached, play or download one, remove.
 *
 * The pipeline's attachment list and the knowledge base's document list are the
 * same control with a different prefix, so this takes the area and lets the
 * rules follow from it — a knowledge-base field will not accept a video
 * because its prefix does not, and the file picker only offers what fits.
 *
 * Three things here that a plain file input does not do:
 *
 *   - **progress that means something.** A browser-direct upload reports real
 *     progress, so a 200 MB recording shows a bar rather than a spinner.
 *   - **media plays in place.** Video and audio are the two kinds you cannot
 *     judge from a name, so they get a player rather than a row.
 *   - **each row says what it is.** Kind glyph, name, size, and a download link
 *     that forces the save dialog even for the types the browser would rather
 *     render.
 */
export function FileField({
  area,
  slug,
  value,
  onChange,
  label = "Attachments",
  max = 10,
  secret,
  disabled = false,
}: FileFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);

  async function add(files: FileList) {
    setBusy(true);
    setError(null);
    const room = max - value.length;
    const picked = Array.from(files).slice(0, Math.max(0, room));
    if (picked.length < files.length) {
      emitToast(`Only ${room} more file${room === 1 ? "" : "s"} fit here.`, "info");
    }

    const added: StoredFile[] = [];
    for (const file of picked) {
      try {
        setProgress(0);
        const stored = await uploadFile(file, {
          area,
          slug,
          multiple: true,
          secret,
          onProgress: setProgress,
        });
        added.push(stored);
        if (stored.demo) setDemo(true);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        emitToast(message, "error");
      }
    }

    if (added.length > 0) {
      onChange([...value, ...added]);
      emitToast(
        added.some((f) => f.demo)
          ? `${added.length} file${added.length === 1 ? "" : "s"} shown — nothing was stored.`
          : `${added.length} file${added.length === 1 ? "" : "s"} attached.`,
        added.some((f) => f.demo) ? "info" : "success",
      );
    }
    setProgress(null);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function remove(file: StoredFile) {
    // The row goes first: the caller's list is what the screen believes, and a
    // delete that fails on a blob nobody references any more is not worth
    // putting the row back for.
    onChange(value.filter((f) => f !== file));
    if (file.pathname) await deleteBlob(file.pathname, secret);
  }

  const full = value.length >= max;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="form-label" style={{ margin: 0 }}>
          {label}
        </span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-mute)" }}>
          {value.length}/{max}
        </span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={acceptFor(area)}
          disabled={disabled || busy || full}
          onChange={(e) => {
            const files = e.target.files;
            if (files && files.length > 0) void add(files);
          }}
          style={{ display: "none" }}
        />
        <button
          type="button"
          className="btn-ghost btn-sm"
          style={{ marginLeft: "auto" }}
          disabled={disabled || busy || full}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Uploading…" : full ? "Full" : "Add files"}
        </button>
      </div>

      {progress !== null && (
        <div className="mart-kpi__track" aria-label="Upload progress">
          <span
            className="mart-kpi__fill"
            style={{ width: `${Math.round(progress * 100)}%`, background: "var(--green-deep)" }}
          />
        </div>
      )}

      {value.length === 0 ? (
        <p style={{ fontSize: 12.5, color: "var(--ink-mute)", padding: "10px 0" }}>
          Nothing attached yet.
        </p>
      ) : (
        <ul style={{ display: "flex", flexDirection: "column", gap: 8, listStyle: "none", minWidth: 0 }}>
          {value.map((file) => (
            <li key={file.pathname || file.name} style={{ minWidth: 0 }}>
              {file.kind === "video" || file.kind === "audio" ? (
                <MediaPlayer file={file} onRemove={disabled ? undefined : () => void remove(file)} />
              ) : (
                <FileRow file={file} onRemove={disabled ? undefined : () => void remove(file)} />
              )}
            </li>
          ))}
        </ul>
      )}

      {demo && !error && (
        <p style={{ fontSize: 11, color: "var(--ink-mute)" }}>
          Shown from this tab — no Blob store is configured, so nothing was uploaded.
        </p>
      )}
      {error && <p style={{ fontSize: 11, color: "var(--crit)" }}>{error}</p>}
    </div>
  );
}

/** One attached file: what it is, what it is called, how big, and two links. */
export function FileRow({ file, onRemove }: { file: StoredFile; onRemove?: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        minWidth: 0,
        padding: "8px 10px",
        background: "var(--surface)",
        border: "1px solid var(--rule)",
        borderRadius: "var(--r-sm)",
      }}
    >
      <span style={{ color: "var(--green-deep)", display: "inline-flex", flexShrink: 0 }}>
        <FileKindIcon kind={file.kind} />
      </span>
      <span className="picker-truncate" style={{ fontSize: 13, minWidth: 0 }} title={file.name}>
        {file.name}
      </span>
      <span
        style={{
          fontFamily: "var(--mono)",
          fontSize: 10,
          color: "var(--ink-mute)",
          marginLeft: "auto",
          flexShrink: 0,
        }}
      >
        {formatBytes(file.size)}
      </span>
      {file.src && (
        <a
          href={downloadUrl(file.src)}
          download={file.name}
          className="btn-ghost btn-sm"
          style={{ flexShrink: 0, textDecoration: "none" }}
        >
          Download
        </a>
      )}
      {onRemove && (
        <button type="button" className="btn-ghost btn-sm" style={{ flexShrink: 0 }} onClick={onRemove}>
          Remove
        </button>
      )}
    </div>
  );
}
