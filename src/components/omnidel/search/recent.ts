/** In-memory recent search selections (v1 — no localStorage). */

import type { SearchResult } from "@/lib/search/types";

const MAX = 8;
let recent: Omit<SearchResult, "updated_at">[] = [];

export function getRecentSelections(): Omit<SearchResult, "updated_at">[] {
  return recent.slice();
}

export function pushRecentSelection(row: Omit<SearchResult, "updated_at">) {
  recent = [row, ...recent.filter((r) => !(r.type === row.type && r.id === row.id))].slice(0, MAX);
}

export function removeRecentSelection(type: string, id: string) {
  recent = recent.filter((r) => !(r.type === type && r.id === id));
}
