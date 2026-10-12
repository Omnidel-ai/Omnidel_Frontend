import { Suspense, lazy, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import AcharyasHomeClient from "./screens/home/AcharyasHomeClient";
import AcharyaBoardClient from "./screens/board/AcharyaBoardClient";
import TaskDetailClient, { type TaskSection } from "./screens/task/TaskDetailClient";
import ActiveTaskPageClient from "./screens/task/ActiveTaskPage";
import ProfileClient, { type ProfileTabId } from "./screens/profile/ProfileClient";
import SettingsClient from "./screens/settings/SettingsClient";
import TasksPageClient from "./screens/tasks/TasksPageClient";
import RequestOtpClient from "./screens/auth/RequestOtpClient";
import VerifyOtpClient from "./screens/auth/VerifyOtpClient";
import { BoardSkeleton } from "@/components/acharya/shell/nav-skeletons";
import { FALLBACK_ACHARYA_SLUG } from "@/acharya/lib/default-acharya";
import { countTasksByLane, seedTasksPerLane } from "@/acharya/lib/acharya-tasks";
import { normalizeClientLang } from "@/acharya/lib/i18n/lang";
import { normalizeSettingsSection } from "@/acharya/lib/voice-nav-targets";
import { useRouterContext } from "./next/router";
import { demoTask, demoTasks } from "./demo/api";
import { ACHARYAS, DEMO_USER } from "./demo/data";

/**
 * One component per `page.tsx` in PR #207.
 *
 * Each does what its server page did — find the guide, the tasks, the user —
 * from the demo data instead of Supabase, then renders the page's client
 * component with exactly the props the server page passed. `router.refresh()`
 * bumps `revision`, which re-reads, the same way a refresh re-runs the server
 * page.
 */

const ComponentGallery = lazy(() => import("./gallery/ComponentGallery"));

const DEFAULT_SLUG = FALLBACK_ACHARYA_SLUG;
const pinnedSlug = ACHARYAS.find((a) => a.slug === DEFAULT_SLUG)?.slug ?? null;

const sessionUser = () => ({
  id: DEMO_USER.id,
  name: DEMO_USER.name,
  phone: DEMO_USER.phone,
  role: DEMO_USER.role,
  isAdmin: DEMO_USER.isAdmin,
  preferredLang: normalizeClientLang(DEMO_USER.preferredLang),
});

function useTasks() {
  const { revision, location } = useRouterContext();
  // Re-read on refresh and on every navigation, like a dynamic server page.
  return useMemo(() => demoTasks(), [revision, location.pathname, location.search]);
}

export function AcharyasHomePage() {
  const tasks = useTasks();
  return <AcharyasHomeClient acharyas={ACHARYAS} tasks={tasks} defaultSlug={DEFAULT_SLUG} pinnedSlug={pinnedSlug} />;
}

export function TasksPage() {
  const tasks = useTasks();
  return <TasksPageClient initialTasks={tasks} acharyas={ACHARYAS} defaultSlug={DEFAULT_SLUG} pinnedSlug={pinnedSlug} />;
}

export function AcharyaBoardPage({ slug }: { slug: string }) {
  const tasks = useTasks();
  const acharya = ACHARYAS.find((a) => a.slug === slug);
  if (!acharya) return <NotFoundPage />;
  const scoped = tasks.filter((t) => (t.acharyaSlug ?? DEFAULT_SLUG) === slug);
  const laneTotals = countTasksByLane(scoped);
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <AcharyaBoardClient
        acharya={acharya}
        seedTasks={seedTasksPerLane(scoped)}
        laneTotals={laneTotals}
        progressTotal={scoped.length}
        progressCompleted={laneTotals.done}
        workspaceSlug={scoped[0]?.workspaceSlug ?? ""}
        defaultAcharyaSlug={DEFAULT_SLUG}
      />
    </Suspense>
  );
}

function enrich(taskId: string) {
  const task = demoTask(taskId);
  if (!task) return null;
  const acharyaName = task.acharyaName || "Acharya";
  return {
    ...task,
    workspaceSlug: task.workspaceSlug ?? "",
    acharyaName,
    acharyaInitial: (acharyaName.trim()[0] || "·").toUpperCase(),
    acharyaAvatarUrl: task.acharyaAvatarUrl || undefined,
  };
}

export function TaskDetailPage({ slug, taskId }: { slug: string; taskId: string }) {
  const tab = useSearchParams().get("tab");
  const task = enrich(taskId);
  if (!task) return <NotFoundPage />;
  const initialSection: TaskSection =
    tab === "chat" || tab === "quiz" || tab === "learn" || tab === "comments" ? tab : "task";
  return (
    <TaskDetailClient
      key={taskId}
      task={task}
      workspaceSlug={task.workspaceSlug}
      acharyaSlug={slug}
      initialSection={initialSection}
    />
  );
}

export function TaskLearnPage({ slug, taskId }: { slug: string; taskId: string }) {
  const params = useSearchParams();
  const task = enrich(taskId);
  if (!task) return <NotFoundPage />;
  const tab = params.get("tab");
  const quiz = params.get("startQuiz");
  const initialQuizStart = quiz === "1" || quiz === "true";
  const initialSection: TaskSection =
    tab === "chat" || tab === "quiz" || tab === "learn" || tab === "comments"
      ? tab
      : initialQuizStart
        ? "quiz"
        : "learn";
  return (
    <TaskDetailClient
      key={taskId}
      task={task}
      workspaceSlug={task.workspaceSlug}
      acharyaSlug={slug}
      initialSection={initialSection}
      initialQuizStart={initialQuizStart}
    />
  );
}

export function ActiveTaskPage() {
  return <ActiveTaskPageClient />;
}

const PROFILE_TABS: readonly ProfileTabId[] = ["profile", "report", "history", "requests"];

export function ProfilePage() {
  const params = useSearchParams();
  const { navigate } = useRouterContext();
  const tab = params.get("tab");
  const settings = params.get("settings");
  if (settings === "1" || settings === "true") {
    queueMicrotask(() => navigate("/settings", { replace: true }));
    return null;
  }
  const initialTab: ProfileTabId = PROFILE_TABS.includes(tab as ProfileTabId) ? (tab as ProfileTabId) : "report";
  return <ProfileClient user={sessionUser()} initialTab={initialTab} />;
}

export function SettingsPage() {
  const section = useSearchParams().get("section");
  const mahacharya = ACHARYAS.find((a) => a.slug === FALLBACK_ACHARYA_SLUG);
  return (
    <SettingsClient
      user={sessionUser()}
      mahAcharyaName={mahacharya?.displayName || "MahAcharya'ji"}
      focusSection={normalizeSettingsSection(section)}
    />
  );
}

function authProps() {
  const acharya = ACHARYAS.find((a) => a.slug === FALLBACK_ACHARYA_SLUG);
  return {
    portraitUrl: acharya?.avatarUrl ?? null,
    acharyaSlug: acharya?.slug ?? FALLBACK_ACHARYA_SLUG,
    acharyaName: acharya?.displayName ?? "MahAcharya'ji",
  };
}

export function RequestOtpPage() {
  return <RequestOtpClient {...authProps()} />;
}

export function VerifyOtpPage() {
  return <VerifyOtpClient {...authProps()} />;
}

export function ComponentGalleryPage() {
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <ComponentGallery />
    </Suspense>
  );
}

export function NotFoundPage() {
  return (
    <div style={{ padding: "48px 20px", textAlign: "center", fontFamily: "var(--sans)" }}>
      <p style={{ fontFamily: "var(--serif)", fontSize: 26, marginBottom: 8 }}>Not found</p>
      <p style={{ color: "var(--ink-mute)", fontSize: 14 }}>
        This page is not part of the demo. <a href="/acharyas">Back to home</a>
      </p>
    </div>
  );
}
