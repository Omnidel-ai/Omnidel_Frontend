import { useState } from "react";
import { Button, ConfirmDialog, Input, Modal, emitToast } from "../components";
import { Case, Section } from "./Case";

export function OverlaysSection() {
  const [modal, setModal] = useState<null | "default" | "long" | "form">(null);
  const [confirm, setConfirm] = useState<null | "default" | "danger" | "reason" | "failing" | "alt">(
    null,
  );
  const [confirmError, setConfirmError] = useState<string | null>(null);

  function closeConfirm() {
    setConfirm(null);
    setConfirmError(null);
  }

  return (
    <Section id="overlays" title="Modals, dialogs & toasts">
      <Case label="Modal">
        <Button variant="secondary" onClick={() => setModal("default")}>
          Default
        </Button>
        <Button variant="secondary" onClick={() => setModal("form")}>
          With a form
        </Button>
        <Button variant="secondary" onClick={() => setModal("long")}>
          Long content (scrolls)
        </Button>
      </Case>

      <Case label="ConfirmDialog">
        <Button variant="secondary" onClick={() => setConfirm("default")}>
          Default
        </Button>
        <Button variant="danger" onClick={() => setConfirm("danger")}>
          Destructive
        </Button>
        <Button variant="secondary" onClick={() => setConfirm("reason")}>
          Requires a reason
        </Button>
        <Button variant="secondary" onClick={() => setConfirm("failing")}>
          Action that fails
        </Button>
        <Button variant="secondary" onClick={() => setConfirm("alt")}>
          Third option
        </Button>
      </Case>

      <Case label="Toasts">
        <Button variant="secondary" onClick={() => emitToast("Saved 12 lanes", "success")}>
          Success
        </Button>
        <Button variant="secondary" onClick={() => emitToast("Nothing changed", "info")}>
          Info
        </Button>
        <Button variant="secondary" onClick={() => emitToast("You don't have permission to do that")}>
          Error
        </Button>
      </Case>

      <Modal
        open={modal === "default"}
        onClose={() => setModal(null)}
        title="Move lane"
        description="Pick the workspace this lane should belong to."
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button onClick={() => setModal(null)}>Move</Button>
          </>
        }
      >
        <p style={{ fontSize: 13, color: "var(--ink-soft)" }}>
          Anything can go in the body — the modal only supplies the scrim, the card, the focus trap
          and the footer row.
        </p>
      </Modal>

      <Modal
        open={modal === "form"}
        onClose={() => setModal(null)}
        title="New lane"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button onClick={() => setModal(null)}>Create</Button>
          </>
        }
      >
        <div style={{ display: "grid", gap: 14 }}>
          <Input label="Name" placeholder="Newtown → Barasat" required />
          <Input label="Code" placeholder="LN-044" hint="Used on delivery labels." />
        </div>
      </Modal>

      <Modal
        open={modal === "long"}
        onClose={() => setModal(null)}
        title="Release notes"
        footer={<Button onClick={() => setModal(null)}>Done</Button>}
      >
        <div style={{ display: "grid", gap: 10 }}>
          {Array.from({ length: 14 }).map((_, i) => (
            <p key={i} style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6 }}>
              {i + 1}. The card scrolls inside itself and stays within the viewport, so a long body
              never pushes the footer buttons off the screen.
            </p>
          ))}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirm === "default"}
        title="Publish this lane?"
        description="It becomes visible to dispatchers straight away."
        confirmLabel="Publish"
        onCancel={closeConfirm}
        onConfirm={async () => {
          await wait(800);
          closeConfirm();
          emitToast("Lane published", "success");
        }}
      />

      <ConfirmDialog
        open={confirm === "danger"}
        title="Archive Lane 12?"
        description="Archived lanes stop accepting new stops. You can restore it later."
        confirmTone="danger"
        confirmLabel="Archive"
        onCancel={closeConfirm}
        onConfirm={async () => {
          await wait(600);
          closeConfirm();
          emitToast("Lane archived", "info");
        }}
      />

      <ConfirmDialog
        open={confirm === "reason"}
        title="Reject this submission?"
        confirmTone="danger"
        confirmLabel="Reject"
        requireText={{
          label: "Reason",
          placeholder: "Tell the submitter what to fix…",
          minLength: 10,
        }}
        onCancel={closeConfirm}
        onConfirm={async () => {
          await wait(500);
          closeConfirm();
        }}
      />

      <ConfirmDialog
        open={confirm === "failing"}
        title="Archive the default language?"
        description="This one always fails, to show where the error lands."
        confirmTone="danger"
        confirmLabel="Archive"
        error={confirmError}
        onCancel={closeConfirm}
        onConfirm={async () => {
          await wait(600);
          setConfirmError("The default language cannot be archived (400).");
        }}
      />

      <ConfirmDialog
        open={confirm === "alt"}
        title="Discard unsaved changes?"
        description="You have edits that have not been saved."
        confirmTone="danger"
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        altAction={{
          label: "Save",
          onClick: async () => {
            await wait(500);
            closeConfirm();
            emitToast("Saved", "success");
          },
        }}
        onCancel={closeConfirm}
        onConfirm={closeConfirm}
      />
    </Section>
  );
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
