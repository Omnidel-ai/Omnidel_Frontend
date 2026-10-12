import { type VoiceLang } from "@/acharya/lib/i18n/registry";

type LanguageAlias = { lang: VoiceLang; names: string[] };

const LANGUAGE_ALIASES: LanguageAlias[] = [
  { lang: "en", names: ["english", "angrezi", "እንግሊዝኛ"] },
  { lang: "hi", names: ["hindi", "हिंदी", "हिन्दी"] },
  { lang: "bn", names: ["bengali", "bangla", "বাংলা"] },
  { lang: "fr", names: ["french", "français", "francais"] },
  { lang: "te", names: ["telugu", "తెలుగు"] },
  { lang: "am", names: ["amharic", "amharigna", "amarigna", "አማርኛ"] },
];

const LANGUAGE_NAME = LANGUAGE_ALIASES.flatMap(({ lang, names }) =>
  names.map((name) => ({ lang, name })),
).sort((a, b) => b.name.length - a.name.length);
const LANGUAGE_NAMES = LANGUAGE_NAME.map(({ name }) => name).join("|");

/**
 * Return a language only for a direct request to change this conversation.
 * A language mention by itself is not a preference (for example,
 * "tell me about Hindi").
 */
export function requestedConversationLang(text: string): VoiceLang | null {
  if (typeof text !== "string") return null;
  const value = text.trim().replace(/\s+/g, " ");
  if (!value) return null;

  // Direct requests: "reply in Hindi", "talk to me in Telugu", "speak English".
  const direct = new RegExp(
    `^(?:please\\s+|(?:can|could)\\s+(?:you|we)\\s+|let's\\s+|i\\s+want\\s+(?:you\\s+)?to\\s+|from\\s+now\\s+)?` +
      `(?:talk|speak|reply|respond|answer|write|communicate|continue)\\b` +
      `(?:(?!\\b(?:about|learn|teach)\\b).){0,48}?` +
      `(?:\\b(?:in|using|with)\\s+)?(?:the\\s+)?(${LANGUAGE_NAMES})(?![\\p{L}\\p{M}])`,
    "iu",
  );
  const directMatch = direct.exec(value);
  if (directMatch) {
    return LANGUAGE_NAME.find(({ name }) => name.toLowerCase() === directMatch[1].toLowerCase())?.lang ?? null;
  }

  // Common English-spelling transliterations such as "Hindi mein baat karo".
  const indic = new RegExp(
    `^(?:please\\s+)?(${LANGUAGE_NAMES})\\s+(?:mein|me|lo|లో|में)\\s+` +
      `(?:baat\\s+)?(?:karo|bolo|boliye|matladandi|మాట్లాడండి|बोलो|बोलिए|reply|respond|speak|talk)(?![\\p{L}\\p{M}])`,
    "iu",
  );
  const indicMatch = indic.exec(value);
  if (indicMatch) {
    return LANGUAGE_NAME.find(({ name }) => name.toLowerCase() === indicMatch[1].toLowerCase())?.lang ?? null;
  }

  // Amharic: "በአማርኛ ተናገር" / "በእንግሊዝኛ መልስልኝ" — the preposition በ ("in")
  // is written joined to the language name, so the English patterns miss it.
  const amharic = new RegExp(
    `^(?:እባክ(?:ህ|ሽ|ዎ)\\s+)?በ?(${LANGUAGE_NAMES})\\s+` +
      `(?:ተናገር|ተናገሪ|ተናገሩ|ይናገሩ|አውራ|አውሪ|አውሩ|ያውሩ|መልስ|መልሺ|መልሱ|ይመልሱ|ጻፍ|ጻፊ|ጻፉ|ይጻፉ|አነጋግረኝ|አነጋግሪኝ|ያነጋግሩኝ)`,
    "iu",
  );
  const amharicMatch = amharic.exec(value);
  if (amharicMatch) {
    return LANGUAGE_NAME.find(({ name }) => name.toLowerCase() === amharicMatch[1].toLowerCase())?.lang ?? null;
  }

  return null;
}
