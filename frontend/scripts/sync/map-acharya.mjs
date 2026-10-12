// PR #207 path (relative to the omnidel-acharya repo) -> path in OmniDel/frontend.

const COMPONENT_GROUPS = {
  shell: [
    "AcharyaShell.tsx", "AcharyaHeader.tsx", "AcharyaHeaderMorph.tsx", "AcharyaBoardChrome.module.css",
    "WorkAppFrame.tsx", "AppBootstrap.tsx", "IndicFontScope.tsx", "instant-nav.tsx", "nav-skeletons.tsx",
    "NoticeBanner.tsx", "ProfileMenu.tsx",
  ],
  persona: ["acharya-avatar.tsx", "AcharyaPortrait.tsx", "AcharyaReelsFeed.tsx", "FeaturedAcharyaCard.tsx"],
  chat: [
    "AcharyaThread.tsx", "BoardAcharyaChat.tsx", "HomeMahAcharyaChat.tsx", "HomeMahAcharyaGuide.tsx",
    "HomeMahAcharyaGuideLazy.tsx", "QuickPrompts.tsx",
  ],
  tasks: [
    "task-board.tsx", "task-card.tsx", "TaskDescription.tsx", "ActiveTaskSession.tsx", "attempt-info-badge.tsx",
    "request-time-button.tsx", "timer-ring.tsx", "update-capture-sheet.tsx", "ContinueWhereYouLeftOff.tsx",
    "WorkProgressOverview.tsx", "WorkSymbol.tsx",
  ],
  ui: ["CustomSelect.tsx", "SearchableSelect.tsx", "ghost-icon-button.ts"],
  auth: ["RegisterHelpSheet.tsx"],
  learn: ["CommentRichBody.tsx"],
  voice: ["AnamAvatarPanel.tsx"],
};
const groupOf = new Map();
for (const [g, names] of Object.entries(COMPONENT_GROUPS)) for (const n of names) groupOf.set(n, g);

const SCREENS = {
  "src/app/(app)/acharyas/AcharyasHomeClient.tsx": "home/AcharyasHomeClient.tsx",
  "src/app/(app)/acharyas/[slug]/AcharyaBoardClient.tsx": "board/AcharyaBoardClient.tsx",
  "src/app/(app)/acharyas/[slug]/tasks/[taskId]/TaskDetailClient.tsx": "task/TaskDetailClient.tsx",
  "src/app/(app)/acharyas/[slug]/tasks/[taskId]/learn/LearnPageClient.tsx": "task/LearnPageClient.tsx",
  "src/app/(app)/acharyas/[slug]/tasks/[taskId]/active/page.tsx": "task/ActiveTaskPage.tsx",
  "src/app/(app)/tasks/TasksPageClient.tsx": "tasks/TasksPageClient.tsx",
  "src/app/(app)/settings/SettingsClient.tsx": "settings/SettingsClient.tsx",
  "src/app/auth/phone/request-otp/RequestOtpClient.tsx": "auth/RequestOtpClient.tsx",
  "src/app/auth/phone/verify-otp/VerifyOtpClient.tsx": "auth/VerifyOtpClient.tsx",
};
const STYLES = {
  "src/app/globals.css": "src/acharya/styles/globals.css",
  "src/app/work-journey.css": "src/acharya/styles/work-journey.css",
};

export default function map(rel) {
  if (rel.startsWith("src/components/")) {
    const sub = rel.slice("src/components/".length);
    if (sub.includes("/")) return "src/components/acharya/" + sub; // auth/ learn/ voice/ keep their folder
    const g = groupOf.get(sub);
    if (!g) throw new Error("no component group for " + sub);
    return `src/components/acharya/${g}/${sub}`;
  }
  if (STYLES[rel]) return STYLES[rel];
  if (SCREENS[rel]) return "src/acharya/screens/" + SCREENS[rel];
  if (rel.startsWith("src/app/(app)/tasks/[id]/")) return "src/acharya/screens/task/" + rel.split("/").pop();
  if (rel.startsWith("src/app/(app)/profile/")) return "src/acharya/screens/profile/" + rel.split("/").pop();
  if (rel.startsWith("src/lib/")) return "src/acharya/lib/" + rel.slice("src/lib/".length);
  if (rel.startsWith("src/hooks/")) return "src/acharya/hooks/" + rel.slice("src/hooks/".length);
  throw new Error("unmapped " + rel);
}
