"use client";

import { useEffect, useState } from "react";
import { type PinnedItem, isItemPinned, togglePin, subscribePins } from "@/lib/client/pins";

// Pin toggle rendered as an overlay in a card corner. It is a SIBLING of the
// card's <Link> (not a child) so we never nest a <button> inside an <a>; the
// click stays local and doesn't navigate.
export function PinButton({ item, style }: { item: PinnedItem; style?: React.CSSProperties }) {
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    const update = () => setPinned(isItemPinned(item.type, item.id));
    update();
    return subscribePins(update);
  }, [item.type, item.id]);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        togglePin(item);
      }}
      title={pinned ? "Unpin" : "Pin for quick access"}
      aria-label={pinned ? "Unpin" : "Pin for quick access"}
      aria-pressed={pinned}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        padding: 4, lineHeight: 0,
        background: "transparent", border: "none", cursor: "pointer",
        borderRadius: "var(--r-sm)",
        color: pinned ? "var(--green-deep)" : "var(--ink-faint)",
        ...style,
      }}
    >
      <PinIcon filled={pinned} />
    </button>
  );
}

export function PinIcon({ filled, size = 15 }: { filled?: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="12" x2="12" y1="17" y2="22" />
      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
    </svg>
  );
}
