import { useState } from "react";
import { BottomDock, MicButton, MobileScreen, PersonAvatar } from "../../components/acharya-mobile";
import { PhoneFrame, SignInScreen, useDemoMic, useScreenStack } from "../shared";
import { KaarigarHome, KaarigarStories } from "./KaarigarHome";
import { KaarigarTaskScreen, KaarigarWork } from "./KaarigarWork";
import { KaarigarProfile, KaarigarSettings } from "./KaarigarProfile";
import type { KaarigarData, KaarigarScreen, KaarigarTask, Lane } from "./types";

const VOICE_LINES = [
  "Sink trap ka kaam aaj ka hai. Shuru karein?",
  "Aapke do kaam review mein hain.",
  "Silicone lagane se pehle joint ko sukha kar lijiye.",
];

const MIC_LABEL = { idle: "Talk now", connecting: "Connecting…", live: "End", speaking: "End", error: "Retry", denied: "Retry" } as const;

const SCREENS = [
  { key: "signin", label: "Sign in" },
  { key: "home", label: "Home" },
  { key: "work", label: "My work — lanes" },
  { key: "task", label: "Task — sessions & steps" },
  { key: "stories", label: "Stories" },
  { key: "profile", label: "Profile — About" },
  { key: "profile:report", label: "Profile — Report" },
  { key: "profile:history", label: "Profile — History" },
  { key: "profile:requests", label: "Profile — Requests" },
  { key: "settings", label: "Settings" },
];

/**
 * The Kaarigar app (omnidel-acharya, PR #207 redesign) on demo data, built
 * from the shared `acharya-mobile` kit. The dock shows on the four top-level
 * screens and Settings, and hides on the full-attention task screen, as in
 * PR #207's `WorkAppFrame`.
 */
export function KaarigarApp({ data }: { data: KaarigarData }) {
  const nav = useScreenStack<KaarigarScreen>({ screen: "home" });
  const [tasks, setTasks] = useState<KaarigarTask[]>(data.tasks);
  const [lane, setLane] = useState<Lane>("doing");
  const mic = useDemoMic(VOICE_LINES);
  const { current } = nav;
  const guide = data.acharyas.find((a) => a.featured) ?? data.acharyas[0];

  const openTask = (id: string) => nav.push({ screen: "task", id, tab: "task" });
  const openLane = (l: Lane) => {
    setLane(l);
    nav.go({ screen: "work" });
  };
  const move = (id: string, to: Lane, sessionsDone?: number) =>
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, lane: to, sessions: { ...t.sessions, done: sessionsDone ?? t.sessions.done } } : t)));

  const jump = (key: string) => {
    const [screen, tab] = key.split(":") as [KaarigarScreen, string | undefined];
    if (screen === "task") {
      const t = tasks.find((x) => x.lane === "doing") ?? tasks[0];
      nav.go({ screen: "work" });
      nav.push({ screen: "task", id: t.id, tab: "task" });
    } else if (screen === "settings") {
      nav.go({ screen: "profile", tab: "profile" });
      nav.push({ screen: "settings" });
    } else {
      nav.go({ screen, tab: tab ?? (screen === "profile" ? "profile" : undefined) });
    }
  };

  const active = current.screen === "profile" && current.tab && current.tab !== "profile" ? `profile:${current.tab}` : current.screen;
  const topLevel = current.screen === "home" || current.screen === "work" || current.screen === "stories" || current.screen === "profile" || current.screen === "settings";

  const dock = topLevel ? (
    <BottomDock
      tone="light"
      ariaLabel="Main navigation"
      items={[
        { key: "home", label: "Home", icon: "home", active: current.screen === "home", onSelect: () => nav.go({ screen: "home" }) },
        { key: "work", label: "My work", icon: "work", active: current.screen === "work", onSelect: () => nav.go({ screen: "work" }) },
        { key: "stories", label: "Stories", icon: "stories", active: current.screen === "stories", onSelect: () => nav.go({ screen: "stories" }) },
        { key: "profile", label: "Profile", icon: "profile", active: current.screen === "profile" || current.screen === "settings", onSelect: () => nav.go({ screen: "profile", tab: "profile" }) },
      ]}
      mic={<MicButton status={mic.status} onToggle={mic.toggle} level={mic.level} size={58} label={mic.status === "idle" ? `Talk to ${guide.name}` : "End conversation"} />}
      micLabel={MIC_LABEL[mic.status]}
      caption={mic.caption}
    />
  ) : undefined;

  let body;
  if (current.screen === "signin") {
    body = (
      <SignInScreen
        appName="Acharya"
        band="forest"
        tagline="Your tasks, your Acharya, your progress — in one place."
        hero={
          <div style={{ display: "grid", justifyItems: "center", gap: 12 }}>
            <PersonAvatar name={guide.name} size={96} ring />
            <p style={{ margin: 0, font: "650 22px/1.2 var(--sans)" }}>{guide.name}</p>
            <p style={{ margin: 0, fontSize: 13.5, opacity: 0.85 }}>A little better, every day.</p>
          </div>
        }
        onSignedIn={() => nav.go({ screen: "home" })}
      />
    );
  } else if (current.screen === "home") {
    body = <KaarigarHome data={data} tasks={tasks} mic={mic} onOpenTask={openTask} onOpenLane={openLane} onOpenProfile={(tab) => nav.go({ screen: "profile", tab: tab ?? "profile" })} />;
  } else if (current.screen === "work") {
    body = <KaarigarWork tasks={tasks} lane={lane} onLane={setLane} onOpenTask={openTask} guide={guide} />;
  } else if (current.screen === "task") {
    const task = tasks.find((t) => t.id === current.id) ?? tasks[0];
    body = (
      <KaarigarTaskScreen
        task={task}
        acharya={data.acharyas.find((a) => a.slug === task.acharya) ?? guide}
        section={current.tab ?? "task"}
        onSection={(tab) => nav.replace({ ...current, tab })}
        onBack={nav.back}
        onMove={move}
        mic={mic}
      />
    );
  } else if (current.screen === "stories") {
    body = <KaarigarStories data={data} />;
  } else if (current.screen === "profile") {
    body = <KaarigarProfile data={data} tab={current.tab ?? "profile"} onTab={(tab) => nav.replace({ screen: "profile", tab })} onSettings={() => nav.push({ screen: "settings" })} />;
  } else {
    body = <KaarigarSettings onBack={nav.depth > 1 ? nav.back : () => nav.go({ screen: "profile", tab: "profile" })} onSignOut={() => nav.go({ screen: "signin" })} />;
  }

  return (
    <PhoneFrame
      title="Kaarigar app"
      subtitle="The Acharya app a kaarigar uses to start, run and submit tasks — the PR #207 redesign. Tap through it: Start work, finish a session, submit for review; accept an invite under Profile → Requests."
      source="Reference: omnidel-acharya, PR #207 (3b9a1a3). Built from src/components/acharya-mobile; trade symbols and the journey dial are Kaarigar-only and live in src/mobile/kaarigar."
      screens={SCREENS}
      activeScreen={active}
      onJump={jump}
      screenKey={`${current.screen}:${current.id ?? ""}:${current.tab ?? ""}`}
    >
      {current.screen === "signin" ? (
        <div data-am-look="kaarigar" style={{ minHeight: "100%" }}>{body}</div>
      ) : (
        <MobileScreen look="kaarigar" dock={dock}>{body}</MobileScreen>
      )}
    </PhoneFrame>
  );
}
