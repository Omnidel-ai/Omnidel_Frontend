import type { ListDescriptor } from "../lists";

/**
 * Shapes of `omnimart.json`.
 *
 * The four work lists use the shared list descriptor; Missions is its own
 * shape, because a promise with a pace is not a row.
 */

export interface MartMission {
  id: string;
  name: string;
  /** The stream it belongs to — the card's eyebrow. */
  stream: string;
  status: "green" | "amber" | "red";
  current: number;
  target: number;
  unit: string;
  /** Per day, to reach the target in the days that remain. */
  requiredPace: number;
  /** Per day, over the last seven days. */
  actualPace: number;
  daysLeft: number;
  tasks: { total: number; open: number; done: number };
}

export interface MartMissionsData {
  label: string;
  subtitle: string;
  searchPlaceholder: string;
  emptyMessage: string;
  emptyHint: string;
  rows: MartMission[];
}

export interface OmniMartData {
  missions: MartMissionsData;
  lists: ListDescriptor[];
}
