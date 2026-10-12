import { useState, type ReactNode } from "react";
import catalog from "virtual:component-catalog";
import CustomSelect from "@/components/acharya/ui/CustomSelect";
import SearchableSelect from "@/components/acharya/ui/SearchableSelect";
import OtpBoxes from "@/components/acharya/auth/OtpBoxes";
import { TimerRing } from "@/components/acharya/tasks/timer-ring";
import { TaskCardLink } from "@/components/acharya/tasks/task-card";
import { AttemptInfoBadge } from "@/components/acharya/tasks/attempt-info-badge";
import WorkSymbol from "@/components/acharya/tasks/WorkSymbol";
import WorkProgressOverview, { ProgressDial } from "@/components/acharya/tasks/WorkProgressOverview";
import AcharyaPortrait from "@/components/acharya/persona/AcharyaPortrait";
import QuickPrompts from "@/components/acharya/chat/QuickPrompts";
import { VoiceWaveform } from "@/components/acharya/voice/VoiceWaveform";
import {
  ActiveSkeleton,
  BoardSkeleton,
  LearnSkeleton,
  TaskSkeleton,
} from "@/components/acharya/shell/nav-skeletons";
import { useStrings } from "@/acharya/lib/i18n/useLang";
import type { TaskCategoryId } from "@/acharya/lib/task-category";
import { ACHARYAS, TASKS } from "../demo/data";

/**
 * The Acharya component set, rendered live in the app's own styles.
 *
 * The OmniDel Components page lists every file in `components/acharya/`; it
 * cannot render them, because they need this app's Tailwind build and
 * tokens. This page renders the self-contained ones with demo props, and
 * lists the rest — the screens, providers and voice layer that only make
 * sense inside a running session — with where to see them in the app.
 */

const CATEGORIES: TaskCategoryId[] = ["general", "voice", "planting", "electrical", "plumbing", "labour", "testing", "ui", "dev"];
const LANG_OPTIONS = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिन्दी" },
  { value: "bn", label: "বাংলা" },
  { value: "te", label: "తెలుగు" },
  { value: "am", label: "አማርኛ" },
];
const CITY_OPTIONS = ["Jaipur", "Udaipur", "Kolkata", "Varanasi", "Sanganer", "Jodhpur"].map((c) => ({ value: c.toLowerCase(), label: c }));

function Block({ title, file, children }: { title: string; file: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
        <h2 style={{ fontFamily: "var(--sans)", fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{title}</h2>
        <code style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--ink-mute)" }}>{file}</code>
      </div>
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--rule)",
          borderRadius: 16,
          padding: 16,
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          alignItems: "center",
        }}
      >
        {children}
      </div>
    </section>
  );
}

export default function ComponentGallery() {
  const s = useStrings();
  const [lang, setLang] = useState("en");
  const [city, setCity] = useState("");
  const [otp, setOtp] = useState("12");
  const [picked, setPicked] = useState<string | null>(null);

  const live = new Set([
    "ui/CustomSelect.tsx", "ui/SearchableSelect.tsx", "auth/OtpBoxes.tsx", "tasks/timer-ring.tsx", "tasks/task-card.tsx",
    "tasks/attempt-info-badge.tsx", "tasks/WorkSymbol.tsx", "tasks/WorkProgressOverview.tsx", "persona/AcharyaPortrait.tsx",
    "chat/QuickPrompts.tsx", "voice/VoiceWaveform.tsx", "shell/nav-skeletons.tsx",
  ]);
  const rest = catalog.filter((e) => e.set === "acharya" && !live.has(e.path.slice("acharya/".length)));

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "20px 16px 120px", fontFamily: "var(--sans)" }}>
      <header style={{ marginBottom: 24 }}>
        <p style={{ fontFamily: "var(--mono)", fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-mute)" }}>
          components/acharya
        </p>
        <h1 style={{ fontFamily: "var(--serif)", fontSize: 32, fontStyle: "italic", fontWeight: 400, margin: "4px 0 8px" }}>Acharya components</h1>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--ink-soft)", maxWidth: "62ch" }}>
          The self-contained components, live, with demo props. Everything else is listed below with where it shows up
          in the app.
        </p>
      </header>

      <Block title="Selects" file="ui/CustomSelect · ui/SearchableSelect">
        <div style={{ width: 240 }}>
          <CustomSelect value={lang} onChange={setLang} options={LANG_OPTIONS} placeholder="Language" />
        </div>
        <div style={{ width: 240 }}>
          <SearchableSelect value={city} onChange={setCity} options={CITY_OPTIONS} placeholder="Search a city" />
        </div>
      </Block>

      <Block title="One-time code" file="auth/OtpBoxes">
        <div style={{ width: 300 }}>
          <OtpBoxes value={otp} onChange={setOtp} label="Six-digit code" />
        </div>
      </Block>

      <Block title="Session timer" file="tasks/timer-ring">
        <TimerRing totalSeconds={2700} remainingSeconds={1920} phase="active" />
        <TimerRing totalSeconds={2700} remainingSeconds={240} phase="warning" />
        <TimerRing totalSeconds={2700} remainingSeconds={0} phase="expired" size="compact" />
        <TimerRing mode="elapsed" elapsedSeconds={754} phase="active" size="compact" />
      </Block>

      <Block title="Task cards" file="tasks/task-card">
        <div style={{ display: "grid", gap: 10, width: "100%" }}>
          {[TASKS[1], TASKS[3], TASKS[8]].map((t) => (
            <TaskCardLink key={t.id} task={t} showWorkspaceChip acharyaSlug={t.acharyaSlug} />
          ))}
        </div>
      </Block>

      <Block title="Retry notice" file="tasks/attempt-info-badge">
        <AttemptInfoBadge attemptNumber={2} />
        <AttemptInfoBadge attemptNumber={3} />
      </Block>

      <Block title="Work symbols" file="tasks/WorkSymbol">
        {CATEGORIES.map((c) => (
          <div key={c} style={{ display: "grid", justifyItems: "center", gap: 6, fontSize: 11, color: "var(--ink-mute)" }}>
            <WorkSymbol category={c} />
            {c}
          </div>
        ))}
      </Block>

      <Block title="Progress" file="tasks/WorkProgressOverview">
        <ProgressDial percent={62} label="Done" />
        <div style={{ flex: "1 1 320px" }}>
          <WorkProgressOverview tasks={TASKS} />
        </div>
      </Block>

      <Block title="Guide portraits" file="persona/AcharyaPortrait">
        {ACHARYAS.slice(0, 4).map((a) => (
          <div key={a.slug} style={{ display: "grid", justifyItems: "center", gap: 6, fontSize: 11, color: "var(--ink-mute)" }}>
            <AcharyaPortrait slug={a.slug} name={a.displayName} portraits={a.portraits} size={88} live={false} radius={22} />
            {a.displayName}
          </div>
        ))}
      </Block>

      <Block title="Chat quick prompts" file="chat/QuickPrompts">
        <div style={{ width: "100%" }}>
          <QuickPrompts labels={s} onPick={setPicked} />
          {picked && <p style={{ marginTop: 8, fontSize: 12, color: "var(--ink-mute)" }}>Picked: “{picked}”</p>}
        </div>
      </Block>

      <Block title="Voice level" file="voice/VoiceWaveform">
        <span style={{ color: "var(--green-deep)" }}>
          <VoiceWaveform bars={5} height={24} />
        </span>
        <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>Moves with the live voice level; still when nobody is speaking.</span>
      </Block>

      <Block title="Loading skeletons" file="shell/nav-skeletons">
        {[["Board", <BoardSkeleton key="b" />], ["Task", <TaskSkeleton key="t" />], ["Learn", <LearnSkeleton key="l" />], ["Active", <ActiveSkeleton key="a" />]].map(
          ([label, el]) => (
            <div key={label as string} style={{ width: 260, height: 220, overflow: "hidden", border: "1px solid var(--rule)", borderRadius: 12, position: "relative" }}>
              <div style={{ transform: "scale(0.5)", transformOrigin: "top left", width: "200%" }}>{el}</div>
              <span style={{ position: "absolute", bottom: 6, right: 8, fontSize: 10.5, fontFamily: "var(--mono)", color: "var(--ink-mute)" }}>{label}</span>
            </div>
          ),
        )}
      </Block>

      <section>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>In the app ({rest.length})</h2>
        <p style={{ fontSize: 12.5, color: "var(--ink-mute)", marginBottom: 12 }}>
          Screens, shells, providers and the voice layer need a running session around them. Open them in the app:
          Home, a guide&rsquo;s board, a task (Task · Chat · Quiz · Learn · Comments), Start work session, Profile and Settings.
        </p>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
          {rest.map((e) => (
            <li key={e.path} style={{ display: "flex", gap: 12, alignItems: "baseline", fontSize: 12.5, borderBottom: "1px solid var(--rule)", padding: "6px 0" }}>
              <code style={{ fontFamily: "var(--mono)", fontSize: 11.5, flex: "0 0 auto", minWidth: 0, maxWidth: "45%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {e.path.slice("acharya/".length)}
              </code>
              <span style={{ color: "var(--ink-mute)", minWidth: 0 }}>{e.summary}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
