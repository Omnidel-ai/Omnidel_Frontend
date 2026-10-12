import type { CSSProperties } from "react";
import type { WorkEventType } from "@/lib/omnipulse/work-event-classify";

export type LeftPane = "task" | "submission" | "subtasks";

export interface EvidenceImage {
  blob_url: string;
  blob_mime: string | null;
  kind?: string;
  update_context?: string | null;
  subtask_id?: string | null;
  subtask_title?: string | null;
  attempt_id?: string | null;
  captured_at?: string | null;
}

export interface EvidenceCommentAttachment {
  url: string;
  name: string;
  size: number | null;
  type: string;
}

export interface EvidenceComment {
  id: string;
  author_name: string;
  content: string;
  created_on: string;
  edited_at?: string | null;
  attachments?: EvidenceCommentAttachment[];
}

export interface EvidenceSubtask {
  id: string;
  title: string;
  status: string;
  is_done: boolean;
  session_count?: number;
  sessions_completed?: number;
  break_allowance_per_segment?: number[];
}

export interface EvidenceTaskContext {
  title?: string | null;
  description: string | null;
  acharya_name: string | null;
  team_name: string | null;
  project_name: string | null;
  priority: string | null;
  due_date: string | null;
  assigned_on: string | null;
  status_label: string | null;
  task_type_name?: string | null;
  is_simple_task?: boolean;
  assignees: { id: string; name: string }[];
  subtasks: EvidenceSubtask[];
  comments: EvidenceComment[];
  task_open_href: string | null;
}

export interface EvidenceTextEntry {
  kind: string;
  label: string;
  text: string;
  created_on?: string;
  update_context?: string | null;
}

export interface EvidenceSubmission {
  id: string;
  user_id: string;
  user_name: string;
  kinds: string[];
  text_payload: string | null;
  text_entries?: EvidenceTextEntry[];
  images: EvidenceImage[];
  created_on: string;
  checklist_item_id?: string | null;
  subtask_title?: string | null;
  evaluation: {
    approved: boolean;
    score: number | null;
    notes: string | null;
    review_status?: string | null;
    acharya_score?: number | null;
    final_score?: number | null;
    reviewer_feedback?: string | null;
    reviewed_by?: string | null;
    reviewed_by_name?: string | null;
    reviewed_at?: string | null;
    display_status?: "Reviewing" | "Approved" | "Pending";
  } | null;
}

export interface EvidenceWorkEvent {
  id: string;
  type: WorkEventType;
  label: string;
  occurred_at: string;
  segment_index: number | null;
  attempt_id: string | null;
  checklist_item_id: string | null;
  text: string | null;
  images: { url: string; mime: string | null }[];
  remaining_seconds: number | null;
  duration_seconds: number | null;
  source: string;
}

export interface EvidenceSubtaskTimeline {
  id: string;
  title: string;
  status: string;
  is_done: boolean;
  session_count: number;
  sessions_completed: number;
  break_allowance_per_segment: number[];
  events: EvidenceWorkEvent[];
}

export interface EvidenceTimeline {
  task_id: string;
  subtasks: EvidenceSubtaskTimeline[];
  unscoped_events: EvidenceWorkEvent[];
  task_completion: EvidenceWorkEvent | null;
}

export const evidenceLabelStyle: CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 10,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--ink-mute)",
  marginBottom: 6,
};

export const evidenceValueBoxStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  fontSize: 13,
  fontFamily: "var(--sans)",
  border: "1px solid var(--rule)",
  borderRadius: "var(--r-sm)",
  background: "var(--surface-sunk)",
  color: "var(--ink)",
  boxSizing: "border-box",
};

export const evidencePaneFillStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  flex: "1 1 auto",
  minHeight: 0,
};

export const EVIDENCE_NARROW_BP = 900;
