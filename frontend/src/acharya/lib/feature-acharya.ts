/**
 * Which acharya gets the feature card — shared by home and the work list so the
 * card (and therefore the mic) is the same acharya on both screens.
 *
 * Order, and why:
 *  1. `pinnedSlug` — the `is_platform_default` flag in OmniDel admin. Flip it
 *     there and the feature card follows; nothing here is slug-hardcoded.
 *  2. `FALLBACK_ACHARYA_SLUG` (MahAcharya'ji) — the acharya `(app)/layout.tsx`
 *     mints the home voice session for. The feature card has to be the one
 *     hosting that mic, or the mic renders nowhere.
 *  3. Busiest acharya — only when neither of the above is in the list at all.
 */

import { FALLBACK_ACHARYA_SLUG } from "@/acharya/lib/default-acharya";

export function pickFeatureAcharya<T extends { slug: string }>(
  acharyas: T[],
  pinnedSlug: string | null | undefined,
  /** Same list ordered most-open-work first; used only as the last resort. */
  byOpenTasks: T[] = acharyas,
): T | undefined {
  const bySlug = (want: string | null) =>
    want ? acharyas.find((a) => a.slug.trim().toLowerCase() === want) : undefined;
  const pinned = pinnedSlug?.trim().toLowerCase() || null;
  return bySlug(pinned) ?? bySlug(FALLBACK_ACHARYA_SLUG) ?? byOpenTasks[0];
}
