import type { DueTone } from "../../components/acharya-mobile";
import type { WorkCategory } from "./WorkSymbol";

export type Lane = "todo" | "doing" | "review" | "done";

export interface KaarigarTask {
  id: string;
  title: string;
  description?: string;
  lane: Lane;
  category: WorkCategory;
  board: string;
  acharya: string;
  due?: { label: string; tone: DueTone };
  sessions: { done: number; total: number };
  score?: number;
  steps: string[];
  notes: { author: string; text: string; when: string }[];
}

export interface KaarigarAcharya {
  slug: string;
  name: string;
  role: string;
  featured?: boolean;
}

export interface KaarigarData {
  user: { name: string; phone: string; trade: string; org: string; joined: string };
  acharyas: KaarigarAcharya[];
  tasks: KaarigarTask[];
  report: { tasksDone: number; avgScore: string; jobsDone: number };
  history: { title: string; org: string; date: string; score: string; verdict: string }[];
  requests: { org: string; city: string; about: string; kind: "invite" | "member" }[];
  details: Record<"contact" | "work" | "location" | "about", { label: string; value: string }[]>;
  stories: { title: string; acharya: string; duration: string }[];
}

export type KaarigarScreen = "signin" | "home" | "work" | "task" | "stories" | "profile" | "settings";

export const LANES: { key: Lane; label: string }[] = [
  { key: "todo", label: "To do" },
  { key: "doing", label: "Doing" },
  { key: "review", label: "Review" },
  { key: "done", label: "Done" },
];

export const LANE_TINT = { doing: "doing", review: "review", done: "done" } as const;
