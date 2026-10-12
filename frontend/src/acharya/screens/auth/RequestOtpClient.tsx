"use client";
import { useEffect, useRef } from "react";
import AuthHeroShell from "@/components/acharya/auth/AuthHeroShell";
import styles from "@/components/acharya/auth/auth-hero.module.css";
import { VoiceToggle } from "@/components/acharya/voice/VoiceToggle";
import { usePhoneVoiceSignIn } from "@/acharya/hooks/usePhoneVoiceSignIn";

import { usePhoneSignInRequest, DEMO_PERSONAS } from "@/acharya/hooks/usePhoneSignIn";

interface Props {
  portraitUrl: string | null;
  acharyaSlug: string;
  acharyaName: string;
}

export default function RequestOtpClient({ portraitUrl, acharyaSlug, acharyaName }: Props) {
  const { phone, setPhone, err, loading, demoEnabled, sendCode, onFill, handleDemoLogin } = usePhoneSignInRequest();
  const phoneInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => phoneInputRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, []);
  const voice = usePhoneVoiceSignIn({ acharyaSlug, step: "phone", phone, onFill, onSubmit: sendCode });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await sendCode(phone);
  }

  return (
    <AuthHeroShell
      portraitUrl={portraitUrl}
      photo="tall"
      title="Welcome back!"
      subtitle={`Enter your mobile number, or tap the mic and tell ${acharyaName}.`}
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
        demoEnabled ? (
          <div>
            <div className={styles.demoLabel}>
              <span className={styles.demoLabelText}>Quick demo login</span>
            </div>
            <div className={styles.demoRow}>
              {DEMO_PERSONAS.map((p) => (
                <button
                  key={p.phone}
                  type="button"
                  disabled={loading}
                  onClick={() => handleDemoLogin(p.phone)}
                  title={p.role}
                  className={`press ${styles.chip}`}
                >
                  <span className={styles.chipDot} style={{ background: p.color }} />
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        ) : null
      }
    >
      <form onSubmit={onSubmit} className={styles.form}>
        <label className={styles.field}>
          <span className="sr-only">Mobile number</span>
          <svg
            className={styles.fieldIcon}
            width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden
          >
            <rect
              x="6" y="2.5" width="12" height="19" rx="2.5"
              stroke="currentColor" strokeWidth="1.6"
            />
            <path d="M10.5 18.5h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <span className={styles.prefix}>+91</span>
          <input
            ref={phoneInputRef}
            type="tel" inputMode="numeric" autoComplete="tel" autoFocus required
            placeholder="Enter your mobile number"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            disabled={loading}
            maxLength={10}
            className={styles.input}
          />
        </label>

        <p className={styles.hint}>We’ll send a 6-digit code by SMS from <strong>JVLMSL</strong> (JVL Management and Services Private Limited).</p>

        {err && (
          <p className={styles.error} role="alert">
            <span aria-hidden>•</span><span>{err}</span>
          </p>
        )}

        <div className={styles.actions}>
          <button
            type="submit" disabled={loading || phone.length < 10}
            className={`press ${styles.primary}`}
          >
            {loading ? "Sending…" : "Send code"}
          </button>
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
