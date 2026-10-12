import { Suspense, lazy, type ComponentType, type ReactNode } from "react";

/**
 * `next/dynamic` for the Vite build: `React.lazy` plus the `loading`
 * fallback. `ssr` means nothing in a client-only app and is ignored.
 */
type Loaded<P> = ComponentType<P> | { default: ComponentType<P> };

export default function dynamic<P extends object>(
  loader: () => Promise<Loaded<P>>,
  options?: { loading?: () => ReactNode; ssr?: boolean },
): ComponentType<P> {
  const Lazy = lazy(async () => {
    const mod = await loader();
    return { default: "default" in mod ? mod.default : mod };
  });
  function Dynamic(props: P) {
    return (
      <Suspense fallback={options?.loading?.() ?? null}>
        <Lazy {...props} />
      </Suspense>
    );
  }
  return Dynamic;
}
