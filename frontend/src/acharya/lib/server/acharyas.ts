/**
 * Type-only stand-in for the Acharya app's `lib/server/acharyas.ts`.
 *
 * The real module reads Supabase and is server-only. Client screens import
 * just this one type from it, so the frontend keeps the type (copied verbatim
 * from omnidel-acharya PR #207) and nothing else. Demo data in
 * `acharya/demo/` is typed against it.
 */
import type { AcharyaField } from "@/acharya/lib/acharya-field";

export interface AcharyaListItem {
  id: string;
  slug: string;
  displayName: string;
  personaSummary: string | null;
  avatarUrl: string | null;
  sortOrder: number;
  /**
   * Teaching field tag (FINANCE / BUSINESS / …). Derived — see
   * `lib/acharya-field.ts`. Resolved from the ENGLISH row before the hi/bn
   * overlay rewrites `personaSummary`.
   */
  field: AcharyaField;
  /**
   * Primary avatar first, then any extras from `persona_meta` — cross-faded
   * during a live voice session. See lib/acharya-portraits.ts.
   */
  portraits: string[];
}
