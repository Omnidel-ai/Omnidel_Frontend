"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/acharya/lib/store";
import type { VoiceActionResult } from "@/acharya/hooks/usePhoneVoiceSignIn";

function resendDelay(value: unknown): number {
  if (value === null || value === undefined || value === "") return 45;
  const seconds = Number(value);
  return Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 45;
}

const REQUEST_ERRORS: Record<string, string> = {
  PHONE_INVALID: "Enter a valid 10-digit mobile number.",
  ACCOUNT_NOT_FOUND: "This number isn't registered for Acharya. Please contact your administrator.",
  OTP_RATE_LIMITED: "Too many attempts. Please wait and try again.",
  OTP_SEND_FAILED: "Couldn't send the code. Please try again shortly.",
  OTP_PROVIDER_UNAVAILABLE: "Couldn't send the code. Please try again shortly.",
};

export const DEMO_PERSONAS = [
  { label: "MahAcharya'ji", role: "Founder", phone: "9830067217", color: "var(--green-deep)" },
  { label: "Panna",         role: "Hunter",  phone: "9123987344", color: "var(--ochre)" },
  { label: "Raju",          role: "Karigar", phone: "7407313442", color: "var(--terracotta)" },
] as const;

const VERIFY_ERRORS: Record<string, string> = {
  PHONE_INVALID: "Enter a valid 10-digit mobile number.",
  OTP_INVALID: "That code is incorrect or has expired.",
  OTP_VERIFY_FAILED: "That code is incorrect or has expired.",
  OTP_EXPIRED: "That code has expired. Request a new one.",
  OTP_RATE_LIMITED: "Too many attempts. Please wait and try again.",
  OTP_PROVIDER_UNAVAILABLE: "Couldn't verify the code. Please try again shortly.",
  TOKEN_INVALID: "Couldn't verify the code. Please try again shortly.",
  REFRESH_REUSED: "Your session expired. Please log in again.",
  TOKEN_VERIFY_FAILED: "Security verification failed. Please try again.",
};

export function usePhoneSignInRequest() {
  const router = useRouter();
  const setUser = useStore((s) => s.setUser);
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoEnabled, setDemoEnabled] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/config").then(r => r.json()).then(data => {
      if (active) setDemoEnabled(data?.demoEnabled === true);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  /**
   * The one submit path. The button calls it and so does the voice tool, so a
   * spoken sign-in cannot take a shortcut past validation or error handling.
   */
  const sendCode = useCallback(async (digits: string): Promise<VoiceActionResult> => {
    if (submittingRef.current) return { ok: false, error: "request_in_progress" };
    if (!/^[6-9]\d{9}$/.test(digits)) {
      const error = "Enter a valid 10-digit mobile number.";
      setErr(error);
      return { ok: false, error };
    }
    submittingRef.current = true;
    setErr(null);
    setLoading(true);
    try {
      const r = await fetch("/api/auth/login/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: digits }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.ok) {
        const error = REQUEST_ERRORS[data.code] || data?.error || "Couldn’t send the code. Please try again.";
        setErr(error);
        return { ok: false, error };
      }
      router.push(`/auth/phone/verify-otp?phone=${encodeURIComponent(digits)}&resend=${encodeURIComponent(String(resendDelay(data.resendAfterSeconds)))}`);
      return { ok: true };
    } catch {
      const error = "Network error. Try again.";
      setErr(error);
      return { ok: false, error };
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }, [router]);

  async function handleDemoLogin(demoPhone: string) {
    if (!demoEnabled || submittingRef.current) return;
    submittingRef.current = true;
    setErr(null);
    setLoading(true);
    try {
      const r = await fetch("/api/auth/login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: demoPhone, otp: "123456" }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.ok) { setErr(data?.error || "Demo login failed"); return; }
      if (data.user) setUser(data.user);
      router.push(data.user?.needsOnboarding ? "/profile" : "/");
    } catch { setErr("Network error. Try again."); }
    finally { submittingRef.current = false; setLoading(false); }
  }

  const onFill = useCallback((digits: string) => { setErr(null); setPhone(digits); }, []);
  return { phone, setPhone, err, loading, demoEnabled, sendCode, onFill, handleDemoLogin };
}

export function usePhoneSignInVerify() {
  const router = useRouter();
  const params = useSearchParams();
  const phone = params.get("phone") || "";
  const initialResend = resendDelay(params.get("resend"));
  const setUser = useStore((s) => s.setUser);
  const [otp, setOtp] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoEnabled, setDemoEnabled] = useState(false);
  const [countdown, setCountdown] = useState(initialResend);
  const [resending, setResending] = useState(false);
  const submittingRef = useRef(false);
  const resendRef = useRef(false);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/config").then(r => r.json()).then(data => {
      if (active) setDemoEnabled(data?.demoEnabled === true);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setInterval(() => setCountdown(value => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [countdown]);

  /** The one submit path — the button and the voice tool both come through here. */
  const verify = useCallback(async (code: string): Promise<VoiceActionResult> => {
    if (submittingRef.current || resendRef.current) return { ok: false, error: "request_in_progress" };
    if (!/^[6-9]\d{9}$/.test(phone) || !/^\d{6}$/.test(code)) {
      const error = "Enter a valid mobile number and six-digit code.";
      setErr(error);
      return { ok: false, error };
    }
    submittingRef.current = true;
    setErr(null);
    setLoading(true);
    try {
      const r = await fetch("/api/auth/login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp: code }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.ok) {
        const error = VERIFY_ERRORS[data.code] || data?.error || "That code is incorrect or has expired.";
        setErr(error);
        return { ok: false, error };
      }
      if (data.user) setUser(data.user);
      router.push(data.user?.needsOnboarding ? "/profile" : "/");
      return { ok: true };
    } catch {
      const error = "Network error. Try again.";
      setErr(error);
      return { ok: false, error };
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }, [phone, router, setUser]);

  async function onResend() {
    if (countdown > 0 || resendRef.current || submittingRef.current) return;
    resendRef.current = true;
    setResending(true);
    setErr(null);
    try {
      const response = await fetch("/api/auth/login/resend", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        setErr(VERIFY_ERRORS[data.code] || data.error || "Couldn't resend the code. Please try again shortly.");
        return;
      }
      setCountdown(resendDelay(data.resendAfterSeconds));
    } catch { setErr("Failed to resend code. Check your connection."); }
    finally { resendRef.current = false; setResending(false); }
  }

  const maskedPhone = phone ? `+91 ******${phone.replace(/\D/g, "").slice(-4)}` : "your mobile";

  const onFill = useCallback((digits: string) => { setErr(null); setOtp(digits); }, []);
  return { phone, otp, setOtp, err, loading, demoEnabled, countdown, resending, verify, onFill, onResend, maskedPhone };
}
