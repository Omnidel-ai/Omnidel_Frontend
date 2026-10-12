import { forwardRef, type AnchorHTMLAttributes, type MouseEvent } from "react";
import { useRouterContext } from "./router";

/**
 * `next/link` for the Vite build: a real `<a href>` that navigates in-app on a
 * plain left click and leaves modified clicks (new tab, etc.) to the browser.
 */
type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string | { pathname?: string; query?: Record<string, string> };
  replace?: boolean;
  scroll?: boolean;
  prefetch?: boolean | null;
};

function toHref(href: LinkProps["href"]): string {
  if (typeof href === "string") return href;
  const qs = href.query ? `?${new URLSearchParams(href.query)}` : "";
  return `${href.pathname ?? ""}${qs}`;
}

const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, replace, scroll, prefetch: _prefetch, onClick, target, ...rest },
  ref,
) {
  const { navigate } = useRouterContext();
  const url = toHref(href);

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (target && target !== "_self") return;
    e.preventDefault();
    navigate(url, { replace, scroll });
  };

  return <a ref={ref} href={url} target={target} onClick={handleClick} {...rest} />;
});

export default Link;
