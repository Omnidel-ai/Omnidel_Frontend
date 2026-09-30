import { useState } from "react";
import { Dropzone } from "./Dropzone";
import { UploadList } from "./UploadList";
import { FileRow } from "../ImageField";
import { useUploadClient, useUploadQueue } from "../../lib/upload";
import type { BlobArea, StoredFile } from "../../lib/blob";

export interface UploadFieldProps {
  /** Which prefix these files belong to — it decides the store and the kinds. */
  area: BlobArea;
  /** The record they belong to. Becomes part of each stored key. */
  slug: string;
  value: StoredFile[];
  onChange: (next: StoredFile[]) => void;
  label?: string;
  /** One file, or several. Single replaces what is there. */
  multiple?: boolean;
  max?: number;
  disabled?: boolean;
}

/**
 * The whole upload control: a dropzone, what is in flight, and what has landed.
 *
 * The three parts are separate components on purpose — a screen that already
 * has its own file list wants only the `Dropzone`, and one that uploads from a
 * menu wants only the `UploadList` — and this is the arrangement most screens
 * want, so it exists rather than being assembled four times.
 *
 * It takes its client from context, which is what lets the playground drive
 * the same control through a mock: slow progress, a cancel that lands
 * mid-flight, a failure with a retry after it.
 *
 * In-flight rows and stored rows are drawn by different components because
 * they answer different questions — one is "how far along", the other is "what
 * is attached". A row that finishes moves from the first list to the second.
 */
export function UploadField({
  area,
  slug,
  value,
  onChange,
  label = "Files",
  multiple = true,
  max = 10,
  disabled = false,
}: UploadFieldProps) {
  const client = useUploadClient();
  const [stored, setStored] = useState<StoredFile[]>(value);

  const queue = useUploadQueue({
    client,
    area,
    slug,
    multiple,
    onStored: (file) => {
      const next = multiple ? [...stored, file] : [file];
      setStored(next);
      onChange(next);
    },
  });

  const policy = client.policy(area);
  const full = stored.length >= max;

  function remove(file: StoredFile) {
    // The row goes first: the caller's list is what the screen believes, and a
    // delete that fails on a blob nothing references any more is not worth
    // putting a row back for.
    const next = stored.filter((f) => f !== file);
    setStored(next);
    onChange(next);
    if (file.pathname) void client.remove(file.pathname);
  }

  return (
    <div className="upload-field">
      <div className="upload-field__head">
        <span className="form-label" style={{ margin: 0 }}>
          {label}
        </span>
        <span className="upload-field__count">
          {stored.length}/{max}
        </span>
        {client.demo && <span className="upload-field__demo">nothing is stored</span>}
      </div>

      <Dropzone
        policy={policy}
        multiple={multiple}
        disabled={disabled}
        full={full}
        onFiles={(files) => queue.add(files.slice(0, Math.max(0, max - stored.length)))}
      />

      <UploadList queue={queue} hideDone />

      {stored.length > 0 && (
        <ul className="upload-field__stored">
          {stored.map((file) => (
            <li key={file.pathname || file.name}>
              <FileRow file={file} onRemove={disabled ? undefined : () => remove(file)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
