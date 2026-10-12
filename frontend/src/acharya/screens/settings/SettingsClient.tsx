"use client";

/**
 * Settings — a top-level screen at `/settings`.
 *
 * It used to be a boolean on ProfileClient (`?settings=1`, then the param was
 * stripped), so the browser/device back gesture had no settings entry to pop and
 * threw the karigar all the way home. Then it became `/profile/settings`, which
 * made it read as a sub-screen of Profile even though it shares no content with
 * it — Profile's About tab is identity + the edit form, these are the app's
 * settings. It is its own route now, but it is reached from Profile (the bottom
 * bar's Profile tab stays lit here), so back goes to Profile.
 * `/profile/settings` still redirects here.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { updateProfileLanguage } from "@/acharya/lib/api/profile";
import { fetchNetworkSheet, type NetworkSheet } from "@/acharya/lib/api/network";
import { useStore, type Lang, type User } from "@/acharya/lib/store";
import { t } from "@/acharya/lib/i18n/strings";
import { normalizeSettingsSection, type SettingsVoiceSection } from "@/acharya/lib/voice-nav-targets";
import { panelStyle, errorTextStyle, btnSecondaryStyle, loadingRowStyle, spinnerStyle } from "../profile/profile-ui";
import { framedIconButtonStyle } from "@/components/acharya/ui/ghost-icon-button";
import { useInstantNav } from "@/components/acharya/shell/instant-nav";
import { SettingsSkeleton } from "@/components/acharya/shell/nav-skeletons";
import ProfileTab from "../profile/ProfileTab";

type SettingsUser = Pick<User, "id" | "name" | "phone" | "role" | "isAdmin" | "preferredLang">;

export default function SettingsClient({
  user,
  mahAcharyaName,
  focusSection,
}: {
  user: SettingsUser;
  mahAcharyaName: string;
  /** From `?section=`, set by voice/chat `open_settings(section)`. */
  focusSection: SettingsVoiceSection | null;
}) {
  const router = useRouter();
  const nav = useInstantNav();
  const storeLang = useStore((state) => state.lang);
  const setLang = useStore((state) => state.setLang);
  const setUser = useStore((state) => state.setUser);

  const [sheet, setSheet] = useState<NetworkSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingLang, setSavingLang] = useState<Lang | null>(null);
  /** Bumped by Try again — re-runs the load effect. */
  const [retry, setRetry] = useState(0);

  /**
   * `?section=` changing while this screen is ALREADY open — which is how voice
   * and chat re-target it: `open_settings(section)` swaps the query rather than
   * navigating, so `focusSection` (a server prop) cannot arrive a second time.
   * Without this, "change my language" worked on the way in from Profile and did
   * nothing at all once the karigar was standing on Settings.
   *
   * Edge-triggered on the URL, same shape as ProfileClient's tab — the prop only
   * seeds the first paint.
   */
  const searchParams = useSearchParams();
  const urlSection = normalizeSettingsSection(searchParams.get("section"));
  // Seeded from the URL when it carries a section, from the prop otherwise: one
  // spoken turn can fire two tool calls, and the second can land while the first
  // navigation is still in flight — by then the URL is ahead of the server
  // render this instance came from. Same reason as ProfileClient's seedTab.
  const seedSection = searchParams.has("section") ? urlSection : focusSection;
  const urlSectionRef = useRef(seedSection);
  const [focus, setFocus] = useState<SettingsVoiceSection | null>(seedSection);
  useEffect(() => {
    if (urlSectionRef.current === urlSection) return;
    urlSectionRef.current = urlSection;
    setFocus(urlSection);
  }, [urlSection]);

  const lang = storeLang || user.preferredLang || "en";
  const s = t(lang);

  // Load (and reload, via the retry counter) as a subscription-shaped effect:
  // fetch in the effect, settle state in the callbacks, cancel on unmount.
  useEffect(() => {
    let cancelled = false;
    fetchNetworkSheet()
      .then((data) => {
        if (cancelled) return;
        setSheet(data);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : t(lang).couldNotLoadProfile);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lang, retry]);

  const reloadSheet = useCallback(() => {
    void fetchNetworkSheet()
      .then(setSheet)
      .catch(() => { /* keep showing the last good sheet */ });
  }, []);

  async function changeLanguage(next: Lang) {
    if (next === lang || savingLang) return;
    const previous = lang;
    setSavingLang(next);
    setLang(next);
    try {
      const res = await updateProfileLanguage(next);
      setUser({ ...user, preferredLang: res.preferredLang });
      router.refresh();
    } catch {
      setLang(previous);
    } finally {
      setSavingLang(null);
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/auth/phone/request-otp");
    }
  }

  if (loading && !sheet) {
    return (
      <main className="journey-settings-page" style={pageWrap} aria-busy="true" aria-live="polite">
        <SettingsSkeleton />
      </main>
    );
  }

  return (
    <main className="journey-settings-page" style={pageWrap}>
      <header style={headerStyle}>
        <button
          type="button"
          aria-label={s.backToProfile}
          // Back is Profile — Settings is opened from there. A real history pop
          // when Profile is where we came from (restores from the router cache,
          // no skeleton); otherwise it replaces to Profile, so a deep link
          // from voice still lands on Profile rather than home.
          onClick={() => nav.back("/profile")}
          className="press"
          style={framedIconButtonStyle}
        >
          <BackIcon />
        </button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={titleStyle}>{s.settings}</h1>
        </div>
      </header>

      {sheet ? (
        <ProfileTab
          sheet={sheet}
          lang={lang}
          savingLang={savingLang}
          onChangeLanguage={(next) => void changeLanguage(next)}
          reloadSheet={reloadSheet}
          onLogout={() => void handleLogout()}
          mahAcharyaName={mahAcharyaName}
          focusSection={focus}
        />
      ) : null}

      {loading ? (
        <section style={panelStyle} aria-live="polite">
          <div style={loadingRowStyle}>
            <span style={spinnerStyle} aria-hidden />
            <span>{s.loading}...</span>
          </div>
        </section>
      ) : null}

      {!loading && error ? (
        <section style={{ ...panelStyle, borderColor: "var(--crit-wash)" }} role="alert">
          <p style={errorTextStyle}>{error}</p>
          <button
            type="button"
            onClick={() => { setLoading(true); setRetry((n) => n + 1); }}
            className="press"
            style={{ ...btnSecondaryStyle, marginTop: 10 }}
          >
            {s.tryAgain}
          </button>
        </section>
      ) : null}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}

const pageWrap: CSSProperties = {
  minHeight: "100vh",
  background: "var(--page)",
  padding: "max(env(safe-area-inset-top), 14px) 16px max(env(safe-area-inset-bottom), 18px)",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  marginBottom: 16,
};

const titleStyle: CSSProperties = {
  fontFamily: "var(--serif)",
  fontStyle: "italic",
  fontSize: 24,
  fontWeight: 500,
  color: "var(--ink)",
  margin: 0,
  lineHeight: 1.15,
};
