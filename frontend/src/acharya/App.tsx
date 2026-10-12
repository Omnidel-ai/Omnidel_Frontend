import { useEffect, useMemo, type ReactNode } from "react";
import { Fraunces, Inter_Tight, JetBrains_Mono } from "next/font/google";
import { AppBootstrap } from "@/components/acharya/shell/AppBootstrap";
import WorkAppFrame from "@/components/acharya/shell/WorkAppFrame";
import { VoiceSessionProvider } from "@/components/acharya/voice/VoiceSessionProvider";
import { TavusSessionProvider } from "@/components/acharya/voice/TavusSessionProvider";
import { HomeMahAcharyaGuideLazy } from "@/components/acharya/chat/HomeMahAcharyaGuideLazy";
import { IndicFontScope } from "@/components/acharya/shell/IndicFontScope";
import { InstantNavProvider } from "@/components/acharya/shell/instant-nav";
import { MahAcharyaMicProvider } from "@/components/acharya/voice/MahAcharyaMic";
import { LastScreenTracker } from "@/components/acharya/tasks/ContinueWhereYouLeftOff";
import { AcharyaShell } from "@/components/acharya/shell/AcharyaShell";
import { FALLBACK_ACHARYA_SLUG } from "@/acharya/lib/default-acharya";
import { RouteParams, matchPath, useRouterContext } from "./next/router";
import { hasDemoSession } from "./demo/api";
import { ACHARYAS, DEMO_USER } from "./demo/data";
import {
  AcharyaBoardPage,
  AcharyasHomePage,
  ActiveTaskPage,
  ComponentGalleryPage,
  NotFoundPage,
  ProfilePage,
  RequestOtpPage,
  SettingsPage,
  TaskDetailPage,
  TaskLearnPage,
  TasksPage,
  VerifyOtpPage,
} from "./pages";

/**
 * The Acharya karigar app, as PR #207 builds it, on demo data.
 *
 * This file is what Next's file-system router did for the app: it matches the
 * URL, mounts the same layouts in the same order (root → `(app)` →
 * `acharyas/[slug]`), and keeps each one mounted while you move beneath it —
 * the MahAcharya guide and voice session live in the `(app)` layout precisely
 * so they survive navigation, and that has to hold here too.
 */

const fraunces = Fraunces({ subsets: ["latin"], weight: ["400"], style: ["normal", "italic"], variable: "--font-fraunces", display: "swap" });
const interTight = Inter_Tight({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-inter-tight", display: "swap" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], weight: ["400"], variable: "--font-jetbrains-mono", display: "swap" });

type Page = { element: ReactNode; params: Record<string, string>; shellSlug?: string; app: boolean };

/** Redirects in the original pages, done as client-side replaces. */
function Redirect({ to }: { to: string }) {
  const { navigate } = useRouterContext();
  useEffect(() => navigate(to, { replace: true }), [navigate, to]);
  return null;
}

function legacyTaskRedirect(id: string, rest: string, search: string): string {
  // /tasks/[id] used to own task detail; it now lives under the acharya shell.
  const params = new URLSearchParams(search);
  const slug = params.get("acharyaSlug") || ACHARYAS.find((a) => a.slug === FALLBACK_ACHARYA_SLUG)?.slug || FALLBACK_ACHARYA_SLUG;
  params.delete("acharyaSlug");
  params.delete("acharyaName");
  const qs = params.toString();
  return `/acharyas/${slug}/tasks/${id}${rest}${qs ? `?${qs}` : ""}`;
}

function resolve(pathname: string, search: string): Page {
  const signIn = "/auth/phone/request-otp";
  let p: Record<string, string> | null;

  if (pathname === "/" || pathname === "") {
    return { element: <Redirect to={hasDemoSession() ? "/acharyas" : signIn} />, params: {}, app: false };
  }
  if (pathname === "/login" || pathname === "/auth/register") return { element: <Redirect to={signIn} />, params: {}, app: false };
  if (pathname === signIn) return { element: <RequestOtpPage />, params: {}, app: false };
  if (pathname === "/auth/phone/verify-otp") return { element: <VerifyOtpPage />, params: {}, app: false };

  // Everything below is the (app) group: signed in, inside the persistent layout.
  if (!hasDemoSession()) return { element: <Redirect to={signIn} />, params: {}, app: false };

  if (pathname === "/acharyas") return { element: <AcharyasHomePage />, params: {}, app: true };
  if (pathname === "/tasks") return { element: <TasksPage />, params: {}, app: true };
  if (pathname === "/profile") return { element: <ProfilePage />, params: {}, app: true };
  if (pathname === "/settings") return { element: <SettingsPage />, params: {}, app: true };
  if (pathname === "/components") return { element: <ComponentGalleryPage />, params: {}, app: true };
  if (pathname === "/profile/settings") {
    const section = new URLSearchParams(search).get("section");
    return { element: <Redirect to={section ? `/settings?section=${encodeURIComponent(section)}` : "/settings"} />, params: {}, app: true };
  }
  if ((p = matchPath("/tasks/:id", pathname))) return { element: <Redirect to={legacyTaskRedirect(p.id, "", search)} />, params: p, app: true };
  if ((p = matchPath("/tasks/:id/active", pathname))) return { element: <Redirect to={legacyTaskRedirect(p.id, "/active", search)} />, params: p, app: true };
  if ((p = matchPath("/tasks/:id/learn", pathname))) return { element: <Redirect to={legacyTaskRedirect(p.id, "/learn", search)} />, params: p, app: true };

  if ((p = matchPath("/acharyas/:slug", pathname))) return { element: <AcharyaBoardPage slug={p.slug} />, params: p, shellSlug: p.slug, app: true };
  if ((p = matchPath("/acharyas/:slug/tasks/:taskId", pathname)))
    return { element: <TaskDetailPage slug={p.slug} taskId={p.taskId} />, params: p, shellSlug: p.slug, app: true };
  if ((p = matchPath("/acharyas/:slug/tasks/:taskId/learn", pathname)))
    return { element: <TaskLearnPage slug={p.slug} taskId={p.taskId} />, params: p, shellSlug: p.slug, app: true };
  if ((p = matchPath("/acharyas/:slug/tasks/:taskId/active", pathname)))
    return { element: <ActiveTaskPage />, params: p, shellSlug: p.slug, app: true };

  return { element: <NotFoundPage />, params: {}, app: true };
}

/** `app/(app)/layout.tsx`: providers, the work frame and the MahAcharya guide. */
function AppGroupLayout({ children }: { children: ReactNode }) {
  const mahacharya = ACHARYAS.find((a) => a.slug === FALLBACK_ACHARYA_SLUG);
  return (
    <VoiceSessionProvider>
      <TavusSessionProvider>
        <IndicFontScope initialLang={DEMO_USER.preferredLang ?? "en"}>
          <InstantNavProvider>
            <MahAcharyaMicProvider>
              <WorkAppFrame>
                <LastScreenTracker />
                {children}
                <HomeMahAcharyaGuideLazy
                  mahacharya={{
                    slug: mahacharya?.slug ?? FALLBACK_ACHARYA_SLUG,
                    displayName: mahacharya?.displayName ?? "MahAcharya'ji",
                    avatarUrl: mahacharya?.avatarUrl ?? null,
                  }}
                  availableAcharyas={ACHARYAS.map((a) => ({ slug: a.slug, displayName: a.displayName }))}
                />
              </WorkAppFrame>
            </MahAcharyaMicProvider>
          </InstantNavProvider>
        </IndicFontScope>
      </TavusSessionProvider>
    </VoiceSessionProvider>
  );
}

/** `app/(app)/acharyas/[slug]/layout.tsx`: the persistent per-guide shell. */
function AcharyaSlugLayout({ slug, children }: { slug: string; children: ReactNode }) {
  const acharya = ACHARYAS.find((a) => a.slug === slug);
  if (!acharya) return <NotFoundPage />;
  return (
    <AcharyaShell
      acharya={{
        slug: acharya.slug,
        displayName: acharya.displayName,
        avatarUrl: acharya.avatarUrl,
        personaSummary: acharya.personaSummary,
        portraits: acharya.portraits,
      }}
    >
      {children}
    </AcharyaShell>
  );
}

export function App() {
  const { location } = useRouterContext();

  // `app/layout.tsx`: font variables and theme on <html>, page colours on <body>.
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.theme = "light";
    html.dataset.scrollBehavior = "smooth";
    html.classList.add("h-full", fraunces.variable, interTight.variable, jetbrainsMono.variable);
    document.body.classList.add("h-full", "bg-page", "text-ink", "font-sans");
  }, []);

  const page = useMemo(() => resolve(location.pathname, location.search), [location.pathname, location.search]);

  // A new slug is a new [slug] segment: Next mounts a fresh layout, so key it.
  let content = page.element;
  if (page.shellSlug) content = <AcharyaSlugLayout key={page.shellSlug} slug={page.shellSlug}>{content}</AcharyaSlugLayout>;
  if (page.app) content = <AppGroupLayout>{content}</AppGroupLayout>;

  return (
    <RouteParams params={page.params}>
      <AppBootstrap />
      {content}
    </RouteParams>
  );
}
