"use client";

import type { ReactNode } from "react";
import { Hind_Siliguri, Hind } from "next/font/google";
import { useLang } from "@/lib/i18n/useLang";
import type { Lang } from "@/lib/store";

const hindSiliguri = Hind_Siliguri({
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600"],
  variable: "--font-hind-siliguri",
  display: "swap",
  preload: false,
});

const hind = Hind({
  subsets: ["devanagari", "latin"],
  weight: ["400", "500", "600"],
  variable: "--font-hind",
  display: "swap",
  preload: false,
});

/**
 * Attaches Indic next/font CSS variables only when the active UI lang needs
 * them. Avoids EN sessions competing for Bengali/Devanagari woff2 on first
 * paint, while still applying fonts immediately after a client-side lang switch.
 */
export function IndicFontScope({
  children,
  initialLang,
}: {
  children: ReactNode;
  /** Server session lang — used before zustand rehydrates. */
  initialLang?: string | null;
}) {
  const storeLang = useLang();
  const lang = (storeLang || initialLang || "en").toLowerCase() as Lang | string;
  const indic =
    lang === "bn" || lang.startsWith("bn-")
      ? hindSiliguri.variable
      : lang === "hi" || lang.startsWith("hi-")
        ? hind.variable
        : "";

  return <div className={`min-h-screen ${indic}`.trim()}>{children}</div>;
}
