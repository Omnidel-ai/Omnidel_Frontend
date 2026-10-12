/**
 * Single source of truth for the languages Acharya supports.
 *
 * Client-safe: no "server-only", no DB access. The DB table
 * `gunakul.mst_languages` decides which languages are *switched on*
 * (see lib/server/languages.ts); this file decides which languages the
 * code *knows how to handle*. A code that is active in the DB but missing
 * here falls back to DEFAULT_LANG.
 *
 * Adding a language:
 *   1. Add an entry to LANGUAGES below.
 *   2. Run the typecheck. Every `Record<Lang, …>` (UI strings, prompt rules,
 *      formatters) that is now missing a value becomes a compile error —
 *      fill each one in.
 *   3. Insert the code into gunakul.mst_languages to switch it on.
 */

export type LanguageConfig = {
  /** ISO 639-1 code, also the value stored in mst_users.preferred_lang. */
  code: string;
  /** English name, used in prompts ("Write ALL user-facing text in …"). */
  name: string;
  /** Name in the language itself, for language pickers. */
  nativeName: string;
  /** BCP-47 code pinned on Gemini Live `speech_config.language_code`. */
  liveCode: string;
  /** Code sent as the `language` hint to OpenAI speech-to-text. */
  sttCode: string;
  /**
   * Locale for dates shown to the user. en/hi/bn/te stay on "en-IN" to match
   * existing behaviour; fr uses "fr-FR" (e.g. "21 sept. 2026"); am uses
   * "am-ET", which Intl renders on the Gregorian calendar (e.g. "ሴፕቴ 21 2026"),
   * so task deadlines line up with what OmniDel stores.
   */
  dateLocale: string;
  /** Text direction. Every current language is left-to-right. */
  dir: "ltr" | "rtl";
  /**
   * Writing system. Latin-script languages (en, fr) never need names or
   * personas transliterated; hi/bn/te/am do, and some code polls until they are.
   */
  script: "latin" | "devanagari" | "bengali" | "telugu" | "ethiopic";
  /**
   * Anam speech-recognition `languageCode` for ephemeral personas. null means
   * "don't send one" (Anam falls back to the org default) — the existing
   * behaviour for en/hi/bn, left untouched. te is null too: Anam does not list
   * Telugu, and its API rejects an explicit unsupported code. am is null for
   * the same reason: Anam does not list Amharic.
   */
  anamCode: string | null;
};

export const LANGUAGES = {
  en: {
    code: "en",
    name: "English",
    nativeName: "English",
    liveCode: "en-IN",
    sttCode: "en",
    dateLocale: "en-IN",
    dir: "ltr",
    script: "latin",
    anamCode: null,
  },
  hi: {
    code: "hi",
    name: "Hindi",
    nativeName: "हिन्दी",
    liveCode: "hi-IN",
    sttCode: "hi",
    dateLocale: "en-IN",
    dir: "ltr",
    script: "devanagari",
    anamCode: null,
  },
  bn: {
    code: "bn",
    name: "Bengali",
    nativeName: "বাংলা",
    liveCode: "bn-IN",
    sttCode: "bn",
    dateLocale: "en-IN",
    dir: "ltr",
    script: "bengali",
    anamCode: null,
  },
  fr: {
    code: "fr",
    name: "French",
    nativeName: "Français",
    liveCode: "fr-FR",
    sttCode: "fr",
    dateLocale: "fr-FR",
    dir: "ltr",
    script: "latin",
    anamCode: "fr",
  },
  te: {
    code: "te",
    name: "Telugu",
    nativeName: "తెలుగు",
    liveCode: "te-IN",
    sttCode: "te",
    dateLocale: "en-IN",
    dir: "ltr",
    script: "telugu",
    anamCode: null,
  },
  am: {
    code: "am",
    name: "Amharic",
    nativeName: "አማርኛ",
    // Gemini Live lists Amharic as plain "am" (no region variant).
    liveCode: "am",
    sttCode: "am",
    dateLocale: "am-ET",
    dir: "ltr",
    script: "ethiopic",
    anamCode: null,
  },
} as const satisfies Record<string, LanguageConfig>;

export type Lang = keyof typeof LANGUAGES;

/** Every supported code, in registry order. Non-empty tuple so it works with `z.enum`. */
export const SUPPORTED_LANGS = Object.keys(LANGUAGES) as [Lang, ...Lang[]];

export const DEFAULT_LANG: Lang = "en";

/** Date locale for text that is not tied to a user's language (AI prompts, logs). */
export const DEFAULT_DATE_LOCALE = LANGUAGES[DEFAULT_LANG].dateLocale;

/** True when the language is written in Latin script (no transliteration needed). */
export function isLatinScript(lang: Lang): boolean {
  return LANGUAGES[lang].script === "latin";
}

type IndicScript = Exclude<LanguageConfig["script"], "latin">;

/**
 * Unicode block per non-Latin script. The one place these ranges live: before
 * Telugu, five files each carried their own Bengali/Devanagari regex, and any
 * one that missed a new script would quietly treat it as "not localized yet".
 */
const SCRIPT_RE: Record<IndicScript, RegExp> = {
  devanagari: /[\u0900-\u097F]/,
  bengali: /[\u0980-\u09FF]/,
  telugu: /[\u0C00-\u0C7F]/,
  // Ethiopic (Ge'ez) + Ethiopic Supplement, Extended and Extended-A.
  ethiopic: /[\u1200-\u139F\u2D80-\u2DDF\uAB00-\uAB2F]/,
};

/**
 * Detection order: Bengali, Devanagari, Telugu — the order the old checks
 * used — then Ethiopic. "Indic" in these names now means "non-Latin script
 * the app knows"; Ethiopic is not Indic but needs the same handling.
 */
const SCRIPT_DETECT_ORDER: IndicScript[] = ["bengali", "devanagari", "telugu", "ethiopic"];

/**
 * True when `text` is written in `lang`'s own script. Latin-script languages
 * (en, fr) always pass: script cannot tell them apart, so it proves nothing.
 */
export function isInLanguageScript(text: string, lang: Lang): boolean {
  const script = LANGUAGES[lang].script;
  return script === "latin" ? true : SCRIPT_RE[script].test(text);
}

/** True when `text` contains any non-Latin script the app knows. */
export function hasIndicScript(text: string): boolean {
  return SCRIPT_DETECT_ORDER.some((script) => SCRIPT_RE[script].test(text));
}

/** The app language whose script `text` uses, or null for Latin/unknown text. */
export function detectIndicLang(text: string): Lang | null {
  for (const script of SCRIPT_DETECT_ORDER) {
    if (!SCRIPT_RE[script].test(text)) continue;
    const hit = SUPPORTED_LANGS.find((code) => LANGUAGES[code].script === script);
    if (hit) return hit;
  }
  return null;
}

export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(LANGUAGES, value);
}

/** Exact-match conversion: returns `value` if it is a supported code, else `fallback`. */
export function toLang(value: unknown, fallback: Lang = DEFAULT_LANG): Lang {
  return isLang(value) ? value : fallback;
}

/** Lenient conversion for user/profile input: trims and lowercases before matching. */
export function normalizeLang(value: unknown, fallback: Lang = DEFAULT_LANG): Lang {
  const code = typeof value === "string" ? value.trim().toLowerCase() : "";
  return toLang(code, fallback);
}

// ── Voice-only languages ────────────────────────────────────────────────────
//
// The languages an Acharya can SPEAK in a live voice session. This is a
// superset of the app languages above: a voice language needs only a Gemini
// Live `speech_config.language_code`, not a full set of UI strings, so a
// language can be spoken here without the app's screens being translated into
// it. Telugu started here (PR #210) and is now a full app language above; the
// mechanism stays for the next language that is spoken before it is translated.

export type VoiceLanguageConfig = {
  code: string;
  /** English name, used in prompts ("speak in Telugu"). */
  name: string;
  /** Name in the language itself, for the picker. */
  nativeName: string;
  /** BCP-47 code pinned on Gemini Live `speech_config.language_code`. */
  liveCode: string;
};

export const VOICE_LANGUAGES = {
  ...(Object.fromEntries(
    SUPPORTED_LANGS.map((code) => {
      const l = LANGUAGES[code];
      return [code, { code: l.code, name: l.name, nativeName: l.nativeName, liveCode: l.liveCode }];
    }),
  ) as Record<Lang, VoiceLanguageConfig>),
} satisfies Record<string, VoiceLanguageConfig>;

export type VoiceLang = keyof typeof VOICE_LANGUAGES;

/** Every speakable code: the app languages first, then voice-only ones. */
export const SUPPORTED_VOICE_LANGS = Object.keys(VOICE_LANGUAGES) as [VoiceLang, ...VoiceLang[]];

/** Speakable languages that have no app screens yet. Empty while every voice language is also an app language. */
// Typed as VoiceLang[] on purpose: while every voice language is also an app
// language, an isLang() type guard here would narrow the result to never[].
export const VOICE_ONLY_LANGS: VoiceLang[] = SUPPORTED_VOICE_LANGS.filter(
  (code) => !(SUPPORTED_LANGS as readonly string[]).includes(code),
);

export function isVoiceLang(value: unknown): value is VoiceLang {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(VOICE_LANGUAGES, value);
}
