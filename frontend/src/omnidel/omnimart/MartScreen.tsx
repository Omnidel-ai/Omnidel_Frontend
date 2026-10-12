import { MissionsPage } from "./MissionsPage";
import { ListPage } from "../lists";
import omnimart from "../data/omnimart.json";
import type { OmniMartData } from "./types";

const MART = omnimart as OmniMartData;

export interface MartScreenProps {
  href: string;
  search?: string;
  fallback?: React.ReactNode;
}

/**
 * OmniMart's five screens.
 *
 * Four are the shared `ListPage` with a descriptor each, so this module is
 * mostly a lookup: the route's last segment is the descriptor's key. Missions
 * is the one screen of its own.
 *
 * It owns `omnimart.json` so the data travels in this chunk rather than in the
 * application's.
 */
export function MartScreen({ href, search, fallback = null }: MartScreenProps) {
  if (href === "/omnimart/missions") return <MissionsPage data={MART.missions} />;

  const key = href.slice("/omnimart/".length);
  const list = MART.lists.find((l) => l.key === key);
  if (!list) return <>{fallback}</>;
  return <ListPage key={list.key} list={list} externalSearch={search} />;
}

export default MartScreen;
