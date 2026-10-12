import {
  ACHARYAS,
  CITIES,
  DEMO_USER,
  INVITES,
  MASTERS,
  NETWORK,
  NOTICES,
  ORGS,
  TASKS,
  WORKSPACES,
} from "./data";
import { getDemoLesson, getDemoQuiz } from "./learn";
import type { KarigarTask } from "@/acharya/lib/server/omnidel-client";

/**
 * The Acharya app's `/api/*`, answered in the browser.
 *
 * The screens are PR #207's own code and call the same endpoints they call in
 * production. This intercepts `fetch` for those paths and answers from the
 * demo data, keeping state in memory so starting a task, pausing it, posting
 * a comment or finishing it all show up on the next read — until reload.
 *
 * Anything that needs a real AI or media provider (Gemini Live, Anam, Tavus,
 * ElevenLabs) answers the way production does when that provider is not
 * configured, so the screens show their own "not available" states.
 */

const SESSION_KEY = "acharya-demo:session";

function signedIn(): boolean {
  try {
    return localStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function setSignedIn(on: boolean) {
  try {
    if (on) localStorage.setItem(SESSION_KEY, "1");
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* private mode — the session lasts for this page only */
  }
  memorySession = on;
}
let memorySession = false;

export function hasDemoSession(): boolean {
  return memorySession || signedIn();
}

// ── state ───────────────────────────────────────────────────────────────────

const tasks = new Map<string, KarigarTask>(TASKS.map((t) => [t.id, { ...t }]));
const notices = [...NOTICES];
let profile = { ...NETWORK.profile };
let lang = DEMO_USER.preferredLang ?? "en";

interface Attempt {
  id: string;
  task_id: string;
  status: "running" | "paused" | "finished" | "expired" | "abandoned";
  started_at: string;
  closed_at: string | null;
  deadline_at: string;
  interval_seconds: number;
  segment_index: number;
  paused_remaining_seconds: number | null;
  remaining_seconds: number;
  breaks_allowed_current_segment: number;
  breaks_used_current_segment: number;
  breaks_remaining_current_segment: number;
  segment_plan: KarigarTask["segmentPlan"];
  checklist_item_id: string | null;
}
const attempts = new Map<string, Attempt[]>();
const updates = new Map<string, unknown[]>();
const notes = new Map<string, unknown[]>([
  [
    TASKS[1].id,
    [
      {
        id: "note-1",
        authorName: "Ravi (Supervisor)",
        noteType: "comment",
        content: "Please include one photo with all twelve lamps together.",
        attachments: [],
        createdAt: new Date(Date.now() - 3_600_000 * 5).toISOString(),
      },
    ],
  ],
]);

let idSeq = 1;
const newId = (p: string) => `${p}-${Date.now().toString(36)}-${idSeq++}`;

function remaining(a: Attempt): number {
  if (a.status === "paused") return a.paused_remaining_seconds ?? a.remaining_seconds;
  if (a.status !== "running") return 0;
  return Math.max(0, Math.round((Date.parse(a.deadline_at) - Date.now()) / 1000));
}

function view(a: Attempt): Attempt {
  return { ...a, remaining_seconds: remaining(a) };
}

function liveAttempt(): Attempt | null {
  for (const list of attempts.values()) {
    const a = list.find((x) => x.status === "running" || x.status === "paused");
    if (a) return a;
  }
  return null;
}

function allTasks(): KarigarTask[] {
  return [...tasks.values()];
}

/** The current tasks, including changes made in this visit — what a server page would read. */
export function demoTasks(): KarigarTask[] {
  return allTasks();
}

export function demoTask(id: string): KarigarTask | null {
  return tasks.get(id) ?? null;
}

// ── responses ───────────────────────────────────────────────────────────────

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

const unauthorized = () => json({ error: "Unauthorized" }, 401);

function streamText(text: string): Response {
  const words = text.split(/(\s+)/);
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const w of words) {
        controller.enqueue(enc.encode(w));
        await new Promise((r) => setTimeout(r, 18));
      }
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

async function readJson(init?: RequestInit): Promise<Record<string, unknown>> {
  if (!init?.body || typeof init.body !== "string") return {};
  try {
    return JSON.parse(init.body) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function chatReply(message: string): string {
  const m = message.toLowerCase();
  if (/start|begin|first|today/.test(m)) {
    return "Start with the task that is already in progress — finishing it frees your mind for the next one. When you are ready, open it and press Start; I will keep time with you.";
  }
  if (/photo|proof|picture/.test(m)) {
    return "Good proof is simple: one clear photo of the whole piece, one close-up of the detail that matters, in daylight. Add a line saying what you did.";
  }
  return "This is the demo, so I am not connected to the live Acharya. In the real app I would answer from your task and its lessons. Try opening a task and pressing Start to see the session timer.";
}

type Handler = (m: RegExpMatchArray, init: RequestInit | undefined, url: URL) => Response | Promise<Response>;
interface Route {
  method: string;
  pattern: RegExp;
  open?: boolean;
  handle: Handler;
}

const routes: Route[] = [
  // auth
  { method: "GET", pattern: /^\/api\/auth\/config$/, open: true, handle: () => json({ demoEnabled: true }) },
  {
    method: "POST",
    pattern: /^\/api\/auth\/login\/(request|resend)$/,
    open: true,
    handle: () => json({ ok: true, resendAfterSeconds: 30 }),
  },
  {
    method: "POST",
    pattern: /^\/api\/auth\/login\/verify$/,
    open: true,
    handle: async (_m, init) => {
      const body = await readJson(init);
      const otp = String(body.otp ?? "");
      if (!/^\d{6}$/.test(otp)) return json({ ok: false, code: "INVALID_OTP", error: "Enter the six-digit code." }, 400);
      setSignedIn(true);
      return json({ ok: true, user: { ...DEMO_USER, preferredLang: lang } });
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/auth\/logout$/,
    open: true,
    handle: () => {
      setSignedIn(false);
      return json({ ok: true });
    },
  },
  { method: "GET", pattern: /^\/api\/auth\/me$/, handle: () => json({ user: { ...DEMO_USER, preferredLang: lang } }) },
  { method: "POST", pattern: /^\/api\/profile\/language$/, handle: async (_m, init) => {
      lang = String((await readJson(init)).lang ?? lang);
      return json({ ok: true, preferredLang: lang });
    } },

  // guides and tasks
  { method: "GET", pattern: /^\/api\/work\/acharyas$/, handle: () => json({ items: ACHARYAS }) },
  {
    method: "GET",
    pattern: /^\/api\/work\/acharyas\/([^/]+)$/,
    handle: (m) => {
      const item = ACHARYAS.find((a) => a.slug === m[1]);
      return item ? json({ item }) : json({ error: "Not found" }, 404);
    },
  },
  { method: "GET", pattern: /^\/api\/work\/workspaces$/, handle: () => json({ items: WORKSPACES }) },
  { method: "GET", pattern: /^\/api\/work\/all-tasks$/, handle: () => json({ items: allTasks(), workspaces: WORKSPACES }) },
  {
    method: "GET",
    pattern: /^\/api\/work\/([^/]+)\/tasks$/,
    handle: (m) => json({ items: allTasks().filter((t) => t.workspaceSlug === m[1]) }),
  },
  {
    method: "GET",
    pattern: /^\/api\/work\/tasks\/([^/]+)$/,
    handle: (m) => {
      const item = tasks.get(m[1]);
      return item ? json({ item }) : json({ error: "Task not found" }, 404);
    },
  },
  {
    method: "PATCH",
    pattern: /^\/api\/work\/tasks\/([^/]+)\/status$/,
    handle: async (m, init) => {
      const t = tasks.get(m[1]);
      if (!t) return json({ error: "Task not found" }, 404);
      const status = String((await readJson(init)).status ?? t.statusSlug);
      const item = { ...t, statusSlug: status, completedAt: status === "done" ? new Date().toISOString() : null };
      tasks.set(t.id, item);
      return json({ item });
    },
  },

  // timed sessions
  {
    method: "GET",
    pattern: /^\/api\/work\/active-attempt$/,
    handle: () => {
      const a = liveAttempt();
      if (!a) return json({ item: null });
      return json({
        item: {
          attemptId: a.id,
          taskId: a.task_id,
          taskTitle: tasks.get(a.task_id)?.title ?? "",
          status: a.status,
          remaining_seconds: remaining(a),
          segment_index: a.segment_index,
          interval_seconds: a.interval_seconds,
        },
      });
    },
  },
  {
    method: "GET",
    pattern: /^\/api\/work\/tasks\/([^/]+)\/attempts$/,
    handle: (m) => json({ items: (attempts.get(m[1]) ?? []).map(view) }),
  },
  {
    method: "POST",
    pattern: /^\/api\/work\/tasks\/([^/]+)\/attempts\/start$/,
    handle: async (m, init) => {
      const t = tasks.get(m[1]);
      if (!t) return json({ error: "Task not found" }, 404);
      const live = liveAttempt();
      if (live && live.task_id !== t.id) {
        return json(
          {
            error: `Finish or pause "${tasks.get(live.task_id)?.title}" first.`,
            code: "ANOTHER_TASK_ACTIVE",
            active: { attemptId: live.id, taskId: live.task_id, taskTitle: tasks.get(live.task_id)?.title, status: live.status },
          },
          409,
        );
      }
      if (live) return json({ item: view(live) });
      const body = await readJson(init);
      const list = attempts.get(t.id) ?? [];
      const seconds = Number(body.remaining_seconds) || t.segmentPlan?.segment_durations_seconds[0] || 2700;
      const allowed = t.segmentPlan?.break_allowance_per_segment?.[0] ?? 300;
      const a: Attempt = {
        id: newId("attempt"),
        task_id: t.id,
        status: "running",
        started_at: new Date().toISOString(),
        closed_at: null,
        deadline_at: new Date(Date.now() + seconds * 1000).toISOString(),
        interval_seconds: seconds,
        segment_index: list.length + 1,
        paused_remaining_seconds: null,
        remaining_seconds: seconds,
        breaks_allowed_current_segment: allowed > 0 ? 1 : 0,
        breaks_used_current_segment: 0,
        breaks_remaining_current_segment: allowed > 0 ? 1 : 0,
        segment_plan: t.segmentPlan,
        checklist_item_id: typeof body.checklist_item_id === "string" ? body.checklist_item_id : null,
      };
      attempts.set(t.id, [...list, a]);
      if (t.statusSlug === "planned") tasks.set(t.id, { ...t, statusSlug: "doing" });
      return json({ item: view(a) });
    },
  },
  {
    method: "GET",
    pattern: /^\/api\/work\/tasks\/([^/]+)\/attempts\/([^/]+)$/,
    handle: (m) => {
      const a = (attempts.get(m[1]) ?? []).find((x) => x.id === m[2]);
      return a ? json({ item: view(a) }) : json({ error: "Attempt not found" }, 404);
    },
  },
  {
    method: "PATCH",
    pattern: /^\/api\/work\/tasks\/([^/]+)\/attempts\/([^/]+)$/,
    handle: async (m, init) => {
      const a = (attempts.get(m[1]) ?? []).find((x) => x.id === m[2]);
      if (!a) return json({ error: "Attempt not found" }, 404);
      const action = String((await readJson(init)).action ?? "");
      if (action === "pause") {
        if (a.status !== "running") return json({ error: "Not running" }, 409);
        a.paused_remaining_seconds = remaining(a);
        a.status = "paused";
        a.breaks_used_current_segment += 1;
        a.breaks_remaining_current_segment = Math.max(0, a.breaks_remaining_current_segment - 1);
      } else if (action === "resume") {
        if (a.status !== "paused") return json({ error: "Not paused" }, 409);
        a.deadline_at = new Date(Date.now() + (a.paused_remaining_seconds ?? 0) * 1000).toISOString();
        a.paused_remaining_seconds = null;
        a.status = "running";
      } else if (action === "finish" || action === "abandon" || action === "expire") {
        a.status = action === "finish" ? "finished" : action === "abandon" ? "abandoned" : "expired";
        a.closed_at = new Date().toISOString();
      } else {
        return json({ error: "Unsupported action" }, 400);
      }
      return json({ item: view(a) });
    },
  },
  {
    method: "GET",
    pattern: /^\/api\/work\/tasks\/([^/]+)\/attempts\/([^/]+)\/updates$/,
    handle: (m) => json({ items: updates.get(m[2]) ?? [] }),
  },
  {
    method: "POST",
    pattern: /^\/api\/work\/tasks\/([^/]+)\/attempts\/([^/]+)\/updates$/,
    handle: async (m, init) => {
      const body = await readJson(init);
      const item = {
        id: newId("update"),
        attempt_id: m[2],
        kind: body.kind ?? "text",
        text: body.text ?? null,
        blob_url: body.blob_url ?? null,
        attachments: body.attachments ?? null,
        update_context: body.update_context ?? null,
        taken_at: new Date().toISOString(),
      };
      updates.set(m[2], [...(updates.get(m[2]) ?? []), item]);
      return json({ item }, 201);
    },
  },
  {
    method: "GET",
    pattern: /^\/api\/work\/tasks\/([^/]+)\/attempts\/([^/]+)\/activity$/,
    handle: () => json({ items: [] }),
  },
  {
    method: "POST",
    pattern: /^\/api\/work\/tasks\/([^/]+)\/attempts\/([^/]+)\/(activity|auto-close|extend-time)$/,
    handle: () => json({ ok: true }),
  },
  {
    method: "POST",
    pattern: /^\/api\/work\/tasks\/([^/]+)\/complete$/,
    handle: (m) => {
      const t = tasks.get(m[1]);
      if (!t) return json({ error: "Task not found" }, 404);
      for (const a of attempts.get(t.id) ?? []) {
        if (a.status === "running" || a.status === "paused") {
          a.status = "finished";
          a.closed_at = new Date().toISOString();
        }
      }
      tasks.set(t.id, { ...t, statusSlug: "pending_review", reviewStatus: "pending_review", acharyaScore: 0.8 });
      return json({
        ok: true,
        evaluation: {
          approved: true,
          score: 0.8,
          notes: "Clear proof and a tidy finish. Sent to your manager for the final score.",
          review_status: "pending_review",
          acharya_score: 0.8,
          evaluator: "acharya",
        },
      });
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/work\/tasks\/([^/]+)\/subtasks\/(complete|complete-session)$/,
    handle: () => json({ ok: true }),
  },

  // comments
  { method: "GET", pattern: /^\/api\/work\/tasks\/([^/]+)\/notes$/, handle: (m) => json({ items: notes.get(m[1]) ?? [] }) },
  {
    method: "POST",
    pattern: /^\/api\/work\/tasks\/([^/]+)\/notes$/,
    handle: async (m, init) => {
      const body = await readJson(init);
      const text = String(body.content ?? "").trim();
      const attachments = Array.isArray(body.attachments) ? body.attachments : [];
      if (!text && attachments.length === 0) return json({ error: "Empty note" }, 400);
      const item = {
        id: newId("note"),
        authorName: DEMO_USER.name,
        noteType: "comment",
        content: text || null,
        attachments,
        createdAt: new Date().toISOString(),
      };
      notes.set(m[1], [...(notes.get(m[1]) ?? []), item]);
      return json({ item });
    },
  },

  // learning and chat
  {
    method: "POST",
    pattern: /^\/api\/work\/chat$/,
    handle: async (_m, init) => {
      const { messages } = (await readJson(init)) as { messages?: { role: string; content: string }[] };
      const last = [...(messages ?? [])].reverse().find((m) => m.role === "user");
      return streamText(chatReply(last?.content ?? ""));
    },
  },
  { method: "POST", pattern: /^\/api\/work\/(course|lesson)$/, handle: async (_m, init) => json(getDemoLesson(String((await readJson(init)).taskId ?? ""))) },
  { method: "POST", pattern: /^\/api\/work\/quiz$/, handle: async (_m, init) => json(getDemoQuiz(String((await readJson(init)).taskId ?? ""))) },
  { method: "POST", pattern: /^\/api\/work\/quiz\/submit$/, handle: () => json({ ok: true }) },
  { method: "POST", pattern: /^\/api\/work\/(search|read|videos)$/, handle: () => json({ items: [], results: [] }) },
  { method: "POST", pattern: /^\/api\/work\/acharya-memory$/, handle: () => json({ items: [] }) },

  // voice and avatar providers: answer as production does when not configured
  { method: "GET", pattern: /^\/api\/work\/anam\/availability$/, handle: () => json({ available: false, reason: "no_workspace" }) },
  { method: "GET", pattern: /^\/api\/work\/tavus\/availability$/, handle: () => json({ available: false, reason: "acharya_not_tavus_enabled" }) },
  {
    method: "POST",
    pattern: /^\/api\/(work\/(gemini-live-token|anam\/session-token|tavus\/conversation.*|eleven-tts-stream|voice-turn|voice-transcribe)|auth\/(phone|register)\/help\/live-token)$/,
    open: true,
    handle: () => json({ error: "Voice is not available in the demo.", code: "DEMO_NO_VOICE" }, 503),
  },
  { method: "POST", pattern: /^\/api\/work\/voice-debug$/, open: true, handle: () => json({ ok: true }) },

  // profile, network, notifications
  { method: "GET", pattern: /^\/api\/notifications$/, handle: () => json({ items: notices }) },
  {
    method: "POST",
    pattern: /^\/api\/notifications\/([^/]+)\/read$/,
    handle: (m) => {
      const i = notices.findIndex((n) => n.id === m[1]);
      if (i >= 0) notices.splice(i, 1);
      return json({ ok: true });
    },
  },
  { method: "GET", pattern: /^\/api\/network\/me$/, handle: () => json({ ...NETWORK, profile }) },
  {
    method: "PATCH",
    pattern: /^\/api\/network\/profile$/,
    handle: async (_m, init) => {
      profile = { ...profile, ...(await readJson(init)) };
      return json({ profile });
    },
  },
  { method: "GET", pattern: /^\/api\/network\/invites$/, handle: () => json({ items: INVITES }) },
  { method: "GET", pattern: /^\/api\/network\/orgs$/, handle: () => json({ items: ORGS }) },
  { method: "POST", pattern: /^\/api\/network\/invites\/([^/]+)$/, handle: () => json({ link: INVITES[0] }) },
  { method: "POST", pattern: /^\/api\/network\/requests$/, handle: () => json({ link: { ...INVITES[0], status: "requested" } }) },
  { method: "DELETE", pattern: /^\/api\/network\/requests$/, handle: () => json({ ok: true }) },
  { method: "GET", pattern: /^\/api\/masters$/, open: true, handle: () => json(MASTERS) },
  {
    method: "GET",
    pattern: /^\/api\/(masters|auth\/register)\/cities$/,
    open: true,
    handle: (_m, _i, url) => json({ cities: CITIES[url.searchParams.get("stateId") ?? url.searchParams.get("state_id") ?? ""] ?? [] }),
  },
  { method: "POST", pattern: /^\/api\/network\/photo$/, handle: () => json({ photo_url: profile.photo_url }) },
  { method: "DELETE", pattern: /^\/api\/network\/photo$/, handle: () => json({ ok: true, photo_url: null }) },
  { method: "POST", pattern: /^\/api\/profile\/delete$/, handle: () => json({ error: "Not in the demo." }, 400) },
];

/**
 * Install once, before the first render. Same-origin `/api/*` requests are
 * answered here; everything else goes to the network untouched.
 */
export function installDemoApi() {
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.href);
    if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/")) return realFetch(input, init);

    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    for (const r of routes) {
      if (r.method !== method) continue;
      const m = url.pathname.match(r.pattern);
      if (!m) continue;
      if (!r.open && !hasDemoSession()) return unauthorized();
      await new Promise((res) => setTimeout(res, 120)); // a network-ish beat, so loading states show
      return r.handle(m, init, url);
    }
    console.info(`[acharya demo] no demo answer for ${method} ${url.pathname}`);
    return json({ error: "Not available in the demo.", demo: true }, 501);
  };
}
