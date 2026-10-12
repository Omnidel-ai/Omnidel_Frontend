import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * The routing layer the Next.js shims read from.
 *
 * The Acharya screens were written for the App Router and read the URL in two
 * ways: through `next/navigation` hooks, and straight off `window.location`
 * (about twenty places). So this router keeps the real URL as the source of
 * truth — paths like `/acharyas/mahacharya/tasks/t1` are real history entries,
 * not hash fragments — and re-renders whenever it changes, including changes
 * made by code that calls `history.pushState` itself, as Next allows.
 */

export interface RouterLocation {
  pathname: string;
  search: string;
}

interface RouterValue {
  location: RouterLocation;
  /** Bumped by `router.refresh()`; screens key their demo loads on it. */
  revision: number;
  navigate: (href: string, opts?: { replace?: boolean; scroll?: boolean }) => void;
  refresh: () => void;
}

const RouterContext = createContext<RouterValue | null>(null);
const ParamsContext = createContext<Record<string, string>>({});

const HISTORY_EVENT = "acharya:history";

function readLocation(): RouterLocation {
  return { pathname: window.location.pathname, search: window.location.search };
}

/** Next syncs its router with direct pushState/replaceState calls; so does this. */
function patchHistory() {
  const h = window.history as History & { __acharyaPatched?: boolean };
  if (h.__acharyaPatched) return;
  h.__acharyaPatched = true;
  for (const method of ["pushState", "replaceState"] as const) {
    const original = h[method].bind(h);
    h[method] = (data: unknown, unused: string, url?: string | URL | null) => {
      original(data, unused, url);
      window.dispatchEvent(new Event(HISTORY_EVENT));
    };
  }
}

// At load, not in an effect: child effects run before their parent's, so a
// page redirecting on mount would otherwise move the URL before we listen.
if (typeof window !== "undefined") patchHistory();

export function RouterProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState(readLocation);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    // Anything that moved the URL between the first render and now.
    setLocation((prev) => {
      const next = readLocation();
      return prev.pathname === next.pathname && prev.search === next.search ? prev : next;
    });
    const sync = () =>
      setLocation((prev) => {
        const next = readLocation();
        return prev.pathname === next.pathname && prev.search === next.search ? prev : next;
      });
    window.addEventListener("popstate", sync);
    window.addEventListener(HISTORY_EVENT, sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener(HISTORY_EVENT, sync);
    };
  }, []);

  const navigate = useCallback<RouterValue["navigate"]>((href, opts) => {
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) {
      window.location.assign(url.href);
      return;
    }
    const target = url.pathname + url.search + url.hash;
    if (opts?.replace) window.history.replaceState(null, "", target);
    else window.history.pushState(null, "", target);
    if (opts?.scroll !== false && !url.hash) window.scrollTo(0, 0);
  }, []);

  const refresh = useCallback(() => setRevision((r) => r + 1), []);

  const value = useMemo(() => ({ location, revision, navigate, refresh }), [location, revision, navigate, refresh]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouterContext(): RouterValue {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error("Acharya router used outside <RouterProvider>");
  return ctx;
}

export function RouteParams({ params, children }: { params: Record<string, string>; children: ReactNode }) {
  return <ParamsContext.Provider value={params}>{children}</ParamsContext.Provider>;
}

export function useRouteParams(): Record<string, string> {
  return useContext(ParamsContext);
}

/** `/acharyas/:slug/tasks/:taskId` against a pathname → params, or null. */
export function matchPath(pattern: string, pathname: string): Record<string, string> | null {
  const p = pattern.split("/").filter(Boolean);
  const s = pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  if (p.length !== s.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(":")) params[p[i].slice(1)] = decodeURIComponent(s[i]);
    else if (p[i] !== s[i]) return null;
  }
  return params;
}
