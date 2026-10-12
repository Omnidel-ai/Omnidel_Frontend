"use client";
import { useTr } from "@/lib/client/language";

// ============================================================================
// MahAcharyaCreateAcharyaStub — Phase-2 entry-point shell.
//
// The conversational "create an Acharya by chatting with MahAcharya" flow is
// Phase 2 (see docs/superpowers/specs/2026-07-09-acharya-admin-overhaul-design.md,
// Lane D). This modal is a placeholder only — it wires no chat/tool logic, it
// just tells the admin the flow is coming and points them back to the manual
// form.
// ============================================================================

interface Props {
  open: boolean;
  onClose: () => void;
}

export function MahAcharyaCreateAcharyaStub({ open, onClose }: Props) {
  const tr = useTr();
  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-card">
        <h3 style={{ fontFamily: "var(--serif)", marginBottom: 12 }}>
          {tr("Create with MahAcharya")}
        </h3>
        <p>
          {tr("Conversational creation — describe the Acharya you want and MahAcharya drafts the persona for you — is coming soon. For now, use the form to create the Acharya directly.")}
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn-primary" onClick={onClose}>
            {tr("Got it")}
          </button>
        </div>
      </div>
    </div>
  );
}
