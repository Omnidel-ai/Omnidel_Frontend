"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { patchNetworkProfile, type NetworkSheet } from "@/acharya/lib/api/network";
import { TEXT_SCALES, useStore, type Lang } from "@/acharya/lib/store";
import { t } from "@/acharya/lib/i18n/strings";
import { SUPPORTED_LANGS, SUPPORTED_VOICE_LANGS, VOICE_LANGUAGES } from "@/acharya/lib/i18n/registry";
import SearchableSelect from "@/components/acharya/ui/SearchableSelect";
import { JourneyIcon, type JourneyIconName } from "@/components/acharya/tasks/WorkProgressOverview";
import {
  SETTINGS_CONTROL_ATTR,
  settingsSectionDomId,
  type SettingsVoiceSection,
} from "@/acharya/lib/voice-nav-targets";
import {
  panelStyle, panelHeaderStyle, panelTitleStyle, errorTextStyle, eyebrowStyle,
  detailRowStyle, detailLabelStyle,
  btnSecondaryStyle, logoutButtonStyle,
} from "./profile-ui";

const NETWORK_PORTAL_URL =
  process.env.NEXT_PUBLIC_NETWORK_PORTAL_URL || "https://omnidel-network.vercel.app";

/**
 * Exhaustive over the registry: a new language without a picker label is a
 * compile error. This used to be a hand-written list of four, so a language
 * could be fully wired and still impossible to choose.
 */
const LANG_LABELS: Record<Lang, string> = {
  en: "English",
  hi: "Hindi",
  bn: "Bangla",
  fr: "Français",
  te: "తెలుగు",
  am: "አማርኛ",
};
const LANG_OPTIONS: Array<{ code: Lang; label: string }> = SUPPORTED_LANGS.map((code) => ({
  code,
  label: LANG_LABELS[code],
}));

interface Props {
  sheet: NetworkSheet;
  lang: Lang;
  savingLang: Lang | null;
  onChangeLanguage: (lang: Lang) => void;
  reloadSheet: () => void;
  onLogout: () => void;
  /** MahAcharya's own display name, for the guide panel's copy. */
  mahAcharyaName: string;
  /**
   * Section to scroll to and flag on arrival, from `/settings?section=`.
   * Voice and chat use it (`open_settings(section)`) so "change my language"
   * lands on the language panel instead of the top of the screen.
   */
  focusSection?: SettingsVoiceSection | null;
}

/**
 * Settings panels, in render order: public card, text size, the MahAcharya
 * guide, task language, account.
 *
 * Each panel carries the DOM id its voice/chat section name maps to (see
 * `voice-nav-targets.ts`) — that shared list is what lets one `open_settings`
 * tool reach every section instead of one tool per destination.
 */
export default function ProfileTab({
  sheet, lang, savingLang, onChangeLanguage, reloadSheet, onLogout,
  mahAcharyaName, focusSection = null,
}: Props) {
  const s = t(lang);
  const profile = sheet.profile;

  // Scroll to the requested panel once, on arrival. `block: "center"` rather
  // than "start": these panels are short, and centring one makes it obvious
  // which one was asked for without a header covering it.
  //
  // Then MOVE FOCUS to the panel's own control. Scrolling and ringing a panel
  // leaves the karigar looking at it with focus still wherever it was, which is
  // why both settings findings came back as "not properly taken to the control"
  // on the #154 retest even though the right panel was on screen. `preventScroll`
  // because the smooth scroll above is already running — letting focus() scroll
  // too snaps past the animation and lands the panel under the header.
  useEffect(() => {
    if (!focusSection) return;
    const el = document.getElementById(settingsSectionDomId(focusSection));
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    const control = el.querySelector<HTMLElement>(`[${SETTINGS_CONTROL_ATTR}]`);
    control?.focus({ preventScroll: true });
  }, [focusSection]);

  return (
    <div className="journey-settings-list">
      <PublicCardPanel
        slug={profile.slug}
        isPublic={profile.is_public}
        labels={s}
        reloadSheet={reloadSheet}
        focused={focusSection === "public_card"}
      />

      <TextSizePanel labels={s} focused={focusSection === "text_size"} />

      <MahAcharyaPanel labels={s} name={mahAcharyaName} focused={focusSection === "guide_auto_open"} />

      <section
        id={settingsSectionDomId("language")}
        style={{ ...panelStyle, ...(focusSection === "language" ? focusRingStyle : null) }}
      >
        <div style={panelHeaderStyle}>
          <div>
            <SettingsHeading icon="language">{s.taskLanguage}</SettingsHeading>
            <h2 className="journey-settings-sub" style={panelTitleStyle}>{s.openTasksIn}</h2>
          </div>
          {savingLang ? <span style={savingStyle}>{s.savingLabel}</span> : null}
        </div>
        <div className="journey-lang-select">
          <SearchableSelect
            value={lang}
            onChange={(value) => onChangeLanguage(value as Lang)}
            options={LANG_OPTIONS.map((option) => ({ value: option.code, label: option.label }))}
            ariaLabel={s.taskLanguage}
            controlAttribute={SETTINGS_CONTROL_ATTR}
            disabled={Boolean(savingLang)}
            pill
          />
        </div>
      </section>

      <VoiceLanguagePanel labels={s} />

      <section
        id={settingsSectionDomId("account")}
        style={{ ...panelStyle, ...(focusSection === "account" ? focusRingStyle : null) }}
      >
        {/* Account = the way out. The internal user id used to sit here; it is
            a database key the karigar can neither use nor act on, so it is
            gone rather than dressed up. */}
        <SettingsHeading icon="profile">{s.accountSection}</SettingsHeading>
        <button
          type="button"
          onClick={onLogout}
          className="press"
          {...{ [SETTINGS_CONTROL_ATTR]: "" }}
          style={{ ...logoutButtonStyle, marginTop: 12 }}
        >
          <LogoutIcon />
          {s.logout}
        </button>
      </section>
    </div>
  );
}

/**
 * The one control over how the app OPENS, so it lives in Settings rather than
 * anywhere the guide itself is drawn.
 *
 * Off by default on purpose: opening straight into a chat sheet is a strong
 * opinion to hold on a karigar's behalf. Writes to the persisted store;
 * HomeMahAcharyaGuide reads it once per app open.
 *
 * The chat sheet is what opens, not the mic — "Ask <name>" is the chat surface's
 * own CTA, and a browser only grants the microphone after a user gesture, so an
 * auto-started mic would ask for permission on every cold open and often fail
 * anyway. Starting the mic instead is a one-line change here and in the guide.
 */
function MahAcharyaPanel({
  labels, name, focused,
}: { labels: ReturnType<typeof t>; name: string; focused: boolean }) {
  const autoStart = useStore((st) => st.guideAutoStart);
  const setAutoStart = useStore((st) => st.setGuideAutoStart);
  const label = labels.autoStartAsk(name);

  return (
    <section
      id={settingsSectionDomId("guide_auto_open")}
      style={{ ...panelStyle, ...(focused ? focusRingStyle : null) }}
    >
      <SettingsHeading icon="mic">{labels.mahAcharyaSection}</SettingsHeading>
      <div className="journey-settings-row" style={switchRowStyle}>
        <span style={{ fontSize: 15, color: "var(--ink)" }}>{label}</span>
        <ToggleSwitch
          on={autoStart}
          label={label}
          onToggle={() => setAutoStart(!autoStart)}
          isSectionControl
        />
      </div>
      <p className="journey-settings-hint" style={{ fontSize: 13, color: "var(--ink-mute)", margin: "8px 0 0" }}>
        {labels.autoStartAskHint(name)}
      </p>
    </section>
  );
}

/**
 * Accessibility text size. Writes `textScale` to the persisted store;
 * AppBootstrap applies it as `zoom` on <html> — see TEXT_SCALES for why zoom
 * and not a root font-size.
 */
function TextSizePanel({ labels, focused }: { labels: ReturnType<typeof t>; focused: boolean }) {
  const textScale = useStore((st) => st.textScale);
  const setTextScale = useStore((st) => st.setTextScale);

  const options: Array<{ scale: number; label: string; preview: number }> = [
    { scale: TEXT_SCALES[0], label: labels.textSizeNormal, preview: 14 },
    { scale: TEXT_SCALES[1], label: labels.textSizeLarge, preview: 16 },
    { scale: TEXT_SCALES[2], label: labels.textSizeLarger, preview: 18 },
  ];

  return (
    <section
      id={settingsSectionDomId("text_size")}
      style={{ ...panelStyle, ...(focused ? focusRingStyle : null) }}
    >
      <SettingsHeading icon="type">{labels.textSizeSection}</SettingsHeading>
      <p className="journey-settings-hint" style={{ fontSize: 13, color: "var(--ink-mute)", margin: "6px 0 10px" }}>
        {labels.textSizeHint}
      </p>
      <div
        role="radiogroup"
        aria-label={labels.textSizeSection}
        // Focus target for `?section=text_size` — see SETTINGS_CONTROL_ATTR.
        tabIndex={-1}
        {...{ [SETTINGS_CONTROL_ATTR]: "" }}
        style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, outline: "none" }}
      >
        {options.map((option) => {
          const active = textScale === option.scale;
          return (
            <button
              key={option.scale}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTextScale(option.scale)}
              className="press"
              style={{
                ...textSizeButtonStyle,
                ...(active ? languageButtonActiveStyle : null),
              }}
            >
              {/* The label renders at its own step so the choice is legible
                  before it is applied. */}
              <span style={{ fontSize: option.preview, fontWeight: 700, lineHeight: 1.1 }}>Aa</span>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{option.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SettingsHeading({ children, icon }: { children: string; icon: JourneyIconName }) {
  return <h2 className="journey-settings-heading"><span><JourneyIcon name={icon} /></span>{children}</h2>;
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

/**
 * The switch shared by the public-card and MahAcharya panels. Extracted when the
 * second one arrived rather than copying 30 lines of absolutely-positioned knob.
 * `busy` is for switches whose write goes to the network; the store-backed ones
 * never pass it.
 */
function ToggleSwitch({ on, label, onToggle, busy = false, isSectionControl = false }: {
  on: boolean;
  label: string;
  onToggle: () => void;
  busy?: boolean;
  /** The control a voice/chat deep link to this panel should focus. */
  isSectionControl?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={busy}
      onClick={onToggle}
      {...(isSectionControl ? { [SETTINGS_CONTROL_ATTR]: "" } : null)}
      style={{
        position: "relative",
        height: 28,
        width: 48,
        flexShrink: 0,
        borderRadius: 999,
        background: on ? "var(--green-deep)" : "var(--surface-sunk)",
        border: "1.5px solid var(--rule-strong)",
        cursor: "pointer",
        transition: "background .15s",
        opacity: busy ? 0.6 : 1,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: on ? 22 : 2,
          height: 20,
          width: 20,
          borderRadius: "50%",
          background: "#f4efdf",
          boxShadow: "var(--shadow-sm)",
          transition: "left .15s",
        }}
      />
    </button>
  );
}

function PublicCardPanel({ slug, isPublic: initialPublic, labels, reloadSheet, focused }: {
  slug: string;
  isPublic: boolean;
  labels: ReturnType<typeof t>;
  reloadSheet: () => void;
  focused: boolean;
}) {
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  // The public card is served by the network portal, not this app — copy the
  // portal origin, never window.location.origin.
  const cardUrl = `${NETWORK_PORTAL_URL}/w/${slug}`;

  async function togglePublic() {
    const next = !isPublic;
    setError("");
    setBusy(true);
    setIsPublic(next);
    try {
      await patchNetworkProfile({ is_public: next });
      reloadSheet();
    } catch (err) {
      setIsPublic(!next);
      setError(err instanceof Error ? err.message : labels.couldNotUpdate);
    } finally {
      setBusy(false);
    }
  }

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(cardUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(labels.couldNotCopyLink);
    }
  }

  return (
    <section
      id={settingsSectionDomId("public_card")}
      style={{ ...panelStyle, ...(focused ? focusRingStyle : null) }}
    >
      <SettingsHeading icon="profile">{labels.publicProfile}</SettingsHeading>

      <div className="journey-settings-row" style={{ ...switchRowStyle, marginTop: 10 }}>
        <span style={{ fontSize: 15, color: "var(--ink)" }}>{labels.showCardPublicly}</span>
        <ToggleSwitch
          on={isPublic}
          label={labels.showCardPublicly}
          onToggle={() => void togglePublic()}
          busy={busy}
          isSectionControl
        />
      </div>

      <div className="journey-settings-linkrow" style={{ ...detailRowStyle, alignItems: "center" }}>
        <span style={{ ...detailLabelStyle, fontFamily: "var(--mono)", textTransform: "none", letterSpacing: 0, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flexShrink: 1 }}>
          /w/{slug}
        </span>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button type="button" onClick={() => void copyShareLink()} className="press" style={{ ...btnSecondaryStyle, minHeight: 40, padding: "0 12px", fontSize: 13 }}>
            {copied ? labels.copied : labels.copyLink}
          </button>
          <a href={cardUrl} target="_blank" rel="noreferrer" className="press" style={{ ...btnSecondaryStyle, minHeight: 40, padding: "0 12px", fontSize: 13, textDecoration: "none" }}>
            {labels.openCard}
          </a>
        </div>
      </div>

      {error ? <p style={{ ...errorTextStyle, marginTop: 8 }}>{error}</p> : null}
    </section>
  );
}

/**
 * Marks the panel a voice/chat deep link asked for. A border + wash rather than
 * a flash: the karigar arrives mid-conversation and may look down a second later,
 * so the marker has to still be there when their eyes get to it.
 */
const focusRingStyle: CSSProperties = {
  borderColor: "var(--green-deep)",
  boxShadow: "0 0 0 3px color-mix(in srgb, var(--green-deep) 14%, transparent)",
};

const switchRowStyle: CSSProperties = {
  display: "flex",
  minHeight: 44,
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const savingStyle: CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 10,
  color: "var(--ink-mute)",
  textTransform: "uppercase",
  letterSpacing: "0.12em",
};

const languageButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: 52,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 12px",
  borderRadius: "var(--r-md)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  background: "var(--surface-sunk)",
  color: "var(--ink)",
  cursor: "pointer",
  textAlign: "left",
  fontSize: 14,
  fontWeight: 700,
};

const textSizeButtonStyle: CSSProperties = {
  minHeight: 62,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
  padding: "8px 6px",
  borderRadius: "var(--r-md)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  background: "var(--surface-sunk)",
  color: "var(--ink)",
  cursor: "pointer",
};

const languageButtonActiveStyle: CSSProperties = {
  borderColor: "var(--green-deep)",
  background: "var(--green-wash)",
  color: "var(--green-deep)",
  boxShadow: "0 1px 0 color-mix(in srgb, var(--green-deep) 16%, transparent)",
};

const languageCodeStyle: CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.12em",
};

/**
 * The language the Acharya SPEAKS in voice conversations — apart from the app
 * language above, and voice-only by design: it never changes a screen or the
 * saved profile, so it can offer languages the app has no UI for (Telugu was
 * one, until it became an app language).
 * Local and instant — the live voice session re-mints in the new language
 * because store.voiceLang is part of its session key.
 */
function VoiceLanguagePanel({ labels }: { labels: ReturnType<typeof t> }) {
  const voiceLang = useStore((state) => state.voiceLang);
  const setVoiceLang = useStore((state) => state.setVoiceLang);
  const options: Array<{ code: (typeof SUPPORTED_VOICE_LANGS)[number] | null; label: string; tag: string }> = [
    { code: null, label: labels.voiceLanguageSameAsApp, tag: "" },
    ...SUPPORTED_VOICE_LANGS.map((code) => ({
      code,
      label: VOICE_LANGUAGES[code].nativeName,
      tag: code.toUpperCase(),
    })),
  ];
  return (
    <section style={panelStyle}>
      <div style={panelHeaderStyle}>
        <div>
          <p style={eyebrowStyle}>{labels.voiceLanguageSection}</p>
          <h2 style={panelTitleStyle}>{labels.acharyaSpeaksIn}</h2>
        </div>
      </div>
      <p style={{ margin: "0 0 10px", fontSize: 13, lineHeight: 1.45, color: "var(--ink-soft)" }}>
        {labels.voiceLanguageHint}
      </p>
      <div
        role="radiogroup"
        aria-label={labels.acharyaSpeaksIn}
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
      >
        {options.map((option) => {
          const active = voiceLang === option.code;
          return (
            <button
              key={option.code ?? "app"}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setVoiceLang(option.code)}
              className="press"
              style={{ ...languageButtonStyle, ...(active ? languageButtonActiveStyle : null) }}
            >
              <span>{option.label}</span>
              {option.tag ? <span style={languageCodeStyle}>{option.tag}</span> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
