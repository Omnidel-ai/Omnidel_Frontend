import type { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Top-left control (usually AuthBackButton). */
  back?: ReactNode;
  /** Content between brand and form (e.g. Acharya support). */
  belowBrand?: ReactNode;
  footer?: ReactNode;
  /**
   * `start` — top-aligned (long register forms).
   * `center` — vertically centered block (short sign-in / OTP).
   */
  align?: "start" | "center";
}

/**
 * Mobile-first auth chrome with safe-area + page margins.
 */
export default function AuthShell({
  title,
  subtitle,
  children,
  back,
  belowBrand,
  footer,
  align = "start",
}: Props) {
  const centered = align === "center";

  return (
    <main
      className="min-h-screen relative overflow-x-hidden"
      style={{
        background:
          "radial-gradient(120% 70% at 50% -8%, color-mix(in srgb, var(--green-wash) 65%, transparent), transparent 52%), var(--page)",
        paddingTop: "max(20px, env(safe-area-inset-top))",
        paddingBottom: "max(28px, env(safe-area-inset-bottom))",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-36"
        style={{
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--green-soft) 28%, transparent), transparent)",
        }}
      />

      <div
        className={[
          "relative max-w-md mx-auto w-full px-5 py-5 flex flex-col min-h-[100dvh] box-border",
          centered ? "justify-center" : "",
        ].join(" ")}
      >
        {back ? (
          <div className={centered ? "absolute top-5 left-5 z-10" : "mb-4"}>{back}</div>
        ) : centered ? null : (
          <div className="mb-2" aria-hidden />
        )}

        <header className={`text-center ${centered ? "mb-6" : "mb-5"}`}>
          <div
            className="inline-flex items-center justify-center w-[4.25rem] h-[4.25rem] mb-3"
            style={{
              borderRadius: "var(--r-md)",
              background: "var(--green-wash)",
              border: "1px solid color-mix(in srgb, var(--green-soft) 80%, var(--rule))",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-serif)",
                fontStyle: "italic",
                fontSize: 36,
                lineHeight: 1,
                color: "var(--green-deep)",
              }}
            >
              आ
            </span>
          </div>
          <p
            className="font-mono text-[10px] tracking-[0.2em] uppercase mb-2"
            style={{ color: "var(--ink-mute)" }}
          >
            Acharya
          </p>
          <h1
            className="font-serif italic text-[1.85rem] leading-tight text-ink m-0"
            style={{ fontWeight: 500 }}
          >
            {title}
          </h1>
          {subtitle ? (
            <p className="text-sm mt-2 mb-0 leading-relaxed" style={{ color: "var(--ink-mute)" }}>
              {subtitle}
            </p>
          ) : null}
        </header>

        {belowBrand}

        <div className={centered ? "" : "flex-1"}>{children}</div>

        {footer ? <div className={`pb-2 ${centered ? "mt-5" : "mt-6"}`}>{footer}</div> : null}
      </div>
    </main>
  );
}
