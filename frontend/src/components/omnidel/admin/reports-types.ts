/**
 * Client-side view models for the Admin Reports feature. Field names mirror
 * src/lib/server/services/admin-reports.ts exactly — a "server-only" file
 * can't be imported from a client component, so these are hand-kept in sync
 * the same way dashboard/types.ts mirrors the dashboard's own services.
 */

export type ReportEntityType = "user" | "users" | "team";

export interface ReportTaskStats {
  created: number;
  assigned: number;
  planned: number;
  doing: number;
  done: number;
}

export interface ReportConversationStats {
  total: number;
  text: number;
  voice: number;
}

export interface ReportTaskRow {
  id: string;
  title: string;
  statusSlug: "planned" | "doing" | "done";
  createdById: string | null;
  createdByName: string;
  assignedToIds: string[];
  assignedToNames: string[];
  assignedByName: string | null;
  boardId: string | null;
  boardName: string;
  listName: string;
  priority: string | null;
  dueDate: string | null;
  createdOn: string;
  updatedOn: string;
}

export interface ReportConversationRow {
  id: string;
  source: "assistant" | "task";
  userId: string;
  userName: string;
  title: string;
  type: "text" | "voice";
  messageCount: number;
  lastActivity: string;
  boardId?: string;
}

export interface ReportMemberBreakdown {
  userId: string;
  name: string;
  taskStats: ReportTaskStats;
  conversationStats: ReportConversationStats;
}

export interface ReportUserInfo {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  teamName: string | null;
}

export interface AdminReport {
  entityType: ReportEntityType;
  period: { start: string; end: string };
  user: ReportUserInfo | null;
  teamName: string | null;
  memberCount: number;
  taskStats: ReportTaskStats;
  conversationStats: ReportConversationStats;
  tasks: ReportTaskRow[];
  conversations: ReportConversationRow[];
  memberBreakdown: ReportMemberBreakdown[];
}

export interface TaskReportDetail {
  id: string;
  title: string;
  description: string | null;
  history: Array<{
    id: string;
    noteType: string;
    authorName: string;
    content: string | null;
    createdOn: string;
  }>;
}

export interface ReportPickerUser {
  id: string;
  name: string;
  primary_workspace_id: string | null;
  primary_workspace_name: string | null;
}

export interface ReportPickerOptions {
  users: ReportPickerUser[];
  teams: Array<{ id: string; name: string }>;
}

export const STATUS_LABELS: Record<ReportTaskRow["statusSlug"], string> = {
  planned: "Planned",
  doing: "Doing",
  done: "Done",
};

export const NOTE_TYPE_LABELS: Record<string, string> = {
  note: "Note",
  file: "File",
  system: "System",
  status_change: "Status change",
  reassign: "Reassigned",
};
