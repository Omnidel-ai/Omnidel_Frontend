import type { CSSProperties } from "react";
import type { AcharyaField } from "@/acharya/lib/acharya-field";

/**
 * Colour for the field tag under an Acharya's name (FINANCE / SALES / GUIDE …).
 *
 * Eight fields need eight readable-apart tints, and the app palette only ships
 * three accents (green / ochre / terracotta) — so the extra hues are literals,
 * chosen muted and earthy to sit inside the block-print look rather than
 * shouting over it. They are LABEL colours only: never reuse them for status
 * (lane tone stays terracotta / ochre / green so "colour = state" keeps its
 * meaning).
 *
 * Each chip is mixed off its hue at fixed ratios, so a new field only needs a
 * hue here and stays consistent with the rest:
 *   text   = hue + ink   (dark enough for 10px bold on the wash)
 *   fill   = hue + surface (a wash, not a solid)
 *   border = hue + surface (between the two)
 */
const FIELD_HUE: Record<AcharyaField, string> = {
  finance: "#9a7513",     // mustard gold
  business: "#a74a2d",    // terracotta
  sales: "#8c2f4a",       // deep rose
  marketing: "#6b4180",   // plum
  operations: "#37587c",  // slate blue
  technology: "#16665f",  // teal
  guide: "#2c5a3a",       // forest green
  general: "#6b5f47",     // warm grey
};

/** Colour half of the field tag — spread OVER the shared tag chrome. */
export function acharyaFieldTone(field: AcharyaField): CSSProperties {
  const hue = FIELD_HUE[field] ?? FIELD_HUE.general;
  return {
    color: `color-mix(in srgb, ${hue} 76%, var(--ink))`,
    background: `color-mix(in srgb, ${hue} 15%, var(--surface))`,
    borderColor: `color-mix(in srgb, ${hue} 40%, var(--surface))`,
  };
}
