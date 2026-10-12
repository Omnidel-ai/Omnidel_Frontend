/**
 * What KIND of work a task is — the trade, not the state.
 *
 * The board already says the state four ways (the lane tab the karigar is
 * standing on, the card tint, the done tick, the due chip). What no card could
 * say was what the work IS: a "To do" list rendered seven identical clipboards
 * whether the job was a UI tweak or a plumbing call-out.
 *
 * Isomorphic on purpose (no "use client"), same rule as `lane-ids.ts`: the
 * server pages that seed a board classify with this too.
 */

export type TaskCategoryId =
  | "voice"
  | "planting"
  | "electrical"
  | "plumbing"
  | "labour"
  | "testing"
  | "ui"
  | "dev"
  | "general";

/**
 * Terms per category, most specific category first — ORDER IS THE TIE-BREAK.
 * "Test PR #512 Icons visible when sharing task" hits testing, dev and ui all
 * in its title; testing sits above both, which is what the title actually says
 * the work is.
 *
 * Latin terms match on word boundaries with a tolerated plural/gerund suffix
 * ("plant" covers plants/planting). Devanagari and Bengali terms match as plain
 * substrings — see `toPattern`.
 *
 * Both spellings are listed wherever Hindi is written with and without the
 * nukta (आवाज़/आवाज, मजदूर/मज़दूर); they are different strings to a regex.
 */
const CATEGORY_TERMS: ReadonlyArray<readonly [TaskCategoryId, readonly string[]]> = [
  ["voice", [
    "voice", "mic", "microphone", "speech", "spoken", "audio", "tts", "stt",
    "transcript", "transcription", "caption", "utterance", "wake word",
    "आवाज़", "आवाज", "माइक", "बोलना", "ভয়েস", "মাইক", "কণ্ঠ",
  ]],
  ["planting", [
    "plant", "plantation", "sapling", "seedling", "nursery", "sow",
    "tree", "garden", "gardening", "vatika", "compost", "manure", "irrigation",
    "watering", "pruning", "harvest", "soil", "crop",
    "पौधा", "पौधे", "रोपण", "पेड़", "बाग", "बगीचा", "नर्सरी", "बीज", "खाद", "सिंचाई",
    "গাছ", "চারা", "বাগান", "বীজ", "সেচ",
  ]],
  ["electrical", [
    "electrician", "electrical", "electric", "electricity", "wiring", "rewire",
    "socket", "mcb", "voltage", "fuse", "bulb", "lighting", "inverter",
    "short circuit", "earthing", "meter reading",
    "बिजली", "इलेक्ट्रिक", "इलेक्ट्रीशियन", "वायरिंग", "बल्ब",
    "বিদ্যুৎ", "ইলেকট্রিক", "ইলেকট্রিশিয়ান", "তার",
  ]],
  ["plumbing", [
    "plumber", "plumbing", "pipe", "pipeline", "faucet", "leak", "leakage",
    "drain", "drainage", "valve", "sink", "toilet", "sanitary", "borewell",
    "water tank", "overhead tank", "flush", "geyser",
    "नल", "पाइप", "प्लंबर", "प्लम्बर", "टंकी", "रिसाव", "नाली",
    "পাইপ", "প্লাম্বার", "লিক", "নর্দমা",
  ]],
  ["labour", [
    "labour", "labor", "mazdoor", "majdoor", "mazdur", "shramik", "coolie",
    "helper", "headcount", "muster", "wage", "loading", "unloading",
    "manpower", "attendance", "haziri",
    "मजदूर", "मज़दूर", "श्रमिक", "मजदूरी", "हाजिरी", "मजूर",
    "শ্রমিক", "মজুর", "মজুরি", "হাজিরা",
  ]],
  ["testing", [
    "test", "qa", "retest", "verify", "verification", "validate", "regression",
    "e2e", "smoke", "sanity", "test case", "testcase", "reproduce", "repro",
    "जांच", "जाँच", "परीक्षण", "टेस्ट",
    "টেস্ট", "পরীক্ষা", "যাচাই",
  ]],
  ["ui", [
    "ui", "ux", "icon", "design", "redesign", "layout", "screen", "css",
    "style", "styling", "theme", "font", "typography", "colour", "color",
    "button", "spacing", "alignment", "responsive", "animation", "mockup",
    "wireframe", "visual",
    "डिज़ाइन", "डिजाइन", "आइकन", "स्क्रीन", "रंग",
    "ডিজাইন", "আইকন", "স্ক্রিন", "রঙ",
  ]],
  ["dev", [
    "code", "api", "bug", "fix", "deploy", "deployment", "refactor", "backend",
    // No "build" or "branch": both are ordinary field words ("build the fence",
    // "cut the branches") long before they are CI words.
    "frontend", "database", "migration", "endpoint", "app", "merge",
    "commit", "crash", "error", "pr", "sdk", "cache", "query",
    "कोड", "ऐप", "बग",
    "কোড", "অ্যাপ", "বাগ",
  ]],
];

/**
 * `\b` is ASCII-word based: it never fires beside a Devanagari or Bengali
 * letter, so `\bपौधा\b` matches nothing at all. Non-Latin terms therefore match
 * as plain substrings, which is also the right call for scripts that do not
 * space-separate the way English does.
 *
 * No lookbehind anywhere — this app has to run on old Android WebViews.
 */
function toPattern(term: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return /^[\x20-\x7e]+$/.test(term)
    ? new RegExp(`\\b${escaped}(?:e?s|ing|ed)?\\b`, "i")
    : new RegExp(escaped, "i");
}

const CATEGORY_PATTERNS: ReadonlyArray<readonly [TaskCategoryId, readonly RegExp[]]> =
  CATEGORY_TERMS.map(([id, terms]) => [id, terms.map(toPattern)] as const);

/** A title says what the work is; a description only hints at it. */
const TITLE_WEIGHT = 3;
const BODY_WEIGHT = 1;

export type TaskCategoryInput = {
  title?: string | null;
  description?: string | null;
  taskTypeName?: string | null;
};

/**
 * Board and workspace names are deliberately NOT read here. Every card on a
 * "Development" board would score dev, and every card in a "team visibility
 * test" workspace would score testing — which is how seven different jobs end
 * up wearing one icon again, just a different one.
 */
export function taskCategory(task: TaskCategoryInput): TaskCategoryId {
  const title = task.title ?? "";
  const body = `${task.description ?? ""} ${task.taskTypeName ?? ""}`;

  let best: TaskCategoryId = "general";
  let bestScore = 0;

  for (const [id, patterns] of CATEGORY_PATTERNS) {
    let score = 0;
    for (const pattern of patterns) {
      if (pattern.test(title)) score += TITLE_WEIGHT;
      else if (pattern.test(body)) score += BODY_WEIGHT;
    }
    // Strictly greater: a tie leaves the earlier, more specific category in
    // place rather than letting the broad "dev" bucket swallow it.
    if (score > bestScore) {
      best = id;
      bestScore = score;
    }
  }

  return best;
}
