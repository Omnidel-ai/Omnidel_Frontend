"use client";

import { StageFieldsForm } from "@/components/omnidel/stage-fields-form";
import { useTr } from "@/lib/client/language";

export type StageDataCapturePanelProps = {
  leadId: string;
  stage: string;
  isLastStage?: boolean;
  apiBase?: string;
  context?: "pipeline" | "operations";
  /** Hide the panel title — used when the parent page already shows the stage name. */
  hideHeading?: boolean;
  /** Called after a partial save (Save Data). */
  onSaved?: () => void | Promise<void>;
  /** Called after Save & Next Stage succeeds. Falls back to onSaved when omitted. */
  onAdvanced?: () => void | Promise<void>;
};

function stageLabel(slug: string): string {
  return slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Shared stage-data block — same heading, copy, and form as the pipeline edit page. */
export function StageDataCapturePanel({
  leadId,
  stage,
  isLastStage,
  apiBase,
  context = "pipeline",
  hideHeading = false,
  onSaved,
  onAdvanced,
}: StageDataCapturePanelProps) {
  const tr = useTr();
  return (
    <>
      {!hideHeading && (
        <h3
          style={{
            fontFamily: "var(--serif)",
            marginBottom: 4,
            fontSize: 16,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          {stageLabel(stage)} {tr("(data)")}
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 9,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--ink-faint)",
              background: "var(--surface-sunk)",
              padding: "2px 6px",
              borderRadius: "var(--r-sm)",
            }}
          >
            {stage}
          </span>
        </h3>
      )}
      <p style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 20 }}>
        {context === "operations"
          ? tr("Fields configured for this operation stage. Save partial progress, or fill all required fields and move to the next stage.")
          : tr("Fields configured for this pipeline stage. Save partial progress, or fill all required fields and move to the next stage.")}
      </p>
      <StageFieldsForm
        key={stage}
        leadId={leadId}
        stage={stage}
        apiBase={apiBase}
        onSaved={onSaved}
        onAdvanced={onAdvanced}
        isLastStage={isLastStage}
      />
    </>
  );
}
