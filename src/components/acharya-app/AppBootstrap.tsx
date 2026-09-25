"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { DEFAULT_TEXT_SCALE, useStore } from "@/lib/store";

/**
 * Hydrates session from cookie, syncs `<html lang>` to preferred language, and
 * applies the accessibility text scale.
 */
export function AppBootstrap() {
  const hydrateMe = useStore((s) => s.hydrateMe);
  const lang = useStore((s) => s.lang);
  const pathname = usePathname();
  const textScale = useStore((s) => s.textScale);
  // Avoid writing to document / store until this client tree has mounted —
  // zustand persist rehydration can otherwise race React 19 mount.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    // Skip /api/auth/me on public auth screens — saves a cold Node round-trip
    // on login LCP (measured ~300ms+ on prod cold path).
    if (pathname?.startsWith("/auth")) return;
    void hydrateMe();
  }, [mounted, hydrateMe, pathname]);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    root.lang = lang;
    root.classList.toggle("bn", lang === "bn");
    root.classList.toggle("hi", lang === "hi");
  }, [mounted, lang]);

  // `zoom` rather than a root font-size: this app hardcodes px type in inline
  // styles, so a root font-size would scale nothing at all. Cleared (not set to
  // "1") at the default so we leave no stray style on <html>.
  useEffect(() => {
    if (!mounted) return;
    const html = document.documentElement;
    if (textScale && textScale !== DEFAULT_TEXT_SCALE) {
      html.style.zoom = String(textScale);
    } else {
      html.style.removeProperty("zoom");
    }
  }, [mounted, textScale]);

  return null;
}
