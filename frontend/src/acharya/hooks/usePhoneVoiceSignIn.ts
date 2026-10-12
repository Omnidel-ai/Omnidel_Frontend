"use client";

/**
 * Sign in by talking to MahAcharya'ji.
 *
 * The karigars this app is for often cannot read a keypad comfortably, and
 * sign-in is the one screen where nothing else in the product can help them:
 * every voice surface the app has lives BEHIND the session this screen creates.
 * So the mic here mints from a public endpoint
 * (`/api/auth/phone/help/live-token`) and drives the same two functions the
 * buttons do.
 *
 * Three things are deliberate, and are why this is not a thin wrapper over the
 * registration helper:
 *
 *  - **Nothing is sent without a spoken confirmation.** `send_login_code`
 *    refuses unless `user_confirmed` is true, exactly as `send_register_code`
 *    does. A misheard digit would otherwise SMS a stranger, and the karigar
 *    would stand there waiting for a code that went somewhere else.
 *  - **The tools call the screen's OWN submit handler**, never the API directly.
 *    Voice presses the button a thumb would press, so validation, error copy
 *    and navigation cannot drift between the two paths.
 *  - **The step binds at mint.** Constrained mode fixes tools when the token is
 *    issued, so the number screen never carries `verify_login_code` and cannot
 *    try to verify a code that has not been sent yet.
 *
 * A hook rather than a component because the three pieces it produces — the
 * mic, the LISTENING pill and the caption — belong in three different places
 * in the sign-in layout.
 */

import { useEffect, useMemo, useRef } from "react";
import {
  useGeminiLiveSession,
  type ToolHandlers,
  type ToolResult,
  type VoiceStatus,
} from "@/acharya/hooks/useGeminiLiveSession";
import { useStore, type Lang } from "@/acharya/lib/store";
import { normalizeRegisterLang } from "@/acharya/lib/i18n/register-strings";

export type VoiceActionResult = { ok: true } | { ok: false; error: string };

interface Options {
  acharyaSlug: string;
  /** Which half of sign-in this is — binds a different tool pair at mint. */
  step: "phone" | "code";
  /** The number on screen (step "phone") or the one the code went to ("code"). */
  phone: string;
  /** Writes the heard digits into the field the karigar is looking at. */
  onFill: (digits: string) => void;
  /** Runs the screen's own submit. Resolves once the request has answered. */
  onSubmit: (value: string) => Promise<VoiceActionResult>;
}

export interface PhoneVoiceSignIn {
  status: VoiceStatus;
  live: boolean;
  start: () => void;
  end: () => void;
  /** What is on screen right now, and whether it is the acharya speaking. */
  caption: string;
  captionFromAcharya: boolean;
  error: string | null;
}

export function usePhoneVoiceSignIn({
  acharyaSlug,
  step,
  phone,
  onFill,
  onSubmit,
}: Options): PhoneVoiceSignIn {
  const voice = useGeminiLiveSession();
  const lang = useStore((s) => s.lang);
  const voiceLang = useStore((s) => s.voiceLang);
  const spokenLangRef = useRef<Lang>(voiceLang ?? lang);
  const switchedSpokenLangRef = useRef(false);

  const langRef = useRef<Lang>(lang);
  const phoneRef = useRef(phone);
  const onFillRef = useRef(onFill);
  const onSubmitRef = useRef(onSubmit);
  const setContextRef = useRef(voice.setContext);
  const handlersRef = useRef<ToolHandlers>({});

  useEffect(() => { langRef.current = lang; }, [lang]);
  useEffect(() => {
    if (!switchedSpokenLangRef.current) spokenLangRef.current = voiceLang ?? lang;
  }, [voiceLang, lang]);
  useEffect(() => { phoneRef.current = phone; }, [phone]);
  useEffect(() => { onFillRef.current = onFill; }, [onFill]);
  useEffect(() => { onSubmitRef.current = onSubmit; }, [onSubmit]);
  useEffect(() => { setContextRef.current = voice.setContext; }, [voice.setContext]);

  const endVoice = voice.end;
  const startVoice = voice.start;
  useEffect(() => () => endVoice(), [endVoice]);

  /** Getter, not a snapshot: a reconnect must remint with the CURRENT number. */
  const tokenBody = useMemo(
    () => () => ({ lang: langRef.current, voiceLang: spokenLangRef.current, step, phone: phoneRef.current }),
    [step],
  );

  const voiceCtx = useMemo(
    () => (speechLang: string) => ({
      context: "acharya" as const,
      acharyaSlug,
      tokenEndpoint: "/api/auth/phone/help/live-token",
      tokenBody,
      // Part of the session key, so switching language remints with the right
      // speech_config language_code instead of speaking Hindi in an en-IN voice.
      speechLang,
    }),
    [acharyaSlug, tokenBody],
  );

  const handlers = useMemo<ToolHandlers>(() => {
    const setLanguage = async (args: Record<string, unknown>): Promise<ToolResult> => {
      const next = normalizeRegisterLang(args.language ?? args.preferred_lang);
      const prev = spokenLangRef.current;
      spokenLangRef.current = next;
      switchedSpokenLangRef.current = true;
      if (next !== prev) setContextRef.current(voiceCtx(next), handlersRef.current, langRef.current);
      return { ok: true, language: next };
    };

    if (step === "code") {
      const codeTools: ToolHandlers = {
        set_login_language: setLanguage,
        verify_login_code: async (args): Promise<ToolResult> => {
          const code = String(args.code ?? "").replace(/\D/g, "");
          if (code.length !== 6) {
            return {
              ok: false,
              error: "not_six_digits",
              heard: code.length,
              instruction: `You heard ${code.length} digits. Say so, and ask them to read the six digits again slowly.`,
            };
          }
          onFillRef.current(code);
          const result = await onSubmitRef.current(code);
          if (result.ok) {
            // The app is about to take over the screen; a mic still talking
            // would be speaking to a page that is already gone.
            endVoice();
            return { ok: true, signed_in: true };
          }
          return {
            ok: false,
            error: result.error,
            instruction:
              "Tell them plainly what went wrong and ask them to read the code again. Never invent a code.",
          };
        },
      };
      return codeTools;
    }

    const phoneTools: ToolHandlers = {
      set_login_language: setLanguage,
      fill_login_phone: async (args): Promise<ToolResult> => {
        const digits = String(args.phone ?? "").replace(/\D/g, "");
        onFillRef.current(digits);
        // An Indian mobile is 10 digits starting 6-9. Reporting WHY it is not
        // usable, rather than a bare false, is what lets the acharya say "I
        // heard nine digits" instead of "that did not work".
        const valid = digits.length === 10 && /^[6-9]/.test(digits);
        return {
          ok: true,
          phone: digits,
          digits: digits.length,
          valid,
          instruction: valid
            ? "Read the number back grouped and ask if it is right. Call send_login_code only after they say yes."
            : digits.length !== 10
              ? `That is ${digits.length} digits, not 10. Say how many you heard and ask them to say the number again slowly.`
              : "An Indian mobile number starts with 6, 7, 8 or 9. Ask them to say it again.",
        };
      },
      send_login_code: async (args): Promise<ToolResult> => {
        const confirmed = args.user_confirmed === true;
        if (!confirmed) {
          return {
            ok: false,
            error: "need_user_confirm",
            instruction:
              "Read the number back grouped and ask whether it is correct. Call this again with user_confirmed=true only after they clearly agree.",
          };
        }
        const spoken = String(args.phone ?? "").replace(/\D/g, "");
        const onScreen = phoneRef.current.replace(/\D/g, "");
        const digits = args.phone == null ? onScreen : spoken;
        if (!/^[6-9]\d{9}$/.test(digits)) {
          return { ok: false, error: "incomplete_number", digits: digits.length };
        }
        // Keep the box and the SMS in agreement — the karigar confirmed what
        // they HEARD, so that is the number that must also be on screen.
        if (digits !== onScreen) onFillRef.current(digits);

        const result = await onSubmitRef.current(digits);
        if (result.ok) {
          // The code screen mints its own session, with its own tools.
          endVoice();
          return { ok: true, advanced: "otp" };
        }
        return { ok: false, error: result.error };
      },
    };
    return phoneTools;
  }, [step, endVoice, voiceCtx]);

  useEffect(() => { handlersRef.current = handlers; }, [handlers]);

  return {
    status: voice.status,
    live: voice.status === "live",
    start: () => void startVoice(voiceCtx(spokenLangRef.current), handlers, langRef.current),
    end: endVoice,
    caption: voice.status === "live" ? voice.outputText || voice.inputText : "",
    captionFromAcharya: Boolean(voice.outputText),
    error: voice.error,
  };
}
