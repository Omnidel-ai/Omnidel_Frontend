/**
 * Initials avatars.
 *
 * The colour is derived from the name, so the same person is the same colour
 * everywhere without anyone storing a colour — and it is decoration only: the
 * initials and the `title` carry the identity.
 */

const PALETTE = [
  "var(--green-deep)",
  "var(--terracotta)",
  "var(--ochre)",
  "var(--ok)",
  "#6a5acd",
  "#0f7b6c",
  "var(--crit)",
  "var(--green)",
];

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export interface AvatarProps {
  name: string;
  size?: number;
  /** Ring in the surface colour, so overlapping avatars stay separable. */
  ring?: boolean;
}

export function Avatar({ name, size = 24, ring = false }: AvatarProps) {
  return (
    <span
      title={name}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: colorFor(name),
        color: "#f4efdf",
        fontSize: Math.max(8, size / 2.4),
        fontWeight: 700,
        fontFamily: "var(--sans)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        border: ring ? "1.5px solid var(--surface)" : undefined,
        boxSizing: "border-box",
      }}
    >
      {initials(name)}
    </span>
  );
}

export interface AvatarStackProps {
  names: string[];
  size?: number;
  /** How many to draw before collapsing the rest into "+N". */
  max?: number;
}

/** Overlapping avatars with a +N overflow — a card's or a board's members. */
export function AvatarStack({ names, size = 24, max = 5 }: AvatarStackProps) {
  if (names.length === 0) return null;
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  return (
    <span style={{ display: "inline-flex", alignItems: "center" }}>
      {shown.map((n, i) => (
        <span key={`${n}-${i}`} style={{ marginLeft: i === 0 ? 0 : -8, display: "inline-flex" }}>
          <Avatar name={n} size={size} ring />
        </span>
      ))}
      {rest > 0 && (
        <span
          style={{
            marginLeft: 6,
            fontFamily: "var(--mono)",
            fontSize: Math.max(9, size / 2.4),
            color: "var(--ink-mute)",
          }}
        >
          +{rest}
        </span>
      )}
    </span>
  );
}
