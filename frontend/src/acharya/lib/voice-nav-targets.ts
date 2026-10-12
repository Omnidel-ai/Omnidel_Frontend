/**
 * Voice + chat navigation targets, grouped by the SCREEN they belong to.
 *
 * The home navigator used to expose one flat tool per destination
 * (`open_profile`, `open_settings`, `open_msme_requests`), which meant voice
 * could reach exactly two of Profile's four tabs and none of Settings' sections
 * — "open my report" or "change my language" had nowhere to land. Grouping the
 * destinations under the screen that owns them fixes both ends: one tool per
 * screen, with the screen's own tabs/sections as the enum, so every tab a thumb
 * can reach is a tab a voice can reach.
 *
 * ISOMORPHIC on purpose — the mint route, the chat route, the prompt builder,
 * the voice handlers and the sentinel parser all need the same lists, and the
 * first three are server-side. Do NOT add "use client" or import from
 * `store.ts` / `lanes.ts` here (same RSC rule as `lane-ids.ts`).
 */
import { LANGUAGES, SUPPORTED_LANGS } from "@/acharya/lib/i18n/registry";

function languageOptionName(code: (typeof SUPPORTED_LANGS)[number]): string {
  const cfg = LANGUAGES[code];
  return cfg.nativeName === cfg.name ? cfg.name : `${cfg.name} / ${cfg.nativeName}`;
}

export const SETTINGS_LANGUAGE_OPTIONS = SUPPORTED_LANGS.map(languageOptionName).join(", ");

// ── Profile ────────────────────────────────────────────────────────────────

/** Profile's tab rail, in the order it renders. */
export const PROFILE_TABS = ["about", "report", "history", "requests"] as const;
export type ProfileVoiceTab = (typeof PROFILE_TABS)[number];

/**
 * Voice tab id → the `?tab=` value `ProfileClient` understands.
 *
 * The rail labels the identity tab "About" while its internal id is "profile";
 * the karigar says "about" or "my details", never "profile tab", so the spoken
 * vocabulary is what the tool enum exposes and this map does the translating.
 */
const PROFILE_TAB_PARAM: Record<ProfileVoiceTab, string> = {
  about: "profile",
  report: "report",
  history: "history",
  requests: "requests",
};

/** What each Profile tab holds — reused verbatim in the tool descriptions and the prompt. */
export const PROFILE_TAB_HINTS: Record<ProfileVoiceTab, string> = {
  about: "their card, name, trade, phone and address — also where they edit those details",
  // No "tasks" in this line. It read "their Acharya score, tasks done and the
  // KPI tiles", and on a board — where nothing else offered the task list — a
  // "show my tasks" had exactly one tool whose text matched: this one. That is
  // the Report tab QA saw opening again and again.
  report: "their Acharya score and performance KPI tiles — NOT their task list",
  history: "past work and the organisations they have worked with",
  requests: "MSME join requests and invites — use this for 'link with an MSME', 'join an organisation', 'invites', 'requests'",
};

// ── Settings ───────────────────────────────────────────────────────────────

/** Settings' panels, in the order they render on `/settings`. */
/**
 * `guide_auto_open` was `mahacharya`. On an Acharya's board that id was the ONLY
 * tool text containing the word — the `acharya` context had no `open_acharya`
 * — so "Mahacharyaji se baat karni hai" resolved to the auto-open switch, and QA
 * logged the acharya taking the karigar to Settings. The section is named for
 * what it does now; the person is reached through `open_acharya`.
 * `normalizeSettingsSection` still accepts the old id (30-minute tokens, old
 * deep links).
 */
export const SETTINGS_SECTIONS = [
  "public_card",
  "text_size",
  "guide_auto_open",
  "language",
  "account",
] as const;
export type SettingsVoiceSection = (typeof SETTINGS_SECTIONS)[number];

/**
 * What each Settings panel does — reused verbatim in the tool descriptions and
 * the prompt.
 *
 * These read as the karigar's OWN WORDS, not as panel titles, and that is the
 * point. PR #152's QA logged "change my language" and "make the text bigger" as
 * refusals; PR #154 answered with a prompt rule, and the #154 retest logged both
 * again. A rule sits in the system prompt; THIS text sits in the tool
 * declaration, which is what the model is reading at the moment it decides
 * whether any tool applies. A request phrased as a change ("change", "switch",
 * "make it bigger") has to match the tool that serves it, or the model concludes
 * no tool fits and explains that it cannot help.
 */
export const SETTINGS_SECTION_HINTS: Record<SettingsVoiceSection, string> = {
  public_card: "show their card publicly, copy or open their share link",
  text_size:
    "the app's text size — use this for \"make the text bigger\", \"smaller text\", \"change the font size\", \"I can't read this\"",
  guide_auto_open:
    "the 'Always open Ask MahAcharya' switch — a start-up setting ONLY. NEVER for \"talk to MahAcharya'ji\", \"open MahAcharya'ji\", \"MahAcharya'ji se baat\" — those are open_acharya",
  language:
    `the APP's language — the language their screens and tasks open in (${SETTINGS_LANGUAGE_OPTIONS}) — use this for "change the app language", "make the app Bangla", "show my tasks in Hindi". NEVER for asking the Acharya to speak or reply in a language ("speak in Telugu", "Hindi mein bolo") — that is set_spoken_language and changes nothing on screen`,
  account: "logging out",
};

/**
 * The control that panel hands the karigar, in plain spoken words.
 *
 * QA's expected result for both settings findings is the same two-part thing:
 * land on the control AND say which one to tap. The second half was left to the
 * model, which has never seen the panel — so it either said nothing specific or
 * fell back to "you will have to do it yourself". The tool now returns this
 * string as `tap_hint` and the prompt tells the model to say it, so naming the
 * control does not depend on the model guessing what is on screen.
 */
export const SETTINGS_SECTION_CONTROLS: Record<SettingsVoiceSection, string> = {
  public_card: "the switch at the top of this panel",
  text_size: "the size you want — Normal, Large or Larger, the three Aa buttons here",
  guide_auto_open: "the switch on this panel",
  language: `the Task language dropdown here — tap it and pick from ${SETTINGS_LANGUAGE_OPTIONS}`,
  account: "the Log out button here",
};

// ── Normalisers ────────────────────────────────────────────────────────────
// Every one of these takes `unknown`: the values arrive from a spoken model
// turn or a streamed sentinel, so neither the type nor the casing is trustworthy.

export function normalizeProfileTab(raw: unknown): ProfileVoiceTab | null {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!v) return null;
  // "profile" is the internal id — accept it so a model that read the ?tab=
  // value off a URL still lands somewhere sensible.
  if (v === "profile") return "about";
  return (PROFILE_TABS as readonly string[]).includes(v) ? (v as ProfileVoiceTab) : null;
}

/**
 * Which Profile tab a `?tab=` value is SHOWING — absent or unrecognised is
 * `report`, not null, because a bare `/profile` opens on Report (see
 * `profileHref`). `normalizeProfileTab` answers "did they name a tab?", which is
 * a different question: it has to stay null for "open my profile" in general.
 * Comparing arrival state needs this one, or `/profile` and `/profile?tab=report`
 * read as two different screens when they are the same screen.
 */
export function profileTabFromParam(raw: unknown): ProfileVoiceTab {
  return normalizeProfileTab(raw) ?? "report";
}

export function normalizeSettingsSection(raw: unknown): SettingsVoiceSection | null {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!v) return null;
  // Pre-rename id. A voice token lives 30 minutes and a chat sentinel or deep
  // link can carry the old value indefinitely, so it keeps landing on the panel.
  if (v === "mahacharya") return "guide_auto_open";
  return (SETTINGS_SECTIONS as readonly string[]).includes(v)
    ? (v as SettingsVoiceSection)
    : null;
}

// ── Hrefs ──────────────────────────────────────────────────────────────────

export const PROFILE_PATH = "/profile";
export const SETTINGS_PATH = "/settings";
/** Pre-move path, still redirected — see app/(app)/profile/settings/page.tsx. */
export const LEGACY_SETTINGS_PATH = "/profile/settings";

/**
 * A bare `/profile` (no tab) is deliberately left alone: it lands on Report,
 * exactly like tapping the profile menu does. Voice with no tab named should
 * behave like a tap, not like a different product.
 */
export function profileHref(tab: ProfileVoiceTab | null): string {
  if (!tab) return PROFILE_PATH;
  return `${PROFILE_PATH}?tab=${PROFILE_TAB_PARAM[tab]}`;
}

export function settingsHref(section: SettingsVoiceSection | null): string {
  if (!section) return SETTINGS_PATH;
  return `${SETTINGS_PATH}?section=${section}`;
}

/** DOM id for a Settings panel, so a deep link can scroll to it. */
export function settingsSectionDomId(section: SettingsVoiceSection): string {
  return `setting-${section}`;
}

/**
 * Marks the ONE control inside a panel that arriving by voice should focus —
 * the radiogroup, the switch, the button. Scrolling a panel into view and
 * ringing its border is not "the control is reached and focused", which is what
 * QA's expected result asks for on both settings findings: nothing had keyboard
 * or screen-reader focus, so a karigar arriving by voice still had to find the
 * control by eye. An attribute rather than five more DOM ids: the panel is
 * already addressable, and this only has to be findable INSIDE it.
 */
export const SETTINGS_CONTROL_ATTR = "data-setting-control";

// ── Arrival state ──────────────────────────────────────────────────────────

/**
 * Is the karigar ALREADY looking at what this href points at?
 *
 * PR #152's QA found "show my report" — said while Report was open — flickering
 * the screen three or four times and the assistant announcing a move that never
 * happened. Every one of those redraws was a real navigation to the screen the
 * karigar was already standing on. So the tools now ask this first, and a yes
 * means: change nothing, and tell them they are already there.
 *
 * A screen href with NO tab/section named counts as already-there when they are
 * anywhere on that screen: "open my profile" from the Requests tab is a request
 * for the screen, not an instruction to go back to Report.
 *
 * Takes the location apart rather than reading `window` so the tool handlers,
 * the sentinel runner and a test can all ask the same question.
 */
export function isAlreadyShowing(
  href: string,
  currentPath: string,
  currentSearch: string,
): boolean {
  const [rawPath = "", rawQuery = ""] = href.split("?");
  const path = trimTrailingSlash(rawPath);
  if (path !== trimTrailingSlash(currentPath)) return false;

  const asked = new URLSearchParams(rawQuery);
  const here = new URLSearchParams(currentSearch);

  if (path === PROFILE_PATH) {
    const tab = normalizeProfileTab(asked.get("tab"));
    return !tab || tab === profileTabFromParam(here.get("tab"));
  }
  if (path === SETTINGS_PATH) {
    const section = normalizeSettingsSection(asked.get("section"));
    return !section || section === normalizeSettingsSection(here.get("section"));
  }
  return asked.toString() === here.toString();
}

function trimTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}
