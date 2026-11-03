import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, EmptyState, Skeleton, SkeletonText } from "../components/common";
import {
  BottomDock,
  BottomSheet,
  Card,
  ChoiceGroup,
  DetailList,
  IconButton,
  ListRow,
  MicButton,
  MobileIcon,
  MobileScreen,
  OtpInput,
  PersonAvatar,
  PersonAvatarStack,
  PhoneInput,
  ProfileHero,
  RowList,
  ScreenHeader,
  SectionHeader,
  SegmentedTabs,
  StatRow,
  StatTile,
  Tag,
  TaskCard,
  colorTagStyle,
  createLevelBus,
  formatIndianPhone,
  type LevelSource,
  type MicStatus,
  type MobileLook,
  type TagTone,
} from "../components/acharya-mobile";
import { Case, Section } from "./Case";

const MIC_STATES: MicStatus[] = ["idle", "connecting", "live", "speaking", "error", "denied"];
const MIC_LABEL: Record<MicStatus, string> = {
  idle: "Talk now",
  connecting: "Connecting…",
  live: "Listening",
  speaking: "Stop",
  error: "Retry",
  denied: "Mic blocked",
};

/** A fake mic level while "live", so the waveform can be seen moving. */
function useDemoLevel(status: MicStatus): LevelSource {
  const bus = useMemo(() => createLevelBus(), []);
  useEffect(() => {
    if (status !== "live") {
      bus.publish(0);
      return;
    }
    let t = 0;
    const id = window.setInterval(() => {
      t += 1;
      bus.publish(Math.max(0, 0.12 + Math.sin(t / 2.3) * 0.08 + (Math.random() - 0.5) * 0.08));
    }, 90);
    return () => window.clearInterval(id);
  }, [bus, status]);
  return bus;
}

/** A phone-sized, scrolling preview with the dock pinned to its bottom edge. */
function Phone({ look, title, children, dock }: { look: MobileLook; title: string; children: ReactNode; dock: ReactNode }) {
  return (
    <figure style={{ margin: 0, display: "grid", gap: 8, justifyItems: "center" }}>
      <div
        data-am-look={look}
        style={{
          width: 375,
          maxWidth: "100%",
          height: 720,
          overflowY: "auto",
          border: "1px solid var(--rule-strong)",
          borderRadius: 32,
          background: "var(--page)",
          boxShadow: "var(--shadow-md)",
        }}
      >
        <MobileScreen look={look} style={{ minHeight: "100%" }}>
          {children}
        </MobileScreen>
        <div style={{ position: "sticky", bottom: 0 }}>{dock}</div>
      </div>
      <figcaption style={{ fontSize: 12, color: "var(--ink-mute)" }}>{title}</figcaption>
    </figure>
  );
}

function KaarigarPhone({ status, onMic, level }: { status: MicStatus; onMic: () => void; level: LevelSource }) {
  const [lane, setLane] = useState("doing");
  return (
    <Phone
      look="kaarigar"
      title="Kaarigar — PR #207 look"
      dock={
        <BottomDock
          tone="light"
          fixed={false}
          ariaLabel="Kaarigar navigation"
          items={[
            { key: "home", label: "Home", icon: "home" },
            { key: "work", label: "Work", icon: "work", active: true },
            { key: "stories", label: "Stories", icon: "stories" },
            { key: "profile", label: "Profile", icon: "profile" },
          ]}
          mic={<MicButton status={status} onToggle={onMic} label={MIC_LABEL[status]} size={58} level={level} />}
          micLabel={MIC_LABEL[status]}
        />
      }
    >
      <ScreenHeader
        title="Work"
        actions={
          <>
            <PersonAvatar name="MahAcharya" size={36} />
            <IconButton label="Refresh"><MobileIcon name="refresh" size={19} /></IconButton>
          </>
        }
      />
      <div className="am-stack">
        <StatRow label="Your work">
          <StatTile tone="green" icon={<MobileIcon name="work" />} value="4" label="Ready" onClick={() => setLane("todo")} />
          <StatTile tone="ochre" icon={<MobileIcon name="clock" />} value="2" label="In progress" onClick={() => setLane("doing")} />
          <StatTile tone="slate" icon={<MobileIcon name="review" />} value="3" label="In review" onClick={() => setLane("review")} />
        </StatRow>
        <SegmentedTabs
          ariaLabel="Lanes"
          active={lane}
          onChange={setLane}
          tabs={[
            { key: "todo", label: "To do", count: 4 },
            { key: "doing", label: "Doing", count: 2 },
            { key: "review", label: "Review", count: 3 },
            { key: "done", label: "Done", count: 12 },
          ]}
        />
        <TaskCard
          title="Fix the kitchen sink trap and re-seal the joints"
          description="Use the white silicone in the van, not the clear one."
          leading={<SymbolDisc icon="briefcase" tone="ochre" />}
          tags={<><Tag>Kitchen Fitout</Tag><Tag>3 sessions</Tag></>}
          due={{ label: "Today", tone: "warn" }}
          progress={{ done: 1, total: 3 }}
          tint="doing"
          onSelect={() => undefined}
        />
        <TaskCard
          title="Tile the bathroom floor — 2nd floor flat"
          leading={<SymbolDisc icon="work" tone="green" />}
          tags={<Tag tone="ok">8.5/10</Tag>}
          due={{ label: "18d late", tone: "overdue" }}
          tint="doing"
          onSelect={() => undefined}
        />
        <Card>
          <SectionHeader title="Text size" icon={<MobileIcon name="type" />} />
          <TextSizeChoice layout="pill" />
        </Card>
      </div>
    </Phone>
  );
}

function ContractorPhone({ status, onMic, level }: { status: MicStatus; onMic: () => void; level: LevelSource }) {
  const [tab, setTab] = useState("notes");
  return (
    <Phone
      look="contractor"
      title="Contractor — OmniPulse look"
      dock={
        <BottomDock
          tone="dark"
          fixed={false}
          ariaLabel="Contractor navigation"
          items={[
            { key: "review", label: "Review", icon: "inbox", active: true },
            { key: "projects", label: "Projects", icon: "projects" },
            { key: "teams", label: "Teams", icon: "teams" },
            { key: "profile", label: "Profile", avatarName: "Shubham Gupta" },
          ]}
          mic={<MicButton status={status} onToggle={onMic} label={MIC_LABEL[status]} size={60} level={level} />}
          status={status === "live" || status === "connecting" ? MIC_LABEL[status] : undefined}
          caption={status === "speaking" ? "Ramesh ka kaam approve kar diya." : undefined}
        />
      }
    >
      <ScreenHeader title="Review" sticky />
      <div className="am-stack" style={{ paddingTop: 14 }}>
        <StatRow label="Waiting">
          <StatTile layout="row" tone="ochre" icon={<MobileIcon name="inbox" />} value="7" label="Waiting" />
          <StatTile layout="row" tone="green" icon={<MobileIcon name="clock" />} value="3d" label="Oldest" />
          <StatTile layout="row" tone="slate" icon={<MobileIcon name="teams" />} value="5" label="People" />
        </StatRow>
        <Card flush>
          <SectionHeader variant="rule" title="My projects" icon={<MobileIcon name="projects" />} right="3" />
          <RowList>
            <ListRow accent="#376a46" title="Kitchen Fitout — Baner" subtitle={<><Tag size="xs">T: Pune crew</Tag><Tag size="xs" tone="ochre">4 left</Tag></>} onSelect={() => undefined} />
            <ListRow accent="#a5711a" title="Office repaint — Kothrud" subtitle={<><Tag size="xs">T: Everyone</Tag><Tag size="xs" tone="green">All done</Tag></>} onSelect={() => undefined} />
          </RowList>
        </Card>
        <TaskCard
          code="#214"
          title="Replace the broken window latch"
          tags={<Tag size="xs" style={colorTagStyle("#a5711a")}>Doing</Tag>}
          due={{ label: "Tomorrow" }}
          comments={3}
          attachments={2}
          assignee="Ramesh Kumar"
          onSelect={() => undefined}
        />
        <SegmentedTabs
          variant="plate"
          ariaLabel="Task sections"
          active={tab}
          onChange={setTab}
          tabs={[
            { key: "notes", label: "Notes", icon: "comment", count: 3 },
            { key: "files", label: "Files", icon: "paperclip", count: 2 },
            { key: "activity", label: "Activity", icon: "clock" },
          ]}
        />
        <Card flush>
          <SectionHeader variant="rule" title="Language" icon={<MobileIcon name="language" />} />
          <div style={{ padding: 12 }}>
            <LanguageChoice />
          </div>
        </Card>
      </div>
    </Phone>
  );
}

function SymbolDisc({ icon, tone }: { icon: "briefcase" | "work"; tone: "ochre" | "green" }) {
  return (
    <span style={{ display: "grid", placeItems: "center", width: 48, height: 48, borderRadius: "50%", background: `var(--${tone}-wash)`, color: `var(--${tone === "green" ? "green-deep" : "ochre"})` }}>
      <MobileIcon name={icon} size={24} />
    </span>
  );
}

function TextSizeChoice({ layout }: { layout: "grid" | "pill" }) {
  const [v, setV] = useState("normal");
  return (
    <ChoiceGroup
      ariaLabel="Text size"
      layout={layout}
      value={v}
      onChange={setV}
      options={[
        { value: "normal", label: "Normal", preview: layout === "grid" ? "Aa" : undefined, previewStyle: { fontSize: 15 } },
        { value: "large", label: "Large", preview: layout === "grid" ? "Aa" : undefined, previewStyle: { fontSize: 18 } },
        { value: "larger", label: "Larger", preview: layout === "grid" ? "Aa" : undefined, previewStyle: { fontSize: 22 } },
      ]}
    />
  );
}

function LanguageChoice() {
  const [v, setV] = useState("hi");
  return (
    <ChoiceGroup
      ariaLabel="Language"
      value={v}
      onChange={setV}
      options={[
        { value: "hi", label: "हिन्दी", code: "hi" },
        { value: "en", label: "English", code: "en" },
        { value: "bn", label: "বাংলা", code: "bn" },
      ]}
    />
  );
}

const TAG_TONES: TagTone[] = ["neutral", "outline", "green", "ok", "ochre", "crit", "terracotta", "slate", "plum"];

/**
 * The Acharya mobile kit: what the Kaarigar and Contractor phone apps share.
 * The two phones are built from the same components; only `look` and the
 * dock's `tone` differ between them.
 */
export function AcharyaMobileSection() {
  const [status, setStatus] = useState<MicStatus>("idle");
  const level = useDemoLevel(status);
  const cycle = () => setStatus((s) => (s === "idle" ? "connecting" : s === "connecting" ? "live" : s === "live" ? "speaking" : "idle"));
  const [otp, setOtp] = useState("");
  const [phone, setPhone] = useState("9830067217");
  const [sheet, setSheet] = useState(false);

  return (
    <Section id="acharya-mobile" title="Acharya mobile — Kaarigar + Contractor">
      <Case label="Mic state (drives both phones and the docks below — or tap a mic)">
        <div style={{ width: "100%", maxWidth: 640 }}>
          <ChoiceGroup ariaLabel="Mic state" layout="pill" value={status} onChange={setStatus} options={MIC_STATES.map((s) => ({ value: s, label: s }))} />
        </div>
      </Case>

      <Case label="Two apps, one kit — same components, `look` + dock `tone` differ">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 28, alignItems: "flex-start" }}>
          <KaarigarPhone status={status} onMic={cycle} level={level} />
          <ContractorPhone status={status} onMic={cycle} level={level} />
        </div>
      </Case>

      <Case label="MicButton — every state, dock and inline sizes">
        {MIC_STATES.map((s) => (
          <MicButton key={s} status={s} onToggle={() => setStatus(s)} label={MIC_LABEL[s]} size={58} level={level} />
        ))}
        <MicButton status={status} onToggle={cycle} label={MIC_LABEL[status]} size={40} level={level} />
        <MicButton status={status} onToggle={cycle} label={MIC_LABEL[status]} size={44} text={MIC_LABEL[status]} level={level} />
      </Case>

      <Case label="Tag — tones × sizes (round on Kaarigar, square on Contractor)" stack>
        {(["kaarigar", "contractor"] as const).map((look) => (
          <div key={look} data-am-look={look} style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            {TAG_TONES.map((t) => <Tag key={t} tone={t}>{t}</Tag>)}
            <Tag size="xs" tone="crit">urgent</Tag>
            <Tag size="md" tone="green">approved</Tag>
            <Tag style={colorTagStyle("#3f5a72")}>list colour</Tag>
          </div>
        ))}
      </Case>

      <Case label="PersonAvatar — sizes, photo fallback, stack">
        <PersonAvatar name="Ramesh Kumar" size="sm" />
        <PersonAvatar name="Sunita Devi" size="md" />
        <PersonAvatar name="Harshit Verma" size="lg" />
        <PersonAvatar name="Shubham Gupta" size="xl" />
        <PersonAvatar name="Broken Photo" size="lg" imageUrl="data:image/png;base64,broken" />
        <PersonAvatarStack names={["Ramesh Kumar", "Sunita Devi", "Harshit Verma", "Imran Khan", "Asha Patil", "Vikram Rao", "Neha Joshi"]} />
      </Case>

      <Case label="ProfileHero + DetailList — forest (Kaarigar) and ochre (Contractor)" stack>
        <ProfileHero name="Sunita Devi" meta={formatIndianPhone("9830067217")} tag={<Tag>Kaarigar</Tag>} />
        <div data-am-look="contractor" className="am-stack">
          <ProfileHero tone="ochre" name="Shubham Gupta" meta="+91 98765 43210" tag={<Tag tone="outline">Supervisor</Tag>} />
          <Card flush>
            <SectionHeader variant="rule" title="Account" icon={<MobileIcon name="id-card" />} />
            <div style={{ padding: 12 }}>
              <DetailList rows={[{ label: "Your name", value: "Shubham Gupta" }, { label: "Phone", value: "+91 98765 43210" }, { label: "Role", value: "Supervisor" }, { label: "Email", value: "" }]} emptyValue="Not added" />
            </div>
          </Card>
        </div>
        <Card tone="green">
          <SectionHeader title="Contact" icon={<MobileIcon name="id-card" />} level={3} />
          <DetailList columns={1} rows={[{ label: "Phone", value: "+91 98300 67217" }, { label: "City", value: "" }]} emptyValue="Not added" />
        </Card>
      </Case>

      <Case label="ChoiceGroup — grid (text size), list (language), pill" stack>
        <TextSizeChoice layout="grid" />
        <LanguageChoice />
        <TextSizeChoice layout="pill" />
      </Case>

      <Case label="ListRow — in a list, and standing alone" stack>
        <RowList framed>
          <ListRow leading={<PersonAvatar name="Pune crew" />} title="Pune crew" subtitle="8 members" trailing={<Tag size="xs" tone="green">Lead</Tag>} onSelect={() => undefined} />
          <ListRow leading={<PersonAvatar name="Baner site" />} title="Baner site" subtitle="3 members" onSelect={() => undefined} />
        </RowList>
        <ListRow card leading={<MobileIcon name="settings" />} title="Settings" onSelect={() => undefined} />
      </Case>

      <Case label="Sign-in fields — phone, OTP (one real input: autofill + paste)" stack>
        <PhoneInput label="Phone number" value={phone} onChange={setPhone} />
        <OtpInput label="Enter the 6-digit code" value={otp} onChange={setOtp} />
      </Case>

      <Case label="BottomSheet">
        <Button onClick={() => setSheet(true)}>Open sheet</Button>
        <BottomSheet
          open={sheet}
          onClose={() => setSheet(false)}
          title="Photo"
          footer={<Button block variant="secondary" onClick={() => setSheet(false)}>Cancel</Button>}
        >
          <RowList>
            <ListRow leading={<MobileIcon name="stories" />} title="Take a photo" chevron={false} onSelect={() => setSheet(false)} />
            <ListRow leading={<MobileIcon name="board" />} title="Choose from gallery" chevron={false} onSelect={() => setSheet(false)} />
          </RowList>
        </BottomSheet>
      </Case>

      <Case label="Reused from the desktop kit — not rebuilt: EmptyState, Skeleton, Button" stack>
        <EmptyState size="inline" title="No invites yet" description="When an organisation invites you, it shows up here." icon={<MobileIcon name="inbox" size={22} />} />
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Skeleton shape="circle" width={48} />
          <div style={{ flex: 1 }}><SkeletonText lines={2} /></div>
        </div>
        <Button block size="lg" variant="danger" iconLeft={<MobileIcon name="logout" size={18} />}>Sign out</Button>
      </Case>

      <Case label="Icon registry">
        <IconGrid />
      </Case>
    </Section>
  );
}

function IconGrid() {
  const names = ["home", "work", "progress", "stories", "profile", "clock", "review", "arrow", "mic", "chat", "learn", "quiz", "type", "language", "chevron-left", "chevron-right", "chevron-down", "check", "check-circle", "close", "settings", "logout", "refresh", "alert", "info", "mic-off", "retry", "paperclip", "comment", "id-card", "star", "briefcase", "board", "sort", "inbox", "projects", "teams"] as const;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))", gap: 8, width: "100%" }}>
      {names.map((n) => (
        <div key={n} style={{ display: "grid", justifyItems: "center", gap: 6, padding: 8, border: "1px solid var(--rule)", borderRadius: 8, background: "var(--surface)", color: "var(--ink-soft)" }}>
          <span style={{ display: "flex", gap: 6 }}>
            <MobileIcon name={n} size={22} />
            {(n === "inbox" || n === "projects" || n === "teams") && <MobileIcon name={n} size={22} filled />}
          </span>
          <span style={{ fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-mute)" }}>{n}</span>
        </div>
      ))}
    </div>
  );
}
