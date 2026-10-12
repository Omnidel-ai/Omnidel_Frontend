/**
 * Shared city-name resolver for the registration voice/chat form fill tools.
 *
 * A spoken city name is rarely an exact string match: the karigar may say only
 * a prefix ("Mo" while the list is still loading in their head), the speech
 * engine may mishear a syllable, or the city may not be in the selected
 * state's list at all. `matchCity` turns a raw heard/typed string into one of
 * four outcomes so the caller can either apply the field silently (exact) or
 * hand the karigar a short "did you mean" choice instead of guessing wrong.
 */

export type CityOption = { id: string; name: string };

export type CityMatchResult =
  | { type: "exact"; city: CityOption }
  /** More than one city matches what was heard — ask which one they mean. */
  | { type: "options"; cities: CityOption[] }
  /** Nothing matches directly, but these are close enough to be worth asking about. */
  | { type: "suggestions"; cities: CityOption[] }
  /** Not enough signal to suggest anything — ask them to repeat/spell it. */
  | { type: "none" };

const MAX_OPTIONS = 6;
const MAX_SUGGESTIONS = 3;

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Standard edit distance — small city-name strings, so the O(n*m) table is fine. */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const row = new Array(n + 1);
  for (let j = 0; j <= n; j++) row[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j];
      row[j] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, row[j], row[j - 1]);
      prev = tmp;
    }
  }
  return row[n];
}

/**
 * Resolve a heard/typed city string against the karigar's state's city list.
 *
 * Order: exact name match → unique prefix match (auto-resolves — "Mo" narrowing
 * to one city) → multiple prefix matches (ask which one) → substring match →
 * nearest-by-edit-distance fallback when nothing starts with or contains what
 * was heard (misheard spelling — "did you mean the nearest city").
 */
export function matchCity(input: string, cities: CityOption[]): CityMatchResult {
  const q = normalize(input);
  if (!q || cities.length === 0) return { type: "none" };

  const exact = cities.find((c) => normalize(c.name) === q);
  if (exact) return { type: "exact", city: exact };

  const prefixMatches = cities.filter((c) => normalize(c.name).startsWith(q));
  if (prefixMatches.length === 1) return { type: "exact", city: prefixMatches[0] };
  if (prefixMatches.length > 1) return { type: "options", cities: prefixMatches.slice(0, MAX_OPTIONS) };

  const substrMatches = cities.filter((c) => normalize(c.name).includes(q));
  if (substrMatches.length === 1) return { type: "exact", city: substrMatches[0] };
  if (substrMatches.length > 1) return { type: "options", cities: substrMatches.slice(0, MAX_OPTIONS) };

  const scored = cities
    .map((c) => ({ c, d: levenshtein(q, normalize(c.name)) }))
    .sort((a, b) => a.d - b.d);
  const best = scored[0];
  // Distance must be small relative to the word length — otherwise "nearest" is
  // just noise (e.g. a one-letter city list match with distance 6).
  if (best && best.d <= Math.max(2, Math.ceil(best.c.name.length * 0.4))) {
    const suggestions = scored
      .filter((s) => s.d <= best.d + 1)
      .slice(0, MAX_SUGGESTIONS)
      .map((s) => s.c);
    return { type: "suggestions", cities: suggestions };
  }

  return { type: "none" };
}
