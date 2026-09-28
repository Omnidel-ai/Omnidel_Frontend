import type { PanelAccent } from "../components";
import type { ListDescriptor } from "../lists";

/**
 * OmniVarsity's demo data.
 *
 * The two lists are ordinary `ListDescriptor`s — an acharya table and a
 * kaarigar table are work lists like OmniMart's, so they reuse `ListPage`
 * rather than bringing a screen of their own. Only the Acharya Dashboard has
 * a shape of its own, and it is described here.
 */
export interface OmniVarsityData {
  dashboard: AcharyaDashboardData;
  lists: ListDescriptor[];
}

export interface AcharyaDashboardData {
  label: string;
  /** Overview · Chats · Rating · Quiz. */
  tabs: string[];
  /** 1D · 7D · 30D. */
  ranges: string[];
  defaultRange: string;
  tiles: DashboardTile[];
  panels: DashboardPanel[];
}

export interface DashboardTile {
  key: string;
  label: string;
  value: string;
  hint?: string;
  tone?: PanelAccent;
}

export interface DashboardPanel {
  key: string;
  title: string;
  accent: PanelAccent;
  count: number;
  empty: string;
  items: { id: string; text: string; meta: string }[];
}
