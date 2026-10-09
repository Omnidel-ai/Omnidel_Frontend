"use client";

import { useEffect, useState } from "react";
import { WHATS_NEW_LAST_SEEN_KEY } from "@/lib/whats-new-schema";

/** Small mute-ink dot when a newer published entry exists than lastSeen. */
export function useWhatsNewUnread(newestReleasedOn: string | null): boolean {
  const [unread, setUnread] = useState(false);

  useEffect(() => {
    if (!newestReleasedOn) {
      setUnread(false);
      return;
    }
    try {
      const last = localStorage.getItem(WHATS_NEW_LAST_SEEN_KEY);
      setUnread(!last || newestReleasedOn > last);
    } catch {
      setUnread(Boolean(newestReleasedOn));
    }
  }, [newestReleasedOn]);

  return unread;
}

export function markWhatsNewSeen(newestReleasedOn: string | null): void {
  if (!newestReleasedOn) return;
  try {
    localStorage.setItem(WHATS_NEW_LAST_SEEN_KEY, newestReleasedOn);
  } catch {
    /* private mode */
  }
}

export function WhatsNewUnreadDot({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span
      aria-hidden
      style={{
        width: 6,
        height: 6,
        borderRadius: 999,
        background: "var(--green-deep)",
        flexShrink: 0,
      }}
    />
  );
}
