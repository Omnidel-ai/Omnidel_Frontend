import { useId, useRef, useState, type DragEvent } from "react";
import type { UploadPolicy } from "../../lib/upload";

export interface DropzoneProps {
  /** What this area accepts — drawn as the line under the prompt. */
  policy: UploadPolicy;
  onFiles: (files: File[]) => void;
  /** One file or several. Single replaces rather than appends. */
  multiple?: boolean;
  label?: string;
  disabled?: boolean;
  /** Shown instead of the prompt when the caller is at its limit. */
  full?: boolean;
}

/**
 * Drop files here, or click to choose them.
 *
 * A file input on its own is a button that says "no file chosen"; this is the
 * same input with the two things people actually do — dragging a file onto the
 * page, and clicking anywhere in a target big enough to hit.
 *
 * Three details that are the whole difference between this and a styled input:
 *
 *   - **`dragenter`/`dragleave` are counted, not toggled.** They fire for every
 *     child element crossed, so a naive toggle flickers the highlight as the
 *     pointer moves over the text inside the zone.
 *   - **It is a `<button>`**, so the keyboard reaches it and says what it is,
 *     rather than a `<div>` with a click handler that a screen reader passes by.
 *   - **The policy is written on it** — what may be dropped and how large —
 *     because the alternative is finding out after choosing.
 */
export function Dropzone({
  policy,
  onFiles,
  multiple = true,
  label,
  disabled = false,
  full = false,
}: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const [over, setOver] = useState(false);
  const describedBy = useId();

  const blocked = disabled || full;

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    depth.current = 0;
    setOver(false);
    if (blocked) return;
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length > 0) onFiles(multiple ? files : files.slice(0, 1));
  }

  return (
    <>
      <button
        type="button"
        className={["dropzone", over && "dropzone--over", blocked && "dropzone--blocked"]
          .filter(Boolean)
          .join(" ")}
        disabled={blocked}
        aria-describedby={describedBy}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(e) => {
          e.preventDefault();
          depth.current += 1;
          if (!blocked) setOver(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => {
          e.preventDefault();
          depth.current -= 1;
          if (depth.current <= 0) {
            depth.current = 0;
            setOver(false);
          }
        }}
        onDrop={handleDrop}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 16V4M8 8l4-4 4 4" />
          <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
        </svg>
        <span className="dropzone__prompt">
          {full
            ? "No room for more files here"
            : over
              ? "Drop to upload"
              : (label ?? (multiple ? "Drop files here, or click to choose" : "Drop a file here, or click to choose"))}
        </span>
        <span className="dropzone__policy" id={describedBy}>
          {policy.describe}
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={policy.accept}
        disabled={blocked}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) onFiles(files);
          // Cleared so choosing the same file twice in a row still fires.
          e.target.value = "";
        }}
        style={{ display: "none" }}
      />
    </>
  );
}
