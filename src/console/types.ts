import type { BadgeTone } from "../components";
import type { DemoBrand, DemoNavItem, DemoUser } from "../data/types";

export type InstanceStatus = "Active" | "Trial" | "Suspended" | "Closing";

export interface Instance {
  id: string;
  name: string;
  /** The schema prefix — the instance's identity in the database. */
  prefix: string;
  status: InstanceStatus;
  /** As the console prints it: "2 / 100", or "0 / ∞" for an uncapped trial. */
  seats: string;
  modules: string[];
  /** "25 Sep 2026" in the list, "25 September 2026" on the record. */
  created: string;
  createdLong: string;
  /** Present once an instance has been suspended or begun closing. */
  lifecycle?: { label: string; value: string }[];
}

export interface StaffPermission {
  label: string;
  /** Roles that hold it. The owner holds every permission and is not listed. */
  grants: string[];
}

/** Everything the console renders, from `console.json`. */
export interface ConsoleData {
  brand: DemoBrand;
  user: DemoUser;
  nav: DemoNavItem[];
  instances: Instance[];
  /** Staff roles in column order, owner excluded. */
  roles: string[];
  permissions: StaffPermission[];
}

export const STATUSES: InstanceStatus[] = ["Active", "Trial", "Suspended", "Closing"];

export const STATUS_TONE: Record<InstanceStatus, BadgeTone> = {
  Active: "ok",
  Trial: "green",
  Suspended: "amber",
  Closing: "crit",
};

export const STATUS_DOT: Record<InstanceStatus, string> = {
  Active: "var(--ok)",
  Trial: "var(--green-deep)",
  Suspended: "var(--amber)",
  Closing: "var(--crit)",
};
