"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import { fetchNetworkSheet, type NetworkSheet } from "@/acharya/lib/api/network";
import { useStore, type User } from "@/acharya/lib/store";
import { t } from "@/acharya/lib/i18n/strings";
import { journeyStrings } from "@/acharya/lib/i18n/journey-strings";
import {
  panelStyle, errorTextStyle, btnSecondaryStyle, loadingRowStyle, spinnerStyle,
} from "./profile-ui";
import { framedIconButtonStyle } from "@/components/acharya/ui/ghost-icon-button";
import { useInstantNav } from "@/components/acharya/shell/instant-nav";
import { ProfileSkeleton } from "@/components/acharya/shell/nav-skeletons";
import IdentityCard, { SettingsHeaderButton, ProfileDetailsPanel } from "./IdentityCard";
import DetailsForm from "./DetailsForm";
import ReportTab, { ProfileKpiCards } from "./ReportTab";
import TaskHistoryPanel from "./TaskHistoryPanel";
import HistoryTab from "./HistoryTab";
import RequestsTab from "./RequestsTab";
import { SETTINGS_PATH } from "@/acharya/lib/voice-nav-targets";

export type ProfileTabId = "report" | "history" | "requests" | "profile";
// "profile" (labelled About) sits FIRST in the rail — identity before report.
export const PROFILE_TAB_IDS: ProfileTabId[] = ["profile", "report", "history", "requests"];

/**
 * `?tab=` → the tab it shows. A missing or unrecognised value is Report, which
 * is what a bare `/profile` opens on — matches `page.tsx`'s server default and
 * `voice-nav-targets.profileTabFromParam`.
 */
function tabFromParam(raw: string | null): ProfileTabId {
  const v = (raw || "").trim().toLowerCase() as ProfileTabId;
  return PROFILE_TAB_IDS.includes(v) ? v : "report";
}

type ProfileUser = Pick<User, "id" | "name" | "phone" | "role" | "isAdmin" | "preferredLang">;

interface Props {
  user: ProfileUser;
  initialTab: ProfileTabId;
}

export default function ProfileClient({ user, initialTab }: Props) {
  const nav = useInstantNav();
  const storeLang = useStore((state) => state.lang);

  /**
   * The OTHER way in: `?tab=` changing while this screen is already open.
   *
   * That is how voice and chat move between Profile tabs — `open_profile(tab)`
   * swaps the query on a screen that is already mounted. `initialTab` cannot
   * carry it: the prop only changes on a server render, and this component
   * instance survives a same-route navigation, so its `useState` kept showing
   * the tab the karigar arrived on. PR #152's QA saw exactly that — "show my
   * requests" flickered and stayed put, while the same destination reached by a
   * nested command (a real navigation, a fresh mount) worked.
   *
   * EDGE-triggered, deliberately unlike `LaneTabs`, which derives `tapped ??
   * urlTab`. That precedence is right when nothing changes the URL behind the
   * component's back — here something does, and a tap must not outrank a later
   * voice command. Reacting to the CHANGE gives both: a stale `useSearchParams`
   * can never drag a tap back, because a URL that did not change does nothing.
   */
  const searchParams = useSearchParams();
  const urlTab = tabFromParam(searchParams.get("tab"));
  /**
   * Seed from the URL when it carries a tab, from the server prop otherwise.
   *
   * Not always the prop: one spoken turn can produce TWO tool calls ("go to my
   * profile and then go to requests"), and the second lands while the first is
   * still in flight. By the time this instance mounts the URL already says
   * requests while the server render it came from was for a bare /profile — seed
   * from the prop there and the karigar arrives on Report, which is the one
   * phrasing QA found working and the one it would have broken.
   */
  const seedTab = searchParams.has("tab") ? urlTab : initialTab;
  const urlTabRef = useRef(seedTab);

  const [activeTab, setActiveTab] = useState<ProfileTabId>(seedTab);
  const [visitedTabs, setVisitedTabs] = useState<ReadonlySet<ProfileTabId>>(
    () => new Set([seedTab]),
  );
  const [sheet, setSheet] = useState<NetworkSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const lang = storeLang || user.preferredLang || "en";
  const s = t(lang);

  const loadSheet = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchNetworkSheet();
      setSheet(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t(lang).couldNotLoadProfile);
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    void loadSheet();
  }, [loadSheet]);

  // Fire-and-forget refresh used by tabs after mutations. Deliberately does
  // not toggle `loading` so the visible UI never flashes back to a spinner.
  const reloadSheet = useCallback(() => {
    void fetchNetworkSheet()
      .then(setSheet)
      .catch(() => { /* keep showing the last good sheet */ });
  }, []);

  const applyTab = useCallback((tab: ProfileTabId) => {
    // Switching tabs closes the edit form so it never hangs over the tab you
    // just moved to.
    setEditing(false);
    setActiveTab(tab);
    setVisitedTabs((prev) => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
  }, []);

  const handleTabChange = useCallback((tab: ProfileTabId) => {
    applyTab(tab);
    // The URL is the tab, so the write happens on every tap. The tap claims
    // urlTabRef itself, so the effect below sees no CHANGE when its own write
    // comes back through `useSearchParams` a frame later.
    urlTabRef.current = tab;
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", tab === "report" ? "/profile" : `/profile?tab=${tab}`);
    }
  }, [applyTab]);

  useEffect(() => {
    if (urlTabRef.current === urlTab) return;
    urlTabRef.current = urlTab;
    applyTab(urlTab);
  }, [urlTab, applyTab]);

  const tabs: Array<{ id: ProfileTabId; label: string }> = [
    // About first — the header already reads "Profile", so the tab that holds
    // identity + details is labelled About rather than repeating the word.
    { id: "profile", label: s.profileTabAbout },
    { id: "report", label: journeyStrings(lang).progress },
    { id: "history", label: s.profileTabHistory },
    { id: "requests", label: s.profileTabRequests },
  ];

  // Client fetch still in flight after the route skeleton cleared — keep the
  // same profile-shaped placeholder instead of a generic "Loading..." row.
  if (loading && !sheet) {
    return (
      <main className="journey-profile-page" style={{ ...pageWrap, paddingInline: 0 }} aria-busy="true" aria-live="polite">
        <ProfileSkeleton mode={activeTab === "profile" ? "profile" : "report"} />
      </main>
    );
  }

  return (
    <main className="journey-profile-page" style={pageWrap}>
      <header className="journey-work-toolbar" style={headerStyle}>
        {/* The title never moves. The close-edit control used to sit LEFT of
            it while editing, which pushed "Profile" sideways every time the form
            opened; it now sits on the right, beside the gear. */}
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={titleStyle}>{s.profileTabProfile}</h1>
        </div>
        {editing ? (
          <button
            type="button"
            aria-label={s.backToProfile}
            onClick={() => setEditing(false)}
            className="press"
            style={framedIconButtonStyle}
          >
            <BackIcon />
          </button>
        ) : null}
        {/* Gear opens the settings ROUTE — pushing history is the point: back
            from settings has to land here, not on home. */}
        <SettingsHeaderButton
          open={false}
          label={s.settings}
          onToggle={() => { setEditing(false); nav.push(SETTINGS_PATH); }}
        />
      </header>

      {/* The rail is the first thing under the header — the identity card it
          used to sit below is now the Profile tab's own content. */}
      {sheet ? (
        <nav className="journey-profile-sections" aria-label={s.profileSectionsAria} style={profileTabRail}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-current={isActive ? "page" : undefined}
                onClick={() => handleTabChange(tab.id)}
                className="press"
                style={{ ...profileTabButton, ...(isActive ? profileTabActive : null) }}
              >
                {tab.label}
                {/* Underline rather than a colour-only shift — on a cream chip
                    the fill change alone was too quiet to spot the live tab. */}
                {isActive ? <span style={profileTabUnderline} aria-hidden /> : null}
              </button>
            );
          })}
        </nav>
      ) : null}

      {/* Identity + details = the Profile tab. Both stay MOUNTED when another
          tab is active (display:none, not unmounted) so a half-typed edit form
          survives a trip to Report and back. */}
      {sheet ? (
        <div style={activeTab === "profile" ? undefined : { display: "none" }}>
          <IdentityCard
            profile={sheet.profile}
            lang={lang}
            userRole={user.role}
            fallbackName={user.name}
            reloadSheet={reloadSheet}
            editing={editing}
            onToggleEdit={() => setEditing((v) => !v)}
          />
          {/* Profile owns identity and editable details; progress owns the KPI
              summary so the same three numbers do not compete with the details. */}
          <ProfileDetailsPanel
            profile={sheet.profile}
            lang={lang}
            phone={user.phone}
            userRole={user.role}
            editing={editing}
          />
          <DetailsForm
            profile={sheet.profile}
            lang={lang}
            phone={user.phone}
            editing={editing}
            onSaved={(saved) => {
              // Show what was saved straight away. The form closes the moment
              // Save returns, and the full sheet reload behind it takes seconds —
              // until now the card sat on the OLD values in that gap, which read
              // as "Save did nothing". Merged, not replaced: the save response
              // lacks the derived fields (state name, OmniDel role/branch/team),
              // which the reload then refreshes.
              setSheet((prev) => (prev ? { ...prev, profile: { ...prev.profile, ...saved } } : prev));
              setEditing(false);
            }}
            reloadSheet={reloadSheet}
          />
        </div>
      ) : null}

      {/* KPIs + task history belong to Report — they are the report. */}
      {sheet && activeTab === "report" ? (
        <>
          <ProfileKpiCards sheet={sheet} lang={lang} />
          <TaskHistoryPanel items={sheet.experience} lang={lang} />
        </>
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
          <button type="button" onClick={() => { setLoading(true); void loadSheet(); }} className="press" style={{ ...btnSecondaryStyle, marginTop: 10 }}>
            {s.tryAgain}
          </button>
        </section>
      ) : null}

      {sheet ? (
        <>
          {PROFILE_TAB_IDS.map((tabId) => {
            // "profile" is rendered above (identity card + details form).
            if (tabId === "profile" || !visitedTabs.has(tabId)) return null;
            const hidden = activeTab !== tabId;
            return (
              <div key={tabId} style={hidden ? { display: "none" } : undefined}>
                {tabId === "report" ? (
                  <ReportTab
                    sheet={sheet}
                    lang={lang}
                    hideStats
                    hideExperience
                    onGoToProfile={() => {
                      // "Complete your profile" now has a tab to jump to.
                      handleTabChange("profile");
                      setEditing(true);
                      setTimeout(() => {
                        document.getElementById("your-details")?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }, 60);
                    }}
                  />
                ) : tabId === "history" ? (
                  <HistoryTab sheet={sheet} lang={lang} onGoToRequests={() => handleTabChange("requests")} />
                ) : (
                  <RequestsTab lang={lang} reloadSheet={reloadSheet} />
                )}
              </div>
            );
          })}
        </>
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
  padding: "0 16px max(env(safe-area-inset-bottom), 18px)",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  margin: "0 -16px",
  paddingTop: "max(env(safe-area-inset-top), 16px)",
  paddingBottom: 0,
};

const titleStyle: CSSProperties = {
  fontFamily: "var(--sans)",
  fontStyle: "normal",
  fontSize: 25,
  fontWeight: 650,
  color: "var(--ink)",
  margin: 0,
  lineHeight: 1.2,
  letterSpacing: "-.05em",
};

// Same segmented-rail idiom as the task detail tabs (TaskDetailClient).
// Four equal slots keep the Profile surface coherent while Progress remains
// inside the same tab context: About / Progress / History / Requests.
const profileTabRail: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 4,
  padding: 5,
  borderRadius: "var(--r-xl)",
  background: "color-mix(in srgb, var(--ochre-wash) 30%, var(--surface))",
  border: "1px solid var(--rule)",
  marginBottom: 16,
};

const profileTabButton: CSSProperties = {
  position: "relative",
  minHeight: 44,
  borderRadius: "calc(var(--r-xl) - 4px)",
  border: "none",
  background: "transparent",
  color: "var(--ink-mute)",
  fontFamily: "var(--sans)",
  fontSize: 13,
  fontWeight: 650,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  textDecoration: "none",
};

const profileTabActive: CSSProperties = {
  background: "var(--surface)",
  color: "var(--green-deep)",
  fontWeight: 750,
  boxShadow: "var(--shadow-sm)",
};

const profileTabUnderline: CSSProperties = {
  position: "absolute",
  bottom: 5,
  left: "26%",
  right: "26%",
  height: 2,
  borderRadius: 2,
  background: "var(--green-deep)",
};
