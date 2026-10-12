/**
 * The teaching field shown as a tag under an Acharya's name on home
 * (FINANCE, BUSINESS, SALES …).
 *
 * `gunakul.mst_acharyas` has no field column, so this derives one from the slug
 * (explicit, curated) and falls back to keyword-matching the **English** base
 * `persona_summary`. Resolution therefore happens server-side in `rowToItem`,
 * BEFORE the hi/bn translation overlay replaces the summary — a Bengali persona
 * would never match the English keyword table.
 *
 * Kept isomorphic (no "server-only") so the client can type the value it renders.
 */

export type AcharyaField =
  | "finance"
  | "business"
  | "sales"
  | "marketing"
  | "operations"
  | "technology"
  | "guide"
  | "general";

/**
 * Curated overrides. Wider than `ACHARYA_DOMAIN_BY_SLUG` in
 * `lib/evaluation/acharya-domains.ts` — that one only needs the four scoring
 * profiles; this one is a label, so it can be more specific.
 */
const FIELD_BY_SLUG: Record<string, AcharyaField> = {
  vivek: "finance",
  subhas: "business",
  subhash: "business",
  arjun: "sales",
  lakshya: "sales",
  lakshya_acharya: "sales",
  lakshya_acharya_2: "sales",
  lakshman: "sales",
  mahacharya: "guide",
};

/**
 * Ordered most-specific-first: a "finance mentor who helps you sell" should read
 * FINANCE, so the first hit wins rather than the longest.
 */
const KEYWORDS: Array<[AcharyaField, RegExp]> = [
  [
    "finance",
    /\b(financ\w*|accounting|accounts|bookkeep\w*|taxes?|gst|cash\s*flow|credit|loans?|udhaar|money|capital|invoic\w*)\b/i,
  ],
  [
    "sales",
    /\b(sales|selling|sell|customers?|clients?|negotiat\w*|pitch\w*|leads?|after[-\s]?sales)\b/i,
  ],
  [
    "marketing",
    /\b(marketing|brand\w*|advertis\w*|promotion\w*|social\s*media|outreach|campaigns?)\b/i,
  ],
  [
    "operations",
    /\b(operations?|production|inventory|supply|logistics|workshop|quality|process\w*|delivery)\b/i,
  ],
  [
    "technology",
    /\b(technolog\w*|digital|software|automation|computers?|apps?|online\s*tools?)\b/i,
  ],
  [
    "business",
    /\b(business|msme|entrepreneur\w*|enterprise|strategy|owner|shop|trade|udyam)\b/i,
  ],
  ["guide", /\b(guide|navigator|mentor|coach|teacher|learning|skills?)\b/i],
];

/**
 * @param slug        Acharya slug (curated overrides win).
 * @param personaBase The **English** persona summary straight off the DB row.
 */
export function resolveAcharyaField(
  slug: string | null | undefined,
  personaBase?: string | null,
): AcharyaField {
  const key = slug?.trim().toLowerCase();
  if (key && FIELD_BY_SLUG[key]) return FIELD_BY_SLUG[key];

  const text = personaBase?.trim();
  if (text) {
    for (const [field, re] of KEYWORDS) {
      if (re.test(text)) return field;
    }
  }
  return "general";
}
