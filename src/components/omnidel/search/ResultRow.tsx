"use client";

import { Command } from "cmdk";
import type { SearchResultType } from "@/lib/search/types";

const TYPE_LABELS: Record<SearchResultType, string> = {
  task: "Tasks",
  board: "Projects",
  workspace: "Teams",
  user: "Users",
  lead: "Leads",
  operation: "Operations",
  media_project: "Media",
  reference: "References",
  site: "Sites",
  acharya: "Acharyas",
  mission: "Missions",
};

export function typeLabel(type: SearchResultType): string {
  return TYPE_LABELS[type] || type;
}

interface ResultRowProps {
  id: string;
  title: string;
  subtitle?: string;
  value: string;
  onSelect: () => void;
}

export function ResultRow({ title, subtitle, value, onSelect }: ResultRowProps) {
  return (
    <Command.Item
      value={value}
      onSelect={() => onSelect()}
      className="global-search-row"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 2,
        width: "100%",
        padding: "8px 12px",
        border: "none",
        borderRadius: "var(--r-sm)",
        background: "transparent",
        color: "var(--ink)",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 500 }}>{title}</span>
      {subtitle ? (
        <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{subtitle}</span>
      ) : null}
    </Command.Item>
  );
}
