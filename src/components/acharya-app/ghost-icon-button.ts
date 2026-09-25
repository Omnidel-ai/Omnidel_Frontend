import type { CSSProperties } from "react";

/**
 * Ghost icon chrome — used for nav / utility controls (back, settings,
 * profile, close, edit). Icon only: no fill, border, or chip shadow.
 *
 * Keep bordered / filled circles for real actions in dense bars
 * (send, camera in composer, voice pill, media play badges).
 */

export const ghostIconButtonStyle: CSSProperties = {
  width: 40,
  height: 40,
  padding: 0,
  margin: 0,
  border: "none",
  background: "transparent",
  boxShadow: "none",
  color: "var(--green-deep)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  flexShrink: 0,
  borderRadius: "var(--r-sm)",
  WebkitTapHighlightColor: "transparent",
  textDecoration: "none",
};

/** Toggleable chrome (settings / edit) — colour shift only when open. */
export const ghostIconButtonActiveStyle: CSSProperties = {
  color: "var(--ink)",
};

/**
 * Soft chip — a filled circle on the karigar's own surfaces (home header bell +
 * profile menu). Ghost icons vanished against the busy card stack below them, so
 * these two get a tan disc that reads as a control without a hard border.
 */
export const softIconButtonStyle: CSSProperties = {
  ...ghostIconButtonStyle,
  borderRadius: "50%",
  background: "color-mix(in srgb, var(--ochre-wash) 55%, var(--surface))",
};

/**
 * Framed chip — rounded square with a hairline rule (profile header back /
 * settings). Same family as the soft chip, squared off because it sits on the
 * page edge rather than inside a row of round avatars.
 */
export const framedIconButtonStyle: CSSProperties = {
  ...ghostIconButtonStyle,
  borderRadius: "var(--r-xl)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  background: "var(--surface)",
  boxShadow: "var(--shadow-sm)",
};

/**
 * Back (and similar) sitting on a photo / avatar — light glyph + soft
 * shadow so it stays readable without a frosted pill.
 */
export const ghostIconOnMediaStyle: CSSProperties = {
  ...ghostIconButtonStyle,
  width: 32,
  height: 32,
  color: "var(--surface)",
  filter: "drop-shadow(0 1px 2px color-mix(in srgb, var(--ink) 60%, transparent))",
};
