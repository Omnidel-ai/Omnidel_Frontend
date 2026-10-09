"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { StageDataCapturePanel } from "@/components/omnidel/stage-data-capture-panel";
import { useIsMobile } from "@/lib/client/use-is-mobile";
import { useTr } from "@/lib/client/language";

type StageDataModalProps = {
  /** Lead id in pipeline context, operation id in operations context. */
  leadId: string;
  leadTitle: string;
  stage: string;
  /** Last active stage — hides "Save & Next Stage", leaving only "Save Data". */
  isLastStage?: boolean;
  apiBase?: string;
  /** Drives the panel's copy ("this pipeline stage" vs "this operation stage"). */
  context?: "pipeline" | "operations";
  /** Human label for `stage`. Operations stages carry admin-set labels; pipeline
   *  slugs format fine on their own, so this is optional. */
  stageLabel?: string;
  /** Kicker above the title. "Stage data" when editing in place, "Next stage"
   *  when the caller's button is about advancing. */
  eyebrow?: string;
  onClose: () => void;
  onSaved?: () => void | Promise<void>;
  /** After "Save & Next Stage". The modal closes itself once this resolves. */
  onAdvanced?: () => void | Promise<void>;
  /**
   * Terminal outcome for a lead sitting on the FINAL stage, where there is no
   * next stage to advance to — the decision is won or lost. Callers pass this
   * only when `isLastStage`, and own the endpoints (pipeline's won/lost differ
   * from operations' complete/lost). Omit it and the block doesn't render.
   */
  outcome?: {
    onWon: () => void | Promise<void>;
    onLost: (reason: string) => void | Promise<void>;
  };
};

function formatSlug(slug: string): string {
  return slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * The stage-capture form as a dialog — shared by the pipeline list, both stage
 * queues, and anywhere else a row needs to fill in or advance a stage without
 * losing its page, filters and scroll position.
 *
 * Sits at --z-modal (1000). CustomSelect (2600) and DatePicker (2500) portal to
 * body, so their popovers open above the card — do NOT raise this above them or
 * every select inside the form renders behind the dialog.
 */
export function StageDataModal({
  leadId,
  leadTitle,
  stage,
  isLastStage,
  apiBase,
  context = "pipeline",
  stageLabel,
  eyebrow = "Stage data",
  onClose,
  onSaved,
  onAdvanced,
  outcome,
}: StageDataModalProps) {
  const tr = useTr();
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const [outcomeBusy, setOutcomeBusy] = useState(false);
  const [outcomeError, setOutcomeError] = useState("");

  useEffect(() => setMounted(true), []);

  // Escape closes; background scroll locks while open. Hosts with their own
  // document-level Escape handler must gate theirs while this is open —
  // stopPropagation cannot suppress a sibling listener on the same node.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (!mounted) return null;

  // Portal to body: callers trigger this from table rows, and a sticky ACTIONS
  // cell is its own stacking context that would trap a fixed overlay inside the
  // horizontally scrolling table.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Stage data — ${leadTitle}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(35, 29, 20, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: isMobile ? 8 : undefined,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: "var(--rule)",
          borderRadius: "var(--r-md)",
          width: "min(700px, 94vw)",
          maxWidth: "100%",
          maxHeight: isMobile ? "90vh" : "88vh",
          overflowY: "auto",
          overflowX: "hidden",
          padding: isMobile ? "16px 14px 20px" : 28,
          boxShadow: "var(--shadow-md)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          minWidth: 0,
          boxSizing: "border-box",
        }}
        className="themed-scroll-y"
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-mute)", marginBottom: 6 }}>
              {eyebrow}
            </div>
            <h3 style={{ fontFamily: "var(--serif)", fontSize: 18, fontWeight: 600, margin: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
              {leadTitle}
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{tr("Current stage")}</span>
              <span style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500 }}>{stageLabel || formatSlug(stage)}</span>
              <span
                style={{
                  fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase",
                  color: "var(--ink-faint)", background: "var(--surface-sunk)",
                  padding: "2px 6px", borderRadius: "var(--r-sm)", fontWeight: 500,
                }}
              >
                {stage}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={tr("Close modal")}
            className="stage-modal-close-btn"
            style={{
              flexShrink: 0,
              background: "transparent",
              borderWidth: 1,
              borderStyle: "solid",
              borderColor: "var(--rule)",
              borderRadius: "var(--r-sm)",
              color: "var(--ink-mute)",
              cursor: "pointer",
              fontSize: 16,
              lineHeight: 1,
              padding: "4px 8px",
              fontFamily: "var(--sans)",
              transition: "color 160ms cubic-bezier(0.23,1,0.32,1), border-color 160ms cubic-bezier(0.23,1,0.32,1)",
              outline: "none",
            }}
          >
            &times;
          </button>
        </div>

        <StageDataCapturePanel
          key={stage}
          leadId={leadId}
          stage={stage}
          isLastStage={isLastStage}
          apiBase={apiBase}
          context={context}
          hideHeading
          onSaved={onSaved}
          onAdvanced={async () => {
            await onAdvanced?.();
            onClose();
          }}
        />

        {outcome && (
          <div style={{ borderTop: "1px solid var(--rule)", paddingTop: 16, marginTop: 4 }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-mute)", marginBottom: 6 }}>
              {tr("Outcome")}
            </div>
            <p style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 12 }}>
              {tr("This is the final stage — there is no next stage. Save the data above, then close the lead.")}
            </p>

            {outcomeError && (
              <div role="alert" style={{ fontSize: 12, color: "var(--crit)", background: "var(--crit-wash)", border: "1px solid var(--crit)", borderRadius: "var(--r-sm)", padding: "8px 12px", marginBottom: 12 }}>
                {outcomeError}
              </div>
            )}

            {lostOpen ? (
              <div>
                <label htmlFor="stage-lost-reason" style={{ display: "block", fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-mute)", marginBottom: 6 }}>
                  {tr("Reason for loss *")}
                </label>
                <textarea
                  id="stage-lost-reason"
                  value={lostReason}
                  onChange={(e) => setLostReason(e.target.value)}
                  rows={3}
                  className="form-input"
                  style={{ fontFamily: "var(--sans)", width: "100%", boxSizing: "border-box", resize: "vertical" }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => { setLostOpen(false); setLostReason(""); setOutcomeError(""); }}
                    disabled={outcomeBusy}
                    style={outcomeGhostBtnStyle}
                  >
                    {tr("Cancel")}
                  </button>
                  <button
                    type="button"
                    disabled={!lostReason.trim() || outcomeBusy}
                    onClick={async () => {
                      setOutcomeBusy(true);
                      setOutcomeError("");
                      try {
                        await outcome.onLost(lostReason.trim());
                        onClose();
                      } catch (e) {
                        setOutcomeError(e instanceof Error ? e.message : "Could not mark this lead lost.");
                      } finally {
                        setOutcomeBusy(false);
                      }
                    }}
                    style={outcomeBtnStyle("var(--crit)", !lostReason.trim() || outcomeBusy)}
                  >
                    {outcomeBusy ? "…" : tr("Mark Lost")}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  disabled={outcomeBusy}
                  onClick={async () => {
                    setOutcomeBusy(true);
                    setOutcomeError("");
                    try {
                      await outcome.onWon();
                      onClose();
                    } catch (e) {
                      // markWon gates on a COMPLETE final-stage capture, so this
                      // is the expected path when a required field is still blank.
                      setOutcomeError(e instanceof Error ? e.message : "Could not mark this lead won.");
                    } finally {
                      setOutcomeBusy(false);
                    }
                  }}
                  style={outcomeBtnStyle("var(--ok)", outcomeBusy)}
                >
                  {outcomeBusy ? "…" : tr("Mark Won")}
                </button>
                <button
                  type="button"
                  disabled={outcomeBusy}
                  onClick={() => { setLostOpen(true); setOutcomeError(""); }}
                  style={outcomeBtnStyle("var(--crit)", outcomeBusy)}
                >
                  {tr("Mark Lost")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function outcomeBtnStyle(bg: string, disabled: boolean): React.CSSProperties {
  return {
    padding: "8px 14px", fontSize: 12, fontWeight: 500,
    background: bg, color: "#f4efdf",
    border: `1px solid ${bg}`, borderRadius: "var(--r-sm)",
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "var(--sans)", opacity: disabled ? 0.6 : 1,
  };
}

const outcomeGhostBtnStyle: React.CSSProperties = {
  padding: "8px 14px", fontSize: 12, fontWeight: 500,
  background: "var(--surface)", color: "var(--ink-soft)",
  border: "1px solid var(--rule-strong)", borderRadius: "var(--r-sm)",
  cursor: "pointer", fontFamily: "var(--sans)",
};
