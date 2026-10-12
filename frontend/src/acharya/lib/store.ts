"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { normalizeClientLang } from "@/acharya/lib/i18n/lang";

import { isVoiceLang, type Lang, type VoiceLang } from "@/acharya/lib/i18n/registry";
export type { Lang };

export type DockPoint = { x: number; y: number };
/** Surfaces that host the floating Start/End conversation pill. */
/** Each surface parks the voice dock independently — a spot clear of the
 *  board's cards can sit on the task screen's CTA, and home owns its own. */
export type VoiceDockSurface = "board" | "task" | "home";

export interface User {
  id: string;
  phone: string;
  name: string;
  role: string;
  isAdmin: boolean;
  preferredLang?: string;
}

export interface KarigarTask {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  completedAt: string | null;
  statusSlug: string;
  workspaceId: string | null;
  boardName: string | null;
  workspaceSlug?: string;
  workspaceName?: string;
  acharyaSlug?: string;
  acharyaName?: string;
  acharyaInitial?: string;
  acharyaAvatarUrl?: string | null;
  acharyaSource?: string | null;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  image?: string;       // data URL preview (kept client-side only)
  attachmentUrl?: string; // Vercel Blob URL once uploaded — survives reloads
  ts: number;
}

interface Store {
  // Identity
  user: User | null;
  setUser: (u: User | null) => void;
  hydrateMe: () => Promise<void>;
  logout: () => Promise<void>;

  // Language pref (cross-workspace)
  lang: Lang;
  setLang: (l: Lang) => void;

  /**
   * The language the Acharya SPEAKS in voice sessions, when the karigar picked
   * one different from the app language. null = speak the app language.
   * Voice-only: changing it never changes the app's screens or the saved
   * profile language, even when the spoken language also has an app UI.
   */
  voiceLang: VoiceLang | null;
  setVoiceLang: (l: VoiceLang | null) => void;

  /**
   * Accessibility text scale, applied app-wide from AppBootstrap.
   * 1 = normal. See TEXT_SCALES for the offered steps.
   */
  textScale: number;
  setTextScale: (scale: number) => void;

  // Optimistic task status — keyed by task id, valid for a short window
  optimisticStatus: Record<string, string>;
  setOptimisticStatus: (taskId: string, status: string) => void;
  clearOptimisticStatus: (taskId: string) => void;

  /**
   * Where the karigar parked the floating Start/End conversation pill, in
   * viewport px (top-left of the pill). Missing entry = that surface's default
   * dock. Persisted: a worker who moved it off their board cards expects it to
   * stay moved. Clamped back into view on mount by DraggableDock (a phone
   * rotation or a smaller screen could otherwise leave it off-screen).
   *
   * Keyed by surface: the board and a task screen have different content under
   * the pill (cards vs the session CTAs that own the bottom edge), so a spot
   * that is out of the way on one is in the way on the other.
   */
  voiceDockPos: Partial<Record<VoiceDockSurface, DockPoint>>;
  setVoiceDockPos: (surface: VoiceDockSurface, pos: DockPoint | null) => void;

  /**
   * Last non-home screen the karigar was on, so home can offer to take them
   * back to it ("continue where you left off"). Persisted, because the point is
   * the trip that ends with the app being closed — a session-scoped memory
   * would be empty exactly when it is needed. `at` is an epoch ms stamp; home
   * ignores anything stale. The stored path CARRIES ITS `?tab=` — resuming a
   * board or the work list on the wrong lane is not resuming.
   */
  lastScreen: { path: string; at: number } | null;
  /**
   * The screen before that one. Needed because the trail records the screen the
   * karigar is standing on: on `/tasks`, `lastScreen` IS `/tasks`, so a resume
   * card there has nothing to offer without one more step of history. Home
   * never appears in the trail, so home keeps reading `lastScreen`.
   */
  prevScreen: { path: string; at: number } | null;
  setLastScreen: (path: string | null) => void;

  // MahAcharya guide chat sheet — open state lives here (not local useState) so
  // the sheet survives cross-route navigation AND a page reload. The guide is
  // mounted in (app)/layout.tsx, so "open" must outlive any single screen.
  guideOpen: boolean;
  setGuideOpen: (open: boolean) => void;

  /**
   * Karigar preference: open Ask MahAcharya by itself every time the app opens.
   *
   * OFF by default, deliberately — the app opening straight into a chat sheet is
   * a strong opinion to hold on someone else's behalf, so it is opt-in from
   * Settings. Persisted like every other preference. Acted on ONCE per app open
   * by HomeMahAcharyaGuide, which is mounted in the (app) layout and therefore
   * mounts once per load rather than once per screen.
   */
  guideAutoStart: boolean;
  setGuideAutoStart: (on: boolean) => void;

  // Per-task chat history — survives task overlay close/reopen + page reload.
  // Phase 2: round-trip to OmniDel notes for cross-device sync.
  chatByTask: Record<string, ChatMessage[]>;
  /** Explicit Acharya text language, keyed by the existing chat identity. */
  conversationLangByChat: Record<string, VoiceLang>;
  getConversationLang: (chatKey: string) => VoiceLang | null;
  setConversationLang: (chatKey: string, lang: VoiceLang | null) => void;
  getTaskChat: (taskId: string) => ChatMessage[];
  appendTaskMessage: (taskId: string, msg: ChatMessage) => void;
  updateLastAssistant: (taskId: string, content: string) => void;
  setTaskChat: (taskId: string, msgs: ChatMessage[]) => void;
  clearTaskChat: (taskId: string) => void;
}

const EMPTY: ChatMessage[] = [];

/** A stored screen without its `?tab=` — two paths with the same key are the
 *  same screen as far as the resume trail is concerned. */
function screenKey(path: string): string {
  const q = path.indexOf("?");
  return q === -1 ? path : path.slice(0, q);
}

/**
 * Offered text-size steps.
 *
 * Applied as CSS `zoom` on <html>, NOT a root font-size: every component in this
 * app sizes type in hardcoded px through inline styles, so changing the root
 * font-size would scale nothing. Zoom scales the whole layout with the text,
 * which is what a karigar squinting at a low-end phone actually wants.
 */
export const TEXT_SCALES = [1, 1.15, 1.3] as const;
export const DEFAULT_TEXT_SCALE = 1;

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      user: null,
      setUser: (u) =>
        set({
          user: u,
          ...(u?.preferredLang ? { lang: normalizeClientLang(u.preferredLang) } : {}),
        }),
      hydrateMe: async () => {
        try {
          const r = await fetch("/api/auth/me");
          if (!r.ok) return;
          const data = await r.json();
          if (data?.user) {
            const user = data.user as User;
            set({ user, lang: normalizeClientLang(user.preferredLang) });
          }
        } catch { /* network */ }
      },
      logout: async () => {
        try { await fetch("/api/auth/logout", { method: "POST" }); } catch {}
        set({ user: null, lang: "en", voiceLang: null, conversationLangByChat: {} });
        // Hard navigation to the sign-in page. A client-side router.push isn't
        // enough — the current page was server-rendered with the session, so
        // we need a full reload to drop all cached state and re-run the
        // server-side auth guard (which now sees no cookie → sign-in).
        if (typeof window !== "undefined") {
          window.location.href = "/auth/phone/request-otp";
        }
      },

      textScale: DEFAULT_TEXT_SCALE,
      setTextScale: (scale) => set({ textScale: scale }),

      lang: "en",
      setLang: (l) =>
        set((s) => ({
          lang: l,
          user: s.user ? { ...s.user, preferredLang: l } : s.user,
        })),

      voiceLang: null,
      setVoiceLang: (l) => set({ voiceLang: l }),

      optimisticStatus: {},
      setOptimisticStatus: (taskId, status) =>
        set((s) => ({ optimisticStatus: { ...s.optimisticStatus, [taskId]: status } })),
      clearOptimisticStatus: (taskId) =>
        set((s) => {
          const next = { ...s.optimisticStatus };
          delete next[taskId];
          return { optimisticStatus: next };
        }),

      voiceDockPos: {},
      setVoiceDockPos: (surface, pos) =>
        set((s) => {
          const next = { ...s.voiceDockPos };
          if (pos) next[surface] = pos;
          else delete next[surface];
          return { voiceDockPos: next };
        }),

      lastScreen: null,
      prevScreen: null,
      setLastScreen: (path) =>
        set((s) => {
          // Dismiss clears the whole trail: the karigar said "not this", and
          // offering the step before it reads as the card refusing to go away.
          if (!path) {
            return s.lastScreen === null && s.prevScreen === null
              ? s
              : { lastScreen: null, prevScreen: null };
          }
          const last = s.lastScreen;
          if (last?.path === path) return s; // same screen, keep the stamp
          // Same screen, different `?tab=` → update in place. Pushing it as a new
          // entry would shove the genuinely previous screen out of the two-slot
          // trail, and flipping a lane tab is not going somewhere else.
          if (last && screenKey(last.path) === screenKey(path)) {
            return { lastScreen: { path, at: Date.now() } };
          }
          return { lastScreen: { path, at: Date.now() }, prevScreen: last };
        }),

      guideOpen: false,
      setGuideOpen: (open) => set({ guideOpen: open }),

      guideAutoStart: false,
      setGuideAutoStart: (on) => set({ guideAutoStart: on }),

      chatByTask: {},
      conversationLangByChat: {},
      getConversationLang: (chatKey) => {
        const value = get().conversationLangByChat?.[chatKey];
        return isVoiceLang(value) ? value : null;
      },
      setConversationLang: (chatKey, lang) =>
        set((s) => {
          const next = { ...s.conversationLangByChat };
          if (lang === null) delete next[chatKey];
          else if (isVoiceLang(lang)) next[chatKey] = lang;
          return { conversationLangByChat: next };
        }),
      getTaskChat: (taskId) => get().chatByTask[taskId] || EMPTY,
      appendTaskMessage: (taskId, msg) =>
        set((s) => {
          const arr = s.chatByTask[taskId] || [];
          return { chatByTask: { ...s.chatByTask, [taskId]: [...arr, msg] } };
        }),
      updateLastAssistant: (taskId, content) =>
        set((s) => {
          const arr = s.chatByTask[taskId] || [];
          if (arr.length === 0 || arr[arr.length - 1].role !== "assistant") return s;
          const next = [...arr.slice(0, -1), { ...arr[arr.length - 1], content }];
          return { chatByTask: { ...s.chatByTask, [taskId]: next } };
        }),
      setTaskChat: (taskId, msgs) =>
        set((s) => ({ chatByTask: { ...s.chatByTask, [taskId]: msgs } })),
      clearTaskChat: (taskId) =>
        set((s) => {
          const next = { ...s.chatByTask };
          delete next[taskId];
          const languages = { ...s.conversationLangByChat };
          delete languages[taskId];
          return { chatByTask: next, conversationLangByChat: languages };
        }),
    }),
    {
      name: "karigar-store",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // v0 stored ONE dock position (`{x,y} | null`) shared by every screen.
      // Carry it over as the board's, which is the surface it was set on.
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Record<string, unknown>;
        if (version >= 1) return state;
        const legacy = state.voiceDockPos as DockPoint | null | undefined;
        return {
          ...state,
          voiceDockPos:
            legacy && typeof legacy.x === "number" && typeof legacy.y === "number"
              ? { board: legacy }
              : {},
        };
      },
      // Persist user + lang + chat history. Strip image data URLs to keep
      // localStorage size sane (we keep the attachmentUrl which is a CDN link).
      partialize: (s) => ({
        user: s.user,
        lang: s.lang,
        voiceLang: s.voiceLang,
        textScale: s.textScale,
        voiceDockPos: s.voiceDockPos,
        lastScreen: s.lastScreen,
        prevScreen: s.prevScreen,
        guideOpen: s.guideOpen,
        guideAutoStart: s.guideAutoStart,
        conversationLangByChat: s.conversationLangByChat,
        chatByTask: Object.fromEntries(
          Object.entries(s.chatByTask).map(([k, arr]) => [
            k,
            arr.map((m) => ({ ...m, image: undefined })),
          ])
        ),
      }),
      onRehydrateStorage: () => (state) => {
        // Prefer profile language over a stale persisted lang (e.g. user switched to Bengali in Gunakul).
        // Defer setState so we never update subscribers before the root client tree mounts.
        if (!state?.user?.preferredLang) return;
        const nextLang = normalizeClientLang(state.user.preferredLang);
        queueMicrotask(() => {
          useStore.setState({ lang: nextLang });
        });
      },
    }
  )
);
