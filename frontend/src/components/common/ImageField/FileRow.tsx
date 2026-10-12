import { FileKindIcon } from "./FileKindIcon";
import { downloadUrl, formatBytes, type StoredFile } from "../../../lib/blob";

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
  );
}
