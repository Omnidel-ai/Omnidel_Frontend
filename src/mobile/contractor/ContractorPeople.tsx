import { useState } from "react";
import { Button } from "../../components/common";
import {
  Card,
  ChoiceGroup,
  DetailList,
  ListRow,
  MobileIcon,
  PersonAvatar,
  ProfileHero,
  RowList,
  ScreenHeader,
  SectionHeader,
  StatRow,
  StatTile,
  Tag,
} from "../../components/acharya-mobile";
import type { ContractorData, Team } from "./types";

/** Teams (OmniPulse `TeamsScreen`): every team, each opening into its roster in place. */
export function ContractorTeams({ teams }: { teams: Team[] }) {
  const [open, setOpen] = useState<string | null>(teams[0]?.id ?? null);
  return (
    <>
      <ScreenHeader title="Teams" sticky />
      <div className="am-stack" style={{ paddingTop: 14 }}>
        <Card flush>
          <SectionHeader variant="rule" title="Teams" icon={<MobileIcon name="teams" />} right={teams.length} />
          <RowList>
            {teams.map((t) => (
              <div key={t.id}>
                <ListRow
                  leading={<PersonAvatar name={t.name} />}
                  title={t.name}
                  subtitle={t.description}
                  chevron={false}
                  trailing={
                    <>
                      <Tag size="xs" tone={t.role === "lead" ? "green" : "outline"}>{t.role === "lead" ? "Lead" : "Member"}</Tag>
                      <span style={{ display: "inline-flex", transition: "transform 160ms", transform: open === t.id ? "rotate(180deg)" : undefined, color: "var(--ink-faint)" }}>
                        <MobileIcon name="chevron-down" size={18} />
                      </span>
                    </>
                  }
                  onSelect={() => setOpen((o) => (o === t.id ? null : t.id))}
                  expanded={open === t.id}
                  ariaLabel={`${t.name}, ${t.members.length} members`}
                />
                {open === t.id && (
                  <ul className="mb-team__members">
                    {t.members.map((m) => (
                      <li key={m.name}>
                        <PersonAvatar name={m.name} size="sm" />
                        <span>{m.name}</span>
                        <Tag size="xs" tone={m.role === "Supervisor" ? "slate" : "neutral"}>{m.role}</Tag>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </RowList>
        </Card>
      </div>
    </>
  );
}

/** Profile (OmniPulse `ProfileScreen`): ochre hero, three counts, account facts, and the way to Settings. */
export function ContractorProfile({ data, onSettings }: { data: ContractorData; onSettings: () => void }) {
  const { user, profile } = data;
  return (
    <>
      <ScreenHeader title="Profile" sticky />
      <div className="am-stack" style={{ paddingTop: 14 }}>
        <ProfileHero tone="ochre" name={user.name} meta={user.phone} tag={<Tag tone="outline">{user.role}</Tag>} />
        <StatRow label="Your numbers">
          <StatTile layout="row" tone="ochre" icon={<MobileIcon name="inbox" />} value={String(data.approvals.length)} label="Waiting" />
          <StatTile layout="row" tone="green" icon={<MobileIcon name="projects" />} value={String(profile.given)} label="Given" />
          <StatTile layout="row" tone="slate" icon={<MobileIcon name="teams" />} value={String(profile.managing)} label="Managing" />
        </StatRow>
        <Card flush>
          <SectionHeader variant="rule" title="Account" icon={<MobileIcon name="id-card" />} />
          <div style={{ padding: 12 }}>
            <DetailList
              rows={[
                { label: "Your name", value: user.name },
                { label: "Phone", value: user.phone },
                { label: "Role", value: user.role },
                { label: "Language", value: "हिन्दी" },
                { label: "Teams", value: String(data.teams.length) },
                { label: "Projects", value: String(data.projects.length) },
              ]}
            />
          </div>
        </Card>
        <ListRow card leading={<MobileIcon name="settings" />} title="Settings" onSelect={onSettings} />
      </div>
    </>
  );
}

/** Settings (OmniPulse `SettingsScreen`): text size, language, sign out, version. */
export function ContractorSettings({ onBack, onSignOut }: { onBack: () => void; onSignOut: () => void }) {
  const [size, setSize] = useState("normal");
  const [lang, setLang] = useState("hi");
  return (
    <>
      <ScreenHeader title="Settings" onBack={onBack} backLabel="Profile" />
      <div className="am-stack">
        <Card flush>
          <SectionHeader variant="rule" title="Text size" icon={<MobileIcon name="type" />} />
          <div style={{ padding: 12 }}>
            <ChoiceGroup
              ariaLabel="Text size"
              layout="grid"
              value={size}
              onChange={setSize}
              options={[
                { value: "normal", label: "Normal", preview: "Aa", previewStyle: { fontSize: 15 } },
                { value: "large", label: "Large", preview: "Aa", previewStyle: { fontSize: 18 } },
                { value: "larger", label: "Larger", preview: "Aa", previewStyle: { fontSize: 22 } },
              ]}
            />
          </div>
        </Card>
        <Card flush>
          <SectionHeader variant="rule" title="Language" icon={<MobileIcon name="language" />} />
          <div style={{ padding: 12 }}>
            <ChoiceGroup
              ariaLabel="Language"
              value={lang}
              onChange={setLang}
              options={[{ value: "hi", label: "हिन्दी", code: "hi" }, { value: "en", label: "English", code: "en" }, { value: "bn", label: "বাংলা", code: "bn" }]}
            />
          </div>
        </Card>
        <Card flush>
          <SectionHeader variant="rule" title="Account" icon={<MobileIcon name="profile" />} />
          <div style={{ padding: 12 }}>
            <Button block size="lg" variant="danger" iconLeft={<MobileIcon name="logout" size={18} />} onClick={onSignOut}>Sign out</Button>
          </div>
        </Card>
        <Card flush>
          <SectionHeader variant="rule" title="About" icon={<MobileIcon name="info" />} />
          <div style={{ display: "flex", justifyContent: "space-between", padding: 12, fontSize: 14 }}>
            <span style={{ color: "var(--ink-mute)" }}>Version</span>
            <span style={{ font: "700 14px/1 var(--mono)" }}>0.2.0</span>
          </div>
        </Card>
      </div>
    </>
  );
}
