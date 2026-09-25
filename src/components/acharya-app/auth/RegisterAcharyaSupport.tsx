"use client";

import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import AcharyaAvatar from "@/components/acharya-avatar";
import { VoiceToggle } from "@/components/voice/VoiceToggle";
import {
  useGeminiLiveSession,
  type ToolHandlers,
  type ToolResult,
} from "@/hooks/useGeminiLiveSession";
import type { HelperAcharya } from "@/components/auth/MahAcharyaHelpCard";
import type { RegisterFormPatch } from "@/components/RegisterHelpSheet";
import type { StateOption, TradeOption } from "@/lib/api/network";
import type { Lang } from "@/lib/store";
import { normalizeRegisterLang, registerCopy } from "@/lib/i18n/register-strings";
import { matchCity, type CityMatchResult } from "@/lib/city-match";

type Draft = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  tradeId: string;
  stateId: string;
  cityId: string;
  addressLine: string;
  pincode: string;
  bio: string;
};

export type SendRegisterCodeResult =
  | { ok: true }
  | { ok: false; error: string };

interface Props {
  acharya: HelperAcharya;
  draft: Draft;
  preferredLang: Lang;
  states: StateOption[];
  trades: TradeOption[];
  cities: Array<{ id: string; name: string }>;
  onApply: (patch: RegisterFormPatch) => void;
  onLanguage: (lang: Lang) => void;
  /** Actually hits /register/start and advances to OTP. */
  onSendCode: (overrides?: { firstName?: string; phone?: string }) => Promise<SendRegisterCodeResult>;
  onChat: () => void;
}

function resolveNamed(
  raw: Record<string, unknown>,
  states: StateOption[],
  trades: TradeOption[],
  cities: Array<{ id: string; name: string }>,
): { patch: RegisterFormPatch; cityMatch: CityMatchResult | null } {
  const patch: RegisterFormPatch = {};
  const str = (k: string) => {
    const v = raw[k];
    return typeof v === "string" && v.trim() ? v.trim() : "";
  };
  if (str("first_name")) patch.first_name = str("first_name");
  if (str("last_name")) patch.last_name = str("last_name");
  if (str("phone")) patch.phone = str("phone").replace(/\D/g, "").slice(0, 10);
  if (str("email")) patch.email = str("email");
  if (str("address_line")) patch.address_line = str("address_line");
  if (str("pincode")) patch.pincode = str("pincode").replace(/\D/g, "").slice(0, 6);
  if (str("bio")) patch.bio = str("bio");
  if (str("preferred_lang") || str("language")) {
    patch.preferred_lang = normalizeRegisterLang(str("preferred_lang") || str("language"));
  }

  const trade = str("trade");
  if (trade) {
    const t = trades.find((x) => x.name.toLowerCase() === trade.toLowerCase())
      || trades.find((x) => x.name.toLowerCase().includes(trade.toLowerCase()));
    if (t) patch.trade_id = t.id;
  }
  const state = str("state");
  if (state) {
    const s = states.find((x) => x.name.toLowerCase() === state.toLowerCase())
      || states.find((x) => x.name.toLowerCase().includes(state.toLowerCase()));
    if (s) patch.state_id = s.id;
  }

  let cityMatch: CityMatchResult | null = null;
  const city = str("city");
  if (city) {
    cityMatch = matchCity(city, cities);
    // Only apply the field when resolution is unambiguous. An "options" or
    // "suggestions" result leaves city_id unset (city stays "missing", so the
    // model keeps asking) — the caller turns cityMatch into a spoken choice
    // instead of silently locking in a guess.
    if (cityMatch.type === "exact") patch.city_id = cityMatch.city.id;
  }
  return { patch, cityMatch };
}

function applyPatchToDraft(d: Draft, patch: RegisterFormPatch, masters: {
  states: StateOption[];
  trades: TradeOption[];
  cities: Array<{ id: string; name: string }>;
}): Draft {
  const next = { ...d };
  if (patch.first_name !== undefined) next.firstName = patch.first_name;
  if (patch.last_name !== undefined) next.lastName = patch.last_name;
  if (patch.phone !== undefined) next.phone = patch.phone;
  if (patch.email !== undefined) next.email = patch.email;
  if (patch.address_line !== undefined) next.addressLine = patch.address_line;
  if (patch.pincode !== undefined) next.pincode = patch.pincode;
  if (patch.bio !== undefined) next.bio = patch.bio;
  if (patch.trade_id !== undefined) next.tradeId = patch.trade_id;
  if (patch.state_id !== undefined) next.stateId = patch.state_id;
  if (patch.city_id !== undefined) next.cityId = patch.city_id;
  void masters;
  return next;
}

function draftProgress(d: Draft, masters: {
  states: StateOption[];
  trades: TradeOption[];
  cities: Array<{ id: string; name: string }>;
  lang: Lang;
}) {
  const trade = masters.trades.find((t) => t.id === d.tradeId)?.name || "";
  const state = masters.states.find((s) => s.id === d.stateId)?.name || "";
  const city = masters.cities.find((c) => c.id === d.cityId)?.name || "";
  const snapshot: Record<string, string> = {
    preferred_lang: masters.lang || "",
    first_name: d.firstName.trim(),
    last_name: d.lastName.trim(),
    phone: d.phone.replace(/\D/g, "").slice(0, 10),
    email: d.email.trim(),
    trade,
    state,
    city,
    address_line: d.addressLine.trim(),
    pincode: d.pincode.trim(),
    bio: d.bio.trim(),
  };
  const required = [
    "preferred_lang",
    "first_name",
    "last_name",
    "phone",
    "trade",
    "state",
    "city",
    "address_line",
    "pincode",
  ] as const;
  const filled = required.filter((k) => snapshot[k]?.trim());
  const missing = required.filter((k) => !snapshot[k]?.trim());
  return { snapshot, filled, missing };
}

/**
 * Signature of the register screen: Acharya presence with Talk + Chat.
 */
export default function RegisterAcharyaSupport({
  acharya, draft, preferredLang, states, trades, cities,
  onApply, onLanguage, onSendCode, onChat,
}: Props) {
  const voice = useGeminiLiveSession();
  const draftRef = useRef(draft);
  const langRef = useRef(preferredLang);
  const mastersRef = useRef({ states, trades, cities });
  const onApplyRef = useRef(onApply);
  const onLanguageRef = useRef(onLanguage);
  const onSendCodeRef = useRef(onSendCode);
  const setContextRef = useRef(voice.setContext);
  const setHandlersRef = useRef(voice.setHandlers);
  const handlersRef = useRef<ToolHandlers>({});

  useEffect(() => { draftRef.current = draft; }, [draft]);
  useEffect(() => { langRef.current = preferredLang; }, [preferredLang]);
  useEffect(() => { mastersRef.current = { states, trades, cities }; }, [states, trades, cities]);
  useEffect(() => { onApplyRef.current = onApply; }, [onApply]);
  useEffect(() => { onLanguageRef.current = onLanguage; }, [onLanguage]);
  useEffect(() => { onSendCodeRef.current = onSendCode; }, [onSendCode]);
  useEffect(() => { setContextRef.current = voice.setContext; }, [voice.setContext]);
  useEffect(() => { setHandlersRef.current = voice.setHandlers; }, [voice.setHandlers]);

  const endVoice = voice.end;
  useEffect(() => () => endVoice(), [endVoice]);

  function buildTokenBody() {
    const d = draftRef.current;
    const trade = mastersRef.current.trades.find((t) => t.id === d.tradeId)?.name || "";
    const state = mastersRef.current.states.find((s) => s.id === d.stateId)?.name || "";
    const city = mastersRef.current.cities.find((c) => c.id === d.cityId)?.name || "";
    return {
      stateId: d.stateId || null,
      lang: langRef.current,
      draft: {
        first_name: d.firstName,
        last_name: d.lastName,
        phone: d.phone,
        email: d.email,
        trade,
        state,
        city,
        address_line: d.addressLine,
        pincode: d.pincode,
        bio: d.bio,
        preferred_lang: langRef.current,
      },
    };
  }

  /** Getter so reconnect/remint always mints with the LATEST form draft. */
  const tokenBodyGetter = useMemo(() => () => buildTokenBody(), []);

  function voiceCtx(speechLang: string) {
    return {
      context: "acharya" as const,
      acharyaSlug: acharya.slug,
      tokenEndpoint: "/api/auth/register/help/live-token",
      // Live getter: every reconnect remints with current draft, not empty start.
      tokenBody: tokenBodyGetter,
      // Bound into session key so language change remints hi-IN / bn-IN / en-IN.
      speechLang,
    };
  }

  const handlers: ToolHandlers = useMemo(() => ({
    set_register_language: async (args): Promise<ToolResult> => {
      const lang = normalizeRegisterLang(args.language ?? args.preferred_lang);
      const prev = langRef.current;
      onLanguageRef.current(lang);
      onApplyRef.current({ preferred_lang: lang });
      langRef.current = lang;
      const progress = draftProgress(draftRef.current, {
        ...mastersRef.current,
        lang,
      });
      // Remint once for speech language_code (hi-IN/bn-IN). Do NOT also notify —
      // that forced a second full model turn and felt very slow.
      if (lang !== prev) {
        setContextRef.current(voiceCtx(lang), handlersRef.current, lang);
      }
      return {
        ok: true,
        language: lang,
        reminted_for_speech: lang !== prev,
        speak_only: lang === "hi" ? "hindi" : lang === "bn" ? "bengali" : "english",
        instruction:
          "Continue registration in this language only. Do not re-ask language. Next: ask only the first missing required field.",
        filled: progress.filled,
        missing: progress.missing,
      };
    },
    fill_register_form: async (args): Promise<ToolResult> => {
      const { patch, cityMatch } = resolveNamed(
        args,
        mastersRef.current.states,
        mastersRef.current.trades,
        mastersRef.current.cities,
      );
      if (Object.keys(patch).length === 0 && !cityMatch) {
        return { ok: false, error: "no_fields" };
      }
      if (patch.preferred_lang) {
        const nextLang = patch.preferred_lang;
        const prev = langRef.current;
        onLanguageRef.current(nextLang);
        langRef.current = nextLang;
        // Prefer tool-result language switch mid-turn; remint only if speech
        // engine language must change (same as set_register_language).
        if (nextLang !== prev) {
          setContextRef.current(voiceCtx(nextLang), handlersRef.current, nextLang);
        }
      }
      onApplyRef.current(patch);
      // Keep draftRef in sync immediately (React setState is async).
      const merged = applyPatchToDraft(draftRef.current, patch, mastersRef.current);
      draftRef.current = merged;
      const progress = draftProgress(merged, {
        ...mastersRef.current,
        lang: langRef.current,
      });
      // No notify() here — tool response already has filled/missing; an extra
      // clientContent turn doubled latency after every field.
      const ready = progress.missing.length === 0;
      // City needs a spoken word narrowed to a name before it can be applied —
      // never lock in a guess. `city` stays in `missing` until one of these
      // resolves to `type: "exact"` on a later call.
      const cityNames = (list: { name: string }[]) => list.map((c) => c.name);
      const cityInstruction =
        cityMatch?.type === "options"
          ? `Several cities match what you heard: ${cityNames(cityMatch.cities).join(", ")}. Read these options and ask the user which one they mean, in their language. Once they pick, call fill_register_form again with that exact city name.`
          : cityMatch?.type === "suggestions"
            ? `No city matched exactly. The closest ${cityMatch.cities.length > 1 ? "cities are" : "city is"} ${cityNames(cityMatch.cities).join(" or ")}. Ask "did you mean ${cityNames(cityMatch.cities)[0]}?" (translated to their language) and confirm before calling fill_register_form again.`
            : cityMatch?.type === "none"
              ? "That city was not found in the list for their state. Ask them to say it again slowly, or spell it, or confirm their state is correct."
              : null;
      return {
        ok: true,
        applied: Object.keys(patch),
        filled: progress.filled,
        missing: progress.missing,
        next_ask: progress.missing[0] || null,
        ready_for_confirm: ready,
        city_options: cityMatch?.type === "options" ? cityNames(cityMatch.cities) : undefined,
        city_suggestions: cityMatch?.type === "suggestions" ? cityNames(cityMatch.cities) : undefined,
        // When complete: ask submit vs change — do NOT call send_register_code yet.
        instruction: cityInstruction
          ? cityInstruction
          : ready
            ? "All required fields filled. Ask the user (in their language) whether to submit and send the OTP code, or change something. Do not call send_register_code until they clearly confirm."
            : null,
        draft: progress.snapshot,
      };
    },
    send_register_code: async (args): Promise<ToolResult> => {
      // Voice path only: require explicit confirmation. The on-screen "Send code"
      // button does not use this tool — it stays one-tap submit.
      const confirmed =
        args.user_confirmed === true ||
        args.user_confirmed === "true" ||
        args.confirmed === true ||
        args.confirmed === "true";
      if (!confirmed) {
        return {
          ok: false,
          error: "need_user_confirm",
          instruction:
            "Ask the user in their language: form is complete — submit and send code, or change something? Only call this tool again with user_confirmed=true after they say yes/submit/send.",
        };
      }
      const firstName = typeof args.first_name === "string" ? args.first_name.trim() : "";
      const phoneRaw = typeof args.phone === "string" ? args.phone.replace(/\D/g, "").slice(0, 10) : "";
      if (firstName || phoneRaw) {
        onApplyRef.current({
          ...(firstName ? { first_name: firstName } : {}),
          ...(phoneRaw ? { phone: phoneRaw } : {}),
        });
        if (firstName) draftRef.current = { ...draftRef.current, firstName };
        if (phoneRaw) draftRef.current = { ...draftRef.current, phone: phoneRaw };
      }
      const progress = draftProgress(draftRef.current, {
        ...mastersRef.current,
        lang: langRef.current,
      });
      if (progress.missing.length > 0) {
        return {
          ok: false,
          error: "missing_required",
          missing: progress.missing,
          filled: progress.filled,
        };
      }
      const result = await onSendCodeRef.current({
        firstName: firstName || draftRef.current.firstName,
        phone: phoneRaw || draftRef.current.phone,
      });
      if (result.ok) {
        // Leave voice so OTP UI is clear.
        endVoice();
        return { ok: true, advanced: "otp" };
      }
      return { ok: false, error: result.error };
    },
  }), [endVoice, acharya.slug, tokenBodyGetter]);

  // Keep handlersRef aligned for set_register_language remint (avoids stale tools).
  useEffect(() => {
    handlersRef.current = handlers;
    setHandlersRef.current(handlers);
  }, [handlers]);

  function startVoice() {
    void voice.start(
      voiceCtx(langRef.current),
      handlers,
      langRef.current,
    );
  }

  const copy = registerCopy(preferredLang);
  const live = voice.status === "live";
  const caption = live ? (voice.outputText || voice.inputText) : "";
  const summary = acharya.personaSummary?.trim() || copy.helperHint;

  return (
    <section className="mb-5 text-left" style={card} aria-label={`${acharya.displayName} can help with registration`}>
      {/* Landscape portrait band, then a solid strip for the words — the same
          two-band split the home feature card uses. A 52px avatar beside three
          lines of type made the acharya an icon; on the screen that ASKS the
          karigar to talk to him, he should be a face. */}
      <div style={photoBand}>
        <AcharyaAvatar
          slug={acharya.slug}
          name={acharya.displayName}
          imageUrl={acharya.avatarUrl}
          size={480}
          shape="rounded"
          style={photoFrame}
          imageStyle={photoImage}
          textStyle={photoInitial}
        />
        {/* The mic disc turns red when live, but it is 56px in a corner. This
            says the same thing on the portrait, where the karigar is looking. */}
        {live && (
          <span style={livePill}>
            <span style={liveDot} aria-hidden />
            {copy.listening}
          </span>
        )}
      </div>

      {/* Type on its own ground, never over the face. Right gutter keeps every
          line clear of the pinned mic. */}
      <div style={infoBand}>
        <p className="font-mono" style={eyebrow}>{copy.yourAcharya}</p>
        <h2 className="font-serif italic" style={nameLine}>{acharya.displayName}</h2>
        <p style={summaryLine}>{summary}</p>
        <button type="button" onClick={onChat} className="press" style={chatBtn}>
          <ChatIcon />
          {copy.chatToFillForm}
        </button>

        {/* Pinned bottom-right, exactly where the home card and the full-screen
            conversation view keep it — the one control that must never move. */}
        <span style={micSlot}>
          <VoiceToggle
            status={voice.status}
            onStart={startVoice}
            onEnd={voice.end}
            size={56}
          />
        </span>
      </div>

      {voice.error ? (
        <p style={errorLine}>{voice.error}</p>
      ) : null}

      {caption ? (
        <p style={captionBand}>
          <span className="font-mono" style={captionWho}>
            {voice.outputText ? acharya.displayName : copy.youSpeaker}
          </span>
          {caption}
        </p>
      ) : null}
    </section>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
      <path d="M20.5 12.2c0 4-3.8 7.2-8.5 7.2-1 0-2-.15-2.9-.42L4.5 20.5l1.2-3.3A7 7 0 0 1 3.5 12.2C3.5 8.2 7.3 5 12 5s8.5 3.2 8.5 7.2Z" />
    </svg>
  );
}

/**
 * The photo's shape, not the card's: the text strip sits under it and adds its
 * own height. 4:3 with a hard height cap, the same numbers the home feature card
 * uses, so the crop a karigar sees on this screen matches the one on home. The
 * register card lives inside `max-w-md`, so it never reaches the width where
 * home has to switch to two columns.
 */
const PHOTO_ASPECT = "4 / 3";
const PHOTO_MAX_H = 232;
/** Room the pinned mic needs — the text strip stops here so they never collide. */
const MIC_GUTTER = 78;

const card: CSSProperties = {
  position: "relative",
  borderRadius: "var(--r-xl)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  background: "var(--surface)",
  boxShadow: "var(--shadow-md)",
  overflow: "hidden",
};

const photoBand: CSSProperties = {
  position: "relative",
  width: "100%",
  aspectRatio: PHOTO_ASPECT,
  maxHeight: PHOTO_MAX_H,
  overflow: "hidden",
  background: "var(--ink)",
};

const photoFrame: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  borderRadius: 0,
  borderWidth: 0,
  background: "var(--ink)",
};

const photoImage: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  // Head-and-shoulders portraits: a vertically centred crop slices the face, so
  // bias the window up.
  objectPosition: "center 18%",
};

const photoInitial: CSSProperties = {
  fontSize: 68,
  color: "color-mix(in srgb, #f4efdf 70%, transparent)",
};

const livePill: CSSProperties = {
  position: "absolute",
  left: 12,
  top: 12,
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  padding: "5px 10px",
  borderRadius: 999,
  background: "rgba(0,0,0,0.56)",
  color: "#fff",
  fontFamily: "var(--mono)",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  pointerEvents: "none",
};

const liveDot: CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: "50%",
  background: "var(--crit)",
};

const infoBand: CSSProperties = {
  position: "relative",
  // Floor so the pinned mic always has band to sit in, even with no persona line.
  minHeight: 96,
  padding: `11px ${MIC_GUTTER}px 13px 14px`,
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 5,
  background: "var(--surface)",
};

const eyebrow: CSSProperties = {
  margin: 0,
  fontSize: 10,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "var(--ink-mute)",
};

const nameLine: CSSProperties = {
  maxWidth: "100%",
  margin: 0,
  fontSize: 20,
  fontWeight: 500,
  lineHeight: 1.15,
  color: "var(--ink)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const summaryLine: CSSProperties = {
  margin: 0,
  fontSize: 12.5,
  lineHeight: 1.42,
  color: "var(--ink-soft)",
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2,
  overflow: "hidden",
};

const chatBtn: CSSProperties = {
  marginTop: 3,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  minHeight: 40,
  padding: "0 14px",
  borderRadius: "var(--r-md)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  background: "var(--surface)",
  color: "var(--green-deep)",
  fontSize: 12.5,
  fontWeight: 700,
  whiteSpace: "nowrap",
  cursor: "pointer",
};

const micSlot: CSSProperties = {
  position: "absolute",
  right: 12,
  bottom: 12,
  display: "inline-flex",
};

const errorLine: CSSProperties = {
  margin: 0,
  padding: "9px 14px 11px",
  borderTopWidth: 1,
  borderTopStyle: "solid",
  borderTopColor: "var(--rule)",
  fontSize: 12,
  lineHeight: 1.4,
  color: "var(--crit)",
};

/**
 * Live caption as its own band under the card, not floating inside the text
 * strip — it appears and disappears mid-conversation, and inside the strip it
 * shoved the mic down the screen every time the acharya spoke.
 */
const captionBand: CSSProperties = {
  margin: 0,
  padding: "10px 14px 12px",
  borderTopWidth: 1,
  borderTopStyle: "solid",
  borderTopColor: "var(--rule)",
  background: "var(--surface-sunk)",
  fontSize: 12.5,
  lineHeight: 1.45,
  color: "var(--ink-soft)",
};

const captionWho: CSSProperties = {
  display: "block",
  marginBottom: 3,
  fontSize: 10,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--ink-mute)",
};