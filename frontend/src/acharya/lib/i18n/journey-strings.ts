import type { Lang } from "@/acharya/lib/store";

const en = {
  home: "Home", work: "My work", progress: "Progress", stories: "Stories", profile: "Profile",
  todo: "To do", talkNow: "Talk now", refresh: "Refresh tasks", navigation: "Main navigation", tagline: "A little better, every day.",
  journey: "Your work journey", momentum: "Small steps. Real progress.",
  assignedWork: "Tasks shown in My work", completed: "completed",
  ready: "Ready to start", inProgress: "In progress", inReview: "In review",
  nextStep: "Your next step", continueWork: "Continue your work", startWork: "Make a start",
  guideInvite: "Ask a question. Find your next step.", yourGuide: "YOUR ACHARYA", guideAction: "Open workspace", mentors: "Your guides",
  seeWork: "See all work", noTasks: "Your next chapter starts here.",
  noTasksBody: "Your assigned work will appear here. In the meantime, talk with your Acharya.",
  completeTitle: "Look how far you’ve come.", allDone: "The work shown here is complete.",
  reviewNote: "Submitted work stays in review until it is checked.",
  progressAria: (done: number, total: number) => `${done} completed · ${total} tasks shown`,
};
type JourneyStrings = typeof en;
const hi: JourneyStrings = {
  home: "होम", work: "मेरा काम", progress: "प्रगति", stories: "कहानियाँ", profile: "प्रोफ़ाइल",
  todo: "करना है", talkNow: "बात करें", refresh: "काम रीफ़्रेश करें", navigation: "मुख्य नेविगेशन", tagline: "हर दिन, थोड़ा बेहतर।",
  journey: "आपके काम का सफ़र", momentum: "छोटे कदम। सच्ची प्रगति।",
  assignedWork: "मेरा काम में दिखाए गए काम", completed: "पूरे हुए",
  ready: "शुरू करने के लिए", inProgress: "चल रहा है", inReview: "समीक्षा में",
  nextStep: "आपका अगला कदम", continueWork: "अपना काम जारी रखें", startWork: "शुरुआत करें",
  guideInvite: "सवाल पूछें। अपना अगला कदम जानें।", yourGuide: "आपके आचार्य", guideAction: "काम देखें", mentors: "आपके मार्गदर्शक",
  seeWork: "सभी काम देखें", noTasks: "आपका अगला अध्याय यहीं से।",
  noTasksBody: "सौंपा गया काम यहाँ दिखेगा। तब तक अपने आचार्य से बात करें।",
  completeTitle: "देखिए, आप कितना आगे आए हैं।", allDone: "यहाँ दिखाए गए काम पूरे हुए।",
  reviewNote: "जमा किया गया काम जाँच पूरी होने तक समीक्षा में रहता है।",
  progressAria: (done, total) => `${total} दिखाए गए कामों में से ${done} पूरे हुए`,
};
const bn: JourneyStrings = {
  home: "হোম", work: "আমার কাজ", progress: "অগ্রগতি", stories: "গল্প", profile: "প্রোফাইল",
  todo: "বাকি", talkNow: "কথা বলুন", refresh: "কাজ রিফ্রেশ করুন", navigation: "প্রধান নেভিগেশন", tagline: "প্রতিদিন, একটু ভালো।",
  journey: "আপনার কাজের যাত্রা", momentum: "ছোট পদক্ষেপ। সত্যিকারের অগ্রগতি।",
  assignedWork: "আমার কাজে দেখানো কাজ", completed: "সম্পূর্ণ",
  ready: "শুরু করার জন্য", inProgress: "চলছে", inReview: "পর্যালোচনায়",
  nextStep: "আপনার পরের পদক্ষেপ", continueWork: "আপনার কাজ চালিয়ে যান", startWork: "শুরু করুন",
  guideInvite: "প্রশ্ন করুন। আপনার পরের পদক্ষেপ জানুন।", yourGuide: "আপনার আচার্য", guideAction: "কাজ দেখুন", mentors: "আপনার পথপ্রদর্শক",
  seeWork: "সব কাজ দেখুন", noTasks: "আপনার পরের অধ্যায় এখান থেকেই।",
  noTasksBody: "আপনাকে দেওয়া কাজ এখানে দেখাবে। ততক্ষণ আপনার আচার্যের সঙ্গে কথা বলুন।",
  completeTitle: "দেখুন, আপনি কত দূর এসেছেন।", allDone: "এখানে দেখানো কাজগুলি সম্পূর্ণ।",
  reviewNote: "জমা দেওয়া কাজ যাচাই না হওয়া পর্যন্ত পর্যালোচনায় থাকে।",
  progressAria: (done, total) => `${total}টি দেখানো কাজের মধ্যে ${done}টি সম্পূর্ণ`,
};
export function journeyStrings(lang: Lang): JourneyStrings {
  return lang === "hi" ? hi : lang === "bn" ? bn : en;
}
