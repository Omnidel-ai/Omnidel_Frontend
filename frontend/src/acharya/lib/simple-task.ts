/**
 * PARITY CONTRACT: this file is kept BYTE-IDENTICAL between OmniDel and
 * omnidel-acharya. A predicate duplicated across the two repos drifting is what
 * broke prod on 2026-08-08 (countdown vs count-up, Session card, mandatory
 * proof) and cost four PRs to unpick — the acharya copy accepted only slug
 * "simple" while prod's type is slugged "simple_task". If you change one copy,
 * copy the whole file to the other and verify with:
 *
 *   diff OmniDel/src/lib/simple-task.ts omnidel-acharya/src/lib/simple-task.ts
 */
/**
 * Simple Task detection — resolve from the **current environment's** task types
 * (slug / name), not a hardcoded UUID. Prod and dev have different
 * `mst_task_types` ids; env UUIDs are only an optional hint when they match a
 * live row.
 *
 * Safe for client + server (NEXT_PUBLIC_ on client; both on server).
 */

export const SIMPLE_TASK_SLUG = "simple";

/** Open-ended attempt ceiling (30 days). DB needs a deadline; Acharya ignores countdown. */
export const SIMPLE_TASK_OPEN_INTERVAL_SECONDS = 30 * 24 * 60 * 60;

export function getConfiguredSimpleTaskTypeId(): string | null {
  const id =
    (typeof process !== "undefined" &&
      (process.env.SIMPLE_TASK_TYPE_ID || process.env.NEXT_PUBLIC_SIMPLE_TASK_TYPE_ID)) ||
    "";
  const trimmed = String(id).trim();
  return trimmed || null;
}

function normalizeSimpleSlug(slug: string): string {
  return slug.trim().toLowerCase().replace(/-/g, "_");
}

function looksLikeSimpleSlug(slug: string | null | undefined): boolean {
  const s = normalizeSimpleSlug(slug ?? "");
  return s === SIMPLE_TASK_SLUG || s === "simple_task";
}

function looksLikeSimpleName(name: string | null | undefined): boolean {
  const n = (name ?? "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  return n === "simple" || n === "simple task" || n.startsWith("simple task ");
}

/**
 * Detect Simple Task from whatever fields the caller has.
 * Prefer slug/name (environment-agnostic). Env UUID is only a hint when present
 * and equal to `opts.id` — never required.
 */
export function isSimpleTaskType(opts: {
  id?: string | null;
  slug?: string | null;
  name?: string | null;
}): boolean {
  if (looksLikeSimpleSlug(opts.slug)) return true;
  if (looksLikeSimpleName(opts.name)) return true;
  const configured = getConfiguredSimpleTaskTypeId();
  if (configured && opts.id && configured === opts.id) return true;
  return false;
}

/**
 * Resolve the Simple Task type id for **this** database from live options.
 * Order: slug → name → env UUID only if that id exists in `taskTypes`.
 * Never returns a stale cross-env UUID that is absent from the options list.
 */
export function resolveSimpleTaskTypeIdFromOptions(
  taskTypes: Array<{ id: string; slug?: string | null; name_en?: string | null; name?: string | null }>,
): string | null {
  if (!taskTypes.length) return null;

  const bySlug = taskTypes.find((t) => looksLikeSimpleSlug(t.slug));
  if (bySlug) return bySlug.id;

  const byName = taskTypes.find((t) =>
    looksLikeSimpleName(t.name_en ?? t.name ?? null),
  );
  if (byName) return byName.id;

  const configured = getConfiguredSimpleTaskTypeId();
  if (configured) {
    const hit = taskTypes.find((t) => t.id === configured);
    if (hit) return hit.id;
  }
  return null;
}

/**
 * THE single answer to "does this task need photo + text proof to submit?"
 *
 * The 2026-08-08 Simple Task incident took FOUR PRs because this question was
 * implemented in eight independent places across two repos and each looked
 * complete on its own. The post-mortem's owed remediation was exactly this
 * helper. Anything gating proof should call it rather than re-deriving the
 * answer from `isSimpleTask` / `timingMode` / task-type slug by hand.
 *
 * Simple tasks are manual-review-only and proof is OPTIONAL for them; every
 * other task requires both completion text and at least one image.
 */
export interface ProofDecisionInput {
  /** Task-type id / slug / name, as accepted by isSimpleTaskType. */
  id?: string | null;
  slug?: string | null;
  name?: string | null;
  /** Pre-resolved flags from a task payload, when the caller already has them. */
  isSimpleTask?: boolean | null;
  timingMode?: string | null;
}

export function requiresProof(task: ProofDecisionInput): boolean {
  if (task.isSimpleTask === true) return false;
  if (task.timingMode === "simple") return false;
  return !isSimpleTaskType({ id: task.id, slug: task.slug, name: task.name });
}
