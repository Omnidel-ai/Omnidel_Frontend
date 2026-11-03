import { useState } from "react";
import { Button, EmptyState } from "../../components/common";
import {
  Card,
  ChoiceGroup,
  DetailList,
  IconButton,
  ListRow,
  MobileIcon,
  PersonAvatar,
  ProfileHero,
  RowList,
  ScreenHeader,
  SectionHeader,
  SegmentedTabs,
  StatRow,
  StatTile,
  Tag,
  formatIndianPhone,
  type CardTone,
  type MobileIconName,
} from "../../components/acharya-mobile";
import type { KaarigarData } from "./types";

const TABS = [
  { key: "profile", label: "About" },
  { key: "report", label: "Report" },
  { key: "history", label: "History" },
  { key: "requests", label: "Requests" },
];

const GROUPS: { key: keyof KaarigarData["details"]; title: string; tone: CardTone; icon: MobileIconName }[] = [
  { key: "contact", title: "Contact", tone: "green", icon: "id-card" },
  { key: "work", title: "Work", tone: "ochre", icon: "briefcase" },
  { key: "location", title: "Location", tone: "terracotta", icon: "home" },
  { key: "about", title: "About", tone: "slate", icon: "info" },
];

/** Only a real verdict gets a colour — `HistoryTags`' rule. */
function verdictTone(v: string) {
  const s = v.toLowerCase();
  if (/approve|pass|accept/.test(s)) return "green" as const;
  if (/reject|fail|redo|needs/.test(s)) return "crit" as const;
  return "neutral" as const;
}

export interface KaarigarProfileProps {
  data: KaarigarData;
  tab: string;
  onTab: (tab: string) => void;
  onSettings: () => void;
}

/** Profile (PR #207 `ProfileClient`): dark identity card, then a 4-slot rail — About, Report, History, Requests. */
export function KaarigarProfile({ data, tab, onTab, onSettings }: KaarigarProfileProps) {
  const [requests, setRequests] = useState(data.requests);

  return (
    <>
      <ScreenHeader title="Profile" actions={<IconButton label="Settings" onClick={onSettings}><MobileIcon name="settings" /></IconButton>} />
      <div className="am-stack">
        <ProfileHero name={data.user.name} meta={formatIndianPhone(data.user.phone)} tag={<Tag>{data.user.trade}</Tag>} />
        <SegmentedTabs ariaLabel="Profile sections" active={tab} onChange={onTab} tabs={TABS} idPrefix="kg-profile" />

        <div role="tabpanel" id={`kg-profile-${tab}`} aria-labelledby={`kg-profile-tab-${tab}`} className="am-stack">
          {tab === "profile" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
              {GROUPS.map((g) => (
                <Card key={g.key} tone={g.tone} style={{ padding: 13, boxShadow: "none" }}>
                  <SectionHeader title={g.title} icon={<MobileIcon name={g.icon} />} level={3} />
                  <DetailList columns={1} rows={data.details[g.key]} emptyValue="Not added" />
                </Card>
              ))}
            </div>
          )}

          {tab === "report" && (
            <>
              <StatRow label="Your numbers">
                <StatTile tone="green" icon={<MobileIcon name="check-circle" />} value={String(data.report.tasksDone)} label="Tasks done" />
                <StatTile tone="ochre" icon={<MobileIcon name="star" />} value={data.report.avgScore} label="Avg score" />
                <StatTile tone="slate" icon={<MobileIcon name="briefcase" />} value={String(data.report.jobsDone)} label="Jobs done" />
              </StatRow>
              <Card>
                <SectionHeader title="Member since" icon={<MobileIcon name="clock" />} />
                <DetailList rows={[{ label: "Joined", value: data.user.joined }, { label: "With", value: data.user.org }]} />
              </Card>
            </>
          )}

          {tab === "history" && (
            <RowList framed label="Work history">
              {data.history.map((h) => (
                <ListRow
                  key={h.title}
                  leading={<PersonAvatar name={h.org} />}
                  title={h.title}
                  subtitle={
                    <>
                      <Tag tone="outline">{h.date}</Tag>
                      <Tag tone="ochre">{h.score}</Tag>
                      <Tag tone={verdictTone(h.verdict)}>{h.verdict}</Tag>
                    </>
                  }
                />
              ))}
            </RowList>
          )}

          {tab === "requests" &&
            (requests.length === 0 ? (
              <EmptyState size="inline" title="No invites yet" description="When an organisation invites you, it shows up here." icon={<MobileIcon name="inbox" size={22} />} />
            ) : (
              requests.map((r) => (
                <Card key={r.org}>
                  <ListRow
                    leading={<PersonAvatar name={r.org} size="lg" />}
                    title={r.org}
                    subtitle={<><MobileIcon name="home" size={13} /> {r.city} · {r.about}</>}
                    trailing={r.kind === "member" ? <Tag tone="green">Active</Tag> : undefined}
                  />
                  {r.kind === "invite" && (
                    <div className="mb-actions" style={{ marginTop: 6 }}>
                      <Button variant="secondary" iconLeft={<MobileIcon name="close" size={16} />} onClick={() => setRequests((rs) => rs.filter((x) => x !== r))}>Decline</Button>
                      <Button iconLeft={<MobileIcon name="check" size={16} />} onClick={() => setRequests((rs) => rs.map((x) => (x === r ? { ...x, kind: "member" as const } : x)))}>Accept</Button>
                    </div>
                  )}
                </Card>
              ))
            ))}
        </div>
      </div>
    </>
  );
}

/** Settings (PR #207 `ProfileTab` settings sections): text size, task language, account. */
export function KaarigarSettings({ onBack, onSignOut }: { onBack: () => void; onSignOut: () => void }) {
  const [size, setSize] = useState("normal");
  const [lang, setLang] = useState("hi");
  return (
    <>
      <ScreenHeader title="Settings" onBack={onBack} backLabel="Profile" />
      <div className="am-stack">
        <Card>
          <SectionHeader title="Text size" icon={<MobileIcon name="type" />} />
          <ChoiceGroup
            ariaLabel="Text size"
            layout="pill"
            value={size}
            onChange={setSize}
            options={[{ value: "normal", label: "Normal" }, { value: "large", label: "Large" }, { value: "larger", label: "Larger" }]}
          />
        </Card>
        <Card>
          <SectionHeader title="Task language" icon={<MobileIcon name="language" />} />
          <ChoiceGroup
            ariaLabel="Task language"
            value={lang}
            onChange={setLang}
            options={[{ value: "hi", label: "हिन्दी", code: "hi" }, { value: "en", label: "English", code: "en" }, { value: "bn", label: "বাংলা", code: "bn" }]}
          />
        </Card>
        <Card>
          <SectionHeader title="Account" icon={<MobileIcon name="profile" />} />
          <Button block size="lg" variant="danger" iconLeft={<MobileIcon name="logout" size={18} />} onClick={onSignOut}>Log out</Button>
        </Card>
      </div>
    </>
  );
}
