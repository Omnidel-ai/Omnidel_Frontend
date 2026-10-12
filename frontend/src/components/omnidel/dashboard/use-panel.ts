"use client";

import { useEffect, useState } from "react";

/**
 * Fetch one dashboard panel, with a cache that survives tab switches.
 *
 * Three problems this solves, all observed in dev logs:
 *
 *  1. Switching to a tab and back refetched from scratch, so a 6-second load was
 *     paid again for data that had not changed.
 *  2. `?days=1` was requested twice on mount. React runs effects twice in dev
 *     StrictMode, and both calls raced. The in-flight map means the second caller
 *     joins the first request instead of starting another.
 *  3. Switching tabs quickly left a slow earlier response to land last and
 *     overwrite the newer one. Responses are now ignored unless their key still
 *     matches what the component wants.
 *
 * The cache is module-level on purpose: it must outlive the component so going
 * back to a tab is instant. It is a plain Map rather than a library because the
 * whole requirement is "same key, same answer, until the page is reloaded".
 */

const CACHE = new Map<string, unknown>();
const INFLIGHT = new Map<string, Promise<unknown>>();

/** How long a cached panel stays fresh. Admin reporting does not need seconds. */
const TTL_MS = 60_000;
const STAMPS = new Map<string, number>();

function fresh(key: string): boolean {
  const at = STAMPS.get(key);
  return at !== undefined && Date.now() - at < TTL_MS;
}

async function load(key: string, url: string): Promise<unknown> {
  const existing = INFLIGHT.get(key);
  if (existing) return existing;

  const p = fetch(url)
    .then(async r => {
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error || `Load failed (${r.status})`);
      }
      return r.json();
    })
    .then(data => {
      CACHE.set(key, data);
      STAMPS.set(key, Date.now());
      return data;
    })
    .finally(() => { INFLIGHT.delete(key); });

  INFLIGHT.set(key, p);
  return p;
}

export interface PanelState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** True while revalidating stale data that is already on screen. */
  refreshing: boolean;
}

export function usePanel<T>(panel: string, days: number, nonce = 0): PanelState<T> {
  const key = `${panel}:${days}:${nonce}`;
  const cached = (CACHE.get(key) as T | undefined) ?? null;

  const [data, setData] = useState<T | null>(cached);
  const [error, setError] = useState<string | null>(null);
  // Only show the skeleton when there is genuinely nothing to render. A cached
  // panel repaints immediately and revalidates behind the existing content.
  const [loading, setLoading] = useState<boolean>(cached === null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    const hit = (CACHE.get(key) as T | undefined) ?? null;

    if (hit !== null) {
      setData(hit);
      setLoading(false);
      setError(null);
      if (fresh(key)) return;      // cached and fresh: nothing to do
      setRefreshing(true);          // cached but stale: revalidate quietly
    } else {
      setLoading(true);
      setError(null);
    }

    load(key, `/api/admin/dashboard/panels/${panel}?days=${days}`)
      .then(d => {
        if (!active) return;        // a newer key superseded this request
        setData(d as T);
        setError(null);
      })
      .catch(e => {
        if (!active) return;
        // Keep stale content on screen rather than blanking the panel; the
        // message says the numbers may be behind.
        setError(e instanceof Error ? e.message : "Load failed");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setRefreshing(false);
      });

    return () => { active = false; };
  }, [key, panel, days]);

  return { data, loading, error, refreshing };
}
