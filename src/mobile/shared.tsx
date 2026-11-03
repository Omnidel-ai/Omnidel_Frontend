import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "../components/common";
import {
  MobileIcon,
  OtpInput,
  PhoneInput,
  createLevelBus,
  formatIndianPhone,
  type LevelSource,
  type MicStatus,
} from "../components/acharya-mobile";

/* ── Navigation ─────────────────────────────────────────────────────────── */

export interface Route<K extends string = string> {
  screen: K;
  id?: string;
  tab?: string;
}

/**
 * A screen stack — what each app's router does, minus the router. A top-level
 * destination (a dock tab) resets the stack; opening something pushes onto it;
 * Back pops it.
 */
export function useScreenStack<K extends string>(initial: Route<K>) {
  const [stack, setStack] = useState<Route<K>[]>([initial]);
  const current = stack[stack.length - 1];
  const go = useCallback((route: Route<K>) => setStack([route]), []);
  const push = useCallback((route: Route<K>) => setStack((s) => [...s, route]), []);
  const back = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []);
  const replace = useCallback((route: Route<K>) => setStack((s) => [...s.slice(0, -1), route]), []);
  return { current, depth: stack.length, go, push, back, replace };
}

/* ── Demo voice ─────────────────────────────────────────────────────────── */

/**
 * Stands in for each app's voice session: tap to connect (a short pause), tap
 * again to end. While live it publishes a fake mic level so the waveform moves,
 * and every few seconds the "agent" speaks a line.
 */
export function useDemoMic(lines: string[] = []) {
  const level = useMemo(() => createLevelBus(), []);
  const [status, setStatus] = useState<MicStatus>("idle");
  const [caption, setCaption] = useState<string | undefined>();

  useEffect(() => {
    if (status !== "connecting") return;
    const t = window.setTimeout(() => setStatus("live"), 900);
    return () => window.clearTimeout(t);
  }, [status]);

  // The person's level, while the mic is open and the agent is not talking.
  useEffect(() => {
    if (status !== "live") {
      level.publish(0);
      return;
    }
    let tick = 0;
    const id = window.setInterval(() => {
      tick += 1;
      level.publish(Math.max(0, 0.12 + Math.sin(tick / 2.3) * 0.08 + (Math.random() - 0.5) * 0.08));
    }, 90);
    return () => window.clearInterval(id);
  }, [status, level]);

  // A few seconds into listening, the agent answers…
  useEffect(() => {
    if (status !== "live" || lines.length === 0) return;
    const t = window.setTimeout(() => {
      setCaption(lines[Math.floor(Math.random() * lines.length)]);
      setStatus("speaking");
    }, 3200);
    return () => window.clearTimeout(t);
  }, [status, lines]);

  // …and then hands the mic back.
  useEffect(() => {
    if (status !== "speaking") return;
    const t = window.setTimeout(() => setStatus("live"), 2600);
    return () => window.clearTimeout(t);
  }, [status]);

  const toggle = useCallback(() => setStatus((s) => (s === "idle" || s === "error" || s === "denied" ? "connecting" : "idle")), []);
  return { status, toggle, level: level as LevelSource, caption: status === "speaking" ? caption : undefined };
}

/* ── Device frame ───────────────────────────────────────────────────────── */

export interface PhoneFrameProps {
  /** App name, shown over the screen list. */
  title: string;
  subtitle: string;
  /** Where these screens come from. */
  source: string;
  screens: { key: string; label: string }[];
  activeScreen: string;
  onJump: (key: string) => void;
  /** Changes whenever the screen does, so the viewport scrolls back to the top. */
  screenKey: string;
  children: ReactNode;
}

/**
 * A phone, and a list of the screens in it.
 *
 * The device is `transform`ed on purpose: that makes it the containing block
 * for `position: fixed`, so the docked mic and the bottom sheets stay pinned
 * to the phone's own edges instead of the browser window's, with no
 * "preview mode" in any component.
 */
export function PhoneFrame({ title, subtitle, source, screens, activeScreen, onJump, screenKey, children }: PhoneFrameProps) {
  const viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    viewport.current?.scrollTo({ top: 0 });
  }, [screenKey]);

  return (
    <div className="mb-stage">
      <div className="mb-device" aria-label={`${title} preview`}>
        <div className="mb-viewport" ref={viewport}>{children}</div>
      </div>
      <aside className="mb-panel">
        <p className="mb-panel__eyebrow">Mobile app · demo data</p>
        <h2 className="mb-panel__title">{title}</h2>
        <p className="mb-panel__text">{subtitle}</p>
        <nav aria-label={`${title} screens`} className="mb-panel__screens">
          {screens.map((s) => (
            <button key={s.key} type="button" className="mb-panel__screen" aria-current={s.key === activeScreen ? "true" : undefined} onClick={() => onJump(s.key)}>
              {s.label}
            </button>
          ))}
        </nav>
        <p className="mb-panel__source">{source}</p>
      </aside>
    </div>
  );
}

/* ── Sign-in — the same flow in both apps ───────────────────────────────── */

export interface SignInScreenProps {
  appName: string;
  tagline: string;
  /** Kaarigar's portrait band or Contractor's wordmark. */
  hero: ReactNode;
  onSignedIn: () => void;
  /** `forest` paints the hero band dark green (Kaarigar); `plain` keeps it on the page. */
  band?: "forest" | "plain";
}

/**
 * Phone, then a 6-digit code. Kaarigar's `RequestOtpClient` / `VerifyOtpClient`
 * (PR #207) and Contractor's `LoginClient` are the same two steps; only the
 * hero above the form differs. Any 6 digits sign in here.
 */
export function SignInScreen({ appName, tagline, hero, onSignedIn, band = "plain" }: SignInScreenProps) {
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(30);

  useEffect(() => {
    if (step !== "otp" || left <= 0) return;
    const t = window.setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => window.clearTimeout(t);
  }, [step, left]);

  const wait = (then: () => void) => {
    setBusy(true);
    window.setTimeout(() => {
      setBusy(false);
      then();
    }, 600);
  };

  return (
    <div className="mb-signin">
      <div className={`mb-signin__hero mb-signin__hero--${band}`}>{hero}</div>
      <div className="mb-signin__form">
        <div>
          <h1 className="mb-signin__title">{step === "phone" ? `Sign in to ${appName}` : "Enter the code"}</h1>
          <p className="mb-signin__text">
            {step === "phone" ? tagline : `We sent a 6-digit code to ${formatIndianPhone(phone)}.`}
          </p>
        </div>
        {step === "phone" ? (
          <>
            <PhoneInput label="Phone number" value={phone} onChange={setPhone} autoFocus />
            <Button size="lg" block disabled={phone.length !== 10} loading={busy} loadingLabel="Sending…" onClick={() => wait(() => { setStep("otp"); setLeft(30); })}>
              Send code
            </Button>
          </>
        ) : (
          <>
            <OtpInput label="6-digit code" value={otp} onChange={setOtp} autoFocus onComplete={() => wait(onSignedIn)} />
            <Button size="lg" block disabled={otp.length !== 6} loading={busy} loadingLabel="Checking…" onClick={() => wait(onSignedIn)}>
              Verify and continue
            </Button>
            <div className="mb-signin__row">
              <button type="button" className="mb-link" onClick={() => { setStep("phone"); setOtp(""); }}>
                <MobileIcon name="chevron-left" size={16} /> Change number
              </button>
              <button type="button" className="mb-link" disabled={left > 0} onClick={() => setLeft(30)}>
                {left > 0 ? `Resend in 0:${String(left).padStart(2, "0")}` : "Resend code"}
              </button>
            </div>
          </>
        )}
        <p className="mb-signin__hint">Demo: any 10-digit number, then any 6 digits.</p>
      </div>
    </div>
  );
}
