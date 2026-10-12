import { useMemo } from "react";
import { useRouteParams, useRouterContext } from "./router";

/**
 * `next/navigation` for the Vite build. Aliased in `vite.acharya.config.ts`
 * and `tsconfig.acharya.json`, so the screens import it unchanged.
 *
 * Only what the Acharya client code uses: useRouter, usePathname,
 * useSearchParams, useParams.
 */

export interface AppRouterInstance {
  push: (href: string, options?: { scroll?: boolean }) => void;
  replace: (href: string, options?: { scroll?: boolean }) => void;
  back: () => void;
  forward: () => void;
  refresh: () => void;
  prefetch: (href: string) => void;
}

export function useRouter(): AppRouterInstance {
  const { navigate, refresh } = useRouterContext();
  return useMemo(
    () => ({
      push: (href, options) => navigate(href, { scroll: options?.scroll }),
      replace: (href, options) => navigate(href, { replace: true, scroll: options?.scroll }),
      back: () => window.history.back(),
      forward: () => window.history.forward(),
      refresh,
      prefetch: () => {},
    }),
    [navigate, refresh],
  );
}

export function usePathname(): string {
  return useRouterContext().location.pathname;
}

export function useSearchParams(): URLSearchParams {
  const { search } = useRouterContext().location;
  return useMemo(() => new URLSearchParams(search), [search]);
}

export function useParams<T extends Record<string, string> = Record<string, string>>(): T {
  return useRouteParams() as T;
}
