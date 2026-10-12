import type { AcharyaListItem } from "@/acharya/lib/server/acharyas";
import type { KarigarTask } from "@/acharya/lib/server/omnidel-client";
import type { WorkspaceSummary } from "@/acharya/lib/api/tasks";
import type { User } from "@/acharya/lib/store";
import type { NoticeRow } from "@/acharya/lib/api/notifications";
import type {
  InviteRow,
  Masters,
  NetworkSheet,
  OrgRow,
} from "@/acharya/lib/api/network";
import { MAHACHARYA_STUDIO, PORTRAITS } from "./portraits";

/**
 * Demo content for the Acharya frontend.
 *
 * Everything here is invented for the demo: the karigar, the tasks, the
 * organisations. The guides keep their real names and portraits so the screens
 * read like the app; their summaries are short stand-ins, not the production
 * personas. Shapes are the app's own types, so a change upstream that breaks
 * the demo shows up in `npm run typecheck`.
 */

export const DEMO_USER: User = {
  id: "demo-karigar",
  phone: "9000000001",
  name: "Asha Devi",
  role: "karigar",
  isAdmin: false,
  preferredLang: "en",
};

function acharya(
  slug: string,
  displayName: string,
  field: AcharyaListItem["field"],
  personaSummary: string,
  sortOrder = 0,
  extraPortraits: string[] = [],
): AcharyaListItem {
  const avatarUrl = PORTRAITS[slug] ?? null;
  return {
    id: `acharya-${slug}`,
    slug,
    displayName,
    personaSummary,
    avatarUrl,
    sortOrder,
    field,
    portraits: avatarUrl ? [avatarUrl, ...extraPortraits] : extraPortraits,
  };
}

export const ACHARYAS: AcharyaListItem[] = [
  acharya(
    "mahacharya",
    "MahAcharya'ji",
    "guide",
    "Your guide across all of KarmYog. Ask about any task, any guide, or where to start today.",
    0,
    MAHACHARYA_STUDIO ? [MAHACHARYA_STUDIO] : [],
  ),
  acharya("neeranjan", "Neeranjan Acharya", "general", "Patient with the basics: planning a day's work, finishing what you start, and showing it well."),
  acharya("dr_swapan_acharya", "Dr Swapan Acharya", "guide", "A children's doctor who explains, gently and clearly, how outdoor time, sleep and food shape a growing child."),
  acharya("lakshya_acharya_2", "Lakshman Acharya", "sales", "Teaches one sales method step by step: who to call, what to say, and how to follow up."),
  acharya("soumyajit_acharya", "Soumyajit Acharya", "guide", "Helps you learn a new skill in small daily steps and check that it stuck.", 10),
  acharya("subhas", "Subhas Acharya", "business", "Runs the numbers of a small workshop: costing, pricing and keeping a simple ledger."),
  acharya("vivek", "Vivek Acharya", "finance", "Savings, loans and UPI for daily earners, explained without jargon."),
];

export const WORKSPACES: WorkspaceSummary[] = [
  { slug: "karmyog-vatika", name: "KarmYog Vātika", acharya: { slug: "mahacharya", displayName: "MahAcharya'ji", avatarUrl: PORTRAITS.mahacharya ?? null } },
  { slug: "omnimart-store", name: "OmniMart Store", acharya: { slug: "subhas", displayName: "Subhas Acharya", avatarUrl: PORTRAITS.subhas ?? null } },
];

const DAY = 86_400_000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString();
const date = (offsetDays: number) => iso(offsetDays).slice(0, 10);

let seq = 0;
function task(
  slug: string,
  title: string,
  statusSlug: KarigarTask["statusSlug"],
  extra: Partial<KarigarTask> = {},
): KarigarTask {
  seq += 1;
  const a = ACHARYAS.find((x) => x.slug === slug)!;
  const ws = slug === "subhas" || slug === "vivek" ? WORKSPACES[1] : WORKSPACES[0];
  const done = statusSlug === "done";
  return {
    id: `demo-task-${seq}`,
    title,
    description: null,
    dueDate: date(done ? -seq % 5 : (seq % 4) + 1),
    completedAt: done ? iso(-(seq % 6) - 1) : null,
    statusSlug,
    workspaceId: `ws-${ws.slug}`,
    boardName: "Daily work",
    workspaceSlug: ws.slug,
    workspaceName: ws.name,
    acharyaSlug: a.slug,
    acharyaName: a.displayName,
    acharyaInitial: a.displayName[0],
    acharyaAvatarUrl: a.avatarUrl,
    acharyaSource: "board",
    photoCount: done ? 2 : 0,
    sessionCount: 1,
    breaksPerSession: 1,
    plannedTime: "00:45",
    segmentPlan: {
      total_planned_seconds: 2700,
      segment_count: 1,
      segment_durations_seconds: [2700],
      break_allowance_total: 300,
      break_allowance_per_segment: [300],
    },
    timingMode: "task",
    timingRollup: null,
    statusLabel: null,
    lane: null,
    priority: seq % 3 === 0 ? "high" : "medium",
    taskTypeId: "type-standard",
    taskTypeName: "Standard",
    taskTypeSlug: "standard",
    isSimpleTask: false,
    timerMode: "countdown",
    missionId: null,
    missionImpact: null,
    listName: "This week",
    assignees: [{ id: DEMO_USER.id, name: DEMO_USER.name }],
    assignedOn: iso(-7 - (seq % 5)),
    assignedByName: "Ravi (Supervisor)",
    createdAt: iso(-8 - (seq % 5)),
    breakAllowanceTotal: 300,
    projectName: null,
    leadNo: null,
    leadTitle: null,
    labels: [],
    recurrence: null,
    reviewStatus: statusSlug === "pending_review" ? "pending_review" : done ? "reviewed" : null,
    finalScore: done ? 0.72 + (seq % 4) * 0.06 : null,
    acharyaScore: statusSlug === "pending_review" ? 0.8 : null,
    isHabit: false,
    countsTowardScore: true,
    ...extra,
  };
}

const D = (lines: string[]) => lines.join("\n");

export const TASKS: KarigarTask[] = [
  task("mahacharya", "Plan today's three most important tasks", "doing", {
    description: D([
      "Before you start, write down the three things that matter most today.",
      "",
      "- Pick tasks that move a customer or a payment forward",
      "- Put the hardest one first",
      "- Tell MahAcharya'ji when the list is ready",
    ]),
    isHabit: true,
    recurrence: "daily",
    taskTypeName: "Habit",
    taskTypeSlug: "habit",
  }),
  task("neeranjan", "Photograph the finished brass lamp batch", "doing", {
    description: D([
      "Twelve lamps are polished and ready. Take clear photos for the catalogue.",
      "",
      "1. Plain background, daylight from the side",
      "2. One front photo and one close-up of the engraving per lamp",
      "3. Upload all photos as proof when you finish",
    ]),
  }),
  task("subhas", "Cost sheet for the new kurta order", "doing", {
    description: "Work out cloth, thread, labour and packing cost for 40 kurtas, then add a fair margin.",
  }),
  task("neeranjan", "Stitch 20 collars for order #118", "planned", {
    description: "Use the cream cotton. Measure twice — the customer asked for a 2 cm band.",
  }),
  task("lakshya_acharya_2", "Call five past customers about the Diwali range", "planned", {
    description: D([
      "Use the list from last season. For each call:",
      "",
      "- Greet them by name and remind them what they bought",
      "- Mention one new piece that suits them",
      "- Note whether to call back, and when",
    ]),
  }),
  task("vivek", "Open a recurring deposit for the workshop", "planned", {
    description: "Compare two banks' RD rates and pick one you can pay into every month.",
  }),
  task("soumyajit_acharya", "Learn the running stitch for the new pattern", "planned", {
    description: "Watch the lesson, practise on scrap cloth, then take the short quiz.",
  }),
  task("mahacharya", "Clean and organise the tool shelf", "planned"),
  task("neeranjan", "Pack and label the Jaipur order", "pending_review", {
    description: "Wrap each piece in paper, add the printed label and the thank-you card.",
  }),
  task("subhas", "Update the ledger for last week", "pending_review"),
  task("lakshya_acharya_2", "Follow up with the hotel buyer", "pending_review"),
  task("neeranjan", "Polish twelve brass lamps", "done", {
    description: "Polish to a soft shine; avoid the engraved panels.",
  }),
  task("mahacharya", "Set up your KarmYog profile", "done"),
  task("vivek", "Link your bank account to UPI", "done"),
  task("subhas", "Count the cloth stock", "done"),
  task("neeranjan", "Sort the thread by colour", "done"),
];

export const NOTICES: NoticeRow[] = [
  {
    id: "notice-1",
    kind: "assignment",
    title: "New task from Ravi",
    body: "Stitch 20 collars for order #118",
    link: `/acharyas/neeranjan/tasks/${TASKS[3].id}`,
    created_on: iso(-0.2),
  },
  {
    id: "notice-2",
    kind: "review",
    title: "Your work was reviewed",
    body: "Polish twelve brass lamps — 84%",
    link: `/acharyas/neeranjan/tasks/${TASKS[11].id}`,
    created_on: iso(-1),
  },
];

export const NETWORK: NetworkSheet = {
  profile: {
    id: "demo-profile",
    user_id: DEMO_USER.id,
    slug: "asha-devi",
    display_name: "Asha Devi",
    first_name: "Asha",
    last_name: "Devi",
    email: null,
    photo_url: null,
    trade: "Tailoring",
    city: "Jaipur",
    bio: "Tailor and brass-work finisher. Twelve years at the bench.",
    is_public: true,
    tasks_done: 39,
    jobs_done: 4,
    avg_score: 0.81,
    created_on: iso(-120),
    trade_id: "trade-tailoring",
    city_id: "city-jaipur",
    city_state_id: "state-rj",
    state_name: "Rajasthan",
    address_line: "Shop 4, Johari Bazaar",
    pincode: "302003",
    trade_master: { name: "Tailoring" },
    city_master: { name: "Jaipur", state_id: "state-rj" },
    account_role_name: "Karigar",
    account_branch_name: "Jaipur",
    account_primary_team_name: "Stitching",
  },
  experience: [
    {
      id: "exp-1",
      org_id: "org-vatika",
      task_title: "Polish twelve brass lamps",
      acharya_slug: "neeranjan",
      verdict: "approved",
      score: 0.84,
      summary: "Even finish, engraving untouched, photos clear.",
      artifact_url: null,
      occurred_on: iso(-1),
    },
    {
      id: "exp-2",
      org_id: "org-vatika",
      task_title: "Count the cloth stock",
      acharya_slug: "subhas",
      verdict: "approved",
      score: 0.9,
      summary: "Count matched the register.",
      artifact_url: null,
      occurred_on: iso(-4),
    },
  ],
  links: [
    {
      id: "link-1",
      org_id: "org-vatika",
      status: "active",
      initiated_by: "org",
      workspace_id: "ws-karmyog-vatika",
      created_on: iso(-120),
      responded_on: iso(-119),
      ended_on: null,
      org: { name: "KarmYog Vātika", slug: "karmyog-vatika" },
    },
  ],
};

export const INVITES: InviteRow[] = [
  {
    id: "invite-1",
    org_id: "org-mart",
    status: "invited",
    initiated_by: "org",
    workspace_id: null,
    created_on: iso(-2),
    responded_on: null,
    ended_on: null,
    org: { name: "OmniMart Store", slug: "omnimart-store", city: "Jaipur", about: "Handmade goods, sold online and in store." },
  },
];

export const ORGS: OrgRow[] = [
  { id: "org-vatika", name: "KarmYog Vātika", slug: "karmyog-vatika", city: "Jaipur", about: "Craft workshop and training centre.", myLink: { id: "link-1", status: "active", initiated_by: "org" } },
  { id: "org-mart", name: "OmniMart Store", slug: "omnimart-store", city: "Jaipur", about: "Handmade goods, sold online and in store.", myLink: { id: "invite-1", status: "invited", initiated_by: "org" } },
  { id: "org-loom", name: "Sanganer Loom Co-op", slug: "sanganer-loom", city: "Sanganer", about: "Block-print and handloom co-operative.", myLink: null },
];

export const MASTERS: Masters = {
  states: [
    { id: "state-rj", name: "Rajasthan", code: "RJ" },
    { id: "state-wb", name: "West Bengal", code: "WB" },
    { id: "state-up", name: "Uttar Pradesh", code: "UP" },
  ],
  trades: [
    { id: "trade-tailoring", name: "Tailoring", slug: "tailoring" },
    { id: "trade-metal", name: "Metal work", slug: "metal-work" },
    { id: "trade-weaving", name: "Weaving", slug: "weaving" },
  ],
};

export const CITIES: Record<string, { id: string; name: string }[]> = {
  "state-rj": [{ id: "city-jaipur", name: "Jaipur" }, { id: "city-udaipur", name: "Udaipur" }],
  "state-wb": [{ id: "city-kolkata", name: "Kolkata" }],
  "state-up": [{ id: "city-varanasi", name: "Varanasi" }],
};
