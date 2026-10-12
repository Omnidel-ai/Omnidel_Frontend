/**
 * Offline content localization for karigar UI (en → hi/bn/te/am).
 * Used when Gemini quota fails or for first-paint master data / notices.
 * Exact maps + phrase tokens — no network.
 */
import type { Lang } from "@/acharya/lib/store";
import { isInLanguageScript, isLatinScript } from "@/acharya/lib/i18n/registry";

const BENGALI_RE = /[\u0980-\u09FF]/;
const DEVANAGARI_RE = /[\u0900-\u097F]/;
const TELUGU_RE = /[\u0C00-\u0C7F]/;
const ETHIOPIC_RE = /[\u1200-\u139F\u2D80-\u2DDF\uAB00-\uAB2F]/;

/** Exact string → localized (case-sensitive preferred keys first). */
const EXACT_BN: Record<string, string> = {
  // Trades / roles
  "General Labour": "সাধারণ শ্রম",
  "General Labor": "সাধারণ শ্রম",
  Admin: "অ্যাডমিন",
  Administrator: "অ্যাডমিন",
  Worker: "কর্মী",
  Karigar: "কারিগর",
  // Places
  Mumbai: "মুম্বই",
  Bombay: "মুম্বই",
  Maharashtra: "মহারাষ্ট্র",
  Nalasopara: "নালাসোপারা",
  "Nala Sopara": "নালা সোপারা",
  Kolkata: "কলকাতা",
  Calcutta: "কলকাতা",
  Delhi: "দিল্লি",
  "New Delhi": "নয়া দিল্লি",
  Bangalore: "বেঙ্গালুরু",
  Bengaluru: "বেঙ্গালুরু",
  Chennai: "চেন্নাই",
  Hyderabad: "হায়দ্রাবাদ",
  Pune: "পুণে",
  // Orgs
  "KarmYog Vatika": "কর্মযোগ বাতিকা",
  KarmYog: "কর্মযোগ",
  // System actors
  System: "সিস্টেম",
  // Notifications chrome fragments (natural BN, not transliteration)
  Notifications: "নোটিশ",
  Notification: "নোটিশ",
  "Your KarmYog link has ended": "কর্মযোগ-এর সঙ্গে আপনার যোগ শেষ হয়েছে",
  // QA: known task / series titles
  "Dr. Nabarun Ghoshal – Satya Sandhani Series Video Editing":
    "ডা. নবারুণ ঘোষাল – সত্য সন্ধানী সিরিজ ভিডিও সম্পাদনা",
  "Satya Sandhani Series Video Editing": "সত্য সন্ধানী সিরিজ ভিডিও সম্পাদনা",
  // Common notice bodies / titles fragments
  "Poster on 4 Missions": "৪টি মিশনে পোস্টার",
  "Lazy loading on home screen": "হোম স্ক্রিনে ধীর লোডিং",
  "#PR261 — board ↔ media project link": "#PR261 — বোর্ড ↔ মিডিয়া প্রজেক্ট লিংক",
  "#PR250 — move a project between teams": "#PR250 — টিমের মধ্যে প্রজেক্ট সরানো",
  "#PR272 — Feat/acharya rating and review": "#PR272 — আচার্য রেটিং ও রিভিউ",
};

const EXACT_HI: Record<string, string> = {
  "General Labour": "सामान्य श्रम",
  "General Labor": "सामान्य श्रम",
  Admin: "एडमिन",
  Administrator: "एडमिन",
  Worker: "वर्कर",
  Karigar: "कारीगर",
  Mumbai: "मुंबई",
  Bombay: "मुंबई",
  Maharashtra: "महाराष्ट्र",
  Nalasopara: "नालासोपारा",
  "Nala Sopara": "नाला सोपारा",
  Kolkata: "कोलकाता",
  Calcutta: "कोलकाता",
  Delhi: "दिल्ली",
  "New Delhi": "नई दिल्ली",
  Bangalore: "बेंगलुरु",
  Bengaluru: "बेंगलुरु",
  Chennai: "चेन्नई",
  Hyderabad: "हैदराबाद",
  Pune: "पुणे",
  "KarmYog Vatika": "कर्मयोग वाटिका",
  KarmYog: "कर्मयोग",
  System: "सिस्टम",
  "Poster on 4 Missions": "4 मिशन पर पोस्टर",
  "Lazy loading on home screen": "होम स्क्रीन पर लेज़ी लोडिंग",
  "#PR261 — board ↔ media project link": "#PR261 — बोर्ड ↔ मीडिया प्रोजेक्ट लिंक",
  "#PR250 — move a project between teams": "#PR250 — टीमों के बीच प्रोजेक्ट स्थानांतरण",
  "#PR272 — Feat/acharya rating and review": "#PR272 — आचार्य रेटिंग और रिव्यू",
};

/** Longer phrases first (persona + free text). */
const PHRASE_BN: Array<[RegExp, string]> = [
  [/MahAcharya'?j?i?\s*[–—-]\s*Founding Acharya of Karm[Yy]og for (?:the )?21st Century/gi,
    "মহাচার্যজি – Karmyog for 21st Century-এর প্রতিষ্ঠাতা আচার্য"],
  [/Founding Acharya of Karm[Yy]og for (?:the )?21st Century/gi,
    "Karmyog for 21st Century-এর প্রতিষ্ঠাতা আচার্য"],
  [/Dr\.\s*Nabarun\s*Ghoshal/gi, "ডা. নবারুণ ঘোষাল"],
  [/\bDr\.\s*/gi, "ডা. "],
  [/Satya\s*Sandhani/gi, "সত্য সন্ধানী"],
  [/Sandhani/gi, "সন্ধানী"],
  [/Video\s*Editing/gi, "ভিডিও সম্পাদনা"],
  [/AI finance mentor/gi, "এআই অর্থনীতি শিক্ষক"],
  [/finance mentor/gi, "অর্থনীতি শিক্ষক"],
  [/in Gunakul/gi, "গুণাকুলে"],
  [/Gunakul/gi, "গুণাকুল"],
  [/bank employees/gi, "ব্যাংক কর্মী"],
  [/retail investors/gi, "খুচরা বিনিয়োগকারী"],
  [/how to invest wisely/gi, "কীভাবে বুদ্ধিমানে বিনিয়োগ করবেন"],
  [/invest wisely/gi, "বুদ্ধিমানে বিনিয়োগ"],
  [/using\b/gi, "ব্যবহার করে"],
  [/teaches\b/gi, "শেখান"],
  [/\bhow to\b/gi, "কীভাবে"],
  [/MFDs?/gi, "এমএফডি"],
  [/assigned you/gi, "আপনাকে দায়িত্ব দিয়েছেন"],
  [/Poster on (\d+) Missions?/gi, "$1টি মিশনে পোস্টার"],
  [/Lazy loading on home screen/gi, "হোম স্ক্রিনে ধীর লোডিং"],
  [/board\s*↔\s*media project link/gi, "বোর্ড ↔ মিডিয়া প্রজেক্ট লিংক"],
  [/move a project between teams/gi, "টিমের মধ্যে প্রজেক্ট সরানো"],
  [/Feat\/?acharya rating and review/gi, "আচার্য রেটিং ও রিভিউ"],
  [/MahAcharya\.?['']?Ji/gi, "মহাচার্যজি"],
  [/MahAcharya/gi, "মহাচার্য"],
  [/Acharya/gi, "আচার্য"],
  [/Business/gi, "ব্যবসা"],
  [/Vivek/gi, "বিবেক"],
  [/Neeranjan/gi, "নীরঞ্জন"],
  [/Soumyajit/gi, "সৌম্যজিৎ"],
  [/Subhas/gi, "সুভাষ"],
  [/Khushi Pandey/gi, "খুশি পান্ডে"],
  [/KarmYog Vatika/gi, "কর্মযোগ বাতিকা"],
  [/KarmYog/gi, "কর্মযোগ"],
  [/General Labour/gi, "সাধারণ শ্রম"],
  [/Maharashtra/gi, "মহারাষ্ট্র"],
  [/Mumbai/gi, "মুম্বই"],
  [/Nalasopara/gi, "নালাসোপারা"],
  [/Kolkata/gi, "কলকাতা"],
  [/\bSystem\b/gi, "সিস্টেম"],
  [/\bAdmin\b/gi, "অ্যাডমিন"],
  [/\bWorker\b/gi, "কর্মী"],
  [/\bNotifications?\b/gi, "নোটিশ"],
];

const PHRASE_HI: Array<[RegExp, string]> = [
  [/AI finance mentor/gi, "एआई फाइनेंस मेंटर"],
  [/finance mentor/gi, "फाइनेंस मेंटर"],
  [/in Gunakul/gi, "गुणाकुल में"],
  [/Gunakul/gi, "गुणाकुल"],
  [/bank employees/gi, "बैंक कर्मचारी"],
  [/retail investors/gi, "खुदरा निवेशक"],
  [/how to invest wisely/gi, "समझदारी से निवेश कैसे करें"],
  [/invest wisely/gi, "समझदारी से निवेश"],
  [/using\b/gi, "का उपयोग करके"],
  [/teaches\b/gi, "सिखाते हैं"],
  [/\bhow to\b/gi, "कैसे"],
  [/MFDs?/gi, "एमएफडी"],
  [/assigned you/gi, "ने आपको असाइन किया"],
  [/Poster on (\d+) Missions?/gi, "$1 मिशन पर पोस्टर"],
  [/Lazy loading on home screen/gi, "होम स्क्रीन पर लेज़ी लोडिंग"],
  [/board\s*↔\s*media project link/gi, "बोर्ड ↔ मीडिया प्रोजेक्ट लिंक"],
  [/move a project between teams/gi, "टीमों के बीच प्रोजेक्ट स्थानांतरण"],
  [/Feat\/?acharya rating and review/gi, "आचार्य रेटिंग और रिव्यू"],
  [/MahAcharya\.?['']?Ji/gi, "महाचार्यजी"],
  [/MahAcharya/gi, "महाचार्य"],
  [/Acharya/gi, "आचार्य"],
  [/Business/gi, "बिजनेस"],
  [/Vivek/gi, "विवेक"],
  [/Neeranjan/gi, "नीरंजन"],
  [/Soumyajit/gi, "सौम्यजीत"],
  [/Subhas/gi, "सुभाष"],
  [/Khushi Pandey/gi, "खुशी पांडे"],
  [/KarmYog Vatika/gi, "कर्मयोग वाटिका"],
  [/KarmYog/gi, "कर्मयोग"],
  [/General Labour/gi, "सामान्य श्रम"],
  [/Maharashtra/gi, "महाराष्ट्र"],
  [/Mumbai/gi, "मुंबई"],
  [/Nalasopara/gi, "नालासोपारा"],
  [/Kolkata/gi, "कोलकाता"],
  [/\bSystem\b/gi, "सिस्टम"],
  [/\bAdmin\b/gi, "एडमिन"],
  [/\bWorker\b/gi, "वर्कर"],
];

/**
 * Telugu: names, places, roles and brands only — sound-carrying values. Unlike
 * the bn/hi maps there are no meaning-carrying phrases yet, which is why
 * English SENTENCES are left alone for Telugu (see SENTENCE_PHRASE_MAPS).
 */
const EXACT_TE: Record<string, string> = {
  "General Labour": "సాధారణ కూలీ",
  "General Labor": "సాధారణ కూలీ",
  Admin: "అడ్మిన్",
  Administrator: "అడ్మిన్",
  Worker: "కార్మికుడు",
  Karigar: "కారిగర్",
  Mumbai: "ముంబై",
  Bombay: "ముంబై",
  Maharashtra: "మహారాష్ట్ర",
  Nalasopara: "నాలాసోపారా",
  "Nala Sopara": "నాలా సోపారా",
  Kolkata: "కోల్కతా",
  Calcutta: "కోల్కతా",
  Delhi: "ఢిల్లీ",
  "New Delhi": "న్యూ ఢిల్లీ",
  Bangalore: "బెంగళూరు",
  Bengaluru: "బెంగళూరు",
  Chennai: "చెన్నై",
  Hyderabad: "హైదరాబాద్",
  Secunderabad: "సికింద్రాబాద్",
  Pune: "పుణె",
  Telangana: "తెలంగాణ",
  "Andhra Pradesh": "ఆంధ్రప్రదేశ్",
  Vijayawada: "విజయవాడ",
  Visakhapatnam: "విశాఖపట్నం",
  Vizag: "విశాఖపట్నం",
  Warangal: "వరంగల్",
  Guntur: "గుంటూరు",
  Tirupati: "తిరుపతి",
  Nellore: "నెల్లూరు",
  Karimnagar: "కరీంనగర్",
  "KarmYog Vatika": "కర్మయోగ్ వాటిక",
  KarmYog: "కర్మయోగ్",
  System: "సిస్టమ్",
};

const PHRASE_TE: Array<[RegExp, string]> = [
  [/\bDr\.\s*/gi, "డా. "],
  [/MahAcharya\.?['’]?Ji/gi, "మహాచార్యజీ"],
  [/MahAcharya/gi, "మహాచార్య"],
  [/Acharya/gi, "ఆచార్య"],
  [/Vivek/gi, "వివేక్"],
  [/Neeranjan/gi, "నీరంజన్"],
  [/Soumyajit/gi, "సౌమ్యజిత్"],
  [/Subhas/gi, "సుభాష్"],
  [/Khushi Pandey/gi, "ఖుషీ పాండే"],
  [/Gunakul/gi, "గుణకుల్"],
  [/KarmYog Vatika/gi, "కర్మయోగ్ వాటిక"],
  [/KarmYog/gi, "కర్మయోగ్"],
  [/General Labour/gi, "సాధారణ కూలీ"],
  [/Maharashtra/gi, "మహారాష్ట్ర"],
  [/Mumbai/gi, "ముంబై"],
  [/Nalasopara/gi, "నాలాసోపారా"],
  [/Kolkata/gi, "కోల్కతా"],
  [/Hyderabad/gi, "హైదరాబాద్"],
  [/\bSystem\b/gi, "సిస్టమ్"],
  [/\bAdmin\b/gi, "అడ్మిన్"],
  [/\bWorker\b/gi, "కార్మికుడు"],
];

/**
 * Amharic: like Telugu, names, places, roles and brands only — no
 * meaning-carrying phrase map yet, so English sentences stay English offline.
 * Ethiopian cities/regions are included for karigars registered in Ethiopia.
 */
const EXACT_AM: Record<string, string> = {
  "General Labour": "የቀን ሠራተኛ",
  "General Labor": "የቀን ሠራተኛ",
  Admin: "አስተዳዳሪ",
  Administrator: "አስተዳዳሪ",
  Worker: "ሠራተኛ",
  Karigar: "ካሪጋር",
  "Addis Ababa": "አዲስ አበባ",
  "Addis Abeba": "አዲስ አበባ",
  "Dire Dawa": "ድሬዳዋ",
  Oromia: "ኦሮሚያ",
  Amhara: "አማራ",
  Tigray: "ትግራይ",
  Sidama: "ሲዳማ",
  Afar: "አፋር",
  Somali: "ሶማሌ",
  "Bahir Dar": "ባሕር ዳር",
  Gondar: "ጎንደር",
  Mekelle: "መቀሌ",
  Hawassa: "ሐዋሳ",
  Adama: "አዳማ",
  Jimma: "ጅማ",
  Dessie: "ደሴ",
  Harar: "ሐረር",
  Mumbai: "ሙምባይ",
  Bombay: "ሙምባይ",
  Maharashtra: "ማሃራሽትራ",
  Nalasopara: "ናላሶፓራ",
  "Nala Sopara": "ናላ ሶፓራ",
  Kolkata: "ኮልካታ",
  Calcutta: "ኮልካታ",
  Delhi: "ዴልሂ",
  "New Delhi": "ኒው ዴልሂ",
  Bangalore: "ባንጋሎር",
  Bengaluru: "ቤንጋሉሩ",
  Chennai: "ቼናይ",
  Hyderabad: "ሃይደራባድ",
  Pune: "ፑኔ",
  "KarmYog Vatika": "ካርምዮግ ቫቲካ",
  KarmYog: "ካርምዮግ",
  System: "ሲስተም",
};

const PHRASE_AM: Array<[RegExp, string]> = [
  [/\bDr\.\s*/gi, "ዶ/ር "],
  [/MahAcharya\.?['’]?Ji/gi, "ማሃቻርያጂ"],
  [/MahAcharya/gi, "ማሃቻርያ"],
  [/Acharya/gi, "አቻርያ"],
  [/Vivek/gi, "ቪቬክ"],
  [/Neeranjan/gi, "ኒራንጃን"],
  [/Soumyajit/gi, "ሶምያጂት"],
  [/Subhas/gi, "ሱባሽ"],
  [/Khushi Pandey/gi, "ኩሺ ፓንዴ"],
  [/Gunakul/gi, "ጉናኩል"],
  [/KarmYog Vatika/gi, "ካርምዮግ ቫቲካ"],
  [/KarmYog/gi, "ካርምዮግ"],
  [/General Labour/gi, "የቀን ሠራተኛ"],
  [/Addis Ababa/gi, "አዲስ አበባ"],
  [/Maharashtra/gi, "ማሃራሽትራ"],
  [/Mumbai/gi, "ሙምባይ"],
  [/\bSystem\b/gi, "ሲስተም"],
  [/\bAdmin\b/gi, "አስተዳዳሪ"],
  [/\bWorker\b/gi, "ሠራተኛ"],
];

/**
 * Languages whose phrase map translates MEANING (whole clauses), so leftover
 * Latin words after it are names worth transliterating. A language not listed
 * has only a name map: transliterating an English sentence word-by-word into
 * its script would produce English written in Telugu letters, which reads as a
 * bug — such sentences stay English offline and the Gemini path translates.
 */
const SENTENCE_PHRASE_MAPS: Partial<Record<Lang, true>> = { bn: true, hi: true };

/** An English clause, not a name: three or more Latin words of 3+ letters. */
function looksLikeLatinSentence(text: string): boolean {
  return (text.match(/[A-Za-z]{3,}/g) || []).length >= 3;
}

function alreadyLocalized(text: string, lang: Lang): boolean {
  // Latin-script languages (en, fr) have nothing to localize into.
  if (isLatinScript(lang)) return true;
  return isInLanguageScript(text, lang);
}

function exactMap(lang: Lang): Record<string, string> {
  if (lang === "bn") return EXACT_BN;
  if (lang === "hi") return EXACT_HI;
  if (lang === "te") return EXACT_TE;
  if (lang === "am") return EXACT_AM;
  return {};
}

function phrases(lang: Lang): Array<[RegExp, string]> {
  if (lang === "bn") return PHRASE_BN;
  if (lang === "hi") return PHRASE_HI;
  if (lang === "te") return PHRASE_TE;
  if (lang === "am") return PHRASE_AM;
  return [];
}

/**
 * Common Indian personal / surname tokens (lowercase keys).
 * Applied word-by-word so "Gaurav Kamble" → "গৌরব কাম্বলে".
 */
const NAME_WORD_BN: Record<string, string> = {
  gaurav: "গৌরব",
  gourav: "গৌরব",
  kamble: "কাম্বলে",
  kumar: "কুমার",
  singh: "সিংহ",
  sharma: "শর্মা",
  pandey: "পান্ডে",
  panday: "পান্ডে",
  khushi: "খুশি",
  rahul: "রাহুল",
  amit: "অমিত",
  rohit: "রোহিত",
  priya: "প্রিয়া",
  ananya: "অনন্যা",
  suresh: "সুরেশ",
  ramesh: "রমেশ",
  deepak: "দীপক",
  neha: "নেহা",
  pooja: "পূজা",
  puja: "পূজা",
  ankit: "অঙ্কিত",
  vikram: "বিক্রম",
  aditya: "আদিত্য",
  arjun: "অর্জুন",
  vivek: "বিবেক",
  subhas: "সুভাষ",
  subhash: "সুভাষ",
  soumyajit: "সৌম্যজিৎ",
  neeranjan: "নীরঞ্জন",
  niranjan: "নিরঞ্জন",
  acharya: "আচার্য",
  mahacharya: "মহাচার্য",
  // Teams / codes that still use Latin
  "dev/ai": "ডেভ/এআই",
  dev: "ডেভ",
  ai: "এআই",
};

const NAME_WORD_HI: Record<string, string> = {
  gaurav: "गौरव",
  gourav: "गौरव",
  kamble: "कांबले",
  kumar: "कुमार",
  singh: "सिंह",
  sharma: "शर्मा",
  pandey: "पांडे",
  panday: "पांडे",
  khushi: "खुशी",
  rahul: "राहुल",
  amit: "अमित",
  rohit: "रोहित",
  priya: "प्रिया",
  ananya: "अनन्या",
  suresh: "सुरेश",
  ramesh: "रमेश",
  deepak: "दीपक",
  neha: "नेहा",
  pooja: "पूजा",
  puja: "पूजा",
  ankit: "अंकित",
  vikram: "विक्रम",
  aditya: "आदित्य",
  arjun: "अर्जुन",
  vivek: "विवेक",
  subhas: "सुभाष",
  subhash: "सुभाष",
  soumyajit: "सौम्यजीत",
  neeranjan: "नीरंजन",
  niranjan: "निरंजन",
  acharya: "आचार्य",
  mahacharya: "महाचार्य",
  "dev/ai": "डेव/एआई",
  dev: "डेव",
  ai: "एआई",
};

/**
 * Lightweight Latin (Indian-name style) → Bengali phonetic.
 * Not perfect IPA — good enough for first/last names when the dict misses.
 */
function phoneticToBengali(word: string): string {
  let s = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!s) return word;

  // Digraphs first
  const pairs: Array<[RegExp, string]> = [
    [/aa/g, "া"],
    [/ee|ii/g, "ী"],
    [/oo|uu/g, "ূ"],
    [/ai/g, "ৈ"],
    [/au|ou/g, "ৌ"],
    [/kh/g, "খ"],
    [/gh/g, "ঘ"],
    [/ch/g, "চ"],
    [/jh/g, "ঝ"],
    [/th/g, "থ"],
    [/dh/g, "ধ"],
    [/ph/g, "ফ"],
    [/bh/g, "ভ"],
    [/sh|ss/g, "শ"],
    [/ng/g, "ং"],
    [/ny/g, "ঞ"],
  ];
  // Work on a token stream: replace consonants with full letters + matras
  // Simpler approach: map common CV patterns via sequential replace on a buffer.
  const cons: Record<string, string> = {
    k: "ক",
    g: "গ",
    c: "চ",
    j: "জ",
    t: "ত",
    d: "দ",
    n: "ন",
    p: "প",
    b: "ব",
    m: "ম",
    y: "য়",
    r: "র",
    l: "ল",
    v: "ব",
    w: "ব",
    s: "স",
    h: "হ",
    f: "ফ",
    z: "জ",
    x: "ক্স",
    q: "ক",
  };
  const vowelAlone: Record<string, string> = {
    a: "অ",
    e: "এ",
    i: "ই",
    o: "ও",
    u: "উ",
  };
  const vowelMatra: Record<string, string> = {
    a: "", // inherent
    e: "ে",
    i: "ি",
    o: "ো",
    u: "ু",
  };

  // Pre-expand digraphs to single-char placeholders
  const digraphMap: Array<[string, string]> = [
    ["kh", "\u0001"],
    ["gh", "\u0002"],
    ["ch", "\u0003"],
    ["jh", "\u0004"],
    ["th", "\u0005"],
    ["dh", "\u0006"],
    ["ph", "\u0007"],
    ["bh", "\u0008"],
    ["sh", "\u0009"],
    ["ng", "\u000b"],
    ["aa", "\u0010"],
    ["ee", "\u0011"],
    ["ii", "\u0011"],
    ["oo", "\u0012"],
    ["uu", "\u0012"],
    ["ai", "\u0013"],
    ["au", "\u0014"],
    ["ou", "\u0014"],
  ];
  const digraphCons: Record<string, string> = {
    "\u0001": "খ",
    "\u0002": "ঘ",
    "\u0003": "চ",
    "\u0004": "ঝ",
    "\u0005": "থ",
    "\u0006": "ধ",
    "\u0007": "ফ",
    "\u0008": "ভ",
    "\u0009": "শ",
    "\u000b": "ং",
  };
  const digraphVow: Record<string, string> = {
    "\u0010": "া",
    "\u0011": "ী",
    "\u0012": "ূ",
    "\u0013": "ৈ",
    "\u0014": "ৌ",
  };

  let buf = s;
  for (const [lat, ph] of digraphMap) {
    buf = buf.split(lat).join(ph);
  }

  let out = "";
  let i = 0;
  while (i < buf.length) {
    const ch = buf[i];
    if (digraphCons[ch]) {
      // consonant digraph — look ahead for vowel
      const next = buf[i + 1];
      out += digraphCons[ch];
      if (next && (vowelMatra[next] !== undefined || digraphVow[next])) {
        if (digraphVow[next]) {
          out += digraphVow[next];
          i += 2;
          continue;
        }
        if (next === "a") {
          i += 2;
          continue; // inherent
        }
        out += vowelMatra[next] ?? "";
        i += 2;
        continue;
      }
      // end of word or consonant cluster: add hasanta if next is cons
      if (next && (cons[next] || digraphCons[next])) {
        out += "্";
      }
      i += 1;
      continue;
    }
    if (digraphVow[ch] && out.length === 0) {
      // leading vowel digraph as independent
      const ind: Record<string, string> = {
        "\u0010": "আ",
        "\u0011": "ঈ",
        "\u0012": "ঊ",
        "\u0013": "ঐ",
        "\u0014": "ঔ",
      };
      out += ind[ch] ?? "";
      i += 1;
      continue;
    }
    if (cons[ch]) {
      out += cons[ch];
      const next = buf[i + 1];
      if (next && digraphVow[next]) {
        out += digraphVow[next];
        i += 2;
        continue;
      }
      if (next && vowelMatra[next] !== undefined) {
        if (next === "a") {
          i += 2;
          continue;
        }
        out += vowelMatra[next];
        i += 2;
        continue;
      }
      if (next && (cons[next] || digraphCons[next])) {
        out += "্";
      }
      i += 1;
      continue;
    }
    if (vowelAlone[ch]) {
      if (out.length === 0) {
        out += vowelAlone[ch];
      } else if (ch !== "a") {
        out += vowelMatra[ch] ?? "";
      }
      i += 1;
      continue;
    }
    i += 1;
  }

  // Special-case polish: "gaurav" style au was handled as digraph
  // "kamble" → ক + া + ম + ্ + ব + ্ + ল + ে ≈ কাম্ব্লে — ok
  void pairs;
  return out || word;
}

function phoneticToHindi(word: string): string {
  // Map Bengali result's rough equivalent via common substitutions after BN phonetics
  // Better: parallel simple map
  let s = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!s) return word;
  // Reuse bn then convert? Devanagari parallel is cleaner with shared pipeline.
  // Lightweight: convert known bn-like via dictionary fallback only + simple map
  const bn = phoneticToBengali(word);
  // bn→hi character map for shared Indic consonants (approx)
  const map: Record<string, string> = {
    "অ": "अ",
    "আ": "आ",
    "ই": "इ",
    "ঈ": "ई",
    "উ": "उ",
    "ঊ": "ऊ",
    "এ": "ए",
    "ঐ": "ऐ",
    "ও": "ओ",
    "ঔ": "औ",
    "ক": "क",
    "খ": "ख",
    "গ": "ग",
    "ঘ": "घ",
    "চ": "च",
    "জ": "ज",
    "ঝ": "झ",
    "ট": "ट",
    "ঠ": "ठ",
    "ড": "ड",
    "ঢ": "ढ",
    "ণ": "ण",
    "ত": "त",
    "থ": "थ",
    "দ": "द",
    "ধ": "ध",
    "ন": "न",
    "প": "प",
    "ফ": "फ",
    "ব": "ब",
    "ভ": "भ",
    "ম": "म",
    "য": "य",
    "র": "र",
    "ল": "ल",
    "শ": "श",
    "ষ": "ष",
    "স": "स",
    "হ": "ह",
    "য়": "य",
    "ং": "ं",
    "া": "ा",
    "ি": "ि",
    "ী": "ी",
    "ু": "ु",
    "ূ": "ू",
    "ে": "े",
    "ৈ": "ै",
    "ো": "ो",
    "ৌ": "ौ",
    "্": "्",
  };
  return [...bn].map((c) => map[c] ?? c).join("");
}

const NAME_WORD_TE: Record<string, string> = {
  gaurav: "గౌరవ్",
  gourav: "గౌరవ్",
  kamble: "కాంబ్లే",
  kumar: "కుమార్",
  singh: "సింగ్",
  sharma: "శర్మ",
  pandey: "పాండే",
  panday: "పాండే",
  khushi: "ఖుషీ",
  rahul: "రాహుల్",
  amit: "అమిత్",
  rohit: "రోహిత్",
  priya: "ప్రియ",
  ananya: "అనన్య",
  suresh: "సురేష్",
  ramesh: "రమేష్",
  deepak: "దీపక్",
  neha: "నేహా",
  pooja: "పూజ",
  puja: "పూజ",
  ankit: "అంకిత్",
  vikram: "విక్రమ్",
  aditya: "ఆదిత్య",
  arjun: "అర్జున్",
  vivek: "వివేక్",
  subhas: "సుభాష్",
  subhash: "సుభాష్",
  soumyajit: "సౌమ్యజిత్",
  neeranjan: "నీరంజన్",
  niranjan: "నిరంజన్",
  venkatesh: "వెంకటేష్",
  srinivas: "శ్రీనివాస్",
  lakshmi: "లక్ష్మి",
  krishna: "కృష్ణ",
  ravi: "రవి",
  sai: "సాయి",
  reddy: "రెడ్డి",
  rao: "రావు",
  naidu: "నాయుడు",
  acharya: "ఆచార్య",
  mahacharya: "మహాచార్య",
  "dev/ai": "డెవ్/ఏఐ",
  dev: "డెవ్",
  ai: "ఏఐ",
};

/**
 * Latin (Indian-name style) → Telugu phonetic, for a name word the dictionary
 * misses. Deliberately NOT derived from phoneticToHindi: that pipeline is built
 * on the Bengali one, and Bengali has no "v", so it spells Naveen as నబీన్ and
 * Madhav as మధబ్ — wrong for exactly the names Telugu speakers carry most
 * (Venkatesh, Vijay, Srinivas). Greedy longest-match over Latin clusters, with
 * the inherent vowel, conjuncts and a final virama handled the Telugu way.
 */
const TE_CONSONANTS: Array<[string, string]> = [
  ["ksh", "క్ష"], ["chh", "ఛ"], ["ch", "చ"], ["kh", "ఖ"], ["gh", "ఘ"], ["jh", "ఝ"],
  ["th", "త"], ["dh", "ధ"], ["ph", "ఫ"], ["bh", "భ"], ["sh", "ష"],
  ["k", "క"], ["g", "గ"], ["c", "క"], ["j", "జ"], ["t", "త"], ["d", "ద"], ["n", "న"],
  ["p", "ప"], ["f", "ఫ"], ["b", "బ"], ["m", "మ"], ["y", "య"], ["r", "ర"], ["l", "ల"],
  ["v", "వ"], ["w", "వ"], ["s", "స"], ["h", "హ"], ["z", "జ"], ["q", "క"], ["x", "క్స"],
];
/** [latin, independent vowel, vowel sign after a consonant ("" = inherent a)] */
const TE_VOWELS: Array<[string, string, string]> = [
  ["aa", "ఆ", "ా"], ["ai", "ఐ", "ై"], ["au", "ఔ", "ౌ"], ["ou", "ఔ", "ౌ"],
  ["ee", "ఈ", "ీ"], ["ii", "ఈ", "ీ"], ["oo", "ఊ", "ూ"], ["uu", "ఊ", "ూ"],
  ["a", "అ", ""], ["i", "ఇ", "ి"], ["u", "ఉ", "ు"], ["e", "ఏ", "ే"], ["o", "ఓ", "ో"],
];
const TE_VIRAMA = "్";
const TE_NASAL_BEFORE = /^(?:k|g|ch|j|t|d|p|b)/;

function phoneticToTelugu(word: string): string {
  const s = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!s) return word;
  let out = "";
  let i = 0;
  let afterConsonant = false;
  while (i < s.length) {
    const rest = s.slice(i);
    const vowel = TE_VOWELS.find(([latin]) => rest.startsWith(latin));
    if (vowel) {
      out += afterConsonant ? vowel[2] : vowel[1];
      afterConsonant = false;
      i += vowel[0].length;
      continue;
    }
    // n/m before a stop is the anusvara Telugu writes: Sandeep → సందీప్.
    if ((rest[0] === "n" || rest[0] === "m") && out && TE_NASAL_BEFORE.test(rest.slice(1))) {
      out += "ం";
      afterConsonant = false;
      i += 1;
      continue;
    }
    const cons = TE_CONSONANTS.find(([latin]) => rest.startsWith(latin));
    if (!cons) {
      i += 1;
      continue;
    }
    // Two consonants in a row form a conjunct: the first takes a virama.
    if (afterConsonant) out += TE_VIRAMA;
    out += cons[1];
    afterConsonant = true;
    i += cons[0].length;
  }
  // A final bare consonant is silent in the Latin spelling (Vivek, Arjun).
  if (afterConsonant) out += TE_VIRAMA;
  return out || word;
}

const NAME_WORD_AM: Record<string, string> = {
  gaurav: "ጋውራቭ",
  gourav: "ጋውራቭ",
  kamble: "ካምብሌ",
  kumar: "ኩማር",
  singh: "ሲንግ",
  sharma: "ሻርማ",
  pandey: "ፓንዴ",
  panday: "ፓንዴ",
  khushi: "ኩሺ",
  rahul: "ራሁል",
  amit: "አሚት",
  priya: "ፕሪያ",
  arjun: "አርጁን",
  vivek: "ቪቬክ",
  subhas: "ሱባሽ",
  subhash: "ሱባሽ",
  soumyajit: "ሶምያጂት",
  neeranjan: "ኒራንጃን",
  niranjan: "ኒራንጃን",
  shivam: "ሺቫም",
  acharya: "አቻርያ",
  mahacharya: "ማሃቻርያ",
  // Common Ethiopian names, so a karigar's own name is spelt the way they write it.
  abebe: "አበበ",
  alemu: "አለሙ",
  almaz: "አልማዝ",
  bekele: "በቀለ",
  dawit: "ዳዊት",
  tesfaye: "ተስፋዬ",
  hana: "ሐና",
  hanna: "ሐና",
  meron: "ሜሮን",
  selam: "ሰላም",
  yonas: "ዮናስ",
  tadesse: "ታደሰ",
  mulugeta: "ሙሉጌታ",
  girma: "ግርማ",
  kebede: "ከበደ",
  getachew: "ጌታቸው",
  mekdes: "መቅደስ",
  tigist: "ትግስት",
  solomon: "ሰሎሞን",
  yohannes: "ዮሐንስ",
  mohammed: "መሐመድ",
  ahmed: "አሕመድ",
  "dev/ai": "ዴቭ/ኤአይ",
  dev: "ዴቭ",
  ai: "ኤአይ",
};

/**
 * Latin → Ge'ez (Ethiopic) phonetic, for a name word the dictionary misses.
 * Ge'ez is a syllabary: each consonant has seven forms, one per vowel —
 * [ä, u, i, a, e, (none), o]. Foreign names are written the way Amharic
 * speakers spell them: Latin "a" takes the 4th form (ካ), a consonant with no
 * vowel after it takes the 6th (ክ), and doubled letters collapse because
 * Amharic does not mark gemination. Aspirates fold to the plain consonant
 * (kh → k, bh → b) since Amharic has no aspirated series.
 */
const AM_SYLLABLES: Array<[string, string]> = [
  // latin, seven orders
  ["ksh", "ክሽ"], // handled specially below (two syllables)
  ["chh", "ቸቹቺቻቼችቾ"], ["ch", "ቸቹቺቻቼችቾ"], ["sh", "ሸሹሺሻሼሽሾ"], ["zh", "ዠዡዢዣዤዥዦ"],
  ["kh", "ከኩኪካኬክኮ"], ["gh", "ገጉጊጋጌግጎ"], ["jh", "ጀጁጂጃጄጅጆ"], ["th", "ተቱቲታቴትቶ"],
  ["dh", "ደዱዲዳዴድዶ"], ["ph", "ፈፉፊፋፌፍፎ"], ["bh", "በቡቢባቤብቦ"],
  ["h", "ሀሁሂሃሄህሆ"], ["l", "ለሉሊላሌልሎ"], ["m", "መሙሚማሜምሞ"], ["r", "ረሩሪራሬርሮ"],
  ["s", "ሰሱሲሳሴስሶ"], ["q", "ቀቁቂቃቄቅቆ"], ["b", "በቡቢባቤብቦ"], ["v", "ቨቩቪቫቬቭቮ"],
  ["t", "ተቱቲታቴትቶ"], ["n", "ነኑኒናኔንኖ"], ["k", "ከኩኪካኬክኮ"], ["c", "ከኩኪካኬክኮ"],
  ["w", "ወዉዊዋዌውዎ"], ["z", "ዘዙዚዛዜዝዞ"], ["y", "የዩዪያዬይዮ"], ["d", "ደዱዲዳዴድዶ"],
  ["j", "ጀጁጂጃጄጅጆ"], ["g", "ገጉጊጋጌግጎ"], ["f", "ፈፉፊፋፌፍፎ"], ["p", "ፐፑፒፓፔፕፖ"],
  ["x", "ክስ"], // two syllables, handled specially
];
/** Glottal (vowel-initial) series: አ ኡ ኢ ኣ ኤ እ ኦ — "a" is written አ, as Amharic does. */
const AM_GLOTTAL = "አኡኢአኤእኦ";
/** [latin, order index into the seven forms] */
const AM_VOWELS: Array<[string, number]> = [
  ["aa", 3], ["ee", 2], ["ii", 2], ["oo", 1], ["uu", 1],
  ["a", 3], ["i", 2], ["u", 1], ["e", 4], ["o", 6],
];
const AM_SIXTH = 5;

function phoneticToAmharic(word: string): string {
  const s = word
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    // Final or pre-consonant "y" after a consonant is the vowel i (Reddy → ሬዲ).
    .replace(/([^aeiouy])y(?=$|[^aeiou])/g, "$1i")
    // Vowel hiatus gets the glide Amharic writes (Oromia → ኦሮሚያ, Ruwa).
    .replace(/([ie])([aou])/g, "$1y$2")
    .replace(/([uo])([aei])/g, "$1w$2");
  if (!s) return word;
  let out = "";
  let i = 0;
  while (i < s.length) {
    const rest = s.slice(i);
    // ai / au / ou: vowel + glide (Sai → ሳይ, Gaurav → ጋውራቭ).
    const vowel = AM_VOWELS.find(([latin]) => rest.startsWith(latin));
    if (vowel) {
      out += AM_GLOTTAL[vowel[1]];
      i += vowel[0].length;
      continue;
    }
    const cons = AM_SYLLABLES.find(([latin]) => rest.startsWith(latin));
    if (!cons) {
      i += 1;
      continue;
    }
    i += cons[0].length;
    // Doubled consonant (Anna, Hanna): Amharic does not write gemination.
    while (s.slice(i).startsWith(cons[0]) && cons[0].length === 1) i += 1;
    if (cons[1].length !== 7) {
      // ksh / x: fixed two-syllable spellings; a following vowel goes on the last.
      const head = "ክ";
      const tail = cons[0] === "ksh" ? "ሸሹሺሻሼሽሾ" : "ሰሱሲሳሴስሶ";
      const v = AM_VOWELS.find(([latin]) => s.slice(i).startsWith(latin));
      out += head + tail[v ? v[1] : AM_SIXTH];
      if (v) i += v[0].length;
      continue;
    }
    const v = AM_VOWELS.find(([latin]) => s.slice(i).startsWith(latin));
    if (v) {
      out += cons[1][v[1]];
      i += v[0].length;
      // Second half of a diphthong is a glide: ai → ይ, au/ou → ው.
      const next = s[i];
      if (next === "i" && v[0] === "a") { out += "ይ"; i += 1; }
      else if (next === "u" && (v[0] === "a" || v[0] === "o")) { out += "ው"; i += 1; }
    } else {
      out += cons[1][AM_SIXTH];
    }
  }
  return out || word;
}

function nameWordMap(lang: Lang): Record<string, string> {
  if (lang === "bn") return NAME_WORD_BN;
  if (lang === "hi") return NAME_WORD_HI;
  if (lang === "te") return NAME_WORD_TE;
  if (lang === "am") return NAME_WORD_AM;
  return {};
}

/**
 * Transliterate one Latin token (name piece) into bn/hi script.
 */
export function transliterateNameWord(word: string, lang: Lang): string {
  if (!word || lang === "en") return word;
  if (alreadyLocalized(word, lang)) return word;
  const key = word.toLowerCase();
  const dict = nameWordMap(lang);
  if (dict[key]) return dict[key];
  // Slash compounds: DEV/AI
  if (key.includes("/")) {
    return key
      .split("/")
      .map((p) => transliterateNameWord(p, lang))
      .join("/");
  }
  if (lang === "bn") return phoneticToBengali(word);
  if (lang === "hi") return phoneticToHindi(word);
  if (lang === "te") return phoneticToTelugu(word);
  if (lang === "am") return phoneticToAmharic(word);
  return word;
}

/**
 * Transliterate a full person name (space-separated words).
 */
export function transliteratePersonName(name: string, lang: Lang): string {
  if (!name.trim() || lang === "en") return name;
  return name
    .trim()
    .split(/(\s+)/)
    .map((part) => {
      if (/^\s+$/.test(part)) return part;
      if (!/[A-Za-z]/.test(part)) return part;
      return transliterateNameWord(part, lang);
    })
    .join("");
}

/**
 * Brands / technical tokens that must stay Latin — never phonetic letter-swap.
 * (Phonetic OmniDel → ওমনিদেল is exactly the QA failure mode.)
 */
const KEEP_LATIN_WORD = /^(omnidel|omnipulse|youtube|whatsapp|karmyog|karmy[oô]g|buffer|vercel|github|http|https|api|pdf|jpg|jpeg|png|webp|url|mfd|ai|pr)$/i;

export type PolishOpts = {
  /** English (or original) text — brands not present here are stripped from the translation. */
  sourceText?: string | null;
  /**
   * Multi-line body copy (task descriptions): keep newlines and leading list
   * markers. Off by default — titles and short labels are single-line, and the
   * cleanup below collapses every whitespace run for them.
   */
  multiline?: boolean;
};

/**
 * Fix bad Gemini / phonetic output that already contains BN/HI script.
 * Always run on task titles & descriptions before paint — even when "already localized".
 */
export function polishLocalizedDisplay(
  text: string,
  lang: Lang,
  opts?: PolishOpts,
): string {
  if (!text?.trim() || lang === "en") return text ?? "";
  let out = text;
  const source = (opts?.sourceText ?? "").trim();
  const multiline = opts?.multiline === true;

  // Strip model meta ("This OmniPulse task was translated into Bengali…")
  out = out.replace(
    /This\s+\S+\s+task\s+(?:has\s+been\s+)?translated\s+into\s+(?:Bengali|Hindi|Bangla|French|Telugu|Amharic)\.?\s*/gi,
    "",
  );
  out = out.replace(
    /এই\s+.+?(?:টাস্ক|কাজ)টি\s+বাংলা\S*\s+অনুবাদ\s+করা\s+হল\S*\s*/gi,
    "",
  );
  out = out.replace(
    /यह\s+.+?(?:टास्क|कार्य).{0,80}?अनुवाद.{0,40}?[।.]?\s*/gi,
    "",
  );
  out = out.replace(/(?:টাস্ক|কাজ)\s+সারাংশ\s*:\s*-?\s*/gi, "");
  out = out.replace(
    /ఈ\s+.{0,60}?(?:టాస్క్|పని).{0,60}?తెలుగు\S*\s+అనువదించ\S*\s*[.]?\s*/gi,
    "",
  );
  // Amharic meta: "ይህ ሥራ ወደ አማርኛ ተተርጉሟል".
  out = out.replace(/ይህ\s+.{0,60}?(?:ሥራ|ተግባር|ታስክ).{0,40}?ወደ\s+አማርኛ\s+ተተርጉ\S*\s*[።.]?\s*/g, "");
  out = out.replace(/Task\s+summary\s*:\s*-?\s*/gi, "");
  // Leftover punctuation after stripping meta. Multi-line body copy keeps a
  // leading "-" (that is the first bullet of a list, not meta debris) and its
  // newlines (a "\s" class here would splice the first two lines together).
  out = multiline
    ? out.replace(/^[।.\s]+/, "").replace(/[^\S\n]+[।.][^\S\n]+/g, " ")
    : out.replace(/^[।.\s-]+/, "").replace(/\s+[।.]\s+/g, " ");

  const sourceHasOmnidel = /omnidel/i.test(source);
  const sourceHasOmnipulse = /omnipulse/i.test(source);

  if (lang === "bn" && (BENGALI_RE.test(out) || /OmniDel|OmniPulse/i.test(out))) {
    // Dr. mis-read as "draw" → ড্র. (should be ডা.)
    out = out.replace(/ড্র\.\s*/g, "ডা. ");
    out = out.replace(/ড্র(?=[\s\u0980-\u09FF])/g, "ডা.");
    out = out.replace(/টেস্ট/g, "পরীক্ষা");
    out = out.replace(/টাস্ক/g, "কাজ");
    out = out.replace(/সাব[\s-]?টাস্ক|উপটাস্ক/g, "উপ-কাজ");
    out = out.replace(/সেশন/g, "পালা");

    // Brands: keep Latin ONLY when the English source actually contains them.
    // Otherwise Gemini/phonetic junk like ওমনিদেল on "Dr. Gaurav Test" must go.
    if (source && !sourceHasOmnidel) {
      out = out.replace(/ওমনিদেল|ওমানিদেল|ওমনিডেল/gi, "");
      out = out.replace(/\bOmniDel\b/gi, "");
    } else {
      out = out.replace(/ওমনিদেল|ওমানিদেল|ওমনিডেল/gi, "OmniDel");
      out = out.replace(/OmniDelসহ/g, "OmniDel সহ");
    }
    if (source && !sourceHasOmnipulse) {
      out = out.replace(/ওমনিপালস|ওমনিপাল্স|ওমনিপালস্/gi, "");
      out = out.replace(/\bOmniPulse\b/gi, "");
    } else {
      out = out.replace(/ওমনিপালস|ওমনিপাল্স|ওমনিপালস্/gi, "OmniPulse");
      out = out.replace(/OmniPulseসহ/g, "OmniPulse সহ");
    }

    // Leftover Latin everyday nouns inside Bengali copy (Hinglish bleed).
    out = out.replace(/\bchair\b/gi, "কুরসি");
    out = out.replace(/\btest\b/gi, "পরীক্ষা");
    out = out.replace(/\btask\b/gi, "কাজ");
    out = out.replace(/\bboard\b/gi, "বোর্ড");
    out = out.replace(/\blabel\b/gi, "লেবেল");
    out = out.replace(/\bsession\b/gi, "পালা");
    out = out.replace(/\bsubtask\b/gi, "উপ-কাজ");
  }

  if (lang === "hi" && (DEVANAGARI_RE.test(out) || /OmniDel|OmniPulse/i.test(out))) {
    out = out.replace(/ड्र\.\s*/g, "डॉ. ");
    out = out.replace(/टेस्ट/g, "परीक्षा");
    out = out.replace(/टास्क/g, "कार्य");
    if (source && !sourceHasOmnidel) {
      out = out.replace(/ओमनिडेल|ओमनीडेल/gi, "");
      out = out.replace(/\bOmniDel\b/gi, "");
    } else {
      out = out.replace(/ओमनिडेल|ओमनीडेल/gi, "OmniDel");
    }
    if (source && !sourceHasOmnipulse) {
      out = out.replace(/ओमनिपल्स|ओमनीपल्स/gi, "");
      out = out.replace(/\bOmniPulse\b/gi, "");
    } else {
      out = out.replace(/ओमनिपल्स|ओमनीपल्स/gi, "OmniPulse");
    }

    out = out.replace(/\bchair\b/gi, "कुर्सी");
    out = out.replace(/\btest\b/gi, "परीक्षा");
    out = out.replace(/\btask\b/gi, "कार्य");
    out = out.replace(/\bboard\b/gi, "बोर्ड");
    out = out.replace(/\blabel\b/gi, "लेबल");
    out = out.replace(/\bsession\b/gi, "सत्र");
    out = out.replace(/\bsubtask\b/gi, "उप-कार्य");
  }

  if (lang === "te" && (TELUGU_RE.test(out) || /OmniDel|OmniPulse/i.test(out))) {
    // Dr. mis-read as "draw" → డ్ర. (should be డా.)
    out = out.replace(/డ్ర\.\s*/g, "డా. ");
    // Transliterated English → the Telugu word. Subtask before task, or the
    // task rule eats half of it first.
    out = out.replace(/సబ్[\s-]?టాస్క్/g, "ఉప పని");
    out = out.replace(/టెస్ట్/g, "పరీక్ష");
    out = out.replace(/టాస్క్/g, "పని");
    out = out.replace(/సెషన్/g, "విడత");
    if (source && !sourceHasOmnidel) {
      out = out.replace(/ఓమ్నిడెల్|ఓమ్నీడెల్|ఓమ్నిడేల్/gi, "");
      out = out.replace(/\bOmniDel\b/gi, "");
    } else {
      out = out.replace(/ఓమ్నిడెల్|ఓమ్నీడెల్|ఓమ్నిడేల్/gi, "OmniDel");
    }
    if (source && !sourceHasOmnipulse) {
      out = out.replace(/ఓమ్నిపల్స్|ఓమ్నీపల్స్/gi, "");
      out = out.replace(/\bOmniPulse\b/gi, "");
    } else {
      out = out.replace(/ఓమ్నిపల్స్|ఓమ్నీపల్స్/gi, "OmniPulse");
    }

    out = out.replace(/\bchair\b/gi, "కుర్చీ");
    out = out.replace(/\bsubtask\b/gi, "ఉప పని");
    out = out.replace(/\btest\b/gi, "పరీక్ష");
    out = out.replace(/\btask\b/gi, "పని");
    out = out.replace(/\bboard\b/gi, "బోర్డ్");
    out = out.replace(/\blabel\b/gi, "లేబుల్");
    out = out.replace(/\bsession\b/gi, "విడత");
  }

  if (lang === "am" && (ETHIOPIC_RE.test(out) || /OmniDel|OmniPulse/i.test(out))) {
    // Transliterated English → the Amharic word. Subtask before task, or the
    // task rule eats half of it first.
    out = out.replace(/ሰብ[\s-]?ታስክ/g, "ንዑስ ሥራ");
    out = out.replace(/ቴስት/g, "ፈተና");
    out = out.replace(/ታስክ/g, "ሥራ");
    out = out.replace(/ሴሽን|ሴሺን/g, "ዙር");
    if (source && !sourceHasOmnidel) {
      out = out.replace(/ኦምኒዴል|ኦምኒደል/g, "");
      out = out.replace(/\bOmniDel\b/gi, "");
    } else {
      out = out.replace(/ኦምኒዴል|ኦምኒደል/g, "OmniDel");
    }
    if (source && !sourceHasOmnipulse) {
      out = out.replace(/ኦምኒፐልስ|ኦምኒፓልስ/g, "");
      out = out.replace(/\bOmniPulse\b/gi, "");
    } else {
      out = out.replace(/ኦምኒፐልስ|ኦምኒፓልስ/g, "OmniPulse");
    }

    out = out.replace(/\bchair\b/gi, "ወንበር");
    out = out.replace(/\bsubtask\b/gi, "ንዑስ ሥራ");
    out = out.replace(/\btest\b/gi, "ፈተና");
    out = out.replace(/\btask\b/gi, "ሥራ");
    out = out.replace(/\bboard\b/gi, "ሰሌዳ");
    out = out.replace(/\blabel\b/gi, "መለያ");
    out = out.replace(/\bsession\b/gi, "ዙር");
  }

  // Squash runs of spaces only when multi-line — `\s{2,}` would eat every
  // paragraph break in a task description.
  const squashed = multiline
    ? out
        .replace(/[^\S\n]{2,}/g, " ")
        .replace(/[^\S\n]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
    : out.replace(/\s{2,}/g, " ").trim();
  return squashed || text.trim();
}

/**
 * Localize a short display value (trade, city, org name, role, person name, notice).
 * Returns original for en, empty, emails, phones, pure numbers.
 * Remaining Latin words are transliterated word-by-word (except brands).
 */
export function localizeContent(text: string | null | undefined, lang: Lang): string {
  if (!text) return text ?? "";
  const raw = text.trim();
  if (!raw || lang === "en") return raw;

  // Do not mangle emails, phones, pin, pure IDs / slugs with digits.
  if (/@/.test(raw) || /^\+?\d[\d\s-]{6,}$/.test(raw) || /^\d{4,}$/.test(raw)) {
    return raw;
  }
  // slug-like gaurav-kamble-1296 — keep as technical id
  if (/^[a-z0-9]+(?:-[a-z0-9]+)+$/i.test(raw) && /\d/.test(raw)) {
    return raw;
  }
  if (alreadyLocalized(raw, lang) && !/[A-Za-z]{2,}/.test(raw)) {
    return polishLocalizedDisplay(raw, lang);
  }

  const exact = exactMap(lang)[raw] ?? exactMap(lang)[raw.replace(/\s+/g, " ")];
  if (exact) return polishLocalizedDisplay(exact, lang);

  // Case-insensitive exact
  const lower = raw.toLowerCase();
  for (const [k, v] of Object.entries(exactMap(lang))) {
    if (k.toLowerCase() === lower) return polishLocalizedDisplay(v, lang);
  }

  // Full-string name dict (e.g. "Gaurav Kamble")
  const nameKey = lower.replace(/\s+/g, " ");
  const nameDict = nameWordMap(lang);
  if (nameDict[nameKey]) return polishLocalizedDisplay(nameDict[nameKey], lang);

  // No meaning-carrying phrase map for this language: an English clause stays
  // wholly English rather than half-replaced ("Business ఆచార్య for small
  // shops") or spelled out letter-by-letter (see SENTENCE_PHRASE_MAPS).
  if (!SENTENCE_PHRASE_MAPS[lang] && looksLikeLatinSentence(raw)) {
    return raw;
  }

  let out = raw;
  for (const [re, rep] of phrases(lang)) {
    out = out.replace(re, rep);
  }

  // Remaining Latin words → transliterate names only; never letter-swap brands.
  out = out.replace(/[A-Za-z][A-Za-z'/.-]*/g, (word) => {
    if (word.length === 1) return word;
    if (KEEP_LATIN_WORD.test(word)) {
      if (/^omnidel$/i.test(word)) return "OmniDel";
      if (/^omnipulse$/i.test(word)) return "OmniPulse";
      if (/^karmyog$/i.test(word)) return "Karmyog";
      return word;
    }
    // Code-ish tokens (PR, CamelCase ids) — leave Latin
    if (/^[A-Z]{2,}$/.test(word) || /[A-Z].*[A-Z]/.test(word)) return word;
    return transliterateNameWord(word, lang);
  });

  return polishLocalizedDisplay(out.replace(/\s{2,}/g, " ").trim() || raw, lang);
}

/**
 * Localize Acharya persona subtitle (may be multi-clause English).
 */
export function localizePersonaSummary(
  text: string | null | undefined,
  lang: Lang,
): string | null {
  if (text == null) return null;
  if (!text.trim() || lang === "en") return text;
  if (alreadyLocalized(text, lang) && !/[A-Za-z]{4,}/.test(text)) return text;
  return localizeContent(text, lang);
}

/**
 * Notice title/body — pattern “X assigned you” + phrase map for free text.
 */
export function localizeNoticeText(
  text: string | null | undefined,
  lang: Lang,
): string | null {
  if (text == null) return null;
  if (!text.trim() || lang === "en") return text;
  return localizeContent(text, lang);
}
