"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { canAdvanceStage } from "@/lib/client/can-advance-stage";
import { PageHeader } from "@/components/omnidel/page-header";
import { StageDataCapturePanel } from "@/components/omnidel/stage-data-capture-panel";
import { operationStageLabel, formatOperationStageSlug } from "@/lib/client/operation-stage-label";
import { useTr } from "@/lib/client/language";

type StageNextVariant = "pipeline" | "operations";

type StageNextPageProps = {
  variant: StageNextVariant;
  entityId: string;
};

const TERMINAL: Record<StageNextVariant, string[]> = {
  pipeline: ["won", "lost", "dormant"],
  operations: ["closed", "on_hold", "cancelled"],
};

function stageLabel(slug: string, labels?: Record<string, string>): string {
  return labels ? operationStageLabel(slug, labels) : formatOperationStageSlug(slug);
}

const backBtnStyle: React.CSSProperties = {
  padding: "7px 14px",
  fontSize: 12,
  fontWeight: 500,
  background: "var(--surface)",
  color: "var(--ink-soft)",
  border: "1px solid var(--rule-strong)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
  fontFamily: "var(--sans)",
};

export function StageNextPage({ variant, entityId }: StageNextPageProps) {
  const tr = useTr();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [stage, setStage] = useState<string | null>(null);
  const [pipelineType, setPipelineType] = useState<"short" | "long">("short");
  const [stages, setStages] = useState<string[]>([]);
  const [stageLabels, setStageLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const apiBase = variant === "pipeline" ? "/api/omnimart/pipeline" : "/api/omnimart/operations";
  const detailPath = variant === "pipeline"
    ? `/omnimart/pipeline/${entityId}`
    : `/omnimart/operations/${entityId}`;
  const sectionKey = variant === "pipeline" ? "pipeline" : "operations";
  const sectionHref = variant === "pipeline" ? "/omnimart/pipeline" : "/omnimart/operations";

  const activeStages = useMemo(
    () => stages.filter((s) => !TERMINAL[variant].includes(s)),
    [stages, variant],
  );

  const stageIdx = stage ? activeStages.indexOf(stage) : -1;
  const isLastStage = stageIdx >= 0 && stageIdx === activeStages.length - 1;
  const canAdvance = canAdvanceStage(stage, activeStages, TERMINAL[variant]);

  const load = useCallback(async () => {
    if (!entityId) return;
    setError("");
    setLoading(true);
    try {
      const [entityRes, optionsRes] = await Promise.all([
        fetch(`${apiBase}/${entityId}`, { cache: "no-store" }),
        fetch(variant === "pipeline" ? "/api/omnimart/pipeline/options" : "/api/omnimart/operations/options", { cache: "no-store" }),
      ]);
      const entityData = await entityRes.json();
      const optionsData = await optionsRes.json();
      const item = entityData.item;
      if (!item) {
        setError(variant === "pipeline" ? "Lead not found" : "Operation not found");
        setStage(null);
        return;
      }
      setTitle(item.title || "");
      setStage(item.stage || null);
      if (variant === "pipeline") {
        const ptype = item.pipeline_type === "long" ? "long" : "short";
        setPipelineType(ptype);
        setStages(ptype === "long" ? (optionsData.longStages || []) : (optionsData.shortStages || []));
      } else {
        setStages(optionsData.stages || []);
        setStageLabels(optionsData.stageLabels || {});
      }
    } catch {
      setError("Failed to load");
    } finally {
      setLoading(false);
    }
  }, [apiBase, entityId, variant]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!loading && stage && !canAdvance) {
      router.replace(detailPath);
    }
  }, [loading, stage, canAdvance, router, detailPath]);

  if (loading) {
    return (
      <PageHeader
        moduleSlug="omnimart"
        sectionKey={sectionKey}
        sectionHref={sectionHref}
        crumbs={[{ label: "Next Stage" }]}
      />
    );
  }

  if (!stage || error) {
    return (
      <div>
        <PageHeader
          moduleSlug="omnimart"
          sectionKey={sectionKey}
          sectionHref={sectionHref}
          crumbs={[{ label: "Next Stage" }]}
        />
        <p style={{ color: "var(--ink-mute)", fontSize: 13 }}>{error || tr("Not available")}</p>
        <button onClick={() => router.push(detailPath)} style={backBtnStyle}>{tr("Back")}</button>
      </div>
    );
  }

  if (!canAdvance) {
    return (
      <PageHeader
        moduleSlug="omnimart"
        sectionKey={sectionKey}
        sectionHref={sectionHref}
        crumbs={[{ label: "Next Stage" }]}
      />
    );
  }

  return (
    <div>
      <PageHeader
        moduleSlug="omnimart"
        sectionKey={sectionKey}
        sectionHref={sectionHref}
        crumbs={[
          { label: title, href: detailPath },
          { label: "Next Stage" },
        ]}
        headerExtra={
          <button onClick={() => router.push(detailPath)} style={backBtnStyle}>
            {tr("Back to")} {variant === "pipeline" ? tr("Lead") : tr("Operation")}
          </button>
        }
        marginBottom={20}
      />

      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--rule)",
        borderRadius: "var(--r-md)",
        padding: "28px 32px",
        marginBottom: 16,
      }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-mute)", marginBottom: 6 }}>
            {tr("Current stage")}
          </div>
          <h2 style={{
            fontFamily: "var(--serif)",
            fontSize: 20,
            fontWeight: 600,
            margin: 0,
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}>
            {stageLabel(stage, variant === "operations" ? stageLabels : undefined)}
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
                fontWeight: 500,
              }}
            >
              {stage}
            </span>
          </h2>
          {variant === "pipeline" && (
            <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 4 }}>{pipelineType} cycle</div>
          )}
        </div>

        <StageDataCapturePanel
          key={stage}
          leadId={entityId}
          stage={stage}
          isLastStage={isLastStage}
          apiBase={apiBase}
          context={variant}
          hideHeading
          onAdvanced={() => router.push(detailPath)}
        />
      </div>
    </div>
  );
}
