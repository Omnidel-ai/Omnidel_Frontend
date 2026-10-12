"use client";

import type { Lang } from "@/acharya/lib/store";

export class ProfileApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "ProfileApiError";
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { cache: "no-store", ...init });
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* ignore parse error */
    }
    throw new ProfileApiError(
      res.status,
      (body as { error?: string } | null)?.error ?? `profile API ${path} returned ${res.status}`,
      body,
    );
  }
  return res.json() as Promise<T>;
}

export function updateProfileLanguage(lang: Lang): Promise<{ ok: true; preferredLang: Lang }> {
  return apiFetch<{ ok: true; preferredLang: Lang }>("/api/profile/language", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lang }),
  });
}
