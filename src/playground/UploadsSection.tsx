import { useEffect, useState, type ReactNode } from "react";
import { FileRow, ImageField, ImagePreview, MediaPlayer, UploadField } from "../components/common";
import { formatBytes, readApiStatus, LIMITS, type StoredFile } from "../lib/blob";
import { Case, Section } from "./Case";

/**
 * Everything that stores or shows a file, against whatever backend is there.
 *
 * The banner at the top is the honest part: this workspace is normally
 * deployed with no Blob store, so the fields show files from the tab and say
 * nothing was stored. With `BLOB_READ_WRITE_TOKEN` and `BLOB_UPLOAD_SECRET`
 * set, the same fields write to the store for real.
 */
export function UploadsSection() {
  const [status, setStatus] = useState<{ demo: boolean; writable: boolean } | null>(null);
  const [portrait, setPortrait] = useState<StoredFile | null>(null);
  const [product, setProduct] = useState<StoredFile | null>(null);
  const [docs, setDocs] = useState<StoredFile[]>([]);
  const [media, setMedia] = useState<StoredFile[]>([]);

  useEffect(() => {
    void readApiStatus().then((s) => setStatus({ demo: s.demo, writable: s.writable }));
  }, []);

  return (
    <Section id="uploads" title="Media, documents & uploads">
      <p
        style={{
          fontSize: 12,
          lineHeight: 1.6,
          color: "var(--ink-mute)",
          background: "var(--surface-sunk)",
          border: "1px solid var(--rule)",
          borderRadius: "var(--r-sm)",
          padding: "10px 12px",
          marginBottom: 18,
        }}
      >
        {status === null
          ? "Checking what the API can do…"
          : status.demo
            ? "No Blob store on this deployment — files stay in the tab, and the fields say so. Set BLOB_READ_WRITE_TOKEN and BLOB_UPLOAD_SECRET to store them."
            : status.writable
              ? "A Blob store is wired up and writable. Files picked here are stored for real."
              : "A Blob store is configured but BLOB_UPLOAD_SECRET is not set, so writes are refused."}
      </p>

      <Case label="Image field — private store, the acharya portrait" stack>
        <div style={{ display: "flex", gap: 28, alignItems: "flex-start", flexWrap: "wrap" }}>
          <ImageField
            area="acharya"
            slug="vivek-acharya"
            name="Vivek Acharya"
            value={portrait?.src}
            pathname={portrait?.pathname}
            onChange={setPortrait}
          />
          <div style={{ fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.7, maxWidth: "46ch" }}>
            Writes to <code>omnivarsity/acharya/&lt;slug&gt;/file.png</code> in the
            private store, overwriting itself, and comes back through the view
            function — a private blob cannot be loaded any other way. Key:{" "}
            <code>{portrait?.pathname || "—"}</code>
          </div>
        </div>
      </Case>

      <Case label="Image field — public store, a storefront picture" stack>
        <div style={{ display: "flex", gap: 28, alignItems: "flex-start", flexWrap: "wrap" }}>
          <ImageField
            area="store"
            slug="kitchen-garden-kit"
            name="Kitchen Garden Kit"
            value={product?.src}
            pathname={product?.pathname}
            onChange={setProduct}
            size={96}
          />
          <div style={{ fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.7, maxWidth: "46ch" }}>
            Same field, public prefix: the picture keeps its own URL, caches for
            a day and answers cross-origin, because a storefront image is the
            same bytes for everyone and is embedded elsewhere.
          </div>
        </div>
      </Case>

      <Case label="Documents — the acharya knowledge base" stack>
        <div style={{ width: "100%", maxWidth: 620 }}>
          <UploadField
            area="kb"
            slug="vivek-acharya"
            label="Documents"
            value={docs}
            onChange={setDocs}
            max={6}
          />
        </div>
        <p style={{ fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.7, maxWidth: "62ch" }}>
          PDF, Word, Excel, PowerPoint, CSV, Markdown, text and JSON — the set
          the application's knowledge base ingests, plus the Office types. The
          picker offers only those, because the prefix takes only those. A PDF
          opens inline under a sandbox CSP; everything else downloads.
        </p>
      </Case>

      <Case label="Video & audio — studio media, played in place" stack>
        <div style={{ width: "100%", maxWidth: 620 }}>
          <UploadField
            area="media"
            slug="diwali-dispatch"
            label="Media"
            value={media}
            onChange={setMedia}
            max={4}
          />
        </div>
        <p style={{ fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.7, maxWidth: "62ch" }}>
          Up to {formatBytes(LIMITS.video.client)} of video and{" "}
          {formatBytes(LIMITS.audio.client)} of audio, browser-direct and in
          parts — a function body could not carry either. The player points at
          the read route, which answers byte ranges, so seeking works instead of
          waiting for the whole file.
        </p>
      </Case>

      <Case label="Rows and players, without a field around them" stack>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 620 }}>
          <FileRow file={sample("Site survey — Newtown duplex.pdf", "document", 1_840_000)} />
          <FileRow file={sample("Q3 dispatch volumes.xlsx", "document", 412_000)} />
          <FileRow file={sample("kaarigar-intake.csv", "data", 38_400)} />
          <MediaPlayer file={sample("Walkthrough, block C.mp4", "video", 214_000_000)} height={150} />
        </div>
      </Case>

      <Case label="Preview — loading, loaded, empty, and failed" stack>
        <div style={{ display: "flex", gap: 18, alignItems: "flex-end", flexWrap: "wrap" }}>
          <Frame caption="Empty">
            <ImagePreview name="Neeranjan Acharya" size={72} />
          </Frame>
          <Frame caption="Circle, empty">
            <ImagePreview name="Esha Acharya" size={72} shape="circle" />
          </Frame>
          <Frame caption="Failed → initials">
            <ImagePreview src="/api/blob/view?pathname=omnivarsity/acharya/none/file.png" name="Bikram Acharya" size={72} />
          </Frame>
          <Frame caption="Loaded">
            <ImagePreview src={SAMPLE} name="Sample" size={72} />
          </Frame>
        </div>
      </Case>
    </Section>
  );
}

/** A stored file that was never stored — for the rows that only demonstrate. */
function sample(name: string, kind: StoredFile["kind"], size: number): StoredFile {
  return { src: "", url: "", pathname: "", name, size, type: "", kind, demo: true };
}

function Frame({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
      {children}
      <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-mute)" }}>
        {caption}
      </span>
    </div>
  );
}

/** A tiny inline picture, so the loaded state needs no network. */
const SAMPLE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72"><rect width="72" height="72" fill="#254a33"/><circle cx="36" cy="28" r="12" fill="#dde5cb"/><path d="M12 72c4-16 12-24 24-24s20 8 24 24z" fill="#dde5cb"/></svg>`,
  );
