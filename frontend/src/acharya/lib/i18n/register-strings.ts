import type { Lang } from "@/acharya/lib/i18n/registry";

export type RegisterCopy = {
  title: string;
  subtitle: string;
  yourLanguage: string;
  langEn: string;
  langHi: string;
  langBn: string;
  langFr: string;
  langTe: string;
  langAm: string;
  firstName: string;
  lastName: string;
  mobile: string;
  email: string;
  trade: string;
  state: string;
  city: string;
  address: string;
  pincode: string;
  aboutWork: string;
  optional: string;
  selectTrade: string;
  selectState: string;
  selectCity: string;
  selectStateFirst: string;
  loadingCities: string;
  youllLearnWith: string;
  sendCode: string;
  sending: string;
  alreadyRegistered: string;
  enterCode: string;
  codeSentTo: (phone: string) => string;
  registering: string;
  register: string;
  helpGreeting: (name: string) => string;
  /** Eyebrow over the acharya's name on the register support card. */
  yourAcharya: string;
  /** Opens the written form-filling chat. */
  chatToFillForm: string;
  /** Stands in when the acharya row carries no persona summary. */
  helperHint: string;
  /** Pill on the portrait while the mic is open. */
  listening: string;
  /** Speaker label on the live caption when the karigar is the one talking. */
  youSpeaker: string;
  /** Chat-help city fill matched more than one city — asks which one. */
  cityDidYouMeanOptions: (names: string[]) => string;
  /** Chat-help city fill matched nothing exactly — offers the nearest spelling. */
  cityDidYouMeanNearest: (name: string) => string;
  /** Chat-help city fill matched nothing at all. */
  cityNotFound: string;
};

const COPY: Record<Lang, RegisterCopy> = {
  en: {
    title: "Register to learn",
    subtitle: "Tell us about yourself. You'll join every Acharya, and tasks appear once you're approved.",
    yourLanguage: "Language you speak",
    langEn: "English",
    langHi: "Hindi",
    langBn: "Bengali",
    langFr: "French",
    langTe: "Telugu",
    langAm: "Amharic",
    firstName: "First name",
    lastName: "Last name",
    mobile: "Mobile number",
    email: "Email",
    trade: "Trade",
    state: "State",
    city: "City",
    address: "Address",
    pincode: "PIN code",
    aboutWork: "About your work",
    optional: "(optional)",
    selectTrade: "Select your trade",
    selectState: "Select state",
    selectCity: "Select city",
    selectStateFirst: "Select a state first",
    loadingCities: "Loading…",
    youllLearnWith: "You'll learn with",
    sendCode: "Send code →",
    sending: "Sending…",
    alreadyRegistered: "Already registered? Sign in",
    enterCode: "Enter code",
    codeSentTo: (phone) => `Six digits sent to ${phone}`,
    registering: "Registering…",
    register: "Register →",
    yourAcharya: "Your Acharya",
    chatToFillForm: "Chat to fill form",
    helperHint:
      "Talk to fill the form, or chat in writing — language first, then your details. Email and about-your-work are optional.",
    listening: "Listening",
    youSpeaker: "You",
    helpGreeting: (name) =>
      `Namaste. I am ${name}. First — which language: English, Hindi, Bengali, French, Telugu or Amharic? Then we fill your name, phone, trade, place, and address. Email and a line about your work are optional — I will still ask.`,
    cityDidYouMeanOptions: (names) => `Did you mean one of these — ${names.join(", ")}? Tell me which one.`,
    cityDidYouMeanNearest: (name) => `I couldn't find that exact city. Did you mean ${name}?`,
    cityNotFound: "I couldn't find that city in your state's list. Could you say it again, or check the state?",
  },
  hi: {
    title: "सीखने के लिए पंजीकरण",
    subtitle: "अपने बारे में बताएँ। आप हर आचार्य से जुड़ेंगे; अनुमति के बाद काम दिखेगा।",
    yourLanguage: "आप कौन-सी भाषा बोलते हैं",
    langEn: "English",
    langHi: "हिंदी",
    langBn: "বাংলা",
    langFr: "Français",
    langTe: "తెలుగు",
    langAm: "አማርኛ",
    firstName: "पहला नाम",
    lastName: "उपनाम",
    mobile: "मोबाइल नंबर",
    email: "ईमेल",
    trade: "काम / ट्रेड",
    state: "राज्य",
    city: "शहर",
    address: "पता",
    pincode: "पिन कोड",
    aboutWork: "अपने काम के बारे में",
    optional: "(वैकल्पिक)",
    selectTrade: "अपना ट्रेड चुनें",
    selectState: "राज्य चुनें",
    selectCity: "शहर चुनें",
    selectStateFirst: "पहले राज्य चुनें",
    loadingCities: "लोड हो रहा है…",
    youllLearnWith: "आप इनसे सीखेंगे",
    sendCode: "कोड भेजें →",
    sending: "भेजा जा रहा है…",
    alreadyRegistered: "पहले से पंजीकृत? साइन इन",
    enterCode: "कोड दर्ज करें",
    codeSentTo: (phone) => `${phone} पर छह अंक भेजे गए`,
    registering: "पंजीकरण…",
    register: "पंजीकरण →",
    yourAcharya: "आपके आचार्य",
    chatToFillForm: "चैट से भरें",
    helperHint:
      "बोलकर फ़ॉर्म भरें, या लिखकर बात करें — पहले भाषा, फिर आपकी जानकारी। ईमेल और काम की बात वैकल्पिक है।",
    listening: "सुन रहे हैं",
    youSpeaker: "आप",
    helpGreeting: (name) =>
      `नमस्ते। मैं ${name} हूँ। पहले भाषा चुनें — अंग्रेज़ी, हिंदी, बांग्ला, फ़्रेंच, तेलुगु या अम्हारिक? फिर नाम, मोबाइल, ट्रेड, जगह और पता भरेंगे। ईमेल और काम के बारे में एक पंक्ति वैकल्पिक है — फिर भी पूछूँगा।`,
    cityDidYouMeanOptions: (names) => `क्या आपका मतलब इनमें से कोई है — ${names.join(", ")}? बताएं कौन सा।`,
    cityDidYouMeanNearest: (name) => `वह शहर बिल्कुल नहीं मिला। क्या आपका मतलब ${name} है?`,
    cityNotFound: "आपके राज्य की सूची में वह शहर नहीं मिला। कृपया फिर से बताएं, या राज्य जांच लें।",
  },
  bn: {
    title: "শেখার জন্য নিবন্ধন",
    subtitle: "নিজের কথা বলুন। আপনি সব আচার্যের সঙ্গে যুক্ত হবেন; অনুমোদনের পর কাজ দেখা যাবে।",
    yourLanguage: "আপনি কোন ভাষায় কথা বলেন",
    langEn: "English",
    langHi: "हिंदी",
    langBn: "বাংলা",
    langFr: "Français",
    langTe: "తెలుగు",
    langAm: "አማርኛ",
    firstName: "নামের প্রথম অংশ",
    lastName: "পদবি",
    mobile: "মোবাইল নম্বর",
    email: "ইমেইল",
    trade: "কাজ / ট্রেড",
    state: "রাজ্য",
    city: "শহর",
    address: "ঠিকানা",
    pincode: "পিন কোড",
    aboutWork: "আপনার কাজ সম্পর্কে",
    optional: "(ঐচ্ছিক)",
    selectTrade: "ট্রেড বেছে নিন",
    selectState: "রাজ্য বেছে নিন",
    selectCity: "শহর বেছে নিন",
    selectStateFirst: "আগে রাজ্য বেছে নিন",
    loadingCities: "লোড হচ্ছে…",
    youllLearnWith: "আপনি যাদের কাছে শিখবেন",
    sendCode: "কোড পাঠান →",
    sending: "পাঠানো হচ্ছে…",
    alreadyRegistered: "আগেই নিবন্ধিত? সাইন ইন",
    enterCode: "কোড লিখুন",
    codeSentTo: (phone) => `${phone}-এ ছয় অঙ্কের কোড পাঠানো হয়েছে`,
    registering: "নিবন্ধন হচ্ছে…",
    register: "নিবন্ধন →",
    yourAcharya: "আপনার আচার্য",
    chatToFillForm: "চ্যাটে পূরণ",
    helperHint:
      "বলে ফরম ভরুন, বা লিখে কথা বলুন — আগে ভাষা, তারপর আপনার তথ্য। ইমেইল ও কাজের কথা ঐচ্ছিক।",
    listening: "শুনছি",
    youSpeaker: "আপনি",
    helpGreeting: (name) =>
      `নমস্কার। আমি ${name}। আগে ভাষা বেছে নিন — ইংরেজি, হিন্দি, বাংলা, ফরাসি, তেলুগু না আমহারিক? তারপর নাম, মোবাইল, ট্রেড, জায়গা ও ঠিকানা ভরব। ইমেইল ও কাজের এক লাইন ঐচ্ছিক — তবু জিজ্ঞাসা করব।`,
    cityDidYouMeanOptions: (names) => `আপনি কি এগুলোর মধ্যে কোনো একটা বুঝিয়েছেন — ${names.join(", ")}? কোনটা বলুন।`,
    cityDidYouMeanNearest: (name) => `ঠিক সেই শহর পাওয়া যায়নি। আপনি কি ${name} বুঝিয়েছেন?`,
    cityNotFound: "আপনার রাজ্যের তালিকায় সেই শহর পাওয়া যায়নি। আবার বলুন, বা রাজ্যটি ঠিক আছে কিনা দেখুন।",
  },
  fr: {
    title: "Inscrivez-vous pour apprendre",
    subtitle: "Parlez-nous de vous. Vous rejoindrez tous les Acharyas, et les tâches apparaîtront une fois votre inscription approuvée.",
    yourLanguage: "Langue que vous parlez",
    langEn: "English",
    langHi: "हिंदी",
    langBn: "বাংলা",
    langFr: "Français",
    langTe: "తెలుగు",
    langAm: "አማርኛ",
    firstName: "Prénom",
    lastName: "Nom",
    mobile: "Numéro de mobile",
    email: "E-mail",
    trade: "Métier",
    state: "Région",
    city: "Ville",
    address: "Adresse",
    pincode: "Code postal",
    aboutWork: "À propos de votre travail",
    optional: "(facultatif)",
    selectTrade: "Choisissez votre métier",
    selectState: "Choisissez la région",
    selectCity: "Choisissez la ville",
    selectStateFirst: "Choisissez d’abord une région",
    loadingCities: "Chargement…",
    youllLearnWith: "Vous apprendrez avec",
    sendCode: "Envoyer le code →",
    sending: "Envoi…",
    alreadyRegistered: "Déjà inscrit ? Connectez-vous",
    enterCode: "Saisissez le code",
    codeSentTo: (phone) => `Six chiffres envoyés au ${phone}`,
    registering: "Inscription…",
    register: "S’inscrire →",
    yourAcharya: "Votre Acharya",
    chatToFillForm: "Discuter pour remplir le formulaire",
    helperHint:
      "Parlez pour remplir le formulaire, ou écrivez — d’abord la langue, puis vos informations. L’e-mail et la description de votre travail sont facultatifs.",
    listening: "À l’écoute",
    youSpeaker: "Vous",
    helpGreeting: (name) =>
      `Bonjour. Je suis ${name}. D’abord, quelle langue : français, anglais, hindi, bengali, télougou ou amharique ? Ensuite, nous remplirons votre nom, votre téléphone, votre métier, votre lieu et votre adresse. L’e-mail et une phrase sur votre travail sont facultatifs — je vous les demanderai quand même.`,
    cityDidYouMeanOptions: (names) => `Vouliez-vous dire l’une de ces villes — ${names.join(", ")} ? Dites-moi laquelle.`,
    cityDidYouMeanNearest: (name) => `Je n’ai pas trouvé cette ville exactement. Vouliez-vous dire ${name} ?`,
    cityNotFound: "Je n’ai pas trouvé cette ville dans la liste de votre région. Pouvez-vous la redire, ou vérifier la région ?",
  },
  te: {
    title: "నేర్చుకోవడానికి నమోదు చేసుకోండి",
    subtitle: "మీ గురించి చెప్పండి. మీరు ప్రతి ఆచార్యతో కలుస్తారు; ఆమోదం తర్వాత పనులు కనిపిస్తాయి.",
    yourLanguage: "మీరు మాట్లాడే భాష",
    langEn: "English",
    langHi: "हिंदी",
    langBn: "বাংলা",
    langFr: "Français",
    langTe: "తెలుగు",
    langAm: "አማርኛ",
    firstName: "మొదటి పేరు",
    lastName: "ఇంటి పేరు",
    mobile: "మొబైల్ నంబర్",
    email: "ఇమెయిల్",
    trade: "వృత్తి",
    state: "రాష్ట్రం",
    city: "నగరం",
    address: "చిరునామా",
    pincode: "PIN కోడ్",
    aboutWork: "మీ పని గురించి",
    optional: "(ఐచ్ఛికం)",
    selectTrade: "మీ వృత్తిని ఎంచుకోండి",
    selectState: "రాష్ట్రాన్ని ఎంచుకోండి",
    selectCity: "నగరాన్ని ఎంచుకోండి",
    selectStateFirst: "ముందు రాష్ట్రాన్ని ఎంచుకోండి",
    loadingCities: "లోడ్ అవుతోంది…",
    youllLearnWith: "మీరు వీరితో నేర్చుకుంటారు",
    sendCode: "కోడ్ పంపండి →",
    sending: "పంపుతోంది…",
    alreadyRegistered: "ఇప్పటికే నమోదు చేసుకున్నారా? సైన్ ఇన్ చేయండి",
    enterCode: "కోడ్ నమోదు చేయండి",
    codeSentTo: (phone) => `${phone} కు ఆరు అంకెల కోడ్ పంపాము`,
    registering: "నమోదు అవుతోంది…",
    register: "నమోదు చేయండి →",
    yourAcharya: "మీ ఆచార్య",
    chatToFillForm: "చాట్ ద్వారా ఫారం నింపండి",
    helperHint:
      "మాట్లాడి ఫారం నింపండి, లేదా రాసి చాట్ చేయండి — ముందు భాష, తర్వాత మీ వివరాలు. ఇమెయిల్, మీ పని గురించిన వాక్యం ఐచ్ఛికం.",
    listening: "వింటున్నాను",
    youSpeaker: "మీరు",
    helpGreeting: (name) =>
      `నమస్తే. నేను ${name}. ముందు భాష చెప్పండి — తెలుగు, ఇంగ్లీష్, హిందీ, బెంగాలీ, ఫ్రెంచ్ లేదా అమ్హారిక్? తర్వాత మీ పేరు, ఫోన్, వృత్తి, ఊరు, చిరునామా నింపుతాము. ఇమెయిల్, మీ పని గురించి ఒక వాక్యం ఐచ్ఛికం — అయినా నేను అడుగుతాను.`,
    cityDidYouMeanOptions: (names) => `మీరు వీటిలో ఏదైనా అన్నారా — ${names.join(", ")}? ఏదో చెప్పండి.`,
    cityDidYouMeanNearest: (name) => `ఆ నగరం సరిగ్గా దొరకలేదు. మీరు ${name} అన్నారా?`,
    cityNotFound: "మీ రాష్ట్ర జాబితాలో ఆ నగరం దొరకలేదు. మళ్ళీ చెప్పగలరా, లేదా రాష్ట్రం సరైనదో చూడండి?",
  },
  am: {
    title: "ለመማር ይመዝገቡ",
    subtitle: "ስለ ራስዎ ይንገሩን። ከሁሉም አቻርያዎች ጋር ይቀላቀላሉ፤ ከጸደቁ በኋላ ሥራዎች ይታያሉ።",
    yourLanguage: "የሚናገሩት ቋንቋ",
    langEn: "English",
    langHi: "हिंदी",
    langBn: "বাংলা",
    langFr: "Français",
    langTe: "తెలుగు",
    langAm: "አማርኛ",
    firstName: "ስም",
    lastName: "የአባት ስም",
    mobile: "የሞባይል ቁጥር",
    email: "ኢሜል",
    trade: "ሙያ",
    state: "ክልል",
    city: "ከተማ",
    address: "አድራሻ",
    pincode: "ፒን ኮድ",
    aboutWork: "ስለ ሥራዎ",
    optional: "(አማራጭ)",
    selectTrade: "ሙያዎን ይምረጡ",
    selectState: "ክልል ይምረጡ",
    selectCity: "ከተማ ይምረጡ",
    selectStateFirst: "መጀመሪያ ክልል ይምረጡ",
    loadingCities: "በመጫን ላይ…",
    youllLearnWith: "የሚማሩት ከ",
    sendCode: "ኮድ ላክ →",
    sending: "በመላክ ላይ…",
    alreadyRegistered: "ቀድሞ ተመዝግበዋል? ይግቡ",
    enterCode: "ኮዱን ያስገቡ",
    codeSentTo: (phone) => `ስድስት አሃዝ ኮድ ወደ ${phone} ተልኳል`,
    registering: "በመመዝገብ ላይ…",
    register: "ተመዝገብ →",
    yourAcharya: "አቻርያዎ",
    chatToFillForm: "ቅጹን በውይይት ይሙሉ",
    helperHint:
      "ቅጹን በመናገር ይሙሉ፣ ወይም በጽሑፍ ይወያዩ — መጀመሪያ ቋንቋ፣ ከዚያ ዝርዝሮችዎ። ኢሜል እና ስለ ሥራዎ ያለው መስመር አማራጭ ናቸው።",
    listening: "እያዳመጥኩ ነው",
    youSpeaker: "እርስዎ",
    helpGreeting: (name) =>
      `ሰላም። እኔ ${name} ነኝ። መጀመሪያ ቋንቋ ይምረጡ — አማርኛ፣ እንግሊዝኛ፣ ሂንዲ፣ ቤንጋሊ፣ ፈረንሳይኛ ወይስ ቴሉጉ? ከዚያ ስምዎን፣ ስልክዎን፣ ሙያዎን፣ ቦታዎን እና አድራሻዎን እንሞላለን። ኢሜል እና ስለ ሥራዎ አንድ መስመር አማራጭ ናቸው — ቢሆንም እጠይቃለሁ።`,
    cityDidYouMeanOptions: (names) => `ከእነዚህ አንዱን ማለትዎ ነው — ${names.join("፣ ")}? የትኛው እንደሆነ ይንገሩኝ።`,
    cityDidYouMeanNearest: (name) => `ያንን ከተማ በትክክል ማግኘት አልቻልኩም። ${name} ማለትዎ ነው?`,
    cityNotFound: "ያንን ከተማ በክልልዎ ዝርዝር ውስጥ ማግኘት አልቻልኩም። እንደገና ሊሉት ይችላሉ፣ ወይም ክልሉን ያረጋግጡ?",
  },
};

export function registerCopy(lang: Lang): RegisterCopy {
  return COPY[lang] || COPY.en;
}

export function normalizeRegisterLang(raw: unknown): Lang {
  const s = String(raw || "").trim().toLowerCase();
  if (!s) return "en";
  // Hindi (incl. Devanagari spellings + common voice mis-hears)
  if (
    s === "hi" ||
    s === "hin" ||
    s.startsWith("hindi") ||
    s.startsWith("hind") ||
    s.includes("हिंद") ||
    s.includes("हिन्द") ||
    s.includes("हिंदी") ||
    s.includes("हिन्दी")
  ) {
    return "hi";
  }
  // Bengali / Bangla
  if (
    s === "bn" ||
    s.startsWith("beng") ||
    s.includes("bangla") ||
    s.includes("বাংলা") ||
    s.includes("বাঙা")
  ) {
    return "bn";
  }
  // French / Français
  if (s === "fr" || s === "fra" || s.startsWith("fren") || s.startsWith("fran")) {
    return "fr";
  }
  // Telugu (incl. Telugu-script spelling + common voice mis-hears)
  if (
    s === "te" ||
    s === "tel" ||
    s.startsWith("telu") ||
    s.startsWith("telg") ||
    s.startsWith("teleg") || // "telegu" — the common misspelling / mis-hear
    s.includes("తెలుగు") ||
    s.includes("तेलुगु")
  ) {
    return "te";
  }
  // Amharic (incl. Ethiopic-script spelling + common voice mis-hears)
  if (
    s === "am" ||
    s === "amh" ||
    s.startsWith("amhar") ||
    s.startsWith("amhe") ||
    s.startsWith("amar") ||
    s.includes("አማርኛ") ||
    s.includes("अम्हारिक")
  ) {
    return "am";
  }
  if (s === "en" || s.startsWith("eng")) return "en";
  return "en";
}
