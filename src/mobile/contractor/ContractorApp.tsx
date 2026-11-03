import { useState } from "react";
import { BottomDock, MicButton, MobileScreen } from "../../components/acharya-mobile";
import { PhoneFrame, SignInScreen, useDemoMic, useScreenStack } from "../shared";
import { ContractorApproval, ContractorReview } from "./ContractorReview";
import { ContractorProject, ContractorProjects, ContractorTask } from "./ContractorProjects";
import { ContractorProfile, ContractorSettings, ContractorTeams } from "./ContractorPeople";
import type { Approval, ContractorData, ContractorScreen, PulseTask } from "./types";

const VOICE_LINES = [
  "Sunita ka sink trap wala kaam aath number pe hai. Theek hai bolun?",
  "Aapke paas chaar kaam intezaar mein hain.",
  "Ramesh ki tiles mein do dher par label nahi hai.",
];

const MIC_STATUS = { connecting: "Connecting…", live: "Listening…", speaking: "Speaking…" } as const;

const SCREENS = [
  { key: "signin", label: "Sign in" },
  { key: "review", label: "Review — the queue" },
  { key: "approval", label: "Approval — details" },
  { key: "approval:scoring", label: "Approval — score & decide" },
  { key: "projects", label: "Projects" },
  { key: "project", label: "Project board + New task" },
  { key: "task", label: "Task — notes, files, activity" },
  { key: "teams", label: "Teams" },
  { key: "profile", label: "Profile" },
  { key: "settings", label: "Settings" },
];

/**
 * The Contractor app (OmniPulse — the supervisor's voice-first app) on demo
 * data, built from the shared `acharya-mobile` kit. The dock is on every screen
 * except an open approval, where the decision bar takes the bottom edge.
 */
export function ContractorApp({ data }: { data: ContractorData }) {
  const nav = useScreenStack<ContractorScreen>({ screen: "review" });
  const [approvals, setApprovals] = useState<Approval[]>(data.approvals);
  const [tasks, setTasks] = useState<PulseTask[]>(data.tasks);
  const [notice, setNotice] = useState<{ text: string; tone: "green" | "ochre" } | undefined>();
  const mic = useDemoMic(VOICE_LINES);
  const { current } = nav;

  const decide = (a: Approval, verdict: "approve" | "redo", score: number) => {
    setApprovals((as) => as.filter((x) => x.id !== a.id));
    setNotice(
      verdict === "approve"
        ? { text: `Approved “${a.task}” at ${score}/10. ${a.kaarigar.split(" ")[0]} will hear it.`, tone: "green" }
        : { text: `Sent “${a.task}” back to ${a.kaarigar.split(" ")[0]}.`, tone: "ochre" },
    );
    nav.go({ screen: "review" });
  };

  const jump = (key: string) => {
    const [screen, tab] = key.split(":") as [ContractorScreen, string | undefined];
    if (screen === "approval") {
      nav.go({ screen: "review" });
      if (approvals[0]) nav.push({ screen: "approval", id: approvals[0].id, tab: tab ?? "details" });
    } else if (screen === "project" || screen === "task") {
      nav.go({ screen: "projects" });
      nav.push({ screen: "project", id: data.projects[0].id });
      if (screen === "task") nav.push({ screen: "task", id: tasks[0].id, tab: "notes" });
    } else if (screen === "settings") {
      nav.go({ screen: "profile" });
      nav.push({ screen: "settings" });
    } else {
      nav.go({ screen });
    }
  };

  const active = current.screen === "approval" && current.tab === "scoring" ? "approval:scoring" : current.screen;
  const inProjects = current.screen === "projects" || current.screen === "project" || current.screen === "task";
  const showDock = current.screen !== "signin" && current.screen !== "approval";

  const dock = showDock ? (
    <BottomDock
      tone="dark"
      ariaLabel="OmniPulse"
      items={[
        { key: "review", label: "Review", icon: "inbox", active: current.screen === "review", onSelect: () => nav.go({ screen: "review" }) },
        { key: "projects", label: "Projects", icon: "projects", active: inProjects, onSelect: () => nav.go({ screen: "projects" }) },
        { key: "teams", label: "Teams", icon: "teams", active: current.screen === "teams", onSelect: () => nav.go({ screen: "teams" }) },
        { key: "profile", label: "Profile", avatarName: data.user.name, active: current.screen === "profile" || current.screen === "settings", onSelect: () => nav.go({ screen: "profile" }) },
      ]}
      mic={<MicButton status={mic.status} onToggle={mic.toggle} level={mic.level} size={60} label={mic.status === "idle" ? "Start conversation" : "End conversation"} />}
      status={mic.status in MIC_STATUS ? MIC_STATUS[mic.status as keyof typeof MIC_STATUS] : undefined}
      caption={mic.caption}
    />
  ) : undefined;

  let body;
  if (current.screen === "signin") {
    body = (
      <SignInScreen
        appName="OmniPulse"
        tagline="Approve work and give tasks — by voice, from site."
        hero={
          <div>
            <span style={{ display: "inline-grid", placeItems: "center", width: 64, height: 64, borderRadius: "50%", background: "var(--green-deep)", color: "var(--cream)" }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 12h4l3-7 4 14 3-7h4" /></svg>
            </span>
            <p className="mb-wordmark">OmniPulse</p>
            <p className="mb-wordmark-sub">For supervisors</p>
          </div>
        }
        onSignedIn={() => nav.go({ screen: "review" })}
      />
    );
  } else if (current.screen === "review") {
    body = <ContractorReview approvals={approvals} onOpen={(id) => nav.push({ screen: "approval", id, tab: "details" })} notice={notice} onDismissNotice={() => setNotice(undefined)} />;
  } else if (current.screen === "approval") {
    const a = approvals.find((x) => x.id === current.id);
    body = a ? (
      <ContractorApproval key={a.id} approval={a} tab={current.tab ?? "details"} onTab={(tab) => nav.replace({ ...current, tab })} onBack={nav.back} onDecide={decide} />
    ) : (
      <ContractorReview approvals={approvals} onOpen={(id) => nav.replace({ screen: "approval", id, tab: "details" })} notice={notice} onDismissNotice={() => setNotice(undefined)} />
    );
  } else if (current.screen === "projects") {
    body = <ContractorProjects projects={data.projects} tasks={tasks} onOpen={(id) => nav.push({ screen: "project", id })} />;
  } else if (current.screen === "project") {
    const project = data.projects.find((p) => p.id === current.id) ?? data.projects[0];
    body = (
      <ContractorProject
        project={project}
        lanes={data.lanes}
        tasks={tasks}
        team={data.teams.find((t) => t.name === project.team) ?? data.teams[0]}
        onBack={nav.back}
        onOpenTask={(id) => nav.push({ screen: "task", id, tab: "notes" })}
        onCreate={(t) => setTasks((ts) => [t, ...ts])}
      />
    );
  } else if (current.screen === "task") {
    const task = tasks.find((t) => t.id === current.id) ?? tasks[0];
    body = (
      <ContractorTask
        task={task}
        project={data.projects.find((p) => p.id === task.projectId)}
        lanes={data.lanes}
        tab={current.tab ?? "notes"}
        onTab={(tab) => nav.replace({ ...current, tab })}
        onBack={nav.back}
      />
    );
  } else if (current.screen === "teams") {
    body = <ContractorTeams teams={data.teams} />;
  } else if (current.screen === "profile") {
    body = <ContractorProfile data={{ ...data, approvals }} onSettings={() => nav.push({ screen: "settings" })} />;
  } else {
    body = <ContractorSettings onBack={nav.depth > 1 ? nav.back : () => nav.go({ screen: "profile" })} onSignOut={() => nav.go({ screen: "signin" })} />;
  }

  return (
    <PhoneFrame
      title="Contractor app"
      subtitle="OmniPulse — the supervisor's half of the work loop. Approve or send back what kaarigars submit, give out tasks, check teams. Try it: open an approval, score it, tap Theek hai; or add a task from a project."
      source="Reference: OmniPulse (Omnipulse Shubham), fix/voice-mahacharya-prompt @ 773cd1e. Built from src/components/acharya-mobile; the decision bar and photo viewer are Contractor-only and live in src/mobile/contractor."
      screens={SCREENS}
      activeScreen={active}
      onJump={jump}
      screenKey={`${current.screen}:${current.id ?? ""}:${current.tab ?? ""}`}
    >
      {current.screen === "signin" ? (
        <div data-am-look="contractor" style={{ minHeight: "100%" }}>{body}</div>
      ) : (
        <MobileScreen look="contractor" dock={dock}>{body}</MobileScreen>
      )}
    </PhoneFrame>
  );
}
