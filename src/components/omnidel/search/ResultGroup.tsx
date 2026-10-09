"use client";

import type { SearchGroup, SearchResultType } from "@/lib/search/types";
import { ResultRow, typeLabel } from "./ResultRow";
import { useTr } from "@/lib/client/language";

interface ResultGroupProps {
  group: SearchGroup;
  rankOffset: number;
  onSelect: (result: SearchGroup["results"][number], rank: number) => void;
  onSeeAll?: (type: SearchResultType) => void;
}

export function ResultGroup({ group, rankOffset, onSelect, onSeeAll }: ResultGroupProps) {
  const tr = useTr();
  const showSeeAll =
    typeof group.total_estimate === "number" &&
    group.total_estimate > group.results.length &&
    !!onSeeAll;

  return (
    <div style={{ padding: "8px 8px 4px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "4px 12px",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "var(--ink-mute)",
          }}
        >
          {typeLabel(group.type)}
        </span>
        {showSeeAll ? (
          <button
            type="button"
            onClick={() => onSeeAll?.(group.type)}
            style={{
              border: "none",
              background: "transparent",
              color: "var(--ink)",
              fontSize: 12,
              cursor: "pointer",
              padding: 0,
              textDecoration: "underline",
            }}
          >
            {tr("See all")}
          </button>
        ) : null}
      </div>
      {group.results.map((r, i) => (
        <ResultRow
          key={`${r.type}-${r.id}`}
          id={r.id}
          title={r.title}
          subtitle={r.subtitle}
          value={`${r.type}:${r.id}`}
          onSelect={() => onSelect(r, rankOffset + i + 1)}
        />
      ))}
    </div>
  );
}
