import type { FileKind } from "../../../lib/blob";

const GLYPHS: Record<FileKind, React.ReactNode> = {
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="M21 16l-5-5-6 6-3-3-4 4" />
    </>
  ),
  video: (
    <>
      <rect x="2" y="5" width="14" height="14" rx="2" />
      <path d="M16 10l6-3v10l-6-3z" />
    </>
  ),
  audio: (
    <>
      <path d="M9 18V6l10-2v12" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="16.5" cy="16" r="2.5" />
    </>
  ),
  document: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </>
  ),
  data: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 12h6M9 16h6M9 8h2" />
    </>
  ),
};

/**
 * One glyph per kind — an image, a reel, a waveform, a page, a page of rows.
 *
 * Kind rather than extension: a `.docx` and an `.rtf` are the same thing to
 * someone scanning a list, and thirty extensions would need thirty glyphs to
 * say five things.
 */
export function FileKindIcon({ kind, size = 15 }: { kind: FileKind | null; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {GLYPHS[kind ?? "document"]}
    </svg>
  );
}
