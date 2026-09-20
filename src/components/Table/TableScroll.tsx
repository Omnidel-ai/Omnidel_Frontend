import type { CSSProperties, ReactNode } from "react";
import { useHScrollThumb } from "../../hooks/useHScrollThumb";

export interface TableScrollProps {
  children: ReactNode;
  /** Floor for the row grid, in px. Set it past the point where the columns
   *  stop being readable — below it the row scrolls instead of compressing. */
  minWidth?: number;
  /** Floor for the card height; a short list still reads as a card. */
  minHeight?: number;
  style?: CSSProperties;
}

/**
 * Card-framed scroll container for `.table-header` / `.table-row` children.
 *
 * Desktop renders a plain flex column with the native scrollbar; phones hide
 * that bar and get the drawn rail underneath, because an overlay scrollbar
 * that fades out cannot advertise the columns it is hiding.
 */
export function TableScroll({ children, minWidth = 640, minHeight, style }: TableScrollProps) {
  const { viewportRef, thumb } = useHScrollThumb(children);

  return (
    <div
      className="table-wrap"
      style={
        {
          "--table-min-w": `${minWidth}px`,
          ...(minHeight != null ? { "--table-min-h": `${minHeight}px` } : null),
          ...style,
        } as CSSProperties
      }
    >
      <div ref={viewportRef} className="table-scroll-viewport">
        {children}
      </div>
      <div className="table-scroll-rail" aria-hidden="true">
        <div
          className="table-scroll-thumb"
          style={{
            width: `${thumb.widthPct}%`,
            left: `${thumb.leftPct}%`,
            opacity: thumb.hasOverflow ? 1 : 0.45,
          }}
        />
      </div>
    </div>
  );
}
