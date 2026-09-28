import type { BadgeTone } from "../../components";

export type InstanceStatus = "Active" | "Trial" | "Suspended" | "Closing";

export interface InstancePerson {
  name: string;
  email: string;
  role: string;
  lastSeen: string;
}

export interface InstanceInvoice {
  no: string;
  period: string;
  amount: number;
  status: "Paid" | "Due" | "Overdue";
  due: string;
}

export interface InstanceEvent {
  /** "YYYY-MM-DD HH:mm", local time. */
  at: string;
  who: string;
  what: string;
  tone?: "green" | "amber" | "crit";
}

export interface Instance {
  id: string;
  name: string;
  /** The schema prefix — the instance's identity in the database. */
  prefix: string;
  status: InstanceStatus;
  /** `cap: null` is an uncapped trial. */
  seats: { used: number; cap: number | null };
  modules: string[];
  created: string;
  trialEnds?: string;
  owner?: { name: string; email: string };
  /** Present once an instance has been suspended or begun closing. */
  lifecycle?: { suspended: string; graceEnds: string; exportEnds: string };
  people?: InstancePerson[];
  invoices?: InstanceInvoice[];
  activity?: InstanceEvent[];
}

export interface InstancesData {
  /** The demo's "now", so relative dates do not drift. */
  today: string;
  /** Every module an instance may have turned on. */
  modules: string[];
  rows: Instance[];
}

export const STATUS_TONE: Record<InstanceStatus, BadgeTone> = {
  Active: "ok",
  Trial: "neutral",
  Suspended: "amber",
  Closing: "crit",
};

const DOT: Record<InstanceStatus, string> = {
  Active: "var(--ok)",
  Trial: "var(--ink-mute)",
  Suspended: "var(--amber)",
  Closing: "var(--crit)",
};
export const statusDot = (s: InstanceStatus) => DOT[s];

/** "25 Sep 2026" — day first, three-letter month, as the app writes it. */
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function formatDate(iso: string, month: "short" | "long" = "short"): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const name = MONTHS[m - 1];
  return `${d} ${month === "long" ? name : name.slice(0, 3)} ${y}`;
}

/** Whole days from `today` to `iso`; negative when it has passed. */
export function daysFrom(today: string, iso: string): number {
  const a = new Date(`${today}T00:00:00`).getTime();
  const b = new Date(`${iso.slice(0, 10)}T00:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** "in 10 days", "today", "4 days ago". */
export function relative(today: string, iso: string): string {
  const n = daysFrom(today, iso);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}

/** The short line under a status — what happens next, and when. */
export function statusNote(i: Instance, today: string): string | null {
  if (i.status === "Trial" && i.trialEnds) return `Trial ends ${relative(today, i.trialEnds)}`;
  if (i.status === "Closing" && i.lifecycle) return `Grace ends ${relative(today, i.lifecycle.graceEnds)}`;
  if (i.status === "Suspended" && i.lifecycle) return `Since ${formatDate(i.lifecycle.suspended)}`;
  return null;
}
