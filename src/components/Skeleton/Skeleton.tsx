import type { CSSProperties } from "react";

export interface SkeletonProps {
  /** Any CSS length. Defaults to 100%. */
  width?: number | string;
  height?: number | string;
  /** Pill for text lines, circle for an avatar, square for a tile. */
  shape?: "line" | "circle" | "block";
  style?: CSSProperties;
  className?: string;
}

/**
 * One shimmering placeholder.
 *
 * A skeleton is only honest when it has the shape of what replaces it — same
 * height, same rhythm — so this takes explicit dimensions rather than guessing.
 * It is `aria-hidden`: a screen reader hears the container's `aria-busy`, not a
 * row of empty boxes.
 *
 * The shimmer respects `prefers-reduced-motion` (see `.skeleton-bar` in
 * global.css).
 */
export function Skeleton({ width = "100%", height = 10, shape = "line", style, className }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={["skeleton-bar", className].filter(Boolean).join(" ")}
      style={{
        display: "block",
        width,
        height: shape === "circle" ? (width as number) : height,
        borderRadius: shape === "circle" ? "50%" : shape === "block" ? "var(--r-sm)" : 2,
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

export interface SkeletonTextProps {
  /** How many lines. The last one is shortened, as running text would be. */
  lines?: number;
  /** Line height in px. */
  height?: number;
  gap?: number;
  /** Width of the last line. */
  lastWidth?: string;
  style?: CSSProperties;
}

/** A paragraph-shaped block of skeleton lines. */
export function SkeletonText({
  lines = 3,
  height = 10,
  gap = 8,
  lastWidth = "60%",
  style,
}: SkeletonTextProps) {
  return (
    <span style={{ display: "flex", flexDirection: "column", gap, ...style }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={height} width={i === lines - 1 ? lastWidth : "100%"} />
      ))}
    </span>
  );
}

export interface SkeletonCardProps {
  /** Show a leading avatar circle. */
  avatar?: boolean;
  lines?: number;
  /** Reserve a block for a chart or an image. */
  media?: number;
  style?: CSSProperties;
}

/** Card-shaped placeholder — a stat tile, a panel, a feed item. */
export function SkeletonCard({ avatar = false, lines = 3, media, style }: SkeletonCardProps) {
  return (
    <div
      aria-busy="true"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--rule)",
        borderRadius: "var(--r-md)",
        padding: "var(--card-pad)",
        ...style,
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        {avatar && <Skeleton shape="circle" width={32} />}
        <Skeleton height={12} width="45%" />
      </div>
      {media != null && <Skeleton shape="block" height={media} style={{ marginBottom: 12 }} />}
      <SkeletonText lines={lines} />
    </div>
  );
}

export interface SkeletonRowsProps {
  /** Number of placeholder rows. */
  rows?: number;
  /** Grid template of the table this stands in for, so columns line up. */
  gridTemplateColumns: string;
  /** Column count, when no per-column widths are needed. */
  columns: number;
}

/**
 * Placeholder rows for a table, on the real grid.
 *
 * Used by `Table` while `loading` is true. The first cell is wider than the
 * rest so the block reads as a list of names, not a mosaic.
 */
export function SkeletonRows({ rows = 5, gridTemplateColumns, columns }: SkeletonRowsProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="table-row" style={{ gridTemplateColumns }} aria-hidden="true">
          {Array.from({ length: columns }).map((__, c) => (
            <div key={c} className="table-cell">
              <Skeleton width={c === 0 ? "70%" : "45%"} />
            </div>
          ))}
        </div>
      ))}
    </>
  );
}
