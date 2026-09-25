"use client";

/**
 * Instant navigation skeletons.
 *
 * Soft navigations in the App Router often keep the *old* screen painted until
 * the destination RSC (and sometimes a new layout) finishes. That feels like
 * "tap → lag → suddenly open". This provider paints a destination-shaped
 * skeleton on the same click, then clears when the pathname catches up.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { skeletonForPath } from "@/components/nav-skeletons";

type InstantNavContextValue = {
  begin: (href: string) => void;
  push: (href: string) => void;
  replace: (href: string) => void;
  /**
   * Go back to `href`. When it is genuinely the previous entry this app pushed,
   * that is a history back — Next restores the destination from the router cache
   * with no server round-trip. Otherwise it falls back to replace().
   */
  back: (href: string) => void;
  /**
   * Move within the screen the karigar is already on, where only the query
   * changes (`/profile?tab=…`, `/settings?section=…`). Falls through to
   * push() when the route genuinely differs, so a caller that cannot know where
   * the karigar is standing may always call this one.
   */
  replaceQuery: (href: string) => void;
  /**
   * True while the destination skeleton covers the screen. Screens that animate
   * across a navigation need it: the persistent acharya header flips its variant
   * while this overlay is still up, so a morph started then would play behind a
   * cream panel (see components/AcharyaHeaderMorph).
   */
  pending: boolean;
};

const InstantNavContext = createContext<InstantNavContextValue | null>(null);

function normalizePath(href: string): string {
  try {
    const url = href.startsWith("http")
      ? new URL(href)
      : new URL(href, "http://local.invalid");
    return url.pathname || "/";
  } catch {
    return href.split("?")[0]?.split("#")[0] || href;
  }
}

function sameRoute(a: string, b: string): boolean {
  const left = normalizePath(a).replace(/\/$/, "") || "/";
  const right = normalizePath(b).replace(/\/$/, "") || "/";
  return left === right;
}

function isModifiedClick(e: MouseEvent): boolean {
  return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
}

export function InstantNavProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const begin = useCallback((href: string) => {
    const next = normalizePath(href);
    if (!next.startsWith("/")) return;
    setPendingHref(next);
  }, []);

  // Paths this app pushed, newest last — the entries a history back would land
  // on. Only ever consulted to decide whether router.back() reaches the screen
  // the caller asked for.
  const pushedFrom = useRef<string[]>([]);
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const push = useCallback(
    (href: string) => {
      const from = pathnameRef.current;
      if (from && !sameRoute(from, href)) {
        pushedFrom.current.push(normalizePath(from));
        // A karigar never needs more history than the shell is deep.
        if (pushedFrom.current.length > 12) pushedFrom.current.shift();
      }
      begin(href);
      router.push(href);
    },
    [begin, router],
  );

  const replace = useCallback(
    (href: string) => {
      begin(href);
      router.replace(href);
    },
    [begin, router],
  );

  /**
   * Back used to be a replace() to the target, which is a fresh navigation:
   * the destination RSC re-runs (the board is force-dynamic and refetches
   * OmniDel), so leaving a task flashed a skeleton for seconds. A real
   * history back restores the previous entry from the router cache instead —
   * instant, no loading state. Only safe when the previous entry IS the
   * requested target: the shell's back goes to the BOARD, and from a learn
   * screen the entry behind is the task, not the board.
   */
  const back = useCallback(
    (href: string) => {
      const stack = pushedFrom.current;
      const previous = stack[stack.length - 1];
      if (previous && sameRoute(previous, href)) {
        stack.pop();
        router.back();
        return;
      }
      begin(href);
      router.replace(href);
    },
    [begin, router],
  );

  /**
   * Same screen, different query — a view toggle, not a journey.
   *
   * `push()` is wrong for this and PR #152's QA is what it looks like when you
   * use it anyway: "show my report" while Report was open flickered the screen
   * three or four times. Two separate costs, both paid for nothing. The skeleton
   * overlay paints instantly (the pathname already matches `pendingHref`, so it
   * clears two frames later) — that flash IS the flicker. And `router.push`
   * refetches the RSC of a force-dynamic page which then re-renders the client
   * component IN PLACE, so its `useState` keeps the old tab: the URL said
   * requests, the screen stayed on report, which is exactly what QA saw.
   *
   * `history.replaceState` instead. Next patches it to dispatch the new URL into
   * the router, so `usePathname` / `useSearchParams` update and the screen reads
   * its own tab off the URL — no fetch, no overlay, no history entry to walk
   * back through. The state argument MUST be `null`: Next skips that dispatch
   * when the state handed to it already carries `__NA`, and every app-router
   * entry carries it (see the long note in `task-board.tsx`, where passing
   * `window.history.state` silently broke the same mechanism).
   *
   * Screens reached this way must therefore read their query with
   * `useSearchParams` — a server prop cannot arrive without a server render.
   * `ProfileClient` and `SettingsClient` both do.
   */
  const replaceQuery = useCallback(
    (href: string) => {
      // `window.location`, not `pathnameRef` — the ref is written by an effect,
      // so it can lag a route change by a commit, and a stale "same route" would
      // swap the query on a screen the karigar has already left.
      if (typeof window === "undefined" || !sameRoute(window.location.pathname, href)) {
        push(href);
        return;
      }
      const next = new URL(href, window.location.origin);
      // Already exactly here: writing the identical URL would not change
      // `useSearchParams`, so this only saves the work — but it also keeps
      // "say it twice" from looking like a no-op that failed.
      if (next.pathname === window.location.pathname && next.search === window.location.search) {
        return;
      }
      window.history.replaceState(null, "", `${next.pathname}${next.search}${next.hash}`);
    },
    [push],
  );

  useEffect(() => {
    if (!pendingHref) return;
    // Exact path only — do not treat "/acharyas/x/tasks/y" as arrived at
    // "/acharyas/x" (going up the tree must keep the skeleton until the board lands).
    if (!sameRoute(pathname, pendingHref)) return;

    // Pathname matching alone is too early: Next can update the URL while the
    // shell content slot is still empty (especially task → board). Keep the
    // destination skeleton until the new route tree has a chance to paint its
    // Suspense/loading fallback, or we flash a blank cream panel.
    let cancelled = false;
    let raf2 = 0;
    let settleTimer = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        settleTimer = window.setTimeout(() => {
          if (!cancelled) setPendingHref(null);
        }, 80);
      });
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf1);
      if (raf2) window.cancelAnimationFrame(raf2);
      if (settleTimer) window.clearTimeout(settleTimer);
    };
  }, [pathname, pendingHref]);

  // Safety: never leave a stuck overlay if navigation was cancelled / failed.
  useEffect(() => {
    if (!pendingHref) return;
    const t = window.setTimeout(() => setPendingHref(null), 8000);
    return () => window.clearTimeout(t);
  }, [pendingHref]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (isModifiedClick(e) || e.defaultPrevented) return;
      const el = e.target;
      if (!(el instanceof Element)) return;
      const anchor = el.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      if (href.startsWith("http") && !href.startsWith(window.location.origin)) return;
      const next = normalizePath(href);
      if (!next.startsWith("/")) return;
      if (sameRoute(next, pathname)) return;
      setPendingHref(next);
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname]);

  // Browser / Android system back: no <a> click and no nav.replace — still paint
  // a destination skeleton from the history URL when possible.
  useEffect(() => {
    function onPopState() {
      try {
        const next = normalizePath(window.location.href);
        if (!next.startsWith("/")) return;
        // The system back consumed the entry our own back() would have used.
        const stack = pushedFrom.current;
        if (stack.length > 0 && sameRoute(stack[stack.length - 1], next)) stack.pop();
        if (sameRoute(next, pathname)) return;
        setPendingHref(next);
      } catch {
        /* ignore */
      }
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [pathname]);

  const value = useMemo(
      () => ({ begin, push, replace, back, replaceQuery, pending: pendingHref != null }),
      [begin, push, replace, back, replaceQuery, pendingHref],
  );
  // Keep overlay until we explicitly clear pendingHref after settle — do not
  // hide on pathname match alone (that caused the task→board blank flash).
  const showOverlay = pendingHref != null;

  return (
    <InstantNavContext.Provider value={value}>
      {children}
      {showOverlay && pendingHref ? (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            background: "var(--page)",
            overflow: "auto",
          }}
        >
          {skeletonForPath(pendingHref)}
        </div>
      ) : null}
    </InstantNavContext.Provider>
  );
}

export function useInstantNav(): InstantNavContextValue {
  const ctx = useContext(InstantNavContext);
  if (!ctx) {
    // Outside provider (auth screens): no-op begin, plain push via window.
    return {
      begin: () => {},
      push: (href: string) => {
        if (typeof window !== "undefined") window.location.assign(href);
      },
      replace: (href: string) => {
        if (typeof window !== "undefined") window.location.replace(href);
      },
      back: (href: string) => {
        if (typeof window !== "undefined") window.location.replace(href);
      },
      replaceQuery: (href: string) => {
        if (typeof window !== "undefined") window.location.replace(href);
      },
      pending: false,
    };
  }
  return ctx;
}
