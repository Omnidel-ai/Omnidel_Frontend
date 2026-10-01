import { useState } from "react";
import { FileKindIcon } from "./FileKindIcon";
import { blobViewUrl, downloadUrl, formatBytes, type StoredFile } from "../../lib/blob";

export interface MediaPlayerProps {
  file: StoredFile;
  onRemove?: () => void;
  /** Height of the video frame. Audio ignores it — a player is a player. */
  height?: number;
}

/**
 * A video or a recording, played where it sits.
 *
 * The element points at the read route rather than at the blob, which is what
 * makes a **private** recording playable: its own URL wants an Authorization
 * header that `<video src>` cannot send. The route answers byte ranges, so
 * seeking works and the browser does not fetch the whole file before it can
 * start — without that, scrubbing a 200 MB video does nothing for a minute.
 *
 * `preload="metadata"` fetches the header and stops: enough for the duration
 * and the first frame, not enough to pull a gigabyte nobody pressed play on.
 */
export function MediaPlayer({ file, onRemove, height = 200 }: MediaPlayerProps) {
  const [failed, setFailed] = useState(false);
  const src = blobViewUrl(file.src);
  // A row can exist before its file does — a listing that only knows the name,
  // or a demo row. An element with an empty src makes the browser re-request
  // the page, so there is nothing to render a player around.
  const playable = Boolean(src) && !failed;

  return (
    <div
      style={{
        border: "1px solid var(--rule)",
        borderRadius: "var(--r-sm)",
        background: "var(--surface)",
        overflow: "hidden",
        minWidth: 0,
      }}
    >
      {!playable ? (
        <p style={{ padding: "18px 12px", fontSize: 12.5, color: "var(--ink-mute)", textAlign: "center" }}>
          {failed ? `This ${file.kind} could not be played here.` : `Nothing to play yet.`}{" "}
          {file.src && (
            <a href={downloadUrl(file.src)} download={file.name} style={{ color: "var(--green-deep)" }}>
              Download it instead
            </a>
          )}
        </p>
      ) : file.kind === "video" ? (
        <video
          src={src}
          controls
          preload="metadata"
          onError={() => setFailed(true)}
          style={{ display: "block", width: "100%", height, background: "var(--ink)", objectFit: "contain" }}
        />
      ) : (
        <audio
          src={src}
          controls
          preload="metadata"
          onError={() => setFailed(true)}
          style={{ display: "block", width: "100%", padding: "10px 12px 0" }}
        />
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 10px",
          borderTop: "1px solid var(--rule)",
          minWidth: 0,
        }}
      >
        <span style={{ color: "var(--green-deep)", display: "inline-flex", flexShrink: 0 }}>
          <FileKindIcon kind={file.kind} />
        </span>
        <span className="picker-truncate" style={{ fontSize: 12.5, minWidth: 0 }} title={file.name}>
          {file.name}
        </span>
        <span className="ui-meta-sm"
 style={{ marginLeft: "auto", flexShrink: 0 }}
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
    </div>
  );
}
