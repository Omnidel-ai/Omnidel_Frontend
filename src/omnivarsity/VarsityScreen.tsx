import { AcharyaDashboard } from "./AcharyaDashboard";
import { ListPage } from "../lists";
import omnivarsity from "../data/omnivarsity.json";
import type { OmniVarsityData } from "./types";

const VARSITY = omnivarsity as OmniVarsityData;

export interface VarsityScreenProps {
  href: string;
  search?: string;
  fallback?: React.ReactNode;
}

/**
 * OmniVarsity's three screens: two lists and the Acharya Dashboard.
 *
 * The same shape as `MartScreen`, because the two modules are the same shape —
 * descriptors handed to the shared `ListPage`, plus one screen with a layout
 * of its own. It owns `omnivarsity.json` so that data loads with it.
 */
export function VarsityScreen({ href, search, fallback = null }: VarsityScreenProps) {
  if (href === "/omnivarsity/dashboard") return <AcharyaDashboard data={VARSITY.dashboard} />;

  const key = href.slice("/omnivarsity/".length);
  const list = VARSITY.lists.find((l) => l.key === key);
  if (!list) return <>{fallback}</>;
  return <ListPage key={list.key} list={list} externalSearch={search} />;
}

export default VarsityScreen;
