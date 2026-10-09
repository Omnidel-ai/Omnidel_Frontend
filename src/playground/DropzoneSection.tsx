import { useMemo, useState, type ReactNode } from "react";
import { Button, PrivateImage, UploadField } from "../components/common";
import { UploadClientProvider, createMockUploadClient } from "../lib/upload";
import type { StoredFile } from "../lib/blob";
import { Case, Section } from "./Case";

/**
 * The upload control, driven by the mock.
 *
 * Everything here runs against `createMockUploadClient`, which is the point:
 * progress slow enough to read, a cancel that lands mid-flight, and a failure
 * with a retry after it — states a real store only gives you on a bad day.
 * The components are the ones that ship; only the client underneath differs.
 *
 * Name a file with "fail" in it to see the failure path. The mock refuses the
 * same types and sizes the functions do, so a wrong-typed file is refused here
 * exactly as it would be on the way to the store.
 */
export function DropzoneSection() {
  // Built once: a new client each render would restart the queue's callbacks.
  const slow = useMemo(() => createMockUploadClient({ duration: 4200 }), []);
  const brisk = useMemo(() => createMockUploadClient({ duration: 1400 }), []);

  const [attachments, setAttachments] = useState<StoredFile[]>([]);
  const [portrait, setPortrait] = useState<StoredFile[]>([]);
  const [fileId, setFileId] = useState("");

  return (
    <Section id="dropzone" title="Dropzone & upload queue">
      <p className="pg-note">
        Against the <strong>mock</strong> client — nothing is stored. Drag files in, or click.
        A file with <code>fail</code> in its name fails partway through, so the retry has
        something to retry.
      </p>

      <Case label="Many files — drop, progress, cancel, retry" stack>
        <div style={{ width: "100%", maxWidth: 620 }}>
          <UploadClientProvider client={slow}>
            <UploadField
              area="pipeline"
              slug="lead-4821"
              label="Attachments"
              value={attachments}
              onChange={setAttachments}
              max={6}
            />
          </UploadClientProvider>
        </div>
      </Case>

      <Case label="One file — single mode replaces rather than appends" stack>
        <div style={{ width: "100%", maxWidth: 620 }}>
          <UploadClientProvider client={brisk}>
            <UploadField
              area="acharya"
              slug="vivek-acharya"
              label="Portrait"
              multiple={false}
              max={1}
              value={portrait}
              onChange={setPortrait}
            />
          </UploadClientProvider>
        </div>
      </Case>

      <Case label="Disabled, and at its limit" stack>
        <div style={{ width: "100%", maxWidth: 620, display: "grid", gap: 14 }}>
          <UploadClientProvider client={brisk}>
            <UploadField area="kb" slug="locked" label="Read-only" value={[]} onChange={() => {}} disabled />
            <UploadField area="kb" slug="full" label="Full" max={0} value={[]} onChange={() => {}} />
          </UploadClientProvider>
        </div>
      </Case>

      <Case label="PrivateImage — a stored id, resolved by a prop" stack>
        <div style={{ display: "flex", gap: 18, alignItems: "flex-end", flexWrap: "wrap" }}>
          <Frame caption="Nothing stored">
            <PrivateImage fileId="" resolveUrl={() => ""} name="Neeranjan Acharya" size={72} />
          </Frame>
          <Frame caption="Resolver returns nothing">
            <PrivateImage fileId="acharya/vivek/file.png" resolveUrl={() => "/no-such-file.png"} name="Vivek Acharya" size={72} />
          </Frame>
          <Frame caption="Resolved">
            <PrivateImage fileId="sample" resolveUrl={() => SAMPLE} name="Sample" size={72} shape="circle" />
          </Frame>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 220 }}>
            <label className="form-label" htmlFor="pg-file-id">
              Any id, resolved through the real view route
            </label>
            <input
              id="pg-file-id"
              className="form-input"
              placeholder="omnivarsity/acharya/vivek/file.png"
              value={fileId}
              onChange={(e) => setFileId(e.target.value)}
            />
            <Button size="sm" variant="ghost" onClick={() => setFileId("")}>
              Clear
            </Button>
          </div>
          <Frame caption="Live">
            <PrivateImage
              fileId={fileId}
              resolveUrl={(id) => `/api/blob/view?pathname=${encodeURIComponent(id)}`}
              name="Live"
              size={72}
            />
          </Frame>
        </div>
      </Case>
    </Section>
  );
}

function Frame({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
      {children}
      <span
        style={{
          fontFamily: "var(--mono)",
          fontSize: 9.5,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ink-mute)",
        }}
      >
        {caption}
      </span>
    </div>
  );
}

const SAMPLE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72"><rect width="72" height="72" fill="#a74a2d"/><circle cx="36" cy="28" r="12" fill="#eccfb5"/><path d="M12 72c4-16 12-24 24-24s20 8 24 24z" fill="#eccfb5"/></svg>`,
  );
