"use client";

/**
 * The Profile / Settings navigation tools, in ONE place, for every voice
 * surface that binds them.
 *
 * They used to live inline in `HomeMahAcharyaGuide`, which is also the only
 * place they were ever bound. That is how PR #154's fix passed its own tests and
 * still failed QA's re-test: the home guide is `active: false` on every
 * `/acharyas/<slug>` route (AcharyaShell owns the mic there), and the `acharya`
 * tool set has no `open_settings` at all — so "change my language" asked while
 * talking to an Acharya reaches a model with no tool for it, and the only thing
 * left to say is that it cannot help. Prompt wording cannot fix a tool that is
 * not bound.
 *
 * Extracting them makes the two surfaces offer the same destinations by
 * construction rather than by both remembering to. Same reason `open_profile`
 * and `open_settings` are grouped by screen in the first place — see
 * `voice-nav-targets.ts`.
 */

import { VOICE_LANGUAGES, isVoiceLang, type VoiceLang } from "@/lib/i18n/registry";
import type { ToolHandlers, ToolResult } from "@/hooks/useGeminiLiveSession";
import { describeScreen } from "@/lib/voice/screen-state";
import { useStore } from "@/lib/store";
import {
  SETTINGS_SECTION_CONTROLS,
  isAlreadyShowing,
  normalizeProfileTab,
  normalizeSettingsSection,
  profileHref,
  settingsHref,
} from "@/lib/voice-nav-targets";

function normalizeSpokenLang(v: unknown): VoiceLang | null {
  const code = typeof v === "string" ? v.trim().toLowerCase() : "";
  return isVoiceLang(code) ? code : null;
}

type Nav = {
  push: (href: string) => void;
  replaceQuery: (href: string) => void;
};

export type ScreenNavDeps = {
  nav: Nav;
  /** Push a context note to the live model without re-minting. */
  notify: (text: string) => void;
};

/**
 * `open_profile`, `open_settings`, and the retired `open_msme_requests` alias.
 *
 * Returns handlers only — the caller decides what else to merge in and which
 * tool declarations its own context mints.
 */
export function buildScreenNavHandlers({ nav, notify }: ScreenNavDeps): ToolHandlers {
  // Navigate WITHOUT ending the session: both surfaces outlive the route change
  // (the guide lives in the (app) layout, the shell in the acharya layout). A
  // notify() context note keeps the model oriented without a re-mint — no
  // re-greet, mic stays open.
  //
  // `replaceQuery`, not `push`: moving between Profile tabs or Settings sections
  // changes only the query, and pushing that painted the destination skeleton
  // over a screen that was already correct — the flicker PR #152's QA saw. It
  // falls through to a real push whenever the screen itself differs, so a caller
  // that cannot know where the karigar is standing may always call this one.
  const goTo = (href: string, note: string) => {
    nav.replaceQuery(href);
    notify(`(context: ${note})`);
  };

  /**
   * Arrive at `href` — or say nothing moved, because nothing needed to.
   *
   * "Show my report" said while Report is open is not a navigation, and treating
   * it as one is what made the screen redraw three or four times while the model
   * announced a move that never happened. The model needs the distinction too,
   * hence `already_there` in the result and a context note that says so in words.
   */
  const arrive = (href: string, movedNote: string, hereNote: string): ToolResult => {
    const here =
      typeof window !== "undefined" &&
      isAlreadyShowing(href, window.location.pathname, window.location.search);
    if (here) {
      notify(`(context: ${hereNote})`);
      return {
        ok: true,
        already_there: true,
        now_showing: describeScreen(window.location.pathname, window.location.search),
      };
    }
    goTo(href, movedNote);
    // Describe the DESTINATION from the href — the router has not moved yet.
    const [path = "", query = ""] = href.split("?");
    return { ok: true, already_there: false, now_showing: describeScreen(path, query) };
  };

  return {
    // Grouped by screen: one tool per destination screen, the screen's own tabs
    // / sections as the argument. Both tolerate a missing or unknown argument by
    // landing on the screen itself — a mis-heard tab name should still get the
    // karigar to Profile, not return an error the model then has to explain out
    // loud.
    open_profile: async (args) => {
      const tab = normalizeProfileTab(args.tab);
      return {
        ...arrive(
          profileHref(tab),
          tab ? `opened the profile page, ${tab} tab` : "opened the profile page",
          tab
            ? `they are already on the profile ${tab} tab — nothing moved`
            : "they are already on their profile — nothing moved",
        ),
        tab: tab ?? "default",
      };
    },
    open_settings: async (args) => {
      const section = normalizeSettingsSection(args.section);
      // The control to tap, in plain words, straight from the section list. The
      // model has never seen the panel; asking it to "name the control" was the
      // half of QA's expected result that kept coming back unmet. `tap_hint` is
      // what the prompt tells it to say once it lands.
      const tapHint = section ? SETTINGS_SECTION_CONTROLS[section] : null;
      return {
        ...arrive(
          settingsHref(section),
          section ? `opened settings, scrolled to ${section}` : "opened profile settings",
          section
            ? `they are already in settings at ${section} — nothing moved; the tap is theirs`
            : "they are already in settings — nothing moved",
        ),
        section: section ?? "default",
        ...(tapHint ? { tap_hint: tapHint } : null),
      };
    },
    // Retired tool. A voice token lives 30 minutes, so a session minted before
    // the regrouping can still call this — without the alias the model gets
    // "unhandled" and tells the karigar it cannot open their requests.
    open_msme_requests: async () =>
      arrive(
        profileHref("requests"),
        "opened the profile requests tab",
        "they are already on the profile requests tab — nothing moved",
      ),
    // Voice-only. Changes the language the Acharya SPEAKS and nothing else —
    // not the app's screens, not the saved profile language. It used to call
    // updateProfileLanguage too, so "speak in Hindi" flipped the whole app.
    // The live session is NOT re-minted: the same Gemini session switches
    // language in place and keeps the conversation (useGeminiLiveSession
    // setContext). store.voiceLang still reaches the next mint, so a later
    // reconnect or new conversation opens in it. Picking the app's own language
    // clears the override, so the voice follows the app again.
    set_spoken_language: async (args) => {
      const lang = normalizeSpokenLang((args as { lang?: unknown }).lang);
      if (!lang) return { ok: false, error: "unknown_lang" };
      const { lang: appLang, voiceLang, setVoiceLang } = useStore.getState();
      const current = voiceLang ?? appLang;
      if (lang === current) return { ok: true, lang, already_set: true, app_language_unchanged: true };
      setVoiceLang(lang === appLang ? null : lang);
      // Same conversation, new language — say so plainly in the result, since
      // the model's system prompt still names the language it was minted with.
      return {
        ok: true,
        lang,
        speak_now_in: VOICE_LANGUAGES[lang].name,
        same_conversation: true,
        app_language_unchanged: true,
      };
    },
  };
}
