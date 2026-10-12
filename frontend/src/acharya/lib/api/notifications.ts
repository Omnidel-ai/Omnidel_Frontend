"use client";

import { apiFetch } from "./profile";

// Client data layer for the karigar's own notification feed (/api/notifications).
// Mirrors the shapes returned by src/lib/server/notifications.ts.

export interface NoticeRow {
  id: string;
  kind: string | null;
  title: string;
  body: string | null;
  link: string | null;
  created_on: string;
}

export function fetchNotices(): Promise<{ items: NoticeRow[] }> {
  return apiFetch<{ items: NoticeRow[] }>("/api/notifications");
}

export function dismissNotice(id: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/api/notifications/${id}/read`, { method: "POST" });
}
