"use client";
import { useEffect, useRef } from "react";
import AuthHeroShell from "@/components/acharya/auth/AuthHeroShell";
import OtpBoxes from "@/components/acharya/auth/OtpBoxes";
import AuthHeroBackButton from "@/components/acharya/auth/AuthHeroBackButton";
import styles from "@/components/acharya/auth/auth-hero.module.css";
import { VoiceToggle } from "@/components/acharya/voice/VoiceToggle";
import { usePhoneVoiceSignIn } from "@/acharya/hooks/usePhoneVoiceSignIn";
import { usePhoneSignInVerify } from "@/acharya/hooks/usePhoneSignIn";

interface Props {
  portraitUrl: string | null;
  acharyaSlug: string;
  acharyaName: string;
}

export default function VerifyOtpClient({ portraitUrl, acharyaSlug, acharyaName }: Props) {
  const { phone, otp, setOtp, err, loading, demoEnabled, countdown, resending, verify, onFill, onResend, maskedPhone } = usePhoneSignInVerify();
  const otpInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => otpInputRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, []);
  const voice = usePhoneVoiceSignIn({ acharyaSlug, step: "code", phone, onFill, onSubmit: verify });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await verify(otp);
  }

  return (
    <AuthHeroShell
      portraitUrl={portraitUrl}
      photo="tall"
      back={<AuthHeroBackButton href="/auth/phone/request-otp" label="Change number" />}
      title="Enter code"
      subtitle={
        phone
          ? `Six digits sent to ${maskedPhone}. Type them, or read them out to ${acharyaName}.`
          : "Six digits sent to your mobile."
      }
      heroNote={
        voice.live ? (
          <span className={styles.livePill}>
            <span className={styles.liveDot} aria-hidden />
            Listening
          </span>
        ) : null
      }
      mic={
        <VoiceToggle status={voice.status} onStart={voice.start} onEnd={voice.end} size={60} />
      }
      footer={
        demoEnabled ? <p className={styles.hint}>
          Demo mode is on for this environment — use code <code className={styles.hintCode}>123456</code>.
        </p> : null
      }
    >
      <form onSubmit={onSubmit} className={styles.form}>
        <OtpBoxes
          ref={otpInputRef}
          value={otp}
          onChange={setOtp}
          label="One-time code"
          autoFocus
          disabled={loading || resending}
        />

        {err && (
          <p className={styles.error} role="alert">
            <span aria-hidden>•</span><span>{err}</span>
          </p>
        )}

        <button
          type="submit" disabled={loading || resending || otp.length !== 6}
          className={`press ${styles.primary}`}
        >
          {loading ? "Verifying…" : "Verify"}
        </button>
        <div className="text-center">
          {countdown > 0 ? <p className={styles.hint}>Resend code in {countdown}s</p> : (
            <button type="button" disabled={resending || loading} onClick={onResend} className={`press ${styles.secondary}`}>
              {resending ? "Sending code…" : "Didn't get the code? Resend SMS"}
            </button>
          )}
        </div>
      </form>

      {voice.error ? (
        <p className={styles.error} style={{ marginTop: 12 }}>
          <span aria-hidden>•</span><span>{voice.error}</span>
        </p>
      ) : null}

      {voice.caption ? (
        <p className={styles.caption}>
          <span className={styles.captionWho}>
            {voice.captionFromAcharya ? acharyaName : "You"}
          </span>
          {voice.caption}
        </p>
      ) : null}
    </AuthHeroShell>
  );
}
