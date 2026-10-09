"use client";

import type { CSSProperties } from "react";
import type { LeftPane } from "./types";
import { useTr } from "@/lib/client/language";

const groupStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "stretch",
  flexShrink: 0,
};

function segmentStyle(
  active: boolean,
  edge: "start" | "mid" | "end",
): CSSProperties {
  const radius =
    edge === "start"
      ? "var(--r-sm) 0 0 var(--r-sm)"
      : edge === "end"
        ? "0 var(--r-sm) var(--r-sm) 0"
        : "0";
  return {
    padding: "4px 10px",
    fontSize: 11,
    fontFamily: "var(--mono)",
    letterSpacing: "0.02em",
    fontWeight: 500,
    background: active ? "var(--green-deep)" : "var(--surface)",
    color: active ? "var(--surface)" : "var(--ink-soft)",
    border: "1px solid var(--rule-strong)",
    marginLeft: edge === "start" ? 0 : -1,
    borderRadius: radius,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

export function PaneToggle({
  value,
  onChange,
  hideSubtasks = false,
}: {
  value: LeftPane;
  onChange: (pane: LeftPane) => void;
  /** Simple tasks have no subtasks — omit the third segment. */
  hideSubtasks?: boolean;
}) {
  const tr = useTr();
  return (
    <div role="group" aria-label={tr("Left pane")} style={groupStyle}>
      <button
        type="button"
        onClick={() => onChange("task")}
        aria-pressed={value === "task"}
        style={segmentStyle(value === "task", "start")}
      >
        {tr("Task details")}
      </button>
      <button
        type="button"
        onClick={() => onChange("submission")}
        aria-pressed={value === "submission"}
        style={segmentStyle(value === "submission", hideSubtasks ? "end" : "mid")}
      >
        {tr("Submission")}
      </button>
      {!hideSubtasks ? (
        <button
          type="button"
          onClick={() => onChange("subtasks")}
          aria-pressed={value === "subtasks"}
          style={segmentStyle(value === "subtasks", "end")}
        >
          {tr("Subtasks")}
        </button>
      ) : null}
    </div>
  );
}
