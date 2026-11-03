export interface Approval {
  id: string;
  task: string;
  kaarigar: string;
  project: string;
  when: string;
  /** Whole days since it was submitted — what "Oldest" is computed from. */
  ageDays: number;
  /** The Acharya's score, 0–10. */
  score: number;
  acharya: string;
  acharyaNotes: string;
  /** What the kaarigar said when submitting. */
  said: string;
  photos: number;
  priority: "normal" | "urgent";
  type: string;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  team: string;
  open: number;
}

export interface PulseLane {
  key: string;
  label: string;
  color: string;
}

export interface PulseTask {
  id: string;
  projectId: string;
  code: string;
  lane: string;
  title: string;
  description: string;
  assignee: string | null;
  due: string;
  priority: "normal" | "urgent";
  comments: number;
  attachments: number;
  notes: { author: string; text: string; when: string }[];
  files: { name: string; size: string }[];
  activity: string[];
}

export interface Team {
  id: string;
  name: string;
  role: "lead" | "member";
  description: string;
  members: { name: string; role: string }[];
}

export interface ContractorData {
  user: { name: string; phone: string; role: string };
  approvals: Approval[];
  projects: Project[];
  lanes: PulseLane[];
  tasks: PulseTask[];
  teams: Team[];
  profile: { waiting: number; given: number; managing: number };
}

export type ContractorScreen = "signin" | "review" | "approval" | "projects" | "project" | "task" | "teams" | "profile" | "settings";
