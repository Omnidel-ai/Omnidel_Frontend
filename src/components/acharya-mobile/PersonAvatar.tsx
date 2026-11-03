import { useState } from "react";
import { initials } from "../common/Avatar";

/**
 * Name → a stable tone, so the same person is the same colour on every screen
 * of both apps. The palette is the one both phone apps already use. Contractor
 * hashes over all five; Kaarigar's `NoteAvatar` used the first four. That is
 * deliberately not the desktop `Avatar` palette, which has eight colours.
 */
const TONES = ["var(--green-deep)", "var(--ochre)", "var(--terracotta)", "var(--slate)", "var(--plum)"];

function toneFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}

const PRESET = { sm: 28, md: 36, lg: 48, xl: 64 } as const;

export interface PersonAvatarProps {
  /** Shown as initials; also hashed for the colour. Pass the name already in the reader's script. */
  name: string | null | undefined;
  /** Hash this instead of `name` — keeps the colour fixed when the shown name is transliterated. */
  colorKey?: string;
  size?: keyof typeof PRESET | number;
  /** A photo. Falls back to initials if it fails to load. */
  imageUrl?: string | null;
  /** A ring in the page colour (or `--am-ring`) so overlapping avatars stay separable. */
  ring?: boolean;
  className?: string;
}

/**
 * Initials in a coloured circle, or a photo.
 *
 * Merges Contractor's `PersonAvatar` (dock, task rows, team rosters, profile)
 * with Kaarigar's `NoteAvatar` (comments) and the fallback half of
 * `acharya-avatar`. Initials come from the desktop kit's `initials()`, so
 * there is one rule for them across all three apps.
 */
export function PersonAvatar({ name, colorKey, size = "md", imageUrl, ring = false, className }: PersonAvatarProps) {
  const px = typeof size === "number" ? size : PRESET[size];
  const n = (name || "").trim();
  const [broken, setBroken] = useState<string | null>(null);
  const showImage = imageUrl && broken !== imageUrl;
  return (
    <span
      className={`am-avatar${ring ? " am-avatar--ring" : ""}${className ? ` ${className}` : ""}`}
      title={n || undefined}
      style={{ width: px, height: px, fontSize: Math.max(9, Math.round(px / 2.6)), background: toneFor(colorKey ?? n) }}
    >
      {showImage ? <img src={imageUrl} alt="" onError={() => setBroken(imageUrl)} /> : n ? initials(n) : "·"}
    </span>
  );
}

export function PersonAvatarStack({ names, max = 5, size = "sm" }: { names: string[]; max?: number; size?: PersonAvatarProps["size"] }) {
  if (names.length === 0) return null;
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  return (
    <span className="am-avatar-stack">
      {shown.map((n, i) => (
        <PersonAvatar key={`${n}-${i}`} name={n} size={size} ring />
      ))}
      {rest > 0 && <span className="am-avatar-stack__more">+{rest}</span>}
    </span>
  );
}
