"use client";

import { Fragment, Suspense, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useLang } from "@/lib/i18n/useLang";
import { journeyStrings } from "@/lib/i18n/journey-strings";
import { JourneyIcon, type JourneyIconName } from "./WorkProgressOverview";
import { MahAcharyaDockMic } from "./voice/MahAcharyaMic";

function WorkNavigation() {
  const path = usePathname();
  const search = useSearchParams();
  const copy = journeyStrings(useLang());
  // Full-attention task/voice screens retain their existing persistent shell.
  if (!["/acharyas", "/tasks", "/profile", "/settings"].includes(path)) return null;
  const onStories = path === "/acharyas" && search.get("view") === "stories";
  const entries: { href: string; label: string; icon: JourneyIconName; active: boolean }[] = [
    { href: "/acharyas", label: copy.home, icon: "home", active: path === "/acharyas" && !onStories },
    { href: "/tasks", label: copy.work, icon: "work", active: path === "/tasks" },
    { href: "/acharyas?view=stories", label: copy.stories, icon: "stories", active: onStories },
    { href: "/profile?tab=profile", label: copy.profile, icon: "profile", active: path === "/settings" || path === "/profile" },
  ];
  return <nav className="journey-navigation" aria-label={copy.navigation}>{entries.map((item, index) => <Fragment key={item.icon}>{index === 2 && <MahAcharyaDockMic />}<Link href={item.href} replace={path === "/profile" && item.href.startsWith("/profile")} aria-current={item.active ? "page" : undefined}><JourneyIcon name={item.icon} /><span>{item.label}</span></Link></Fragment>)}</nav>;
}

export default function WorkAppFrame({ children }: { children: ReactNode }) {
  const path = usePathname();
  const topLevel = ["/acharyas", "/tasks", "/profile", "/settings"].includes(path);
  return <div className="journey-app" data-top-level={topLevel ? "true" : undefined}>{children}<Suspense fallback={null}><WorkNavigation /></Suspense></div>;
}
