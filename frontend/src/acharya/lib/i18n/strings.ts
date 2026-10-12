/**
 * Karigar UI copy — en / hi / bn / fr.
 *
 * Pattern for every new user-visible string:
 * 1. Add the key to `type Strings` below.
 * 2. Fill en, hi, bn and fr in `STRINGS` (never leave a language missing).
 * 3. In components: `const s = useStrings()` then `s.myKey` (or `s.fn(args)`).
 * 4. For media helpers that are not React: `import { t } from "@/acharya/lib/i18n/strings"` + `t(lang)`.
 *
 * Do NOT hardcode English in JSX. Dynamic content (task titles, persona from DB)
 * is separate: personas go through mst_acharyas_tr + schedulePersonaTranslations.
 */
import type { Lang } from "@/acharya/lib/store";
import type { AcharyaField } from "@/acharya/lib/acharya-field";

type Strings = {
  task: string;
  planned: string;
  doing: string;
  /** Board lane between Doing and Done: submitted, waiting on the manager. */
  review: string;
  done: string;
  description: string;
  acharya: string;
  plannedTime: string;
  sessions: string;
  totalDuration: string;
  breaksPerSession: string;
  noDescription: string;
  learn: string;
  startTask: string;
  /** Subtask-timing CTA: which session of the CURRENT subtask to start. */
  startSubtaskSession: (sessionOf: number, sessionTotal: number, title: string) => string;
  starting: string;
  markDone: string;
  markTaskDone: string;
  reviewingTask: string;
  submitTask: string;
  openTimer: string;
  attemptRunning: string;
  attemptActive: string;
  attemptPaused: string;
  breaksRemaining: (n: number) => string;
  // One-task-at-a-time guard
  anotherTaskActive: string;
  anotherTaskActiveDetail: (title: string) => string;
  goToRunningTask: string;
  readyToStart: string;
  chat: string;
  quiz: string;
  learnTab: string;
  video: string;
  comments: string;
  videoLoadError: string;
  videoWatchLearn: string;
  videoWatchLearnSubtitle: string;
  videoRelatedYoutube: string;
  videoSearchingLabel: string;
  videoWatchTutorials: string;
  videoSuggestedPicks: string;
  videoPlayHere: string;
  videoPlayInside: string;
  videoTapBrowse: string;
  videoTutorial: string;
  loading: string;
  back: string;
  tryAgain: string;
  summarisePrompt: string;
  chatWelcome: string;
  chatPlaceholder: string;
  summariseCta: string;
  findingVideos: string;
  findingReferences: string;
  goToTimer: string;
  subtaskComplete: string;
  sessionComplete: string;
  completed: string;
  readyToStartPrefix: string;
  startThisTask: string;
  chatWelcomeShort: string;
  // Tasks list page
  tasksTitle: string;
  yourWork: string;
  overallProgress: string;
  progressCompleted: (pct: number) => string;
  logout: string;
  refreshing: string;
  sessionRunning: string;
  sessionPaused: string;
  openRunningTask: (title: string) => string;
  loadingTasks: string;
  couldNotLoadTasks: string;
  nothingInLane: (lane: string) => string;
  noTasksHere: string;
  noTasksYet: string;
  noTasksAssigned: string;
  taskLanes: string;
  blocked: string;
  today: string;
  tomorrow: string;
  daysLate: (n: number) => string;
  daysShort: (n: number) => string;
  openTask: (title: string) => string;
  acharyaFrom: (source: string) => string;
  // Acharya spotlight + guidance
  acharyaRole: string;
  acharyaWillGuide: (name: string) => string;
  // Quiz landing
  quizScopeTitle: string;
  lesson: string;
  session: string;
  // Home screen (Your Acharyas)
  yourAcharyas: string;
  acharyasEyebrow: string;
  noTasksWithAcharya: string;
  learnWithAcharya: (name: string) => string;
  /** Row meta on home when an acharya has no tasks but does have a story reel. */
  watchStory: string;
  activeTask: string;
  openTaskCta: string;
  openAcharya: string;
  /** Field tag under an Acharya's name on home — FINANCE / BUSINESS / … */
  acharyaFieldLabel: (field: AcharyaField) => string;
  /** Second page of home reels — heading above story cards. */
  acharyaStories: string;
  /** Hint on the home list: the reels page is one swipe to the left. */
  swipeForStories: string;
  /** Resume card on home — eyebrow above the screen the karigar was last on. */
  continueWhereYouLeftOff: string;
  /** Resume card CTA. */
  resume: string;
  /** Eyebrow on the full-screen live conversation view. */
  liveConversation: string;
  /** Collapses the full-screen conversation back to the card (call stays live). */
  minimizeConversation: string;
  storyReelSubtitle: string;
  storyFrameLabels: [string, string, string, string];
  /** Default story title when no per-slug copy: "{name}'s story". */
  storyTitleFor: (name: string) => string;
  /** Story frame captions when no per-slug English copy is localized. */
  storyFrameCaptionsFor: (name: string, personaSummary: string | null) => [string, string, string, string];
  profileAria: string;
  /** Live voice caption: who is speaking (user side). */
  youSpeaker: string;
  askWhatToLearn: (name: string) => string;
  /** Back one question in a quiz. */
  quizPrevious: string;
  /** Forward one lesson card. */
  lessonNext: string;
  /** Position in the lesson deck, e.g. "2 of 5". */
  lessonModuleOf: (current: number, total: number) => string;
  /** Shown on the result, under the score. */
  quizWellDone: string;
  quizTryAgainSoon: string;
  /**
   * Openers on an empty chat. A karigar staring at a blank box and a blinking
   * cursor does not know what an Acharya is FOR — these are the four things
   * they actually come to ask, in their own words, one tap away.
   */
  chatQuickTodayWork: string;
  chatQuickHowToDo: string;
  chatQuickSession: string;
  chatQuickProof: string;
  /** What each chip actually sends, which is longer than its label. */
  chatQuickTodayWorkPrompt: string;
  chatQuickHowToDoPrompt: string;
  chatQuickSessionPrompt: string;
  chatQuickProofPrompt: string;
  /** Soft CTA on /acharyas home to open MahAcharya navigator chat. */
  askMahAcharyaCta: (name: string) => string;
  /** Mic on home soft CTA — starts MahAcharya Gemini Live (no chat sheet). */
  talkMahAcharyaAria: (name: string) => string;
  homeMahAcharyaEyebrow: string;
  homeMahAcharyaWelcome: (name: string) => string;
  taskCountSummary: (counts: { doing: number; planned: number; done: number }) => string;
  // Profile / Karigar Network tabs
  profileTabReport: string;
  profileTabHistory: string;
  profileTabRequests: string;
  /**
   * Label for the identity/details tab. Named "About" — NOT "Profile" — because
   * the page header already says Profile; the tab is the *about you* section.
   * `profileTabProfile` stays as the page title / aria copy.
   */
  profileTabAbout: string;
  profileTabProfile: string;
  /** Eyebrow above Profile title (header). */
  karigarNetwork: string;
  /** Fallback display name / trade when profile is empty. */
  karigarFallback: string;
  /** Prefix for public slug line: "ID - slug". */
  profileIdLabel: string;
  roleAdmin: string;
  roleWorker: string;
  /** Map API role strings (ADMIN, worker, …) to UI labels. */
  roleLabelFor: (role: string | null | undefined) => string;
  backToProfile: string;
  backToAcharyas: string;
  profileSectionsAria: string;
  workerStatsAria: string;
  taskLanguage: string;
  openTasksIn: string;
  /** Settings: the language the Acharya SPEAKS in voice — separate from the app language. */
  voiceLanguageSection: string;
  acharyaSpeaksIn: string;
  voiceLanguageHint: string;
  voiceLanguageSameAsApp: string;
  /** Settings: accessibility text-size control. */
  textSizeSection: string;
  textSizeHint: string;
  textSizeNormal: string;
  textSizeLarge: string;
  textSizeLarger: string;
  /** Settings panel: how the MahAcharya guide behaves. Takes the acharya's own name. */
  mahAcharyaSection: string;
  autoStartAsk: (name: string) => string;
  autoStartAskHint: (name: string) => string;
  savingLabel: string;
  accountSection: string;
  userIdLabel: string;
  linkRequested: string;
  linkInvited: string;
  linkResponded: string;
  linkEnded: string;
  networkCompany: string;
  linkStatusLabel: (status: string) => string;
  reportSheet: string;
  reportEmpty: string;
  tasksDone: string;
  jobsDone: string;
  avgScore: string;
  avgScoreShort: string;
  taskHistoryTitle: string;
  /** Headline of the empty task-history card. Its second sentence is `…Body`. */
  taskHistoryEmpty: string;
  taskHistoryEmptyBody: string;
  taskHistoryUntitled: string;
  publicCard: string;
  completeProfileTitle: string;
  completeProfileBody: string;
  invitesToYou: string;
  noInvites: string;
  exploreMsmes: string;
  exploreMsmesSub: string;
  noOrgsYet: string;
  requestToJoin: string;
  cancelRequest: string;
  linkedStamp: string;
  respondAbove: string;
  // Notices — OmniDel writes the feed in English; copy is re-authored per language.
  noticeUnlinkedTitle: string;
  noticeUnlinkedBody: string;
  noticeDismiss: string;
  noticesTitle: string;
  noticesAria: (count: number) => string;
  accept: string;
  decline: string;
  historyEmpty: string;
  yourDetails: string;
  edit: string;
  settings: string;
  save: string;
  saved: string;
  publicProfile: string;
  showCardPublicly: string;
  copyLink: string;
  copied: string;
  openCard: string;
  photoSection: string;
  addPhoto: string;
  changePhoto: string;
  photoOptions: string;
  previewPhoto: string;
  addNewPhoto: string;
  takePhoto: string;
  chooseFromGallery: string;
  cancel: string;
  removingPhoto: string;
  // Voice / shell chrome
  startConversation: string;
  endConversation: string;
  videoAvatarOpen: string;
  videoAvatarLanguageNote: string;
  videoAvatarStarting: (name: string) => string;
  endVideoCall: string;
  close: string;
  endConversationWith: (name: string) => string;
  /** Home bar when an Acharya conversation is still live after leaving the board. */
  stillTalkingWith: (name: string) => string;
  returnToBoard: string;
  /** Tooltip / a11y name on the draggable conversation pill (board dock). */
  moveConversationPill: string;
  connecting: string;
  retry: string;
  chatWith: (name: string) => string;
  // Quiz landing card
  quizReadyTitle: string;
  quizReadySubtitle: string;
  startQuiz: string;
  // Video empty state
  noVideoYet: string;
  noVideoYetBody: string;
  // Learn empty state
  noCourseYet: string;
  noCourseYetBody: string;
  // Comments composer
  taskComments: string;
  commentPlaceholder: string;
  photo: string;
  postComment: string;
  posting: string;
  noCommentsYet: string;
  noCommentsYetBody: string;
  loadingComments: string;
  couldNotLoadComments: string;
  couldNotPostComment: string;
  commentTooShort: string;
  removePhoto: string;
  attachPhoto: string;
  uploadingPhoto: string;
  /** Comments tab — manager approved the final score */
  commentsApproved: string;
  /** Comments tab — still waiting on OmniPulse Review */
  commentsAwaitingApproval: string;
  commentsYourScore: string;
  commentsAcharyaScore: string;
  commentsScorePendingBody: string;
  commentsScoreApprovedBody: string;
  showMore: string;
  showLess: string;
  firstNameLabel: string;
  lastNameLabel: string;
  phoneLabel: string;
  emailLabel: string;
  tradeLabel: string;
  stateLabel: string;
  cityLabel: string;
  addressLabel: string;
  pincodeLabel: string;
  bioLabel: string;
  roleLabel: string;
  branchLabel: string;
  primaryTeamLabel: string;
  // Profile form placeholders + validation / error copy
  selectTrade: string;
  selectState: string;
  selectCity: string;
  selectStateFirst: string;
  loadingCities: string;
  addressPlaceholder: string;
  pincodePlaceholder: string;
  bioPlaceholder: string;
  enterFirstName: string;
  enterValidEmail: string;
  enterValidPincode: string;
  couldNotSave: string;
  couldNotLoadProfile: string;
  couldNotUpdate: string;
  couldNotCopyLink: string;
  couldNotLoadRequests: string;
  couldNotRespond: string;
  couldNotSendRequest: string;
  couldNotCancel: string;
  photoTypeError: string;
  photoSizeError: string;
  couldNotUploadPhoto: string;
  couldNotRemovePhoto: string;
  notAdded: string;
  tasksDoneTotal: (n: number) => string;
  // Proof / Share your progress sheet
  proofSessionHeading: string;
  proofSubtaskHeading: string;
  proofBreakHeading: string;
  proofSessionEyebrow: string;
  proofSubtaskEyebrow: string;
  proofBreakEyebrow: string;
  proofHelperRequired: string;
  proofHelperOptional: string;
  proofHelperBreak: string;
  proofTakePhoto: string;
  proofChooseGallery: string;
  proofAddAnother: (n: number, max: number) => string;
  proofMaxPhotos: (max: number) => string;
  proofDescribeLabel: string;
  proofDescribePlaceholder: string;
  proofSubmitUpdate: string;
  proofSubmitProof: string;
  proofSubmitBreak: string;
  proofTakeBreak: string;
  proofCancel: string;
  proofBreakWithout: string;
  proofNeedImage: string;
  proofNeedText: string;
  proofTabImage: string;
  proofTabText: string;
  /** Profile crop sheet */
  cropPhotoTitle: string;
  cropPhotoHint: string;
  cropRotate: string;
  cropApply: string;
  cropUsePhoto: string;
  cropZoomIn: string;
  cropZoomOut: string;
  /** Multi-attempt sessions: retry counter, inactivity grace, time extensions */
  attemptWord: string;
  attemptOfWord: string;
  attemptScorePenalty: string;
  attemptRetriesLeft: string;
  attemptNoRetriesLeft: string;
  requestTime: string;
  requestTimeTitle: string;
  requestTimeEyebrow: string;
  requestTimeBody: string;
  requestTimeBodyExpired: string;
  requestTimeApply: string;
  requestTimeUsedLabel: string;
  requestTimeAllUsed: string;
  requestTimeFailed: string;
  minutesShort: string;
  inactivityWarning: string;
  inactivityClosedTitle: string;
  inactivityClosedBody: string;
  habit: string;
  noScoreImpact: string;
};

const STRINGS: Record<Lang, Strings> = {
  en: {
    task: "Task",
    planned: "Planned",
    doing: "Doing",
    review: "Review",
    done: "Done",
    description: "Description",
    acharya: "Acharya",
    plannedTime: "Planned time",
    sessions: "Sessions",
    totalDuration: "Total duration",
    breaksPerSession: "Breaks per session",
    noDescription: "No description provided.",
    learn: "Learn",
    startTask: "Start work session",
    startSubtaskSession: (sessionOf, sessionTotal, title) =>
      `Start with ${title}`,
    starting: "Starting…",
    markDone: "Mark as done",
    markTaskDone: "Mark task as Done",
    reviewingTask: "Reviewing the task",
    submitTask: "Submit task",
    openTimer: "Open timer",
    attemptRunning: "Attempt running",
    attemptActive: "Your work session is active.",
    attemptPaused: "On break for now.",
    breaksRemaining: (n) => `${n} breaks remaining.`,
    anotherTaskActive: "Another task is running",
    anotherTaskActiveDetail: (title) =>
      title
        ? `Pause or finish “${title}” first — only one timer runs at a time. A paused task waits for you.`
        : "Pause or finish your running task first — only one timer runs at a time. A paused task waits for you.",
    goToRunningTask: "Go to running task",
    readyToStart: "Ready to start",
    chat: "Chat",
    quiz: "Quiz",
    learnTab: "Learn",
    video: "Video",
    comments: "Comments",
    videoLoadError: "Could not load videos.",
    videoWatchLearn: "Watch and learn",
    videoWatchLearnSubtitle: "Short tutorials related to this task.",
    videoRelatedYoutube: "Related YouTube videos",
    videoSearchingLabel: "Searching",
    videoWatchTutorials: "Watch tutorials",
    videoSuggestedPicks: "Suggested picks",
    videoPlayHere: "Play here",
    videoPlayInside: "Play inside the app",
    videoTapBrowse: "Tap to browse",
    videoTutorial: "Tutorial video",
    loading: "Loading",
    back: "Back",
    tryAgain: "Try again",
    summarisePrompt: "Please summarise this task in one sentence and tell me what to do first.",
    chatWelcome: "Namaste! I'm your Acharya for this task. Ask me anything — or tap below to get a quick summary.",
    chatPlaceholder: "Ask your Acharya…",
    summariseCta: "Summarise this task",
    findingVideos: "Finding tutorial videos…",
    findingReferences: "Finding references for your task",
    goToTimer: "Go to timer",
    subtaskComplete: "Subtask complete",
    sessionComplete: "Session complete",
    completed: "Completed",
    readyToStartPrefix: "Ready to start",
    startThisTask: "Start this task",
    chatWelcomeShort: "Namaste — type below, or start a voice chat with your Acharya to ask about this task.",
    tasksTitle: "Tasks",
    yourWork: "Your work",
    overallProgress: "Overall progress",
    progressCompleted: (pct) => `${pct}% of tasks completed`,
    logout: "Log out",
    refreshing: "Refreshing",
    sessionRunning: "Running",
    sessionPaused: "Paused",
    openRunningTask: (title) => `Open running task: ${title}`,
    loadingTasks: "Loading tasks",
    couldNotLoadTasks: "Could not load tasks.",
    nothingInLane: (lane) => `Nothing in ${lane}.`,
    noTasksHere: "No tasks here.",
    noTasksYet: "No tasks yet.",
    noTasksAssigned:
      "You're signed in but no workspace or tasks have been assigned yet. Ask your supervisor to add you, then pull down to refresh.",
    taskLanes: "Task lanes",
    blocked: "Blocked",
    today: "Today",
    tomorrow: "Tomorrow",
    daysLate: (n) => `${n}d late`,
    daysShort: (n) => `${n}d`,
    openTask: (title) => `Open task: ${title}`,
    acharyaFrom: (source) => {
      if (source === "list") return "from column";
      if (source === "board") return "from project";
      if (source === "workspace") return "from team";
      return `from ${source}`;
    },
    acharyaRole: "AI Mentor",
    acharyaWillGuide: (name) => `${name} will guide you`,
    quizScopeTitle: "Questions cover",
    lesson: "Lesson",
    session: "Session",
    yourAcharyas: "Your Acharyas",
    acharyasEyebrow: "MENTORS",
    noTasksWithAcharya: "No tasks yet",
    learnWithAcharya: (name) => `Learn with ${name}`,
    watchStory: "Watch story",
    activeTask: "Active task",
    openTaskCta: "Open task",
    openAcharya: "Open Acharya",
    acharyaFieldLabel: (field) =>
      ({
        finance: "Finance",
        business: "Business",
        sales: "Sales",
        marketing: "Marketing",
        operations: "Operations",
        technology: "Technology",
        guide: "Guide",
        general: "General",
      })[field],
    acharyaStories: "Acharya stories",
    swipeForStories: "Swipe for stories",
    continueWhereYouLeftOff: "Continue where you left off",
    resume: "Resume",
    liveConversation: "Live conversation",
    minimizeConversation: "Minimize",
    storyReelSubtitle: "Get to know your Acharya",
    storyFrameLabels: ["Identity", "Off-field", "Learning", "Begin"],
    storyTitleFor: (name) => `${name} story`,
    storyFrameCaptionsFor: (name, personaSummary) => [
      `${name} is here as your guide, not just a task helper.`,
      personaSummary || `${name} brings work, learning, and discipline together.`,
      "Watch, learn, and then choose the work step when you are ready.",
      `Open the task when you want to work with ${name}.`,
    ],
    profileAria: "Profile",
    youSpeaker: "You",
    askWhatToLearn: (name) => `Ask ${name} what you'd like to learn`,
    quizPrevious: "Previous",
    lessonNext: "Next",
    lessonModuleOf: (current, total) => `Part ${current} of ${total}`,
    quizWellDone: "Well done!",
    quizTryAgainSoon: "Better luck next time — try again.",
    chatQuickTodayWork: "Today's work",
    chatQuickHowToDo: "How do I do this?",
    chatQuickSession: "About the timer",
    chatQuickProof: "What photo to send",
    chatQuickTodayWorkPrompt: "What is my work today? Tell me the next step.",
    chatQuickHowToDoPrompt: "Explain how to do this task, step by step, in simple words.",
    chatQuickSessionPrompt: "How does the work session and the break work?",
    chatQuickProofPrompt: "What photo do I need to send when I finish this work?",
    askMahAcharyaCta: (name) => `Ask ${name}`,
    talkMahAcharyaAria: (name) => `Talk to ${name}`,
    homeMahAcharyaEyebrow: "Home guide",
    homeMahAcharyaWelcome: (name) => `${name} can help you get around`,
    taskCountSummary: ({ doing, planned, done }) => {
      const parts: string[] = [];
      if (doing > 0) parts.push(`${doing} Doing`);
      if (planned > 0) parts.push(`${planned} Planned`);
      if (done > 0) parts.push(`${done} Done`);
      return parts.length > 0 ? parts.join(" · ") : "No tasks yet";
    },
    profileTabReport: "Report",
    profileTabHistory: "History",
    profileTabRequests: "Requests",
    profileTabAbout: "About",
    profileTabProfile: "Profile",
    karigarNetwork: "Karigar Network",
    karigarFallback: "Karigar",
    profileIdLabel: "ID",
    roleAdmin: "Admin",
    roleWorker: "Worker",
    roleLabelFor: (role) => {
      const r = (role || "").trim().toLowerCase();
      if (r === "admin" || r === "administrator") return "Admin";
      if (r === "worker" || r === "karigar" || !r) return "Worker";
      return role!.trim();
    },
    backToProfile: "Back to profile",
    backToAcharyas: "Back to Acharyas",
    profileSectionsAria: "Profile sections",
    workerStatsAria: "Worker stats",
    taskLanguage: "Task language",
    openTasksIn: "Open tasks in",
    voiceLanguageSection: "Acharya voice",
    acharyaSpeaksIn: "Acharya speaks in",
    voiceLanguageHint: "Only changes how the Acharya talks to you. The app stays in its own language.",
    voiceLanguageSameAsApp: "Same as app",
    textSizeSection: "Text size",
    textSizeHint: "Make everything on screen bigger.",
    textSizeNormal: "Normal",
    textSizeLarge: "Large",
    textSizeLarger: "Larger",
    mahAcharyaSection: "Your guide",
    autoStartAsk: (name) => `Open Ask ${name} when the app opens`,
    autoStartAskHint: (name) =>
      `Every time you open the app, the Ask ${name} chat opens by itself. Off by default.`,
    savingLabel: "Saving",
    accountSection: "Account",
    userIdLabel: "User ID",
    linkRequested: "Requested",
    linkInvited: "Invited",
    linkResponded: "Responded",
    linkEnded: "Ended",
    networkCompany: "Network company",
    linkStatusLabel: (status) => {
      const r = (status || "").trim().toLowerCase();
      if (r === "active") return "Linked";
      if (r === "invited") return "Invited";
      if (r === "requested") return "Requested";
      if (r === "declined") return "Declined";
      if (r === "ended" || r === "unlinked") return "Ended";
      return status || "";
    },
    reportSheet: "Report sheet",
    reportEmpty: "No completed work on the network sheet yet.",
    tasksDone: "Tasks done",
    jobsDone: "Jobs done",
    avgScore: "Avg score",
    avgScoreShort: "avg",
    taskHistoryTitle: "Task history",
    taskHistoryEmpty: "No completed tasks yet",
    taskHistoryEmptyBody: "Finish work with an Acharya to build your record.",
    taskHistoryUntitled: "Task",
    publicCard: "Public card",
    completeProfileTitle: "Complete your profile",
    completeProfileBody: "Add your email, trade and city so MSMEs can find you.",
    invitesToYou: "Invites to you",
    noInvites: "No invites right now.",
    exploreMsmes: "Explore MSMEs",
    exploreMsmesSub: "Ask to join a company on the network.",
    noOrgsYet: "No companies on the network yet.",
    requestToJoin: "Request to join",
    cancelRequest: "Cancel request",
    linkedStamp: "Linked",
    respondAbove: "This MSME has invited you — respond in the Invites section above.",
    noticeUnlinkedTitle: "Your KarmYog link has ended",
    noticeUnlinkedBody: "KarmYog has unlinked you. Your profile stays active — you can send a join request again from the Requests tab.",
    noticeDismiss: "Got it",
    noticesTitle: "Notifications",
    noticesAria: (count) =>
      count === 1 ? "1 notification" : `${count} notifications`,
    accept: "Accept",
    decline: "Decline",
    historyEmpty: "No company links yet. Find MSMEs in the Requests tab.",
    yourDetails: "Your details",
    edit: "Edit",
    settings: "Settings",
    save: "Save",
    saved: "Saved.",
    publicProfile: "Public profile",
    showCardPublicly: "Show my card publicly",
    copyLink: "Copy link",
    copied: "Copied",
    openCard: "Open card",
    photoSection: "Photo",
    addPhoto: "Add photo",
    changePhoto: "Change photo",
    photoOptions: "Photo options",
    previewPhoto: "Preview",
    addNewPhoto: "Add new",
    takePhoto: "Take photo",
    chooseFromGallery: "Choose from gallery",
    cancel: "Cancel",
    removingPhoto: "Removing…",
    startConversation: "Start conversation",
    endConversation: "End",
    videoAvatarOpen: "Start a video call",
    videoAvatarLanguageNote: "The video avatar speaks English and Hindi only for now.",
    videoAvatarStarting: (name) => `Connecting you to ${name}...`,
    endVideoCall: "End call",
    close: "Close",
    endConversationWith: (name) => `End the conversation with ${name}`,
    stillTalkingWith: (name) => `Still talking with ${name}`,
    returnToBoard: "Return",
    moveConversationPill: "Drag to move",
    connecting: "Connecting…",
    retry: "Retry",
    chatWith: (name) => `Chat with ${name}`,
    quizReadyTitle: "Ready to test yourself?",
    quizReadySubtitle: "5 questions · ~3 minutes · generated from this task",
    startQuiz: "Start quiz",
    noVideoYet: "No video yet",
    noVideoYetBody: "Story and course videos will appear here once they are added for this Acharya.",
    noCourseYet: "No course yet",
    noCourseYetBody: "Start a conversation with your Acharya from the top bar.",
    taskComments: "Task comments",
    commentPlaceholder: "Add a note for this task...",
    photo: "Photo",
    postComment: "Post comment",
    posting: "Posting…",
    noCommentsYet: "No comments yet",
    noCommentsYetBody: "Task notes, manager comments, and photo updates will appear here.",
    loadingComments: "Loading comments…",
    couldNotLoadComments: "Could not load comments.",
    couldNotPostComment: "Could not post comment.",
    commentTooShort: "Comment needs at least 2 characters.",
    removePhoto: "Remove photo",
    attachPhoto: "Attach photo",
    uploadingPhoto: "Uploading…",
    commentsApproved: "Approved",
    commentsAwaitingApproval: "Awaiting approval",
    commentsYourScore: "Your score",
    commentsAcharyaScore: "Acharya score",
    commentsScorePendingBody: "Your Acharya scored this task. A manager will confirm the final score.",
    commentsScoreApprovedBody: "Your team manager approved the final score.",
    showMore: "Show more",
    showLess: "Show less",
    firstNameLabel: "First name",
    lastNameLabel: "Last name",
    phoneLabel: "Phone",
    emailLabel: "Email",
    tradeLabel: "Trade",
    stateLabel: "State",
    cityLabel: "City",
    addressLabel: "Address",
    pincodeLabel: "PIN code",
    bioLabel: "About your work",
    roleLabel: "Role",
    branchLabel: "Branch",
    primaryTeamLabel: "Primary team",
    selectTrade: "Select your trade",
    selectState: "Select your state",
    selectCity: "Select your city",
    selectStateFirst: "Select a state first",
    loadingCities: "Loading cities…",
    addressPlaceholder: "House, street, area",
    pincodePlaceholder: "6-digit PIN code",
    bioPlaceholder: "A line about your work",
    enterFirstName: "Enter your first name.",
    enterValidEmail: "Enter a valid email address.",
    enterValidPincode: "Enter a valid 6-digit PIN code.",
    couldNotSave: "Could not save. Try again.",
    couldNotLoadProfile: "Could not load profile.",
    couldNotUpdate: "Could not update. Try again.",
    couldNotCopyLink: "Could not copy the link.",
    couldNotLoadRequests: "Could not load requests.",
    couldNotRespond: "Could not respond. Try again.",
    couldNotSendRequest: "Could not send the request. Try again.",
    couldNotCancel: "Could not cancel. Try again.",
    photoTypeError: "Use a JPEG, PNG or WebP image.",
    photoSizeError: "Max 4 MB.",
    couldNotUploadPhoto: "Could not upload the photo. Try again.",
    couldNotRemovePhoto: "Could not remove the photo. Try again.",
    notAdded: "Not added",
    tasksDoneTotal: (n) => (n === 1 ? "1 task done" : `${n} tasks done`),
    proofSessionHeading: "Session complete — share your progress",
    proofSubtaskHeading: "Subtask complete — upload proof",
    proofBreakHeading: "Take a break",
    proofSessionEyebrow: "session ended",
    proofSubtaskEyebrow: "subtask proof",
    proofBreakEyebrow: "break time",
    proofHelperRequired: "Add 1–5 photos and a short completion note — both are required.",
    proofHelperOptional: "Photos and a note are optional for this task — you can submit without them.",
    proofHelperBreak: "Photos and note are optional (up to 5 photos) — you can take a break without them.",
    proofTakePhoto: "Take photo",
    proofChooseGallery: "Choose from gallery",
    proofAddAnother: (n, max) => `Add another (${n}/${max})`,
    proofMaxPhotos: (max) => `Maximum ${max} photos.`,
    proofDescribeLabel: "Describe what you accomplished in this interval",
    proofDescribePlaceholder: "e.g. Completed the initial sketch for the east wall, took measurements…",
    proofSubmitUpdate: "Submit update",
    proofSubmitProof: "Submit proof",
    proofSubmitBreak: "Submit & take break",
    proofTakeBreak: "Take break",
    proofCancel: "Cancel",
    proofBreakWithout: "Take break without proof",
    proofNeedImage: "Please add at least one image proof for this subtask/session.",
    proofNeedText: "Please describe what was completed for this subtask/session.",
    proofTabImage: "Image",
    proofTabText: "Text",
    cropPhotoTitle: "Adjust photo",
    cropPhotoHint: "Drag to frame · pinch or +/− to zoom · Save when done.",
    cropRotate: "Rotate",
    cropApply: "Save",
    cropUsePhoto: "Use photo",
    cropZoomIn: "Zoom in",
    cropZoomOut: "Zoom out",
    /** Multi-attempt sessions */
    attemptWord: "Attempt",
    attemptOfWord: "of",
    attemptScorePenalty: "score",
    attemptRetriesLeft: "tries left",
    attemptNoRetriesLeft: "last try",
    requestTime: "Request time",
    requestTimeTitle: "Request more time",
    requestTimeEyebrow: "SESSION TIME",
    requestTimeBody: "Add time to this work session.",
    requestTimeBodyExpired: "Session time has ended. Add time to keep working on this task.",
    requestTimeApply: "Add time",
    requestTimeUsedLabel: "extra time used",
    requestTimeAllUsed: "You have used all the extra time for this try.",
    requestTimeFailed: "Could not add time. Please try again.",
    minutesShort: "min",
    inactivityWarning: "No activity — this session closes soon.",
    inactivityClosedTitle: "Session closed",
    inactivityClosedBody: "There was no activity for 30 minutes. This task is back in Planned — you can start it again.",
    habit: "Habit",
    noScoreImpact: "Practice · No score impact",
  },
  hi: {
    task: "कार्य",
    planned: "योजना",
    doing: "चल रहा",
    review: "समीक्षा",
    done: "पूर्ण",
    description: "विवरण",
    acharya: "आचार्य",
    plannedTime: "नियोजित समय",
    sessions: "सत्र",
    totalDuration: "कुल अवधि",
    breaksPerSession: "प्रति सत्र ब्रेक",
    noDescription: "कोई विवरण नहीं दिया गया।",
    learn: "सीखें",
    startTask: "कार्य सत्र शुरू करें",
    startSubtaskSession: (sessionOf, sessionTotal, title) =>
      `${title} से शुरू करें`,
    starting: "शुरू हो रहा…",
    markDone: "पूर्ण चिह्नित करें",
    markTaskDone: "कार्य पूर्ण चिह्नित करें",
    reviewingTask: "कार्य समीक्षा में",
    submitTask: "कार्य जमा करें",
    openTimer: "टाइमर खोलें",
    attemptRunning: "प्रयास चल रहा है",
    attemptActive: "आपका कार्य सत्र सक्रिय है।",
    attemptPaused: "अभी ब्रेक पर है।",
    breaksRemaining: (n) => `${n} ब्रेक शेष हैं।`,
    anotherTaskActive: "दूसरा कार्य चल रहा है",
    anotherTaskActiveDetail: (title) =>
      title
        ? `पहले “${title}” रोकें या पूरा करें — एक समय में एक ही टाइमर चलता है। रुका हुआ कार्य आपका इंतज़ार करेगा।`
        : "पहले अपना चालू कार्य रोकें या पूरा करें — एक समय में एक ही टाइमर चलता है। रुका हुआ कार्य आपका इंतज़ार करेगा।",
    goToRunningTask: "चालू कार्य पर जाएं",
    readyToStart: "शुरू करने के लिए तैयार",
    chat: "चैट",
    quiz: "क्विज़",
    learnTab: "सीखें",
    video: "वीडियो",
    comments: "टिप्पणियाँ",
    videoLoadError: "वीडियो लोड नहीं हो सके।",
    videoWatchLearn: "देखें और सीखें",
    videoWatchLearnSubtitle: "इस कार्य से जुड़े छोटे ट्यूटोरियल।",
    videoRelatedYoutube: "संबंधित YouTube वीडियो",
    videoSearchingLabel: "खोज",
    videoWatchTutorials: "ट्यूटोरियल देखें",
    videoSuggestedPicks: "सुझाए गए वीडियो",
    videoPlayHere: "यहीं चलाएं",
    videoPlayInside: "ऐप में चलाएं",
    videoTapBrowse: "ब्राउज़ करने के लिए टैप करें",
    videoTutorial: "ट्यूटोरियल वीडियो",
    loading: "लोड हो रहा",
    back: "वापस",
    tryAgain: "फिर कोशिश करें",
    summarisePrompt: "कृपया इस कार्य का एक वाक्य में सारांश दें और बताएं कि पहले क्या करना है।",
    chatWelcome: "नमस्ते! मैं इस कार्य के लिए आपका आचार्य हूँ। कुछ भी पूछें — या नीचे टैप करके संक्षिप्त सारांश लें।",
    chatPlaceholder: "अपने आचार्य से पूछें…",
    summariseCta: "कार्य का सारांश",
    findingVideos: "ट्यूटोरियल वीडियो खोज रहे हैं…",
    findingReferences: "आपके कार्य के लिए संदर्भ खोज रहे हैं",
    goToTimer: "टाइमर पर जाएं",
    subtaskComplete: "उपकार्य पूर्ण",
    sessionComplete: "सत्र पूर्ण",
    completed: "पूर्ण",
    readyToStartPrefix: "शुरू करने के लिए तैयार",
    startThisTask: "यह कार्य शुरू करें",
    chatWelcomeShort: "नमस्ते — नीचे लिखें, या इस काम के बारे में पूछने के लिए आचार्य से वॉइस पर बात शुरू करें।",
    tasksTitle: "कार्य",
    yourWork: "आपका कार्य",
    overallProgress: "कुल प्रगति",
    progressCompleted: (pct) => `${pct}% कार्य पूर्ण`,
    logout: "लॉग आउट",
    refreshing: "रीफ़्रेश हो रहा",
    sessionRunning: "चल रहा",
    sessionPaused: "रुका हुआ",
    openRunningTask: (title) => `चल रहा कार्य खोलें: ${title}`,
    loadingTasks: "कार्य लोड हो रहे",
    couldNotLoadTasks: "कार्य लोड नहीं हो सके।",
    nothingInLane: (lane) => `${lane} में कुछ नहीं।`,
    noTasksHere: "यहाँ कोई कार्य नहीं।",
    noTasksYet: "अभी कोई कार्य नहीं।",
    noTasksAssigned:
      "आप साइन इन हैं, लेकिन अभी कोई कार्य असाइन नहीं है। अपने सुपरवाइज़र से जोड़ने को कहें, फिर रीफ़्रेश करें।",
    taskLanes: "कार्य लेन",
    blocked: "अवरुद्ध",
    today: "आज",
    tomorrow: "कल",
    daysLate: (n) => `${n} दिन देरी`,
    daysShort: (n) => `${n} दिन`,
    openTask: (title) => `कार्य खोलें: ${title}`,
    acharyaFrom: (source) => {
      if (source === "list") return "कॉलम से";
      if (source === "board") return "प्रोजेक्ट से";
      if (source === "workspace") return "टीम से";
      return `${source} से`;
    },
    acharyaRole: "एआई गुरु",
    acharyaWillGuide: (name) => `${name} आपका मार्गदर्शन करेंगे`,
    quizScopeTitle: "प्रश्न इन पर आधारित",
    lesson: "पाठ",
    session: "सत्र",
    yourAcharyas: "आपके आचार्य",
    acharyasEyebrow: "गुरु",
    noTasksWithAcharya: "अभी कोई कार्य नहीं।",
    learnWithAcharya: (name) => `${name} के साथ सीखें`,
    watchStory: "कहानी देखें",
    activeTask: "सक्रिय कार्य",
    openTaskCta: "कार्य खोलें",
    openAcharya: "आचार्य खोलें",
    acharyaFieldLabel: (field) =>
      ({
        finance: "वित्त",
        business: "व्यवसाय",
        sales: "बिक्री",
        marketing: "मार्केटिंग",
        operations: "संचालन",
        technology: "तकनीक",
        guide: "मार्गदर्शक",
        general: "सामान्य",
      })[field],
    acharyaStories: "आचार्य कहानियाँ",
    swipeForStories: "कहानियों के लिए स्वाइप करें",
    continueWhereYouLeftOff: "जहाँ छोड़ा था वहीं से जारी रखें",
    resume: "जारी रखें",
    liveConversation: "लाइव बातचीत",
    minimizeConversation: "छोटा करें",
    storyReelSubtitle: "अपने आचार्य को जानें",
    storyFrameLabels: ["पहचान", "जीवन", "सीख", "शुरू करें"],
    storyTitleFor: (name) => `${name} की कहानी`,
    storyFrameCaptionsFor: (name, personaSummary) => [
      `${name} सिर्फ काम का सहायक नहीं, आपके मार्गदर्शक हैं।`,
      personaSummary || `${name} काम, सीख और अनुशासन को जोड़ते हैं।`,
      "देखें, सीखें, फिर जब तैयार हों तब काम चुनें।",
      `जब ${name} के साथ काम करना हो, टास्क खोलें।`,
    ],
    profileAria: "प्रोफ़ाइल",
    youSpeaker: "आप",
    askWhatToLearn: (name) => `${name} से पूछें कि आप क्या सीखना चाहते हैं`,
    quizPrevious: "पिछला",
    lessonNext: "अगला",
    lessonModuleOf: (current, total) => `भाग ${current} / ${total}`,
    quizWellDone: "शाबाश!",
    quizTryAgainSoon: "अगली बार ज़रूर होगा — फिर कोशिश करें।",
    chatQuickTodayWork: "आज का काम",
    chatQuickHowToDo: "यह कैसे करूँ?",
    chatQuickSession: "टाइमर के बारे में",
    chatQuickProof: "कौन-सी फ़ोटो भेजूँ",
    chatQuickTodayWorkPrompt: "आज मेरा काम क्या है? अगला कदम बताइए।",
    chatQuickHowToDoPrompt: "यह काम कैसे करना है, आसान शब्दों में एक-एक करके समझाइए।",
    chatQuickSessionPrompt: "काम का सेशन और ब्रेक कैसे चलता है?",
    chatQuickProofPrompt: "काम पूरा होने पर मुझे कौन-सी फ़ोटो भेजनी है?",
    askMahAcharyaCta: (name) => `${name} से पूछें`,
    talkMahAcharyaAria: (name) => `${name} से बात करें`,
    homeMahAcharyaEyebrow: "घर गाइड",
    homeMahAcharyaWelcome: (name) => `${name} आपको ऐप में घुमा सकते हैं`,
    taskCountSummary: ({ doing, planned, done }) => {
      const parts: string[] = [];
      if (doing > 0) parts.push(`${doing} चल रहा`);
      if (planned > 0) parts.push(`${planned} योजना`);
      if (done > 0) parts.push(`${done} पूर्ण`);
      return parts.length > 0 ? parts.join(" · ") : "अभी कोई कार्य नहीं।";
    },
    profileTabReport: "रिपोर्ट",
    profileTabHistory: "इतिहास",
    profileTabRequests: "अनुरोध",
    profileTabAbout: "परिचय",
    profileTabProfile: "प्रोफ़ाइल",
    karigarNetwork: "कारीगर नेटवर्क",
    karigarFallback: "कारीगर",
    profileIdLabel: "आईडी",
    roleAdmin: "एडमिन",
    roleWorker: "वर्कर",
    roleLabelFor: (role) => {
      const r = (role || "").trim().toLowerCase();
      if (r === "admin" || r === "administrator") return "एडमिन";
      if (r === "worker" || r === "karigar" || !r) return "वर्कर";
      return role!.trim();
    },
    backToProfile: "प्रोफ़ाइल पर वापस",
    backToAcharyas: "आचार्यों पर वापस",
    profileSectionsAria: "प्रोफ़ाइल खंड",
    workerStatsAria: "कार्य आँकड़े",
    taskLanguage: "कार्य भाषा",
    openTasksIn: "कार्य खोलें",
    voiceLanguageSection: "आचार्य की आवाज़",
    acharyaSpeaksIn: "आचार्य किस भाषा में बोलें",
    voiceLanguageHint: "सिर्फ़ आचार्य के बोलने की भाषा बदलती है। ऐप अपनी भाषा में ही रहेगा।",
    voiceLanguageSameAsApp: "ऐप जैसी",
    textSizeSection: "अक्षर का आकार",
    textSizeHint: "स्क्रीन पर सब कुछ बड़ा करें।",
    textSizeNormal: "सामान्य",
    textSizeLarge: "बड़ा",
    textSizeLarger: "और बड़ा",
    mahAcharyaSection: "आपका गाइड",
    autoStartAsk: (name) => `ऐप खोलते ही ${name} से पूछें खोलें`,
    autoStartAskHint: (name) =>
      `जब भी आप ऐप खोलेंगे, ${name} से पूछें वाली चैट अपने आप खुल जाएगी। शुरू में यह बंद रहती है।`,
    savingLabel: "सेव हो रहा",
    accountSection: "खाता",
    userIdLabel: "यूज़र आईडी",
    linkRequested: "अनुरोध किया",
    linkInvited: "आमंत्रित",
    linkResponded: "जवाब दिया",
    linkEnded: "समाप्त",
    networkCompany: "नेटवर्क कंपनी",
    linkStatusLabel: (status) => {
      const r = (status || "").trim().toLowerCase();
      if (r === "active") return "जुड़ा";
      if (r === "invited") return "आमंत्रित";
      if (r === "requested") return "अनुरोध";
      if (r === "declined") return "अस्वीकृत";
      if (r === "ended" || r === "unlinked") return "समाप्त";
      return status || "";
    },
    reportSheet: "रिपोर्ट शीट",
    reportEmpty: "नेटवर्क शीट पर अभी कोई पूर्ण कार्य नहीं।",
    tasksDone: "पूर्ण टास्क",
    jobsDone: "पूर्ण कार्य",
    avgScore: "औसत स्कोर",
    avgScoreShort: "औसत",
    taskHistoryTitle: "टास्क इतिहास",
    taskHistoryEmpty: "अभी कोई पूर्ण टास्क नहीं",
    taskHistoryEmptyBody: "आचार्य के साथ काम पूरा करें और अपना रिकॉर्ड बनाएं।",
    taskHistoryUntitled: "टास्क",
    publicCard: "सार्वजनिक कार्ड",
    completeProfileTitle: "अपनी प्रोफ़ाइल पूरी करें",
    completeProfileBody: "ईमेल, ट्रेड और शहर जोड़ें ताकि MSME आपको खोज सकें।",
    invitesToYou: "आपके लिए निमंत्रण",
    noInvites: "अभी कोई निमंत्रण नहीं।",
    exploreMsmes: "MSME खोजें",
    exploreMsmesSub: "नेटवर्क पर किसी कंपनी से जुड़ने का अनुरोध करें।",
    noOrgsYet: "नेटवर्क पर अभी कोई कंपनी नहीं।",
    requestToJoin: "जुड़ने का अनुरोध",
    cancelRequest: "अनुरोध रद्द करें",
    linkedStamp: "जुड़ा हुआ",
    respondAbove: "इस MSME ने आपको आमंत्रित किया है — ऊपर निमंत्रण अनुभाग में जवाब दें।",
    noticeUnlinkedTitle: "KarmYog से आपका जुड़ाव समाप्त हो गया है",
    noticeUnlinkedBody: "KarmYog ने आपको अनलिंक कर दिया है। आपकी प्रोफ़ाइल पहले जैसी सक्रिय है — अनुरोध टैब से आप दोबारा जुड़ने का अनुरोध भेज सकते हैं।",
    noticeDismiss: "ठीक है",
    noticesTitle: "सूचनाएँ",
    noticesAria: (count) =>
      count === 1 ? "1 सूचना" : `${count} सूचनाएँ`,
    accept: "स्वीकार करें",
    decline: "अस्वीकार करें",
    historyEmpty: "अभी कोई कंपनी लिंक नहीं। अनुरोध टैब में MSME खोजें।",
    yourDetails: "आपका विवरण",
    edit: "एडिट",
    settings: "सेटिंग्स",
    save: "सहेजें",
    saved: "सहेजा गया।",
    publicProfile: "सार्वजनिक प्रोफ़ाइल",
    showCardPublicly: "मेरा कार्ड सार्वजनिक दिखाएं",
    copyLink: "लिंक कॉपी करें",
    copied: "कॉपी हो गया",
    openCard: "कार्ड खोलें",
    photoSection: "फ़ोटो",
    addPhoto: "फ़ोटो जोड़ें",
    changePhoto: "फ़ोटो बदलें",
    photoOptions: "फ़ोटो विकल्प",
    previewPhoto: "पूर्वावलोकन",
    addNewPhoto: "नई जोड़ें",
    takePhoto: "फ़ोटो लें",
    chooseFromGallery: "गैलरी से चुनें",
    cancel: "रद्द करें",
    removingPhoto: "हटाया जा रहा…",
    startConversation: "बात शुरू करें",
    endConversation: "समाप्त",
    videoAvatarOpen: "वीडियो कॉल शुरू करें",
    videoAvatarLanguageNote: "वीडियो अवतार फ़िलहाल केवल अंग्रेज़ी और हिंदी बोलता है।",
    videoAvatarStarting: (name) => `${name} से जोड़ा जा रहा है...`,
    endVideoCall: "कॉल समाप्त करें",
    close: "बंद करें",
    endConversationWith: (name) => `${name} से बातचीत समाप्त करें`,
    stillTalkingWith: (name) => `${name} से बात जारी है`,
    returnToBoard: "वापस जाएँ",
    moveConversationPill: "खींचकर हटाएँ",
    connecting: "कनेक्ट हो रहा…",
    retry: "फिर कोशिश करें",
    chatWith: (name) => `${name} से बात करें`,
    quizReadyTitle: "खुद को परखने के लिए तैयार?",
    quizReadySubtitle: "5 प्रश्न · ~3 मिनट · इस कार्य से बने",
    startQuiz: "क्विज़ शुरू करें",
    noVideoYet: "अभी कोई वीडियो नहीं",
    noVideoYetBody: "इस आचार्य के लिए कहानी और कोर्स वीडियो जुड़ने पर यहाँ दिखेंगे।",
    noCourseYet: "अभी कोई कोर्स नहीं",
    noCourseYetBody: "ऊपर की बार से अपने आचार्य से बात शुरू करें।",
    taskComments: "कार्य टिप्पणियाँ",
    commentPlaceholder: "इस कार्य के लिए नोट लिखें…",
    photo: "फ़ोटो",
    postComment: "टिप्पणी भेजें",
    posting: "भेजा जा रहा…",
    noCommentsYet: "अभी कोई टिप्पणी नहीं",
    noCommentsYetBody: "कार्य नोट्स, मैनेजर की टिप्पणियाँ और फ़ोटो अपडेट यहाँ दिखेंगे।",
    loadingComments: "टिप्पणियाँ लोड हो रही…",
    couldNotLoadComments: "टिप्पणियाँ लोड नहीं हो सकीं।",
    couldNotPostComment: "टिप्पणी भेज नहीं सके।",
    commentTooShort: "टिप्पणी कम से कम 2 अक्षर की होनी चाहिए।",
    removePhoto: "फ़ोटो हटाएँ",
    attachPhoto: "फ़ोटो जोड़ें",
    uploadingPhoto: "अपलोड हो रहा…",
    commentsApproved: "स्वीकृत",
    commentsAwaitingApproval: "स्वीकृति की प्रतीक्षा",
    commentsYourScore: "आपका स्कोर",
    commentsAcharyaScore: "आचार्य स्कोर",
    commentsScorePendingBody: "आपके आचार्य ने इस कार्य को स्कोर किया है। मैनेजर अंतिम स्कोर की पुष्टि करेंगे।",
    commentsScoreApprovedBody: "आपके टीम मैनेजर ने अंतिम स्कोर स्वीकार कर लिया है।",
    showMore: "और देखें",
    showLess: "कम देखें",
    firstNameLabel: "पहला नाम",
    lastNameLabel: "अंतिम नाम",
    phoneLabel: "फ़ोन",
    emailLabel: "ईमेल",
    tradeLabel: "व्यापार",
    stateLabel: "राज्य",
    cityLabel: "शहर",
    addressLabel: "पता",
    pincodeLabel: "पिन कोड",
    bioLabel: "अपने काम के बारे में",
    roleLabel: "भूमिका",
    branchLabel: "शाखा",
    primaryTeamLabel: "मुख्य टीम",
    selectTrade: "अपना व्यापार चुनें",
    selectState: "अपना राज्य चुनें",
    selectCity: "अपना शहर चुनें",
    selectStateFirst: "पहले राज्य चुनें",
    loadingCities: "शहर लोड हो रहे…",
    addressPlaceholder: "घर, गली, इलाका",
    pincodePlaceholder: "6 अंकों का पिन कोड",
    bioPlaceholder: "अपने काम के बारे में एक पंक्ति",
    enterFirstName: "अपना पहला नाम लिखें।",
    enterValidEmail: "सही ईमेल पता लिखें।",
    enterValidPincode: "सही 6 अंकों का पिन कोड लिखें।",
    couldNotSave: "सेव नहीं हो सका। फिर कोशिश करें।",
    couldNotLoadProfile: "प्रोफ़ाइल लोड नहीं हो सकी।",
    couldNotUpdate: "अपडेट नहीं हो सका। फिर कोशिश करें।",
    couldNotCopyLink: "लिंक कॉपी नहीं हो सका।",
    couldNotLoadRequests: "अनुरोध लोड नहीं हो सके।",
    couldNotRespond: "जवाब नहीं दे सके। फिर कोशिश करें।",
    couldNotSendRequest: "अनुरोध नहीं भेजा जा सका। फिर कोशिश करें।",
    couldNotCancel: "रद्द नहीं हो सका। फिर कोशिश करें।",
    photoTypeError: "JPEG, PNG या WebP चित्र इस्तेमाल करें।",
    photoSizeError: "अधिकतम 4 MB।",
    couldNotUploadPhoto: "फ़ोटो अपलोड नहीं हो सकी। फिर कोशिश करें।",
    couldNotRemovePhoto: "फ़ोटो हटाई नहीं जा सकी। फिर कोशिश करें।",
    notAdded: "जोड़ नहीं",
    tasksDoneTotal: (n) => `${n} कार्य पूर्ण`,
    proofSessionHeading: "सत्र पूरा — अपनी प्रगति साझा करें",
    proofSubtaskHeading: "उपकार्य पूरा — प्रमाण अपलोड करें",
    proofBreakHeading: "ब्रेक लें",
    proofSessionEyebrow: "सत्र समाप्त",
    proofSubtaskEyebrow: "उपकार्य प्रमाण",
    proofBreakEyebrow: "ब्रेक",
    proofHelperRequired: "1–5 फ़ोटो और छोटा नोट दोनों ज़रूरी हैं।",
    proofHelperOptional: "इस काम के लिए फ़ोटो और नोट वैकल्पिक हैं — बिना उनके भी सबमिट कर सकते हैं।",
    proofHelperBreak: "फ़ोटो और नोट वैकल्पिक हैं (अधिकतम 5) — बिना प्रमाण भी ब्रेक ले सकते हैं।",
    proofTakePhoto: "फ़ोटो लें",
    proofChooseGallery: "गैलरी से चुनें",
    proofAddAnother: (n, max) => `और जोड़ें (${n}/${max})`,
    proofMaxPhotos: (max) => `अधिकतम ${max} फ़ोटो।`,
    proofDescribeLabel: "इस अंतराल में आपने क्या किया, लिखें",
    proofDescribePlaceholder: "जैसे: पूर्वी दीवार का स्केच पूरा किया, माप लिया…",
    proofSubmitUpdate: "अपडेट जमा करें",
    proofSubmitProof: "प्रमाण जमा करें",
    proofSubmitBreak: "जमा करें और ब्रेक लें",
    proofTakeBreak: "ब्रेक लें",
    proofCancel: "रद्द करें",
    proofBreakWithout: "बिना प्रमाण ब्रेक लें",
    proofNeedImage: "कृपया कम से कम एक फ़ोटो प्रमाण जोड़ें।",
    proofNeedText: "कृपया लिखें कि इस उपकार्य/सत्र में क्या पूरा हुआ।",
    proofTabImage: "छवि",
    proofTabText: "लेख",
    cropPhotoTitle: "फ़ोटो समायोजित करें",
    cropPhotoHint: "फ्रेम करने के लिए खींचें · ज़ूम के लिए +/− · हो जाने पर सेव करें।",
    cropRotate: "घुमाएँ",
    cropApply: "सहेजें",
    cropUsePhoto: "यह फ़ोटो इस्तेमाल करें",
    cropZoomIn: "ज़ूम इन",
    cropZoomOut: "ज़ूम आउट",
    /** Multi-attempt sessions */
    attemptWord: "प्रयास",
    attemptOfWord: "में से",
    attemptScorePenalty: "अंक",
    attemptRetriesLeft: "मौके बाकी",
    attemptNoRetriesLeft: "आखिरी मौका",
    requestTime: "समय मांगें",
    requestTimeTitle: "और समय मांगें",
    requestTimeEyebrow: "सत्र का समय",
    requestTimeBody: "इस कार्य सत्र में समय जोड़ें।",
    requestTimeBodyExpired: "सत्र का समय पूरा हो गया। काम जारी रखने के लिए समय जोड़ें।",
    requestTimeApply: "समय जोड़ें",
    requestTimeUsedLabel: "अतिरिक्त समय लिया",
    requestTimeAllUsed: "इस प्रयास का पूरा अतिरिक्त समय ले लिया गया है।",
    requestTimeFailed: "समय नहीं जोड़ पाए। फिर कोशिश करें।",
    minutesShort: "मिनट",
    inactivityWarning: "कोई गतिविधि नहीं — यह सत्र जल्द बंद होगा।",
    inactivityClosedTitle: "सत्र बंद हुआ",
    inactivityClosedBody: "30 मिनट तक कोई गतिविधि नहीं हुई। यह कार्य फिर से नियोजित में है — आप इसे दोबारा शुरू कर सकते हैं।",
    habit: "आदत",
    noScoreImpact: "अभ्यास · स्कोर पर कोई प्रभाव नहीं",
  },
  bn: {
    task: "কাজ",
    planned: "পরিকল্পিত",
    doing: "চলছে",
    review: "যাচাই",
    done: "সম্পন্ন",
    description: "বিবরণ",
    acharya: "আচার্য",
    plannedTime: "পরিকল্পিত সময়",
    sessions: "পালা",
    totalDuration: "মোট সময়",
    breaksPerSession: "প্রতি পালায় বিরতি",
    noDescription: "কোনো বিবরণ দেওয়া হয়নি।",
    learn: "শিখুন",
    startTask: "কাজের পালা শুরু করুন",
    startSubtaskSession: (sessionOf, sessionTotal, title) =>
      `${title} দিয়ে শুরু করুন`,
    starting: "শুরু হচ্ছে…",
    markDone: "সম্পন্ন হিসেবে চিহ্নিত করুন",
    markTaskDone: "কাজ সম্পন্ন করুন",
    reviewingTask: "কাজ যাচাই হচ্ছে",
    submitTask: "কাজ জমা দিন",
    openTimer: "টাইমার খুলুন",
    attemptRunning: "চেষ্টা চলছে",
    attemptActive: "আপনার কাজের পালা চলছে।",
    attemptPaused: "এখন বিরতিতে আছে।",
    breaksRemaining: (n) => `${n}টি বিরতি বাকি আছে।`,
    anotherTaskActive: "অন্য একটি কাজ চলছে",
    anotherTaskActiveDetail: (title) =>
      title
        ? `আগে “${title}” থামান বা শেষ করুন — একসাথে একটিই টাইমার চলে। থামানো কাজ আপনার জন্য অপেক্ষা করবে।`
        : "আগে আপনার চলমান কাজ থামান বা শেষ করুন — একসাথে একটিই টাইমার চলে। থামানো কাজ আপনার জন্য অপেক্ষা করবে।",
    goToRunningTask: "চলমান কাজে যান",
    readyToStart: "শুরু করতে প্রস্তুত",
    chat: "চ্যাট",
    quiz: "কুইজ",
    learnTab: "শিখুন",
    video: "ভিডিও",
    comments: "মন্তব্য",
    videoLoadError: "ভিডিও লোড করা যায়নি।",
    videoWatchLearn: "দেখুন ও শিখুন",
    videoWatchLearnSubtitle: "এই কাজের সঙ্গে যুক্ত ছোট টিউটোরিয়াল।",
    videoRelatedYoutube: "সম্পর্কিত YouTube ভিডিও",
    videoSearchingLabel: "খোঁজা হচ্ছে",
    videoWatchTutorials: "টিউটোরিয়াল দেখুন",
    videoSuggestedPicks: "প্রস্তাবিত ভিডিও",
    videoPlayHere: "এখানেই চালান",
    videoPlayInside: "অ্যাপে চালান",
    videoTapBrowse: "ব্রাউজ করতে ট্যাপ করুন",
    videoTutorial: "টিউটোরিয়াল ভিডিও",
    loading: "লোড হচ্ছে",
    back: "পিছনে",
    tryAgain: "আবার চেষ্টা করুন",
    summarisePrompt: "অনুগ্রহ করে এই কাজের এক বাক্যে সারাংশ দিন এবং প্রথমে কী করতে হবে বলুন।",
    chatWelcome: "নমস্কার! আমি এই কাজের জন্য আপনার আচার্য। যা খুশি জিজ্ঞাসা করুন — অথবা নিচে ট্যাপ করে সংক্ষিপ্ত সারাংশ নিন।",
    chatPlaceholder: "আপনার আচার্যকে জিজ্ঞাসা করুন…",
    summariseCta: "কাজের সারাংশ",
    findingVideos: "টিউটোরিয়াল ভিডিও খুঁজছি…",
    findingReferences: "আপনার কাজের জন্য রেফারেন্স খুঁজছি",
    goToTimer: "টাইমারে যান",
    subtaskComplete: "উপ-কাজ সম্পন্ন",
    sessionComplete: "পালা শেষ",
    completed: "সম্পন্ন",
    readyToStartPrefix: "শুরু করতে প্রস্তুত",
    startThisTask: "এই কাজ শুরু করুন",
    chatWelcomeShort: "নমস্কার — নিচে লিখুন, বা এই কাজ সম্পর্কে জিজ্ঞাসা করতে আচার্যের সঙ্গে ভয়েসে কথা শুরু করুন।",
    tasksTitle: "কাজ",
    yourWork: "আপনার কাজ",
    overallProgress: "মোট অগ্রগতি",
    progressCompleted: (pct) => `${pct}% কাজ সম্পন্ন`,
    logout: "লগ আউট",
    refreshing: "রিফ্রেশ হচ্ছে",
    sessionRunning: "চলছে",
    sessionPaused: "বিরতি",
    openRunningTask: (title) => `চলমান কাজ খুলুন: ${title}`,
    loadingTasks: "কাজ লোড হচ্ছে",
    couldNotLoadTasks: "কাজ লোড করা যায়নি।",
    nothingInLane: (lane) => `${lane}-এ কিছু নেই।`,
    noTasksHere: "এখানে কোনো কাজ নেই।",
    noTasksYet: "এখনও কোনো কাজ নেই।",
    noTasksAssigned:
      "আপনি সাইন ইন করেছেন, কিন্তু এখনও কোনো কাজ দেওয়া হয়নি। সুপারভাইজারকে যোগ করতে বলুন, তারপর রিফ্রেশ করুন।",
    taskLanes: "কাজের লেন",
    blocked: "অবরুদ্ধ",
    today: "আজ",
    tomorrow: "আগামীকাল",
    daysLate: (n) => `${n} দিন দেরি`,
    daysShort: (n) => `${n} দিন`,
    openTask: (title) => `কাজ খুলুন: ${title}`,
    acharyaFrom: (source) => {
      if (source === "list") return "কলাম থেকে";
      if (source === "board") return "প্রকল্প থেকে";
      if (source === "workspace") return "টিম থেকে";
      return `${source} থেকে`;
    },
    acharyaRole: "এআই গুরু",
    acharyaWillGuide: (name) => `${name} আপনাকে পথ দেখাবেন`,
    quizScopeTitle: "প্রশ্ন এর উপর ভিত্তিক",
    lesson: "পাঠ",
    session: "পালা",
    yourAcharyas: "আপনার আচার্য",
    acharyasEyebrow: "গুরু",
    noTasksWithAcharya: "এখনও কোনো কাজ নেই।",
    learnWithAcharya: (name) => `${name}-এর সাথে শিখুন`,
    watchStory: "গল্প দেখুন",
    activeTask: "সক্রিয় কাজ",
    openTaskCta: "কাজ খুলুন",
    openAcharya: "আচার্য খুলুন",
    acharyaFieldLabel: (field) =>
      ({
        finance: "অর্থ",
        business: "ব্যবসা",
        sales: "বিক্রয়",
        marketing: "বিপণন",
        operations: "পরিচালনা",
        technology: "প্রযুক্তি",
        guide: "পথপ্রদর্শক",
        general: "সাধারণ",
      })[field],
    acharyaStories: "আচার্য গল্প",
    swipeForStories: "গল্প দেখতে সোয়াইপ করুন",
    continueWhereYouLeftOff: "যেখানে ছেড়েছিলেন সেখান থেকে চালিয়ে যান",
    resume: "চালিয়ে যান",
    liveConversation: "লাইভ কথা",
    minimizeConversation: "ছোট করুন",
    storyReelSubtitle: "আপনার আচার্যকে জানুন",
    storyFrameLabels: ["পরিচয়", "জীবন", "শেখা", "শুরু"],
    storyTitleFor: (name) => `${name}-এর গল্প`,
    storyFrameCaptionsFor: (name, personaSummary) => [
      `${name} শুধু কাজের সহায়ক নন — আপনার গাইড।`,
      personaSummary || `${name} কাজ, শেখা ও শৃঙ্খলা একসাথে আনেন।`,
      "দেখুন, শিখুন, তারপর প্রস্তুত হলে কাজ বেছে নিন।",
      `যখন ${name}-এর সাথে কাজ করতে চান, কাজ খুলুন।`,
    ],
    profileAria: "প্রোফাইল",
    youSpeaker: "আপনি",
    askWhatToLearn: (name) => `${name}-কে জিজ্ঞাসা করুন আপনি কী শিখতে চান`,
    quizPrevious: "আগেরটি",
    lessonNext: "পরেরটি",
    lessonModuleOf: (current, total) => `অংশ ${current} / ${total}`,
    quizWellDone: "বাহ, দারুণ!",
    quizTryAgainSoon: "পরের বার হবেই — আবার চেষ্টা করুন।",
    chatQuickTodayWork: "আজকের কাজ",
    chatQuickHowToDo: "এটা কীভাবে করব?",
    chatQuickSession: "টাইমার সম্পর্কে",
    chatQuickProof: "কোন ছবি পাঠাব",
    chatQuickTodayWorkPrompt: "আজ আমার কাজ কী? পরের ধাপটা বলুন।",
    chatQuickHowToDoPrompt: "এই কাজটা কীভাবে করতে হয়, সহজ কথায় ধাপে ধাপে বুঝিয়ে দিন।",
    chatQuickSessionPrompt: "কাজের সেশন আর বিরতি কীভাবে চলে?",
    chatQuickProofPrompt: "কাজ শেষ হলে আমাকে কোন ছবি পাঠাতে হবে?",
    askMahAcharyaCta: (name) => `${name}-কে জিজ্ঞাসা করুন`,
    talkMahAcharyaAria: (name) => `${name}-এর সাথে কথা বলুন`,
    homeMahAcharyaEyebrow: "হোম গাইড",
    homeMahAcharyaWelcome: (name) => `${name} আপনাকে অ্যাপে ঘুরিয়ে দিতে পারেন`,
    taskCountSummary: ({ doing, planned, done }) => {
      const parts: string[] = [];
      if (doing > 0) parts.push(`${doing} চলছে`);
      if (planned > 0) parts.push(`${planned} পরিকল্পিত`);
      if (done > 0) parts.push(`${done} সম্পন্ন`);
      return parts.length > 0 ? parts.join(" · ") : "এখনও কোনো কাজ নেই।";
    },
    profileTabReport: "রিপোর্ট",
    profileTabHistory: "ইতিহাস",
    profileTabRequests: "অনুরোধ",
    profileTabAbout: "পরিচয়",
    profileTabProfile: "প্রোফাইল",
    karigarNetwork: "কারিগর নেটওয়ার্ক",
    karigarFallback: "কারিগর",
    profileIdLabel: "আইডি",
    roleAdmin: "অ্যাডমিন",
    roleWorker: "কর্মী",
    roleLabelFor: (role) => {
      const r = (role || "").trim().toLowerCase();
      if (r === "admin" || r === "administrator") return "অ্যাডমিন";
      if (r === "worker" || r === "karigar" || !r) return "কর্মী";
      return role!.trim();
    },
    backToProfile: "প্রোফাইলে ফিরে যান",
    backToAcharyas: "আচার্যদের কাছে ফিরে যান",
    profileSectionsAria: "প্রোফাইল বিভাগ",
    workerStatsAria: "কর্মী পরিসংখ্যান",
    taskLanguage: "কাজের ভাষা",
    openTasksIn: "কাজ খুলুন",
    voiceLanguageSection: "আচার্যের কণ্ঠ",
    acharyaSpeaksIn: "আচার্য কোন ভাষায় কথা বলবেন",
    voiceLanguageHint: "শুধু আচার্যের কথা বলার ভাষা বদলায়। অ্যাপ নিজের ভাষাতেই থাকবে।",
    voiceLanguageSameAsApp: "অ্যাপের মতো",
    textSizeSection: "লেখার আকার",
    textSizeHint: "পর্দার সবকিছু বড় করুন।",
    textSizeNormal: "স্বাভাবিক",
    textSizeLarge: "বড়",
    textSizeLarger: "আরও বড়",
    mahAcharyaSection: "আপনার গাইড",
    autoStartAsk: (name) => `অ্যাপ খুললেই ${name}-কে জিজ্ঞাসা করুন খুলুন`,
    autoStartAskHint: (name) =>
      `যতবার অ্যাপ খুলবেন, ${name}-কে জিজ্ঞাসা করুন চ্যাট নিজে থেকেই খুলবে। শুরুতে এটি বন্ধ থাকে।`,
    savingLabel: "সেভ হচ্ছে",
    accountSection: "অ্যাকাউন্ট",
    userIdLabel: "ইউজার আইডি",
    linkRequested: "অনুরোধ করা",
    linkInvited: "আমন্ত্রিত",
    linkResponded: "উত্তর দেওয়া",
    linkEnded: "শেষ",
    networkCompany: "নেটওয়ার্ক কোম্পানি",
    linkStatusLabel: (status) => {
      const r = (status || "").trim().toLowerCase();
      if (r === "active") return "সংযুক্ত";
      if (r === "invited") return "আমন্ত্রিত";
      if (r === "requested") return "অনুরোধ";
      if (r === "declined") return "প্রত্যাখ্যাত";
      if (r === "ended" || r === "unlinked") return "শেষ";
      return status || "";
    },
    reportSheet: "রিপোর্ট শিট",
    reportEmpty: "নেটওয়ার্ক শিটে এখনও কোনো সম্পন্ন কাজ নেই।",
    tasksDone: "সম্পন্ন কাজ",
    jobsDone: "সম্পন্ন কাজ",
    avgScore: "গড় স্কোর",
    avgScoreShort: "গড়",
    taskHistoryTitle: "কাজের ইতিহাস",
    taskHistoryEmpty: "এখনও কোনো সম্পন্ন কাজ নেই",
    taskHistoryEmptyBody: "আচার্য-এর সাথে কাজ শেষ করে আপনার রেকর্ড গড়ুন।",
    taskHistoryUntitled: "কাজ",
    publicCard: "পাবলিক কার্ড",
    completeProfileTitle: "আপনার প্রোফাইল সম্পূর্ণ করুন",
    completeProfileBody: "ইমেল, ট্রেড ও শহর যোগ করুন যাতে MSME আপনাকে খুঁজে পায়।",
    invitesToYou: "আপনার জন্য আমন্ত্রণ",
    noInvites: "এখন কোনো আমন্ত্রণ নেই।",
    exploreMsmes: "MSME খুঁজুন",
    exploreMsmesSub: "নেটওয়ার্কের কোনো কোম্পানিতে যোগ দেওয়ার অনুরোধ করুন।",
    noOrgsYet: "নেটওয়ার্কে এখনও কোনো কোম্পানি নেই।",
    requestToJoin: "যোগ দেওয়ার অনুরোধ",
    cancelRequest: "অনুরোধ বাতিল করুন",
    linkedStamp: "যুক্ত",
    respondAbove: "এই MSME আপনাকে আমন্ত্রণ জানিয়েছে — উপরের আমন্ত্রণ অংশে উত্তর দিন।",
    noticeUnlinkedTitle: "KarmYog-এর সঙ্গে আপনার যোগ শেষ হয়েছে",
    noticeUnlinkedBody: "KarmYog আপনাকে আনলিঙ্ক করেছে। আপনার প্রোফাইল আগের মতোই সক্রিয় — অনুরোধ ট্যাব থেকে আবার যোগ দেওয়ার অনুরোধ পাঠাতে পারেন।",
    noticeDismiss: "ঠিক আছে",
    noticesTitle: "নোটিশ",
    noticesAria: (count) =>
      count === 1 ? "১টি নোটিশ" : `${count}টি নোটিশ`,
    accept: "গ্রহণ করুন",
    decline: "প্রত্যাখ্যান করুন",
    historyEmpty: "এখনও কোনো কোম্পানি লিঙ্ক নেই। অনুরোধ ট্যাবে MSME খুঁজুন।",
    yourDetails: "আপনার বিবরণ",
    edit: "সম্পাদনা",
    settings: "সেটিংস",
    save: "সংরক্ষণ করুন",
    saved: "সংরক্ষিত।",
    publicProfile: "পাবলিক প্রোফাইল",
    showCardPublicly: "আমার কার্ড প্রকাশ্যে দেখান",
    copyLink: "লিঙ্ক কপি করুন",
    copied: "কপি হয়েছে",
    openCard: "কার্ড খুলুন",
    photoSection: "ছবি",
    addPhoto: "ছবি যোগ করুন",
    changePhoto: "ছবি বদলান",
    photoOptions: "ছবির বিকল্প",
    previewPhoto: "প্রিভিউ",
    addNewPhoto: "নতুন যোগ করুন",
    takePhoto: "ছবি তুলুন",
    chooseFromGallery: "গ্যালারি থেকে বেছে নিন",
    cancel: "বাতিল",
    removingPhoto: "সরানো হচ্ছে…",
    startConversation: "কথা শুরু করুন",
    endConversation: "শেষ",
    videoAvatarOpen: "ভিডিও কল শুরু করুন",
    videoAvatarLanguageNote: "ভিডিও অবতার আপাতত শুধু ইংরেজি ও হিন্দিতে কথা বলে।",
    videoAvatarStarting: (name) => `${name}-এর সঙ্গে যুক্ত করা হচ্ছে...`,
    endVideoCall: "কল শেষ করুন",
    close: "বন্ধ করুন",
    endConversationWith: (name) => `${name}-এর সঙ্গে কথা বলা শেষ করুন`,
    stillTalkingWith: (name) => `${name}-এর সাথে কথা চলছে`,
    returnToBoard: "ফিরে যান",
    moveConversationPill: "টেনে সরান",
    connecting: "সংযোগ হচ্ছে…",
    retry: "আবার চেষ্টা করুন",
    chatWith: (name) => `${name}-এর সাথে চ্যাট`,
    quizReadyTitle: "নিজেকে পরীক্ষা করতে প্রস্তুত?",
    quizReadySubtitle: "৫টি প্রশ্ন · ~৩ মিনিট · এই কাজ থেকে তৈরি",
    startQuiz: "কুইজ শুরু করুন",
    noVideoYet: "এখনও কোনো ভিডিও নেই",
    noVideoYetBody: "এই আচার্যের জন্য গল্প ও কোর্স ভিডিও যোগ হলে এখানে দেখা যাবে।",
    noCourseYet: "এখনও কোনো কোর্স নেই",
    noCourseYetBody: "উপরের বার থেকে আপনার আচার্যের সঙ্গে কথা শুরু করুন।",
    taskComments: "কাজের মন্তব্য",
    commentPlaceholder: "এই কাজের জন্য একটি নোট লিখুন…",
    photo: "ছবি",
    postComment: "মন্তব্য পাঠান",
    posting: "পাঠানো হচ্ছে…",
    noCommentsYet: "এখনও কোনো মন্তব্য নেই",
    noCommentsYetBody: "কাজের নোট, ম্যানেজারের মন্তব্য এবং ছবি আপডেট এখানে দেখা যাবে।",
    loadingComments: "মন্তব্য লোড হচ্ছে…",
    couldNotLoadComments: "মন্তব্য লোড করা যায়নি।",
    couldNotPostComment: "মন্তব্য পাঠানো যায়নি।",
    commentTooShort: "মন্তব্যে কমপক্ষে ২টি অক্ষর লাগবে।",
    removePhoto: "ছবি সরান",
    attachPhoto: "ছবি যোগ করুন",
    uploadingPhoto: "আপলোড হচ্ছে…",
    commentsApproved: "অনুমোদিত",
    commentsAwaitingApproval: "অনুমোদনের অপেক্ষায়",
    commentsYourScore: "আপনার স্কোর",
    commentsAcharyaScore: "আচার্য স্কোর",
    commentsScorePendingBody: "আপনার আচার্য এই কাজ স্কোর করেছেন। ম্যানেজার চূড়ান্ত স্কোর নিশ্চিত করবেন।",
    commentsScoreApprovedBody: "আপনার টিম ম্যানেজার চূড়ান্ত স্কোর অনুমোদন করেছেন।",
    showMore: "আরও দেখুন",
    showLess: "কম দেখুন",
    firstNameLabel: "নামের প্রথম অংশ",
    lastNameLabel: "নামের শেষ অংশ",
    phoneLabel: "ফোন",
    emailLabel: "ইমেইল",
    tradeLabel: "পেশা",
    stateLabel: "রাজ্য",
    cityLabel: "শহর",
    addressLabel: "ঠিকানা",
    pincodeLabel: "পিন কোড",
    bioLabel: "আপনার কাজ সম্পর্কে",
    roleLabel: "ভূমিকা",
    branchLabel: "শাখা",
    primaryTeamLabel: "মূল দল",
    selectTrade: "আপনার পেশা বেছে নিন",
    selectState: "আপনার রাজ্য বেছে নিন",
    selectCity: "আপনার শহর বেছে নিন",
    selectStateFirst: "আগে রাজ্য বেছে নিন",
    loadingCities: "শহর লোড হচ্ছে…",
    addressPlaceholder: "বাড়ি, রাস্তা, এলাকা",
    pincodePlaceholder: "৬ সংখ্যার পিন কোড",
    bioPlaceholder: "আপনার কাজের এক লাইন",
    enterFirstName: "আপনার নামের প্রথম অংশ লিখুন।",
    enterValidEmail: "সঠিক ইমেইল ঠিকানা লিখুন।",
    enterValidPincode: "সঠিক ৬ সংখ্যার পিন কোড লিখুন।",
    couldNotSave: "সেভ করা যায়নি। আবার চেষ্টা করুন।",
    couldNotLoadProfile: "প্রোফাইল লোড করা যায়নি।",
    couldNotUpdate: "আপডেট করা যায়নি। আবার চেষ্টা করুন।",
    couldNotCopyLink: "লিংক কপি করা যায়নি।",
    couldNotLoadRequests: "অনুরোধ লোড করা যায়নি।",
    couldNotRespond: "উত্তর দেওয়া যায়নি। আবার চেষ্টা করুন।",
    couldNotSendRequest: "অনুরোধ পাঠানো যায়নি। আবার চেষ্টা করুন।",
    couldNotCancel: "বাতিল করা যায়নি। আবার চেষ্টা করুন।",
    photoTypeError: "JPEG, PNG বা WebP ছবি ব্যবহার করুন।",
    photoSizeError: "সর্বোচ্চ ৪ MB।",
    couldNotUploadPhoto: "ছবি আপলোড করা যায়নি। আবার চেষ্টা করুন।",
    couldNotRemovePhoto: "ছবি সরানো যায়নি। আবার চেষ্টা করুন।",
    notAdded: "যোগ করা হয়নি",
    tasksDoneTotal: (n) => `${n} কাজ সম্পন্ন`,
    proofSessionHeading: "পালা শেষ — আপনার অগ্রগতি জানান",
    proofSubtaskHeading: "উপ-কাজ শেষ — প্রমাণ আপলোড করুন",
    proofBreakHeading: "বিরতি নিন",
    proofSessionEyebrow: "পালা শেষ",
    proofSubtaskEyebrow: "উপ-কাজের প্রমাণ",
    proofBreakEyebrow: "বিরতি",
    proofHelperRequired: "১–৫টি ছবি ও ছোট নোট দুটোই লাগবে।",
    proofHelperOptional: "এই কাজের জন্য ছবি ও নোট ঐচ্ছিক — সেগুলো ছাড়াও জমা দিতে পারেন।",
    proofHelperBreak: "ছবি ও নোট ঐচ্ছিক (সর্বোচ্চ ৫টি) — প্রমাণ ছাড়াও বিরতি নিতে পারেন।",
    proofTakePhoto: "ছবি তুলুন",
    proofChooseGallery: "গ্যালারি থেকে বেছে নিন",
    proofAddAnother: (n, max) => `আরও যোগ করুন (${n}/${max})`,
    proofMaxPhotos: (max) => `সর্বোচ্চ ${max}টি ছবি।`,
    proofDescribeLabel: "এই সময়ে আপনি কী করেছেন লিখুন",
    proofDescribePlaceholder: "যেমন: পূর্ব দেয়ালের স্কেচ শেষ করেছি, মাপ নিয়েছি…",
    proofSubmitUpdate: "আপডেট জমা দিন",
    proofSubmitProof: "প্রমাণ জমা দিন",
    proofSubmitBreak: "জমা দিয়ে বিরতি নিন",
    proofTakeBreak: "বিরতি নিন",
    proofCancel: "বাতিল",
    proofBreakWithout: "প্রমাণ ছাড়া বিরতি নিন",
    proofNeedImage: "অনুগ্রহ করে অন্তত একটি ছবির প্রমাণ যোগ করুন।",
    proofNeedText: "অনুগ্রহ করে লিখুন এই উপ-কাজ/পালায় কী সম্পন্ন হয়েছে।",
    proofTabImage: "ছবি",
    proofTabText: "লেখা",
    cropPhotoTitle: "ছবি ঠিক করুন",
    cropPhotoHint: "ফ্রেম করতে টানুন · জুম +/− · হয়ে গেলে সেভ করুন।",
    cropRotate: "ঘোরান",
    cropApply: "সংরক্ষণ করুন",
    cropUsePhoto: "এই ছবি ব্যবহার করুন",
    cropZoomIn: "জুম ইন",
    cropZoomOut: "জুম আউট",
    /** Multi-attempt sessions */
    attemptWord: "প্রচেষ্টা",
    attemptOfWord: "এর মধ্যে",
    attemptScorePenalty: "নম্বর",
    attemptRetriesLeft: "সুযোগ বাকি",
    attemptNoRetriesLeft: "শেষ সুযোগ",
    requestTime: "সময় চান",
    requestTimeTitle: "আরও সময় চান",
    requestTimeEyebrow: "সেশনের সময়",
    requestTimeBody: "এই কাজের সেশনে সময় যোগ করুন।",
    requestTimeBodyExpired: "সেশনের সময় শেষ। কাজ চালিয়ে যেতে সময় যোগ করুন।",
    requestTimeApply: "সময় যোগ করুন",
    requestTimeUsedLabel: "অতিরিক্ত সময় নেওয়া হয়েছে",
    requestTimeAllUsed: "এই প্রচেষ্টার সব অতিরিক্ত সময় নেওয়া হয়ে গেছে।",
    requestTimeFailed: "সময় যোগ করা যায়নি। আবার চেষ্টা করুন।",
    minutesShort: "মিনিট",
    inactivityWarning: "কোনো কাজ হচ্ছে না — সেশন শীঘ্রই বন্ধ হবে।",
    inactivityClosedTitle: "সেশন বন্ধ হয়েছে",
    inactivityClosedBody: "৩০ মিনিট কোনো কাজ হয়নি। কাজটি আবার পরিকল্পিত-এ আছে — আপনি আবার শুরু করতে পারেন।",
    habit: "অভ্যাস",
    noScoreImpact: "অনুশীলন · স্কোরে কোনো প্রভাব নেই",
  },
  fr: {
    habit: "Habitude",
    noScoreImpact: "Entraînement · sans effet sur le score",
    task: "Tâche",
    planned: "Prévu",
    doing: "En cours",
    review: "En revue",
    done: "Terminé",
    description: "Description",
    acharya: "Acharya",
    plannedTime: "Temps prévu",
    sessions: "Sessions",
    totalDuration: "Durée totale",
    breaksPerSession: "Pauses par session",
    noDescription: "Aucune description.",
    learn: "Apprendre",
    startTask: "Commencer la session de travail",
    startSubtaskSession: (sessionOf, sessionTotal, title) =>
      `Commencer par ${title}`,
    starting: "Démarrage…",
    markDone: "Marquer comme terminé",
    markTaskDone: "Marquer la tâche comme terminée",
    reviewingTask: "Vérification de la tâche",
    submitTask: "Envoyer la tâche",
    openTimer: "Ouvrir le chrono",
    attemptRunning: "Essai en cours",
    attemptActive: "Votre session de travail est active.",
    attemptPaused: "En pause pour le moment.",
    breaksRemaining: (n) => (n === 1 ? "1 pause restante." : `${n} pauses restantes.`),
    anotherTaskActive: "Une autre tâche est en cours",
    anotherTaskActiveDetail: (title) =>
      title
        ? `Mettez en pause ou terminez « ${title} » d’abord — un seul chrono tourne à la fois. Une tâche en pause vous attend.`
        : "Mettez en pause ou terminez votre tâche en cours d’abord — un seul chrono tourne à la fois. Une tâche en pause vous attend.",
    goToRunningTask: "Aller à la tâche en cours",
    readyToStart: "Prêt à commencer",
    chat: "Discussion",
    quiz: "Quiz",
    learnTab: "Apprendre",
    video: "Vidéo",
    comments: "Commentaires",
    videoLoadError: "Impossible de charger les vidéos.",
    videoWatchLearn: "Regarder et apprendre",
    videoWatchLearnSubtitle: "Courts tutoriels liés à cette tâche.",
    videoRelatedYoutube: "Vidéos YouTube liées",
    videoSearchingLabel: "Recherche",
    videoWatchTutorials: "Voir les tutoriels",
    videoSuggestedPicks: "Suggestions",
    videoPlayHere: "Lire ici",
    videoPlayInside: "Lire dans l’application",
    videoTapBrowse: "Touchez pour parcourir",
    videoTutorial: "Vidéo tutoriel",
    loading: "Chargement",
    back: "Retour",
    tryAgain: "Réessayer",
    summarisePrompt: "Résume cette tâche en une phrase et dis-moi par quoi commencer.",
    chatWelcome: "Bonjour ! Je suis votre Acharya pour cette tâche. Posez-moi vos questions — ou touchez ci-dessous pour un résumé rapide.",
    chatPlaceholder: "Demandez à votre Acharya…",
    summariseCta: "Résumer cette tâche",
    findingVideos: "Recherche de vidéos tutoriels…",
    findingReferences: "Recherche de références pour votre tâche",
    goToTimer: "Aller au chrono",
    subtaskComplete: "Sous-tâche terminée",
    sessionComplete: "Session terminée",
    completed: "Terminé",
    readyToStartPrefix: "Prêt à commencer",
    startThisTask: "Commencer cette tâche",
    chatWelcomeShort: "Bonjour — écrivez ci-dessous, ou lancez une discussion vocale avec votre Acharya pour parler de cette tâche.",
    tasksTitle: "Tâches",
    yourWork: "Votre travail",
    overallProgress: "Progression globale",
    progressCompleted: (pct) => `${pct} % des tâches terminées`,
    logout: "Se déconnecter",
    refreshing: "Actualisation",
    sessionRunning: "En cours",
    sessionPaused: "En pause",
    openRunningTask: (title) => `Ouvrir la tâche en cours : ${title}`,
    loadingTasks: "Chargement des tâches",
    couldNotLoadTasks: "Impossible de charger les tâches.",
    nothingInLane: (lane) => `Rien dans « ${lane} ».`,
    noTasksHere: "Aucune tâche ici.",
    noTasksYet: "Aucune tâche pour l’instant.",
    noTasksAssigned:
      "Vous êtes connecté, mais aucun espace de travail ni aucune tâche ne vous a encore été attribué. Demandez à votre responsable de vous ajouter, puis tirez vers le bas pour actualiser.",
    taskLanes: "Colonnes des tâches",
    blocked: "Bloqué",
    today: "Aujourd’hui",
    tomorrow: "Demain",
    daysLate: (n) => `${n} j de retard`,
    daysShort: (n) => `${n} j`,
    openTask: (title) => `Ouvrir la tâche : ${title}`,
    acharyaFrom: (source) => {
      if (source === "list") return "de la colonne";
      if (source === "board") return "du projet";
      if (source === "workspace") return "de l’équipe";
      return `de ${source}`;
    },
    acharyaRole: "Mentor IA",
    acharyaWillGuide: (name) => `${name} va vous guider`,
    quizScopeTitle: "Les questions portent sur",
    lesson: "Leçon",
    session: "Session",
    yourAcharyas: "Vos Acharyas",
    acharyasEyebrow: "MENTORS",
    noTasksWithAcharya: "Aucune tâche pour l’instant",
    learnWithAcharya: (name) => `Apprendre avec ${name}`,
    watchStory: "Voir l’histoire",
    activeTask: "Tâche active",
    openTaskCta: "Ouvrir la tâche",
    openAcharya: "Ouvrir l’Acharya",
    acharyaFieldLabel: (field) =>
      ({
        finance: "Finance",
        business: "Entreprise",
        sales: "Ventes",
        marketing: "Marketing",
        operations: "Opérations",
        technology: "Technologie",
        guide: "Guide",
        general: "Général",
      })[field],
    acharyaStories: "Histoires des Acharyas",
    swipeForStories: "Balayez pour voir les histoires",
    continueWhereYouLeftOff: "Reprendre là où vous en étiez",
    resume: "Reprendre",
    liveConversation: "Conversation en direct",
    minimizeConversation: "Réduire",
    storyReelSubtitle: "Faites connaissance avec votre Acharya",
    storyFrameLabels: ["Identité", "Hors travail", "Apprentissage", "Démarrer"],
    storyTitleFor: (name) => `L’histoire de ${name}`,
    storyFrameCaptionsFor: (name, personaSummary) => [
      `${name} est là pour vous guider, pas seulement pour aider sur une tâche.`,
      personaSummary || `${name} réunit le travail, l’apprentissage et la discipline.`,
      "Regardez, apprenez, puis passez à l’étape de travail quand vous êtes prêt.",
      `Ouvrez la tâche quand vous voulez travailler avec ${name}.`,
    ],
    profileAria: "Profil",
    youSpeaker: "Vous",
    askWhatToLearn: (name) => `Demandez à ${name} ce que vous voulez apprendre`,
    quizPrevious: "Précédent",
    lessonNext: "Suivant",
    lessonModuleOf: (current, total) => "Partie {current} sur {total}".replace("{current}", String(current)).replace("{total}", String(total)),
    quizWellDone: "Bravo !",
    quizTryAgainSoon: "Ce sera pour la prochaine fois — réessayez.",
    chatQuickTodayWork: "Travail du jour",
    chatQuickHowToDo: "Comment faire ?",
    chatQuickSession: "À propos du minuteur",
    chatQuickProof: "Quelle photo envoyer",
    chatQuickTodayWorkPrompt: "Quel travail dois-je faire aujourd’hui ? Indiquez-moi la prochaine étape.",
    chatQuickHowToDoPrompt: "Expliquez comment faire cette tâche, étape par étape, avec des mots simples.",
    chatQuickSessionPrompt: "Comment fonctionnent la session de travail et la pause ?",
    chatQuickProofPrompt: "Quelle photo dois-je envoyer une fois ce travail terminé ?",
    askMahAcharyaCta: (name) => `Demander à ${name}`,
    talkMahAcharyaAria: (name) => `Parler à ${name}`,
    homeMahAcharyaEyebrow: "Guide d’accueil",
    homeMahAcharyaWelcome: (name) => `${name} peut vous aider à vous repérer`,
    taskCountSummary: ({ doing, planned, done }) => {
      const parts: string[] = [];
      if (doing > 0) parts.push(`${doing} en cours`);
      if (planned > 0) parts.push(`${planned} ${planned === 1 ? "prévue" : "prévues"}`);
      if (done > 0) parts.push(`${done} ${done === 1 ? "terminée" : "terminées"}`);
      return parts.length > 0 ? parts.join(" · ") : "Aucune tâche pour l’instant";
    },
    profileTabReport: "Rapport",
    profileTabHistory: "Historique",
    profileTabRequests: "Demandes",
    profileTabAbout: "À propos",
    profileTabProfile: "Profil",
    karigarNetwork: "Réseau Karigar",
    karigarFallback: "Karigar",
    profileIdLabel: "ID",
    roleAdmin: "Admin",
    roleWorker: "Travailleur",
    roleLabelFor: (role) => {
      const r = (role || "").trim().toLowerCase();
      if (r === "admin" || r === "administrator") return "Admin";
      if (r === "worker" || r === "karigar" || !r) return "Travailleur";
      return role!.trim();
    },
    backToProfile: "Retour au profil",
    backToAcharyas: "Retour aux Acharyas",
    profileSectionsAria: "Sections du profil",
    workerStatsAria: "Statistiques du travailleur",
    taskLanguage: "Langue des tâches",
    openTasksIn: "Ouvrir les tâches en",
    voiceLanguageSection: "Voix de l'Acharya",
    acharyaSpeaksIn: "L'Acharya parle en",
    voiceLanguageHint: "Change seulement la langue dans laquelle l'Acharya vous parle. L'application garde sa langue.",
    voiceLanguageSameAsApp: "Comme l'application",
    textSizeSection: "Taille du texte",
    textSizeHint: "Agrandir tout ce qui est à l’écran.",
    textSizeNormal: "Normale",
    textSizeLarge: "Grande",
    textSizeLarger: "Très grande",
    mahAcharyaSection: "Votre guide",
    autoStartAsk: (name) => `Ouvrir « Demander à ${name} » au lancement de l’application`,
    autoStartAskHint: (name) =>
      `À chaque ouverture de l’application, la discussion « Demander à ${name} » s’ouvre toute seule. Désactivé par défaut.`,
    savingLabel: "Enregistrement",
    accountSection: "Compte",
    userIdLabel: "ID utilisateur",
    linkRequested: "Demandé",
    linkInvited: "Invité",
    linkResponded: "Répondu",
    linkEnded: "Terminé",
    networkCompany: "Entreprise du réseau",
    linkStatusLabel: (status) => {
      const r = (status || "").trim().toLowerCase();
      if (r === "active") return "Lié";
      if (r === "invited") return "Invité";
      if (r === "requested") return "Demandé";
      if (r === "declined") return "Refusé";
      if (r === "ended" || r === "unlinked") return "Terminé";
      return status || "";
    },
    reportSheet: "Fiche de rapport",
    reportEmpty: "Aucun travail terminé sur la fiche du réseau pour l’instant.",
    tasksDone: "Tâches terminées",
    jobsDone: "Travaux terminés",
    avgScore: "Score moyen",
    avgScoreShort: "moy.",
    taskHistoryTitle: "Historique des tâches",
    taskHistoryEmpty: "Aucune tâche terminée pour l’instant",
    taskHistoryEmptyBody: "Terminez un travail avec un Acharya pour construire votre historique.",
    taskHistoryUntitled: "Tâche",
    publicCard: "Carte publique",
    completeProfileTitle: "Complétez votre profil",
    completeProfileBody: "Ajoutez votre e-mail, votre métier et votre ville pour que les PME puissent vous trouver.",
    invitesToYou: "Invitations reçues",
    noInvites: "Aucune invitation pour le moment.",
    exploreMsmes: "Explorer les PME",
    exploreMsmesSub: "Demandez à rejoindre une entreprise du réseau.",
    noOrgsYet: "Aucune entreprise sur le réseau pour l’instant.",
    requestToJoin: "Demander à rejoindre",
    cancelRequest: "Annuler la demande",
    linkedStamp: "Lié",
    respondAbove: "Cette PME vous a invité — répondez dans la section Invitations ci-dessus.",
    noticeUnlinkedTitle: "Votre lien KarmYog a pris fin",
    noticeUnlinkedBody: "KarmYog a supprimé votre lien. Votre profil reste actif — vous pouvez envoyer une nouvelle demande depuis l’onglet Demandes.",
    noticeDismiss: "Compris",
    noticesTitle: "Notifications",
    noticesAria: (count) =>
      count === 1 ? "1 notification" : `${count} notifications`,
    accept: "Accepter",
    decline: "Refuser",
    historyEmpty: "Aucun lien avec une entreprise pour l’instant. Trouvez des PME dans l’onglet Demandes.",
    yourDetails: "Vos informations",
    edit: "Modifier",
    settings: "Paramètres",
    save: "Enregistrer",
    saved: "Enregistré.",
    publicProfile: "Profil public",
    showCardPublicly: "Afficher ma carte publiquement",
    copyLink: "Copier le lien",
    copied: "Copié",
    openCard: "Ouvrir la carte",
    photoSection: "Photo",
    addPhoto: "Ajouter une photo",
    changePhoto: "Changer la photo",
    photoOptions: "Options de la photo",
    previewPhoto: "Aperçu",
    addNewPhoto: "Nouvelle photo",
    takePhoto: "Prendre une photo",
    chooseFromGallery: "Choisir dans la galerie",
    cancel: "Annuler",
    removingPhoto: "Suppression…",
    startConversation: "Démarrer la conversation",
    endConversation: "Terminer",
    videoAvatarOpen: "Démarrer un appel vidéo",
    videoAvatarLanguageNote: "Pour l’instant, l’avatar vidéo parle uniquement anglais et hindi.",
    videoAvatarStarting: (name) => `Connexion avec ${name}...`,
    endVideoCall: "Raccrocher",
    close: "Fermer",
    endConversationWith: (name) => `Terminer la conversation avec ${name}`,
    stillTalkingWith: (name) => `Conversation en cours avec ${name}`,
    returnToBoard: "Retour",
    moveConversationPill: "Faites glisser pour déplacer",
    connecting: "Connexion…",
    retry: "Réessayer",
    chatWith: (name) => `Discuter avec ${name}`,
    quizReadyTitle: "Prêt à vous tester ?",
    quizReadySubtitle: "5 questions · ~3 minutes · créées à partir de cette tâche",
    startQuiz: "Commencer le quiz",
    noVideoYet: "Pas encore de vidéo",
    noVideoYetBody: "Les vidéos d’histoire et de cours apparaîtront ici dès qu’elles seront ajoutées pour cet Acharya.",
    noCourseYet: "Pas encore de cours",
    noCourseYetBody: "Démarrez une conversation avec votre Acharya depuis la barre du haut.",
    taskComments: "Commentaires de la tâche",
    commentPlaceholder: "Ajoutez une note pour cette tâche...",
    photo: "Photo",
    postComment: "Publier le commentaire",
    posting: "Publication…",
    noCommentsYet: "Pas encore de commentaires",
    noCommentsYetBody: "Les notes de tâche, les commentaires du responsable et les photos apparaîtront ici.",
    loadingComments: "Chargement des commentaires…",
    couldNotLoadComments: "Impossible de charger les commentaires.",
    couldNotPostComment: "Impossible de publier le commentaire.",
    commentTooShort: "Le commentaire doit contenir au moins 2 caractères.",
    removePhoto: "Retirer la photo",
    attachPhoto: "Joindre une photo",
    uploadingPhoto: "Envoi…",
    commentsApproved: "Approuvé",
    commentsAwaitingApproval: "En attente d’approbation",
    commentsYourScore: "Votre score",
    commentsAcharyaScore: "Score de l’Acharya",
    commentsScorePendingBody: "Votre Acharya a noté cette tâche. Un responsable confirmera le score final.",
    commentsScoreApprovedBody: "Le responsable de votre équipe a approuvé le score final.",
    showMore: "Voir plus",
    showLess: "Voir moins",
    firstNameLabel: "Prénom",
    lastNameLabel: "Nom",
    phoneLabel: "Téléphone",
    emailLabel: "E-mail",
    tradeLabel: "Métier",
    stateLabel: "Région",
    cityLabel: "Ville",
    addressLabel: "Adresse",
    pincodeLabel: "Code postal",
    bioLabel: "À propos de votre travail",
    roleLabel: "Rôle",
    branchLabel: "Agence",
    primaryTeamLabel: "Équipe principale",
    selectTrade: "Choisissez votre métier",
    selectState: "Choisissez votre région",
    selectCity: "Choisissez votre ville",
    selectStateFirst: "Choisissez d’abord une région",
    loadingCities: "Chargement des villes…",
    addressPlaceholder: "Maison, rue, quartier",
    pincodePlaceholder: "Code postal à 6 chiffres",
    bioPlaceholder: "Une phrase sur votre travail",
    enterFirstName: "Saisissez votre prénom.",
    enterValidEmail: "Saisissez une adresse e-mail valide.",
    enterValidPincode: "Saisissez un code postal valide à 6 chiffres.",
    couldNotSave: "Impossible d’enregistrer. Réessayez.",
    couldNotLoadProfile: "Impossible de charger le profil.",
    couldNotUpdate: "Impossible de mettre à jour. Réessayez.",
    couldNotCopyLink: "Impossible de copier le lien.",
    couldNotLoadRequests: "Impossible de charger les demandes.",
    couldNotRespond: "Impossible de répondre. Réessayez.",
    couldNotSendRequest: "Impossible d’envoyer la demande. Réessayez.",
    couldNotCancel: "Impossible d’annuler. Réessayez.",
    photoTypeError: "Utilisez une image JPEG, PNG ou WebP.",
    photoSizeError: "4 Mo maximum.",
    couldNotUploadPhoto: "Impossible d’envoyer la photo. Réessayez.",
    couldNotRemovePhoto: "Impossible de retirer la photo. Réessayez.",
    notAdded: "Non renseigné",
    tasksDoneTotal: (n) => (n === 1 ? "1 tâche terminée" : `${n} tâches terminées`),
    proofSessionHeading: "Session terminée — partagez votre progression",
    proofSubtaskHeading: "Sous-tâche terminée — envoyez une preuve",
    proofBreakHeading: "Faites une pause",
    proofSessionEyebrow: "session terminée",
    proofSubtaskEyebrow: "preuve de sous-tâche",
    proofBreakEyebrow: "pause",
    proofHelperRequired: "Ajoutez 1 à 5 photos et une courte note de fin — les deux sont obligatoires.",
    proofHelperOptional: "Les photos et la note sont facultatives pour cette tâche — vous pouvez envoyer sans.",
    proofHelperBreak: "Les photos et la note sont facultatives (5 photos maximum) — vous pouvez faire une pause sans.",
    proofTakePhoto: "Prendre une photo",
    proofChooseGallery: "Choisir dans la galerie",
    proofAddAnother: (n, max) => `Ajouter une autre (${n}/${max})`,
    proofMaxPhotos: (max) => `${max} photos maximum.`,
    proofDescribeLabel: "Décrivez ce que vous avez accompli pendant cette période",
    proofDescribePlaceholder: "ex. : croquis initial du mur est terminé, mesures prises…",
    proofSubmitUpdate: "Envoyer la mise à jour",
    proofSubmitProof: "Envoyer la preuve",
    proofSubmitBreak: "Envoyer et faire une pause",
    proofTakeBreak: "Faire une pause",
    proofCancel: "Annuler",
    proofBreakWithout: "Faire une pause sans preuve",
    proofNeedImage: "Ajoutez au moins une photo comme preuve pour cette sous-tâche/session.",
    proofNeedText: "Décrivez ce qui a été fait pour cette sous-tâche/session.",
    proofTabImage: "Image",
    proofTabText: "Texte",
    cropPhotoTitle: "Ajuster la photo",
    cropPhotoHint: "Faites glisser pour cadrer · pincez ou +/− pour zoomer · Enregistrez à la fin.",
    cropRotate: "Pivoter",
    cropApply: "Enregistrer",
    cropUsePhoto: "Utiliser la photo",
    cropZoomIn: "Zoom avant",
    cropZoomOut: "Zoom arrière",
    /** Multi-attempt sessions */
    attemptWord: "Essai",
    attemptOfWord: "sur",
    attemptScorePenalty: "score",
    attemptRetriesLeft: "essais restants",
    attemptNoRetriesLeft: "dernier essai",
    requestTime: "Demander du temps",
    requestTimeTitle: "Demander plus de temps",
    requestTimeEyebrow: "TEMPS DE SESSION",
    requestTimeBody: "Ajoutez du temps à cette session de travail.",
    requestTimeBodyExpired: "Le temps de session est écoulé. Ajoutez du temps pour continuer cette tâche.",
    requestTimeApply: "Ajouter du temps",
    requestTimeUsedLabel: "temps supplémentaire utilisé",
    requestTimeAllUsed: "Vous avez utilisé tout le temps supplémentaire pour cet essai.",
    requestTimeFailed: "Impossible d’ajouter du temps. Réessayez.",
    minutesShort: "min",
    inactivityWarning: "Aucune activité — cette session va bientôt se fermer.",
    inactivityClosedTitle: "Session fermée",
    inactivityClosedBody: "Aucune activité pendant 30 minutes. Cette tâche est revenue dans Prévu — vous pouvez la recommencer.",
  },
  te: {
    task: "పని",
    planned: "ప్రణాళిక",
    doing: "జరుగుతోంది",
    review: "సమీక్ష",
    done: "పూర్తయింది",
    description: "వివరణ",
    acharya: "ఆచార్య",
    plannedTime: "ప్రణాళిక సమయం",
    sessions: "విడతలు",
    totalDuration: "మొత్తం సమయం",
    breaksPerSession: "ఒక్కో విడతకు విరామాలు",
    noDescription: "వివరణ ఇవ్వలేదు.",
    learn: "నేర్చుకోండి",
    startTask: "పని విడత ప్రారంభించండి",
    startSubtaskSession: (sessionOf, sessionTotal, title) =>
      `${title} తో ప్రారంభించండి`,
    starting: "ప్రారంభమవుతోంది…",
    markDone: "పూర్తయినట్లు గుర్తించండి",
    markTaskDone: "పనిని పూర్తయినట్లు గుర్తించండి",
    reviewingTask: "పనిని సమీక్షిస్తున్నారు",
    submitTask: "పనిని సమర్పించండి",
    openTimer: "టైమర్ తెరవండి",
    attemptRunning: "ప్రయత్నం జరుగుతోంది",
    attemptActive: "మీ పని విడత కొనసాగుతోంది.",
    attemptPaused: "ప్రస్తుతం విరామంలో ఉన్నారు.",
    breaksRemaining: (n) => `ఇంకా ${n} విరామాలు మిగిలి ఉన్నాయి.`,
    anotherTaskActive: "మరో పని జరుగుతోంది",
    anotherTaskActiveDetail: (title) =>
      title
        ? `ముందు “${title}” ను ఆపండి లేదా పూర్తి చేయండి — ఒకేసారి ఒక టైమర్ మాత్రమే నడుస్తుంది. ఆపిన పని మీ కోసం ఎదురుచూస్తుంది.`
        : "ముందు నడుస్తున్న పనిని ఆపండి లేదా పూర్తి చేయండి — ఒకేసారి ఒక టైమర్ మాత్రమే నడుస్తుంది. ఆపిన పని మీ కోసం ఎదురుచూస్తుంది.",
    goToRunningTask: "నడుస్తున్న పనికి వెళ్ళండి",
    readyToStart: "ప్రారంభించడానికి సిద్ధం",
    chat: "చాట్",
    quiz: "క్విజ్",
    learnTab: "నేర్చుకోండి",
    video: "వీడియో",
    comments: "వ్యాఖ్యలు",
    videoLoadError: "వీడియోలు లోడ్ కాలేదు.",
    videoWatchLearn: "చూసి నేర్చుకోండి",
    videoWatchLearnSubtitle: "ఈ పనికి సంబంధించిన చిన్న శిక్షణ వీడియోలు.",
    videoRelatedYoutube: "సంబంధిత YouTube వీడియోలు",
    videoSearchingLabel: "వెతుకుతోంది",
    videoWatchTutorials: "శిక్షణ వీడియోలు చూడండి",
    videoSuggestedPicks: "సూచించిన వీడియోలు",
    videoPlayHere: "ఇక్కడే ప్లే చేయండి",
    videoPlayInside: "యాప్ లోనే ప్లే చేయండి",
    videoTapBrowse: "చూడటానికి నొక్కండి",
    videoTutorial: "శిక్షణ వీడియో",
    loading: "లోడ్ అవుతోంది",
    back: "వెనక్కి",
    tryAgain: "మళ్ళీ ప్రయత్నించండి",
    summarisePrompt: "దయచేసి ఈ పనిని ఒక్క వాక్యంలో సంక్షిప్తంగా చెప్పి, ముందు ఏం చేయాలో చెప్పండి.",
    chatWelcome: "నమస్తే! ఈ పనికి నేను మీ ఆచార్యను. ఏదైనా అడగండి — లేదా త్వరిత సారాంశం కోసం కింద నొక్కండి.",
    chatPlaceholder: "మీ ఆచార్యను అడగండి…",
    summariseCta: "ఈ పని సారాంశం",
    findingVideos: "శిక్షణ వీడియోలు వెతుకుతోంది…",
    findingReferences: "మీ పని కోసం సమాచారం వెతుకుతోంది",
    goToTimer: "టైమర్ కి వెళ్ళండి",
    subtaskComplete: "ఉప పని పూర్తయింది",
    sessionComplete: "విడత పూర్తయింది",
    completed: "పూర్తయింది",
    readyToStartPrefix: "ప్రారంభించడానికి సిద్ధం",
    startThisTask: "ఈ పనిని ప్రారంభించండి",
    chatWelcomeShort: "నమస్తే — కింద టైప్ చేయండి, లేదా ఈ పని గురించి అడగడానికి మీ ఆచార్యతో వాయిస్ చాట్ ప్రారంభించండి.",
    tasksTitle: "పనులు",
    yourWork: "మీ పని",
    overallProgress: "మొత్తం పురోగతి",
    progressCompleted: (pct) => `${pct}% పనులు పూర్తయ్యాయి`,
    logout: "లాగ్ అవుట్",
    refreshing: "రిఫ్రెష్ అవుతోంది",
    sessionRunning: "నడుస్తోంది",
    sessionPaused: "ఆపబడింది",
    openRunningTask: (title) => `నడుస్తున్న పనిని తెరవండి: ${title}`,
    loadingTasks: "పనులు లోడ్ అవుతున్నాయి",
    couldNotLoadTasks: "పనులు లోడ్ కాలేదు.",
    nothingInLane: (lane) => `${lane} లో ఏమీ లేవు.`,
    noTasksHere: "ఇక్కడ పనులు లేవు.",
    noTasksYet: "ఇంకా పనులు లేవు.",
    noTasksAssigned:
      "మీరు సైన్ ఇన్ అయ్యారు, కానీ మీకు ఇంకా వర్క్‌స్పేస్ లేదా పనులు కేటాయించలేదు. మిమ్మల్ని జోడించమని మీ సూపర్‌వైజర్‌ని అడగండి, తర్వాత రిఫ్రెష్ చేయడానికి కిందికి లాగండి.",
    taskLanes: "పని వరుసలు",
    blocked: "ఆగిపోయింది",
    today: "ఈరోజు",
    tomorrow: "రేపు",
    daysLate: (n) => `${n} రోజులు ఆలస్యం`,
    daysShort: (n) => `${n} రో`,
    openTask: (title) => `పనిని తెరవండి: ${title}`,
    acharyaFrom: (source) => {
      if (source === "list") return "కాలమ్ నుండి";
      if (source === "board") return "ప్రాజెక్ట్ నుండి";
      if (source === "workspace") return "టీమ్ నుండి";
      return `${source} నుండి`;
    },
    acharyaRole: "AI గురువు",
    acharyaWillGuide: (name) => `${name} మీకు మార్గదర్శనం చేస్తారు`,
    quizScopeTitle: "ప్రశ్నలు వీటిపై ఉంటాయి",
    lesson: "పాఠం",
    session: "విడత",
    yourAcharyas: "మీ ఆచార్యులు",
    acharyasEyebrow: "గురువులు",
    noTasksWithAcharya: "ఇంకా పనులు లేవు",
    learnWithAcharya: (name) => `${name} తో నేర్చుకోండి`,
    watchStory: "కథ చూడండి",
    activeTask: "ప్రస్తుత పని",
    openTaskCta: "పని తెరవండి",
    openAcharya: "ఆచార్యను తెరవండి",
    acharyaFieldLabel: (field) =>
      ({
        finance: "ఆర్థికం",
        business: "వ్యాపారం",
        sales: "అమ్మకాలు",
        marketing: "మార్కెటింగ్",
        operations: "కార్యకలాపాలు",
        technology: "సాంకేతికత",
        guide: "మార్గదర్శి",
        general: "సాధారణం",
      })[field],
    acharyaStories: "ఆచార్య కథలు",
    swipeForStories: "కథల కోసం స్వైప్ చేయండి",
    continueWhereYouLeftOff: "ఆపిన చోట నుండి కొనసాగించండి",
    resume: "కొనసాగించండి",
    liveConversation: "ప్రత్యక్ష సంభాషణ",
    minimizeConversation: "చిన్నది చేయండి",
    storyReelSubtitle: "మీ ఆచార్యను తెలుసుకోండి",
    storyFrameLabels: ["పరిచయం", "పని వెలుపల", "నేర్చుకోవడం", "ప్రారంభం"],
    storyTitleFor: (name) => `${name} కథ`,
    storyFrameCaptionsFor: (name, personaSummary) => [
      `${name} కేవలం పని సహాయకుడు కాదు, మీ మార్గదర్శి.`,
      personaSummary || `${name} పని, నేర్చుకోవడం, క్రమశిక్షణ — మూడింటినీ కలిపి తెస్తారు.`,
      "చూడండి, నేర్చుకోండి, మీరు సిద్ధంగా ఉన్నప్పుడు పని దశను ఎంచుకోండి.",
      `${name} తో పని చేయాలనుకున్నప్పుడు పనిని తెరవండి.`,
    ],
    profileAria: "ప్రొఫైల్",
    youSpeaker: "మీరు",
    askWhatToLearn: (name) => `ఏమి నేర్చుకోవాలనుకుంటున్నారో ${name} ను అడగండి`,
    quizPrevious: "మునుపటి",
    lessonNext: "తదుపరి",
    lessonModuleOf: (current, total) => "భాగం {current} / {total}".replace("{current}", String(current)).replace("{total}", String(total)),
    quizWellDone: "బాగా చేశారు!",
    quizTryAgainSoon: "పర్వాలేదు — మరోసారి ప్రయత్నించండి.",
    chatQuickTodayWork: "ఈరోజు పని",
    chatQuickHowToDo: "ఇది ఎలా చేయాలి?",
    chatQuickSession: "టైమర్ గురించి",
    chatQuickProof: "ఏ ఫోటో పంపాలి",
    chatQuickTodayWorkPrompt: "ఈరోజు నేను ఏ పని చేయాలి? తర్వాతి దశ ఏమిటో చెప్పండి.",
    chatQuickHowToDoPrompt: "ఈ పనిని ఎలా చేయాలో సులభమైన మాటల్లో, ఒక్కో దశగా వివరించండి.",
    chatQuickSessionPrompt: "పని సెషన్‌, విరామం ఎలా ఉంటాయో చెప్పండి.",
    chatQuickProofPrompt: "ఈ పని పూర్తయ్యాక నేను ఏ ఫోటో పంపాలి?",
    askMahAcharyaCta: (name) => `${name} ను అడగండి`,
    talkMahAcharyaAria: (name) => `${name} తో మాట్లాడండి`,
    homeMahAcharyaEyebrow: "హోమ్ గైడ్",
    homeMahAcharyaWelcome: (name) => `యాప్ లో తిరగడానికి ${name} మీకు సహాయం చేస్తారు`,
    taskCountSummary: ({ doing, planned, done }) => {
      const parts: string[] = [];
      if (doing > 0) parts.push(`${doing} జరుగుతున్నాయి`);
      if (planned > 0) parts.push(`${planned} ప్రణాళికలో`);
      if (done > 0) parts.push(`${done} పూర్తయ్యాయి`);
      return parts.length > 0 ? parts.join(" · ") : "ఇంకా పనులు లేవు";
    },
    profileTabReport: "నివేదిక",
    profileTabHistory: "చరిత్ర",
    profileTabRequests: "అభ్యర్థనలు",
    profileTabAbout: "గురించి",
    profileTabProfile: "ప్రొఫైల్",
    karigarNetwork: "కారిగర్ నెట్‌వర్క్",
    karigarFallback: "కారిగర్",
    profileIdLabel: "ID",
    roleAdmin: "అడ్మిన్",
    roleWorker: "కార్మికుడు",
    roleLabelFor: (role) => {
      const r = (role || "").trim().toLowerCase();
      if (r === "admin" || r === "administrator") return "అడ్మిన్";
      if (r === "worker" || r === "karigar" || !r) return "కార్మికుడు";
      return role!.trim();
    },
    backToProfile: "ప్రొఫైల్ కి తిరిగి వెళ్ళండి",
    backToAcharyas: "ఆచార్యుల వద్దకు తిరిగి వెళ్ళండి",
    profileSectionsAria: "ప్రొఫైల్ విభాగాలు",
    workerStatsAria: "కార్మికుడి గణాంకాలు",
    taskLanguage: "పని భాష",
    openTasksIn: "పనులను ఈ భాషలో తెరవండి",
    voiceLanguageSection: "ఆచార్య స్వరం",
    acharyaSpeaksIn: "ఆచార్య మాట్లాడే భాష",
    voiceLanguageHint: "ఆచార్య మీతో మాట్లాడే భాష మాత్రమే మారుతుంది. యాప్ తన భాషలోనే ఉంటుంది.",
    voiceLanguageSameAsApp: "యాప్ లాగే",
    textSizeSection: "అక్షరాల పరిమాణం",
    textSizeHint: "స్క్రీన్ మీద ఉన్నవన్నీ పెద్దగా చేయండి.",
    textSizeNormal: "సాధారణం",
    textSizeLarge: "పెద్దది",
    textSizeLarger: "ఇంకా పెద్దది",
    mahAcharyaSection: "మీ మార్గదర్శి",
    autoStartAsk: (name) => `యాప్ తెరిచినప్పుడు ${name} ను అడగండి తెరవండి`,
    autoStartAskHint: (name) =>
      `మీరు యాప్ తెరిచిన ప్రతిసారీ, ${name} ను అడగండి చాట్ దానంతట అదే తెరుచుకుంటుంది. డిఫాల్ట్ గా ఆఫ్ లో ఉంటుంది.`,
    savingLabel: "సేవ్ అవుతోంది",
    accountSection: "ఖాతా",
    userIdLabel: "యూజర్ ID",
    linkRequested: "అభ్యర్థించారు",
    linkInvited: "ఆహ్వానించారు",
    linkResponded: "స్పందించారు",
    linkEnded: "ముగిసింది",
    networkCompany: "నెట్‌వర్క్ కంపెనీ",
    linkStatusLabel: (status) => {
      const r = (status || "").trim().toLowerCase();
      if (r === "active") return "అనుసంధానమైంది";
      if (r === "invited") return "ఆహ్వానించారు";
      if (r === "requested") return "అభ్యర్థించారు";
      if (r === "declined") return "తిరస్కరించారు";
      if (r === "ended" || r === "unlinked") return "ముగిసింది";
      return status || "";
    },
    reportSheet: "నివేదిక పత్రం",
    reportEmpty: "నెట్‌వర్క్ పత్రంలో ఇంకా పూర్తయిన పని లేదు.",
    tasksDone: "పూర్తయిన పనులు",
    jobsDone: "పూర్తయిన ఉద్యోగాలు",
    avgScore: "సగటు స్కోరు",
    avgScoreShort: "సగటు",
    taskHistoryTitle: "పని చరిత్ర",
    taskHistoryEmpty: "ఇంకా పూర్తయిన పనులు లేవు",
    taskHistoryEmptyBody: "మీ రికార్డు తయారవ్వడానికి ఆచార్యతో కలిసి పని పూర్తి చేయండి.",
    taskHistoryUntitled: "పని",
    publicCard: "పబ్లిక్ కార్డ్",
    completeProfileTitle: "మీ ప్రొఫైల్ పూర్తి చేయండి",
    completeProfileBody: "MSMEలు మిమ్మల్ని కనుగొనేలా మీ ఇమెయిల్, వృత్తి, నగరం జోడించండి.",
    invitesToYou: "మీకు వచ్చిన ఆహ్వానాలు",
    noInvites: "ప్రస్తుతం ఆహ్వానాలు లేవు.",
    exploreMsmes: "MSMEలను చూడండి",
    exploreMsmesSub: "నెట్‌వర్క్ లోని ఒక కంపెనీలో చేరడానికి అడగండి.",
    noOrgsYet: "నెట్‌వర్క్ లో ఇంకా కంపెనీలు లేవు.",
    requestToJoin: "చేరడానికి అభ్యర్థించండి",
    cancelRequest: "అభ్యర్థన రద్దు చేయండి",
    linkedStamp: "అనుసంధానమైంది",
    respondAbove: "ఈ MSME మిమ్మల్ని ఆహ్వానించింది — పైన ఉన్న ఆహ్వానాలు విభాగంలో స్పందించండి.",
    noticeUnlinkedTitle: "మీ KarmYog అనుసంధానం ముగిసింది",
    noticeUnlinkedBody: "KarmYog మిమ్మల్ని అనుసంధానం నుండి తొలగించింది. మీ ప్రొఫైల్ యాక్టివ్ గానే ఉంటుంది — అభ్యర్థనలు ట్యాబ్ నుండి మళ్ళీ చేరే అభ్యర్థన పంపవచ్చు.",
    noticeDismiss: "సరే",
    noticesTitle: "నోటిఫికేషన్లు",
    noticesAria: (count) =>
      count === 1 ? "1 నోటిఫికేషన్" : `${count} నోటిఫికేషన్లు`,
    accept: "అంగీకరించండి",
    decline: "తిరస్కరించండి",
    historyEmpty: "ఇంకా కంపెనీ అనుసంధానాలు లేవు. అభ్యర్థనలు ట్యాబ్ లో MSMEలను కనుగొనండి.",
    yourDetails: "మీ వివరాలు",
    edit: "మార్చండి",
    settings: "సెట్టింగ్‌లు",
    save: "సేవ్ చేయండి",
    saved: "సేవ్ అయింది.",
    publicProfile: "పబ్లిక్ ప్రొఫైల్",
    showCardPublicly: "నా కార్డును అందరికీ చూపించండి",
    copyLink: "లింక్ కాపీ చేయండి",
    copied: "కాపీ అయింది",
    openCard: "కార్డ్ తెరవండి",
    photoSection: "ఫోటో",
    addPhoto: "ఫోటో జోడించండి",
    changePhoto: "ఫోటో మార్చండి",
    photoOptions: "ఫోటో ఎంపికలు",
    previewPhoto: "ముందుగా చూడండి",
    addNewPhoto: "కొత్తది జోడించండి",
    takePhoto: "ఫోటో తీయండి",
    chooseFromGallery: "గ్యాలరీ నుండి ఎంచుకోండి",
    cancel: "రద్దు చేయండి",
    removingPhoto: "తొలగిస్తోంది…",
    startConversation: "సంభాషణ ప్రారంభించండి",
    endConversation: "ముగించండి",
    videoAvatarOpen: "వీడియో కాల్ ప్రారంభించండి",
    videoAvatarLanguageNote: "వీడియో అవతార్ ప్రస్తుతం ఇంగ్లీష్, హిందీ మాత్రమే మాట్లాడుతుంది.",
    videoAvatarStarting: (name) => `మిమ్మల్ని ${name} తో కలుపుతోంది...`,
    endVideoCall: "కాల్ ముగించండి",
    close: "మూసివేయండి",
    endConversationWith: (name) => `${name} తో సంభాషణ ముగించండి`,
    stillTalkingWith: (name) => `ఇంకా ${name} తో మాట్లాడుతున్నారు`,
    returnToBoard: "తిరిగి వెళ్ళండి",
    moveConversationPill: "జరపడానికి లాగండి",
    connecting: "కలుపుతోంది…",
    retry: "మళ్ళీ ప్రయత్నించండి",
    chatWith: (name) => `${name} తో చాట్`,
    quizReadyTitle: "మిమ్మల్ని మీరు పరీక్షించుకోవడానికి సిద్ధమా?",
    quizReadySubtitle: "5 ప్రశ్నలు · ~3 నిమిషాలు · ఈ పని నుండి తయారుచేసినవి",
    startQuiz: "క్విజ్ ప్రారంభించండి",
    noVideoYet: "ఇంకా వీడియో లేదు",
    noVideoYetBody: "ఈ ఆచార్య కోసం కథ, కోర్సు వీడియోలు జోడించిన తర్వాత ఇక్కడ కనిపిస్తాయి.",
    noCourseYet: "ఇంకా కోర్సు లేదు",
    noCourseYetBody: "పై బార్ నుండి మీ ఆచార్యతో సంభాషణ ప్రారంభించండి.",
    taskComments: "పని వ్యాఖ్యలు",
    commentPlaceholder: "ఈ పని కోసం ఒక నోట్ జోడించండి...",
    photo: "ఫోటో",
    postComment: "వ్యాఖ్య పోస్ట్ చేయండి",
    posting: "పోస్ట్ అవుతోంది…",
    noCommentsYet: "ఇంకా వ్యాఖ్యలు లేవు",
    noCommentsYetBody: "పని నోట్లు, మేనేజర్ వ్యాఖ్యలు, ఫోటో అప్డేట్లు ఇక్కడ కనిపిస్తాయి.",
    loadingComments: "వ్యాఖ్యలు లోడ్ అవుతున్నాయి…",
    couldNotLoadComments: "వ్యాఖ్యలు లోడ్ కాలేదు.",
    couldNotPostComment: "వ్యాఖ్య పోస్ట్ కాలేదు.",
    commentTooShort: "వ్యాఖ్యలో కనీసం 2 అక్షరాలు ఉండాలి.",
    removePhoto: "ఫోటో తొలగించండి",
    attachPhoto: "ఫోటో జత చేయండి",
    uploadingPhoto: "అప్లోడ్ అవుతోంది…",
    commentsApproved: "ఆమోదించబడింది",
    commentsAwaitingApproval: "ఆమోదం కోసం వేచి ఉంది",
    commentsYourScore: "మీ స్కోరు",
    commentsAcharyaScore: "ఆచార్య స్కోరు",
    commentsScorePendingBody: "మీ ఆచార్య ఈ పనికి స్కోరు ఇచ్చారు. మేనేజర్ చివరి స్కోరును నిర్ధారిస్తారు.",
    commentsScoreApprovedBody: "మీ టీమ్ మేనేజర్ చివరి స్కోరును ఆమోదించారు.",
    showMore: "ఇంకా చూపించండి",
    showLess: "తక్కువ చూపించండి",
    firstNameLabel: "మొదటి పేరు",
    lastNameLabel: "ఇంటి పేరు",
    phoneLabel: "ఫోన్",
    emailLabel: "ఇమెయిల్",
    tradeLabel: "వృత్తి",
    stateLabel: "రాష్ట్రం",
    cityLabel: "నగరం",
    addressLabel: "చిరునామా",
    pincodeLabel: "PIN కోడ్",
    bioLabel: "మీ పని గురించి",
    roleLabel: "పాత్ర",
    branchLabel: "శాఖ",
    primaryTeamLabel: "ప్రధాన టీమ్",
    selectTrade: "మీ వృత్తిని ఎంచుకోండి",
    selectState: "మీ రాష్ట్రాన్ని ఎంచుకోండి",
    selectCity: "మీ నగరాన్ని ఎంచుకోండి",
    selectStateFirst: "ముందు రాష్ట్రాన్ని ఎంచుకోండి",
    loadingCities: "నగరాలు లోడ్ అవుతున్నాయి…",
    addressPlaceholder: "ఇల్లు, వీధి, ప్రాంతం",
    pincodePlaceholder: "6 అంకెల PIN కోడ్",
    bioPlaceholder: "మీ పని గురించి ఒక వాక్యం",
    enterFirstName: "మీ మొదటి పేరు నమోదు చేయండి.",
    enterValidEmail: "సరైన ఇమెయిల్ చిరునామా నమోదు చేయండి.",
    enterValidPincode: "సరైన 6 అంకెల PIN కోడ్ నమోదు చేయండి.",
    couldNotSave: "సేవ్ కాలేదు. మళ్ళీ ప్రయత్నించండి.",
    couldNotLoadProfile: "ప్రొఫైల్ లోడ్ కాలేదు.",
    couldNotUpdate: "అప్డేట్ కాలేదు. మళ్ళీ ప్రయత్నించండి.",
    couldNotCopyLink: "లింక్ కాపీ కాలేదు.",
    couldNotLoadRequests: "అభ్యర్థనలు లోడ్ కాలేదు.",
    couldNotRespond: "స్పందించలేకపోయాం. మళ్ళీ ప్రయత్నించండి.",
    couldNotSendRequest: "అభ్యర్థన పంపలేకపోయాం. మళ్ళీ ప్రయత్నించండి.",
    couldNotCancel: "రద్దు చేయలేకపోయాం. మళ్ళీ ప్రయత్నించండి.",
    photoTypeError: "JPEG, PNG లేదా WebP చిత్రాన్ని వాడండి.",
    photoSizeError: "గరిష్టంగా 4 MB.",
    couldNotUploadPhoto: "ఫోటో అప్లోడ్ కాలేదు. మళ్ళీ ప్రయత్నించండి.",
    couldNotRemovePhoto: "ఫోటో తొలగించలేకపోయాం. మళ్ళీ ప్రయత్నించండి.",
    notAdded: "జోడించలేదు",
    tasksDoneTotal: (n) => (n === 1 ? "1 పని పూర్తయింది" : `${n} పనులు పూర్తయ్యాయి`),
    proofSessionHeading: "విడత పూర్తయింది — మీ పురోగతిని పంచుకోండి",
    proofSubtaskHeading: "ఉప పని పూర్తయింది — రుజువు అప్లోడ్ చేయండి",
    proofBreakHeading: "విరామం తీసుకోండి",
    proofSessionEyebrow: "విడత ముగిసింది",
    proofSubtaskEyebrow: "ఉప పని రుజువు",
    proofBreakEyebrow: "విరామ సమయం",
    proofHelperRequired: "1–5 ఫోటోలు మరియు చిన్న పూర్తి నోట్ జోడించండి — రెండూ తప్పనిసరి.",
    proofHelperOptional: "ఈ పనికి ఫోటోలు, నోట్ ఐచ్ఛికం — అవి లేకుండానే సమర్పించవచ్చు.",
    proofHelperBreak: "ఫోటోలు, నోట్ ఐచ్ఛికం (గరిష్టంగా 5 ఫోటోలు) — అవి లేకుండానే విరామం తీసుకోవచ్చు.",
    proofTakePhoto: "ఫోటో తీయండి",
    proofChooseGallery: "గ్యాలరీ నుండి ఎంచుకోండి",
    proofAddAnother: (n, max) => `ఇంకొకటి జోడించండి (${n}/${max})`,
    proofMaxPhotos: (max) => `గరిష్టంగా ${max} ఫోటోలు.`,
    proofDescribeLabel: "ఈ సమయంలో మీరు ఏమి పూర్తి చేశారో వివరించండి",
    proofDescribePlaceholder: "ఉదా: తూర్పు గోడ కోసం మొదటి స్కెచ్ పూర్తి చేశాను, కొలతలు తీసుకున్నాను…",
    proofSubmitUpdate: "అప్డేట్ సమర్పించండి",
    proofSubmitProof: "రుజువు సమర్పించండి",
    proofSubmitBreak: "సమర్పించి విరామం తీసుకోండి",
    proofTakeBreak: "విరామం తీసుకోండి",
    proofCancel: "రద్దు చేయండి",
    proofBreakWithout: "రుజువు లేకుండా విరామం తీసుకోండి",
    proofNeedImage: "ఈ ఉప పని/విడత కోసం కనీసం ఒక ఫోటో రుజువు జోడించండి.",
    proofNeedText: "ఈ ఉప పని/విడతలో ఏమి పూర్తయిందో వివరించండి.",
    proofTabImage: "చిత్రం",
    proofTabText: "వచనం",
    cropPhotoTitle: "ఫోటో సరిచేయండి",
    cropPhotoHint: "ఫ్రేమ్ చేయడానికి లాగండి · జూమ్ కోసం చిటికెతో లేదా +/− నొక్కండి · పూర్తయ్యాక సేవ్ చేయండి.",
    cropRotate: "తిప్పండి",
    cropApply: "సేవ్ చేయండి",
    cropUsePhoto: "ఫోటో వాడండి",
    cropZoomIn: "దగ్గరగా",
    cropZoomOut: "దూరంగా",
    /** Multi-attempt sessions */
    attemptWord: "ప్రయత్నం",
    attemptOfWord: "లో",
    attemptScorePenalty: "స్కోరు",
    attemptRetriesLeft: "ప్రయత్నాలు మిగిలాయి",
    attemptNoRetriesLeft: "చివరి ప్రయత్నం",
    requestTime: "సమయం అడగండి",
    requestTimeTitle: "ఇంకా సమయం అడగండి",
    requestTimeEyebrow: "విడత సమయం",
    requestTimeBody: "ఈ పని విడతకు సమయం జోడించండి.",
    requestTimeBodyExpired: "విడత సమయం ముగిసింది. ఈ పనిని కొనసాగించడానికి సమయం జోడించండి.",
    requestTimeApply: "సమయం జోడించండి",
    requestTimeUsedLabel: "అదనపు సమయం వాడారు",
    requestTimeAllUsed: "ఈ ప్రయత్నానికి అదనపు సమయం మొత్తం వాడేశారు.",
    requestTimeFailed: "సమయం జోడించలేకపోయాం. మళ్ళీ ప్రయత్నించండి.",
    minutesShort: "ని",
    inactivityWarning: "ఎలాంటి కదలిక లేదు — ఈ విడత త్వరలో మూసుకుంటుంది.",
    inactivityClosedTitle: "విడత మూసివేయబడింది",
    inactivityClosedBody: "30 నిమిషాలు ఎలాంటి కదలిక లేదు. ఈ పని మళ్ళీ ప్రణాళికలోకి వచ్చింది — మీరు దాన్ని మళ్ళీ ప్రారంభించవచ్చు.",
    habit: "అలవాటు",
    noScoreImpact: "అభ్యాసం · స్కోరుపై ఎలాంటి ప్రభావం లేదు",
  },
  am: {
    task: "ሥራ",
    planned: "የታቀደ",
    doing: "በሂደት ላይ",
    review: "ግምገማ",
    done: "ተጠናቋል",
    description: "መግለጫ",
    acharya: "አቻርያ",
    plannedTime: "የታቀደ ጊዜ",
    sessions: "ዙሮች",
    totalDuration: "ጠቅላላ ጊዜ",
    breaksPerSession: "በአንድ ዙር ዕረፍቶች",
    noDescription: "ምንም መግለጫ አልተሰጠም።",
    learn: "ተማር",
    startTask: "የሥራ ዙር ይጀምሩ",
    startSubtaskSession: (sessionOf, sessionTotal, title) =>
      `በ${title} ይጀምሩ`,
    starting: "በመጀመር ላይ…",
    markDone: "እንደተጠናቀቀ ምልክት ያድርጉ",
    markTaskDone: "ሥራውን እንደተጠናቀቀ ምልክት ያድርጉ",
    reviewingTask: "ሥራው እየተገመገመ ነው",
    submitTask: "ሥራውን ያስረክቡ",
    openTimer: "ሰዓት ቆጣሪውን ይክፈቱ",
    attemptRunning: "ሙከራ በሂደት ላይ",
    attemptActive: "የሥራ ዙርዎ ንቁ ነው።",
    attemptPaused: "ለጊዜው ዕረፍት ላይ ነዎት።",
    breaksRemaining: (n) => `${n} ዕረፍቶች ቀርተዋል።`,
    anotherTaskActive: "ሌላ ሥራ በሂደት ላይ ነው",
    anotherTaskActiveDetail: (title) =>
      title
        ? `መጀመሪያ “${title}”ን ያቁሙ ወይም ይጨርሱ — በአንድ ጊዜ አንድ ሰዓት ቆጣሪ ብቻ ይሰራል። የቆመ ሥራ ይጠብቅዎታል።`
        : "መጀመሪያ በሂደት ላይ ያለውን ሥራ ያቁሙ ወይም ይጨርሱ — በአንድ ጊዜ አንድ ሰዓት ቆጣሪ ብቻ ይሰራል። የቆመ ሥራ ይጠብቅዎታል።",
    goToRunningTask: "ወደ በሂደት ላይ ያለው ሥራ ይሂዱ",
    readyToStart: "ለመጀመር ዝግጁ",
    chat: "ውይይት",
    quiz: "ጥያቄዎች",
    learnTab: "ተማር",
    video: "ቪዲዮ",
    comments: "አስተያየቶች",
    videoLoadError: "ቪዲዮዎችን መጫን አልተቻለም።",
    videoWatchLearn: "ይመልከቱ እና ይማሩ",
    videoWatchLearnSubtitle: "ከዚህ ሥራ ጋር የተያያዙ አጫጭር ትምህርቶች።",
    videoRelatedYoutube: "ተዛማጅ የYouTube ቪዲዮዎች",
    videoSearchingLabel: "በመፈለግ ላይ",
    videoWatchTutorials: "ትምህርቶችን ይመልከቱ",
    videoSuggestedPicks: "የተጠቆሙ ምርጫዎች",
    videoPlayHere: "እዚህ ያጫውቱ",
    videoPlayInside: "በመተግበሪያው ውስጥ ያጫውቱ",
    videoTapBrowse: "ለማሰስ ይንኩ",
    videoTutorial: "የትምህርት ቪዲዮ",
    loading: "በመጫን ላይ",
    back: "ተመለስ",
    tryAgain: "እንደገና ይሞክሩ",
    summarisePrompt: "እባክዎ ይህን ሥራ በአንድ ዓረፍተ ነገር ያጠቃልሉልኝ እና መጀመሪያ ምን ማድረግ እንዳለብኝ ይንገሩኝ።",
    chatWelcome: "ሰላም! ለዚህ ሥራ አቻርያዎ ነኝ። ማንኛውንም ነገር ይጠይቁኝ — ወይም አጭር ማጠቃለያ ለማግኘት ከታች ይንኩ።",
    chatPlaceholder: "አቻርያዎን ይጠይቁ…",
    summariseCta: "ይህን ሥራ አጠቃልል",
    findingVideos: "የትምህርት ቪዲዮዎችን በመፈለግ ላይ…",
    findingReferences: "ለሥራዎ ማጣቀሻዎችን በመፈለግ ላይ",
    goToTimer: "ወደ ሰዓት ቆጣሪ ይሂዱ",
    subtaskComplete: "ንዑስ ሥራው ተጠናቋል",
    sessionComplete: "ዙሩ ተጠናቋል",
    completed: "ተጠናቋል",
    readyToStartPrefix: "ለመጀመር ዝግጁ",
    startThisTask: "ይህን ሥራ ይጀምሩ",
    chatWelcomeShort: "ሰላም — ከታች ይጻፉ፣ ወይም ስለዚህ ሥራ ለመጠየቅ ከአቻርያዎ ጋር የድምፅ ውይይት ይጀምሩ።",
    tasksTitle: "ሥራዎች",
    yourWork: "ሥራዎ",
    overallProgress: "አጠቃላይ እድገት",
    progressCompleted: (pct) => `ከሥራዎቹ ${pct}% ተጠናቀዋል`,
    logout: "ውጣ",
    refreshing: "በማደስ ላይ",
    sessionRunning: "በሂደት ላይ",
    sessionPaused: "ቆሟል",
    openRunningTask: (title) => `በሂደት ላይ ያለውን ሥራ ይክፈቱ፦ ${title}`,
    loadingTasks: "ሥራዎችን በመጫን ላይ",
    couldNotLoadTasks: "ሥራዎችን መጫን አልተቻለም።",
    nothingInLane: (lane) => `በ${lane} ውስጥ ምንም የለም።`,
    noTasksHere: "እዚህ ምንም ሥራ የለም።",
    noTasksYet: "እስካሁን ምንም ሥራ የለም።",
    noTasksAssigned:
      "ገብተዋል፣ ነገር ግን እስካሁን ምንም የሥራ ቦታ ወይም ሥራ አልተመደበልዎትም። ተቆጣጣሪዎ እንዲጨምርዎ ይጠይቁ፣ ከዚያ ለማደስ ወደ ታች ይጎትቱ።",
    taskLanes: "የሥራ መስመሮች",
    blocked: "ታግዷል",
    today: "ዛሬ",
    tomorrow: "ነገ",
    daysLate: (n) => `${n} ቀን ዘግይቷል`,
    daysShort: (n) => `${n} ቀን`,
    openTask: (title) => `ሥራውን ይክፈቱ፦ ${title}`,
    acharyaFrom: (source) => {
      if (source === "list") return "ከአምድ";
      if (source === "board") return "ከፕሮጀክት";
      if (source === "workspace") return "ከቡድን";
      return `ከ${source}`;
    },
    acharyaRole: "የAI አማካሪ",
    acharyaWillGuide: (name) => `${name} ይመራዎታል`,
    quizScopeTitle: "ጥያቄዎቹ የሚሸፍኑት",
    lesson: "ትምህርት",
    session: "ዙር",
    yourAcharyas: "የእርስዎ አቻርያዎች",
    acharyasEyebrow: "አማካሪዎች",
    noTasksWithAcharya: "እስካሁን ምንም ሥራ የለም",
    learnWithAcharya: (name) => `ከ${name} ጋር ይማሩ`,
    watchStory: "ታሪኩን ይመልከቱ",
    activeTask: "ንቁ ሥራ",
    openTaskCta: "ሥራውን ይክፈቱ",
    openAcharya: "አቻርያውን ይክፈቱ",
    acharyaFieldLabel: (field) =>
      ({
        finance: "ፋይናንስ",
        business: "ንግድ",
        sales: "ሽያጭ",
        marketing: "ግብይት",
        operations: "ኦፕሬሽን",
        technology: "ቴክኖሎጂ",
        guide: "መሪ",
        general: "አጠቃላይ",
      })[field],
    acharyaStories: "የአቻርያ ታሪኮች",
    swipeForStories: "ለታሪኮች ያንሸራትቱ",
    continueWhereYouLeftOff: "ካቆሙበት ይቀጥሉ",
    resume: "ቀጥል",
    liveConversation: "ቀጥታ ውይይት",
    minimizeConversation: "አሳንስ",
    storyReelSubtitle: "አቻርያዎን ይወቁ",
    storyFrameLabels: ["ማንነት", "ከሥራ ውጪ", "መማር", "ጀምር"],
    storyTitleFor: (name) => `የ${name} ታሪክ`,
    storyFrameCaptionsFor: (name, personaSummary) => [
      `${name} እዚህ ያለው የሥራ ረዳት ብቻ ሳይሆን መሪዎ ሆኖ ነው።`,
      personaSummary || `${name} ሥራን፣ መማርን እና ዲሲፕሊንን ያጣምራል።`,
      "ይመልከቱ፣ ይማሩ፣ ከዚያ ዝግጁ ሲሆኑ የሥራውን ደረጃ ይምረጡ።",
      `ከ${name} ጋር መሥራት ሲፈልጉ ሥራውን ይክፈቱ።`,
    ],
    profileAria: "መገለጫ",
    youSpeaker: "እርስዎ",
    askWhatToLearn: (name) => `መማር የሚፈልጉትን ${name}ን ይጠይቁ`,
    quizPrevious: "ቀዳሚ",
    lessonNext: "ቀጣይ",
    lessonModuleOf: (current, total) => "ክፍል {current} ከ {total}".replace("{current}", String(current)).replace("{total}", String(total)),
    quizWellDone: "በጣም ጥሩ!",
    quizTryAgainSoon: "አይዞህ — እንደገና ሞክር።",
    chatQuickTodayWork: "የዛሬ ሥራ",
    chatQuickHowToDo: "ይህን እንዴት ላድርግ?",
    chatQuickSession: "ስለ ሰዓት ቆጣሪው",
    chatQuickProof: "ምን ፎቶ ልላክ?",
    chatQuickTodayWorkPrompt: "ዛሬ ምን ሥራ አለኝ? ቀጣዩን እርምጃ ንገሩኝ።",
    chatQuickHowToDoPrompt: "ይህን ሥራ እንዴት እንደምሠራ በቀላል ቃላት፣ ደረጃ በደረጃ አስረዱኝ።",
    chatQuickSessionPrompt: "የሥራ ጊዜውና ዕረፍቱ እንዴት ይሠራሉ?",
    chatQuickProofPrompt: "ይህን ሥራ ስጨርስ ምን ፎቶ መላክ አለብኝ?",
    askMahAcharyaCta: (name) => `${name}ን ይጠይቁ`,
    talkMahAcharyaAria: (name) => `ከ${name} ጋር ይነጋገሩ`,
    homeMahAcharyaEyebrow: "የመነሻ መሪ",
    homeMahAcharyaWelcome: (name) => `${name} በመተግበሪያው ውስጥ እንዲንቀሳቀሱ ሊረዳዎት ይችላል`,
    taskCountSummary: ({ doing, planned, done }) => {
      const parts: string[] = [];
      if (doing > 0) parts.push(`${doing} በሂደት ላይ`);
      if (planned > 0) parts.push(`${planned} የታቀደ`);
      if (done > 0) parts.push(`${done} ተጠናቋል`);
      return parts.length > 0 ? parts.join(" · ") : "እስካሁን ምንም ሥራ የለም";
    },
    profileTabReport: "ሪፖርት",
    profileTabHistory: "ታሪክ",
    profileTabRequests: "ጥያቄዎች",
    profileTabAbout: "ስለ እኔ",
    profileTabProfile: "መገለጫ",
    karigarNetwork: "የካሪጋር ኔትወርክ",
    karigarFallback: "ካሪጋር",
    profileIdLabel: "መለያ",
    roleAdmin: "አስተዳዳሪ",
    roleWorker: "ሠራተኛ",
    roleLabelFor: (role) => {
      const r = (role || "").trim().toLowerCase();
      if (r === "admin" || r === "administrator") return "አስተዳዳሪ";
      if (r === "worker" || r === "karigar" || !r) return "ሠራተኛ";
      return role!.trim();
    },
    backToProfile: "ወደ መገለጫ ተመለስ",
    backToAcharyas: "ወደ አቻርያዎች ተመለስ",
    profileSectionsAria: "የመገለጫ ክፍሎች",
    workerStatsAria: "የሠራተኛ ስታቲስቲክስ",
    taskLanguage: "የሥራ ቋንቋ",
    openTasksIn: "ሥራዎችን የሚከፍቱበት ቋንቋ",
    voiceLanguageSection: "የአቻርያ ድምፅ",
    acharyaSpeaksIn: "አቻርያው የሚናገርበት ቋንቋ",
    voiceLanguageHint: "አቻርያው ከእርስዎ ጋር የሚነጋገርበትን ብቻ ይቀይራል። መተግበሪያው በራሱ ቋንቋ ይቆያል።",
    voiceLanguageSameAsApp: "እንደ መተግበሪያው",
    textSizeSection: "የጽሑፍ መጠን",
    textSizeHint: "በማያ ገጹ ላይ ያለውን ሁሉ ያተልቁ።",
    textSizeNormal: "መደበኛ",
    textSizeLarge: "ትልቅ",
    textSizeLarger: "በጣም ትልቅ",
    mahAcharyaSection: "መሪዎ",
    autoStartAsk: (name) => `መተግበሪያው ሲከፈት ${name}ን ጠይቅ ይከፈት`,
    autoStartAskHint: (name) =>
      `መተግበሪያውን በከፈቱ ቁጥር የ${name}ን ጠይቅ ውይይት በራሱ ይከፈታል። በነባሪነት ጠፍቷል።`,
    savingLabel: "በማስቀመጥ ላይ",
    accountSection: "መለያ",
    userIdLabel: "የተጠቃሚ መለያ",
    linkRequested: "ተጠይቋል",
    linkInvited: "ተጋብዘዋል",
    linkResponded: "ምላሽ ተሰጥቷል",
    linkEnded: "አብቅቷል",
    networkCompany: "የኔትወርክ ኩባንያ",
    linkStatusLabel: (status) => {
      const r = (status || "").trim().toLowerCase();
      if (r === "active") return "ተገናኝቷል";
      if (r === "invited") return "ተጋብዘዋል";
      if (r === "requested") return "ተጠይቋል";
      if (r === "declined") return "ተቀባይነት አላገኘም";
      if (r === "ended" || r === "unlinked") return "አብቅቷል";
      return status || "";
    },
    reportSheet: "የሪፖርት ሉህ",
    reportEmpty: "በኔትወርክ ሉሁ ላይ እስካሁን የተጠናቀቀ ሥራ የለም።",
    tasksDone: "የተጠናቀቁ ሥራዎች",
    jobsDone: "የተሰሩ ሥራዎች",
    avgScore: "አማካይ ውጤት",
    avgScoreShort: "አማካይ",
    taskHistoryTitle: "የሥራ ታሪክ",
    taskHistoryEmpty: "እስካሁን የተጠናቀቀ ሥራ የለም",
    taskHistoryEmptyBody: "መዝገብዎን ለመገንባት ከአቻርያ ጋር ሥራ ይጨርሱ።",
    taskHistoryUntitled: "ሥራ",
    publicCard: "የሕዝብ ካርድ",
    completeProfileTitle: "መገለጫዎን ያጠናቅቁ",
    completeProfileBody: "MSMEዎች እንዲያገኙዎት ኢሜልዎን፣ ሙያዎን እና ከተማዎን ያክሉ።",
    invitesToYou: "ለእርስዎ የተላኩ ግብዣዎች",
    noInvites: "አሁን ምንም ግብዣ የለም።",
    exploreMsmes: "MSMEዎችን ያስሱ",
    exploreMsmesSub: "በኔትወርኩ ላይ ያለ ኩባንያ ለመቀላቀል ይጠይቁ።",
    noOrgsYet: "በኔትወርኩ ላይ እስካሁን ምንም ኩባንያ የለም።",
    requestToJoin: "ለመቀላቀል ይጠይቁ",
    cancelRequest: "ጥያቄውን ሰርዝ",
    linkedStamp: "ተገናኝቷል",
    respondAbove: "ይህ MSME ጋብዞዎታል — ከላይ ባለው የግብዣዎች ክፍል ምላሽ ይስጡ።",
    noticeUnlinkedTitle: "የKarmYog ግንኙነትዎ አብቅቷል",
    noticeUnlinkedBody: "KarmYog ግንኙነትዎን አቋርጧል። መገለጫዎ ንቁ ሆኖ ይቆያል — ከጥያቄዎች ትር እንደገና የመቀላቀል ጥያቄ መላክ ይችላሉ።",
    noticeDismiss: "ገባኝ",
    noticesTitle: "ማሳወቂያዎች",
    noticesAria: (count) =>
      count === 1 ? "1 ማሳወቂያ" : `${count} ማሳወቂያዎች`,
    accept: "ተቀበል",
    decline: "አትቀበል",
    historyEmpty: "እስካሁን ምንም የኩባንያ ግንኙነት የለም። MSMEዎችን በጥያቄዎች ትር ውስጥ ያግኙ።",
    yourDetails: "የእርስዎ ዝርዝሮች",
    edit: "አርትዕ",
    settings: "ቅንብሮች",
    save: "አስቀምጥ",
    saved: "ተቀምጧል።",
    publicProfile: "የሕዝብ መገለጫ",
    showCardPublicly: "ካርዴን ለሕዝብ አሳይ",
    copyLink: "ሊንኩን ቅዳ",
    copied: "ተቀድቷል",
    openCard: "ካርዱን ክፈት",
    photoSection: "ፎቶ",
    addPhoto: "ፎቶ ያክሉ",
    changePhoto: "ፎቶ ይቀይሩ",
    photoOptions: "የፎቶ አማራጮች",
    previewPhoto: "ቅድመ እይታ",
    addNewPhoto: "አዲስ ያክሉ",
    takePhoto: "ፎቶ ያንሱ",
    chooseFromGallery: "ከማዕከለ-ስዕላት ይምረጡ",
    cancel: "ሰርዝ",
    removingPhoto: "በማስወገድ ላይ…",
    startConversation: "ውይይት ይጀምሩ",
    endConversation: "ጨርስ",
    videoAvatarOpen: "የቪዲዮ ጥሪ ይጀምሩ",
    videoAvatarLanguageNote: "የቪዲዮ አቫታሩ ለጊዜው እንግሊዝኛ እና ሂንዲ ብቻ ይናገራል።",
    videoAvatarStarting: (name) => `ከ${name} ጋር በማገናኘት ላይ...`,
    endVideoCall: "ጥሪውን ጨርስ",
    close: "ዝጋ",
    endConversationWith: (name) => `ከ${name} ጋር ያለውን ውይይት ይጨርሱ`,
    stillTalkingWith: (name) => `አሁንም ከ${name} ጋር እየተነጋገሩ ነው`,
    returnToBoard: "ተመለስ",
    moveConversationPill: "ለማንቀሳቀስ ይጎትቱ",
    connecting: "በማገናኘት ላይ…",
    retry: "እንደገና ሞክር",
    chatWith: (name) => `ከ${name} ጋር ይወያዩ`,
    quizReadyTitle: "ራስዎን ለመፈተን ዝግጁ ነዎት?",
    quizReadySubtitle: "5 ጥያቄዎች · ~3 ደቂቃ · ከዚህ ሥራ የተዘጋጀ",
    startQuiz: "ጥያቄዎቹን ይጀምሩ",
    noVideoYet: "እስካሁን ቪዲዮ የለም",
    noVideoYetBody: "ለዚህ አቻርያ ሲጨመሩ የታሪክ እና የኮርስ ቪዲዮዎች እዚህ ይታያሉ።",
    noCourseYet: "እስካሁን ኮርስ የለም",
    noCourseYetBody: "ከላይኛው አሞሌ ከአቻርያዎ ጋር ውይይት ይጀምሩ።",
    taskComments: "የሥራ አስተያየቶች",
    commentPlaceholder: "ለዚህ ሥራ ማስታወሻ ያክሉ...",
    photo: "ፎቶ",
    postComment: "አስተያየት ይለጥፉ",
    posting: "በመለጠፍ ላይ…",
    noCommentsYet: "እስካሁን ምንም አስተያየት የለም",
    noCommentsYetBody: "የሥራ ማስታወሻዎች፣ የኃላፊ አስተያየቶች እና የፎቶ ዝማኔዎች እዚህ ይታያሉ።",
    loadingComments: "አስተያየቶችን በመጫን ላይ…",
    couldNotLoadComments: "አስተያየቶችን መጫን አልተቻለም።",
    couldNotPostComment: "አስተያየቱን መለጠፍ አልተቻለም።",
    commentTooShort: "አስተያየቱ ቢያንስ 2 ፊደላት ሊኖሩት ይገባል።",
    removePhoto: "ፎቶውን አስወግድ",
    attachPhoto: "ፎቶ አያይዝ",
    uploadingPhoto: "በመጫን ላይ…",
    commentsApproved: "ጸድቋል",
    commentsAwaitingApproval: "ማጽደቅን በመጠበቅ ላይ",
    commentsYourScore: "የእርስዎ ውጤት",
    commentsAcharyaScore: "የአቻርያ ውጤት",
    commentsScorePendingBody: "አቻርያዎ ይህን ሥራ ገምግሟል። ኃላፊው የመጨረሻውን ውጤት ያረጋግጣል።",
    commentsScoreApprovedBody: "የቡድንዎ ኃላፊ የመጨረሻውን ውጤት አጽድቋል።",
    showMore: "ተጨማሪ አሳይ",
    showLess: "ያነሰ አሳይ",
    firstNameLabel: "ስም",
    lastNameLabel: "የአባት ስም",
    phoneLabel: "ስልክ",
    emailLabel: "ኢሜል",
    tradeLabel: "ሙያ",
    stateLabel: "ክልል",
    cityLabel: "ከተማ",
    addressLabel: "አድራሻ",
    pincodeLabel: "ፒን ኮድ",
    bioLabel: "ስለ ሥራዎ",
    roleLabel: "ሚና",
    branchLabel: "ቅርንጫፍ",
    primaryTeamLabel: "ዋና ቡድን",
    selectTrade: "ሙያዎን ይምረጡ",
    selectState: "ክልልዎን ይምረጡ",
    selectCity: "ከተማዎን ይምረጡ",
    selectStateFirst: "መጀመሪያ ክልል ይምረጡ",
    loadingCities: "ከተሞችን በመጫን ላይ…",
    addressPlaceholder: "ቤት፣ መንገድ፣ አካባቢ",
    pincodePlaceholder: "ባለ 6 አሃዝ ፒን ኮድ",
    bioPlaceholder: "ስለ ሥራዎ አንድ መስመር",
    enterFirstName: "ስምዎን ያስገቡ።",
    enterValidEmail: "ትክክለኛ የኢሜል አድራሻ ያስገቡ።",
    enterValidPincode: "ትክክለኛ ባለ 6 አሃዝ ፒን ኮድ ያስገቡ።",
    couldNotSave: "ማስቀመጥ አልተቻለም። እንደገና ይሞክሩ።",
    couldNotLoadProfile: "መገለጫውን መጫን አልተቻለም።",
    couldNotUpdate: "ማዘመን አልተቻለም። እንደገና ይሞክሩ።",
    couldNotCopyLink: "ሊንኩን መቅዳት አልተቻለም።",
    couldNotLoadRequests: "ጥያቄዎችን መጫን አልተቻለም።",
    couldNotRespond: "ምላሽ መስጠት አልተቻለም። እንደገና ይሞክሩ።",
    couldNotSendRequest: "ጥያቄውን መላክ አልተቻለም። እንደገና ይሞክሩ።",
    couldNotCancel: "መሰረዝ አልተቻለም። እንደገና ይሞክሩ።",
    photoTypeError: "JPEG፣ PNG ወይም WebP ምስል ይጠቀሙ።",
    photoSizeError: "ከፍተኛው 4 MB።",
    couldNotUploadPhoto: "ፎቶውን መጫን አልተቻለም። እንደገና ይሞክሩ።",
    couldNotRemovePhoto: "ፎቶውን ማስወገድ አልተቻለም። እንደገና ይሞክሩ።",
    notAdded: "አልተጨመረም",
    tasksDoneTotal: (n) => (n === 1 ? "1 ሥራ ተጠናቋል" : `${n} ሥራዎች ተጠናቀዋል`),
    proofSessionHeading: "ዙሩ ተጠናቋል — እድገትዎን ያጋሩ",
    proofSubtaskHeading: "ንዑስ ሥራው ተጠናቋል — ማስረጃ ይጫኑ",
    proofBreakHeading: "ዕረፍት ይውሰዱ",
    proofSessionEyebrow: "ዙሩ አብቅቷል",
    proofSubtaskEyebrow: "የንዑስ ሥራ ማስረጃ",
    proofBreakEyebrow: "የዕረፍት ጊዜ",
    proofHelperRequired: "1–5 ፎቶዎችን እና አጭር የማጠናቀቂያ ማስታወሻ ያክሉ — ሁለቱም ያስፈልጋሉ።",
    proofHelperOptional: "ለዚህ ሥራ ፎቶዎች እና ማስታወሻ አማራጭ ናቸው — ያለ እነሱ ማስረከብ ይችላሉ።",
    proofHelperBreak: "ፎቶዎች እና ማስታወሻ አማራጭ ናቸው (እስከ 5 ፎቶዎች) — ያለ እነሱ ዕረፍት መውሰድ ይችላሉ።",
    proofTakePhoto: "ፎቶ ያንሱ",
    proofChooseGallery: "ከማዕከለ-ስዕላት ይምረጡ",
    proofAddAnother: (n, max) => `ሌላ ያክሉ (${n}/${max})`,
    proofMaxPhotos: (max) => `ከፍተኛው ${max} ፎቶዎች።`,
    proofDescribeLabel: "በዚህ ጊዜ ውስጥ ያከናወኑትን ይግለጹ",
    proofDescribePlaceholder: "ለምሳሌ፦ የምሥራቁን ግድግዳ የመጀመሪያ ንድፍ ጨረስኩ፣ ልኬቶችን ወሰድኩ…",
    proofSubmitUpdate: "ዝማኔውን ያስረክቡ",
    proofSubmitProof: "ማስረጃውን ያስረክቡ",
    proofSubmitBreak: "ያስረክቡ እና ዕረፍት ይውሰዱ",
    proofTakeBreak: "ዕረፍት ይውሰዱ",
    proofCancel: "ሰርዝ",
    proofBreakWithout: "ያለ ማስረጃ ዕረፍት ይውሰዱ",
    proofNeedImage: "እባክዎ ለዚህ ንዑስ ሥራ/ዙር ቢያንስ አንድ የምስል ማስረጃ ያክሉ።",
    proofNeedText: "እባክዎ ለዚህ ንዑስ ሥራ/ዙር የተጠናቀቀውን ይግለጹ።",
    proofTabImage: "ምስል",
    proofTabText: "ጽሑፍ",
    cropPhotoTitle: "ፎቶውን ያስተካክሉ",
    cropPhotoHint: "ለማስተካከል ይጎትቱ · ለማጉላት ቆንጥጠው ወይም +/− ይጠቀሙ · ሲጨርሱ ያስቀምጡ።",
    cropRotate: "አሽከርክር",
    cropApply: "አስቀምጥ",
    cropUsePhoto: "ፎቶውን ተጠቀም",
    cropZoomIn: "አጉላ",
    cropZoomOut: "አሳንስ",
    /** Multi-attempt sessions */
    attemptWord: "ሙከራ",
    attemptOfWord: "ከ",
    attemptScorePenalty: "ውጤት",
    attemptRetriesLeft: "ሙከራዎች ቀርተዋል",
    attemptNoRetriesLeft: "የመጨረሻ ሙከራ",
    requestTime: "ጊዜ ይጠይቁ",
    requestTimeTitle: "ተጨማሪ ጊዜ ይጠይቁ",
    requestTimeEyebrow: "የዙር ጊዜ",
    requestTimeBody: "ለዚህ የሥራ ዙር ጊዜ ይጨምሩ።",
    requestTimeBodyExpired: "የዙሩ ጊዜ አብቅቷል። በዚህ ሥራ ላይ መሥራት ለመቀጠል ጊዜ ይጨምሩ።",
    requestTimeApply: "ጊዜ ጨምር",
    requestTimeUsedLabel: "ተጨማሪ ጊዜ ተጠቅመዋል",
    requestTimeAllUsed: "ለዚህ ሙከራ ያለውን ተጨማሪ ጊዜ በሙሉ ተጠቅመዋል።",
    requestTimeFailed: "ጊዜ መጨመር አልተቻለም። እባክዎ እንደገና ይሞክሩ።",
    minutesShort: "ደቂቃ",
    inactivityWarning: "ምንም እንቅስቃሴ የለም — ይህ ዙር በቅርቡ ይዘጋል።",
    inactivityClosedTitle: "ዙሩ ተዘግቷል",
    inactivityClosedBody: "ለ30 ደቂቃ ምንም እንቅስቃሴ አልነበረም። ይህ ሥራ ወደ የታቀደ ተመልሷል — እንደገና መጀመር ይችላሉ።",
    habit: "ልማድ",
    noScoreImpact: "ልምምድ · በውጤት ላይ ተጽዕኖ የለውም",
  },
};

export function t(lang: Lang): Strings {
  return STRINGS[lang] ?? STRINGS.en;
}

export function statusLabelFor(slug: string, lang: Lang): string {
  const s = t(lang);
  if (slug === "doing" || slug === "in_progress") return s.doing;
  if (slug === "done") return s.done;
  if (slug === "blocked") return s.blocked;
  return s.planned;
}

const LOCALE: Record<Lang, string> = { en: "en-IN", hi: "hi-IN", bn: "bn-IN", fr: "fr-FR", te: "te-IN", am: "am-ET" };

export function dateLocaleFor(lang: Lang): string {
  return LOCALE[lang] ?? "en-IN";
}

/** Due-date chip label for task cards. */
export function dueChipLabel(
  dueDate: string | null,
  lang: Lang,
): { label: string; tone: "neutral" | "warn" | "overdue" } | null {
  if (!dueDate) return null;
  const d = new Date(dueDate);
  if (Number.isNaN(d.getTime())) return null;
  const s = t(lang);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { label: s.daysLate(Math.abs(diff)), tone: "overdue" };
  if (diff === 0) return { label: s.today, tone: "warn" };
  if (diff === 1) return { label: s.tomorrow, tone: "neutral" };
  if (diff < 7) return { label: s.daysShort(diff), tone: "neutral" };
  return {
    label: d.toLocaleDateString(LOCALE[lang] ?? "en-IN", { day: "numeric", month: "short" }),
    tone: "neutral",
  };
}
