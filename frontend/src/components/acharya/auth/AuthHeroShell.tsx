import type { ReactNode } from "react";
import styles from "./auth-hero.module.css";

interface Props {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Top-left control (usually AuthHeroBackButton). */
  back?: ReactNode;
  /** Pinned bottom-right over the photograph — the sign-in mic. */
  mic?: ReactNode;
  /** Sits opposite the mic while a voice session is live. */
  heroNote?: ReactNode;
  footer?: ReactNode;
  /**
   * MahAcharya'ji's portrait, the ground this screen stands on. Resolved on the
   * server — this screen is public, and the client cannot fetch it:
   * `/api/acharyas/avatar` is session-gated, and only the `avatar-blob` proxy is
   * carved out of middleware. Null renders a plain parchment page, which is
   * what an unconfigured DB or a missing portrait gets.
   */
  portraitUrl?: string | null;
  /**
   * How much of the screen the photograph takes. `tall` is sign-in, where one
   * field stands under him; `compact` is register, where a ten-field form does.
   */
  photo?: "regular" | "tall" | "compact";
  /** Sits between the subtitle and the form (register's chat-help row). */
  belowHeader?: ReactNode;
}

/**
 * Auth chrome for every screen outside the session: sign-in, the code, and
 * register. One portrait band, one centred column, pill fields, pill actions.
 */
export default function AuthHeroShell({
  title,
  subtitle,
  children,
  back,
  mic,
  heroNote,
  footer,
  portraitUrl,
  photo = "regular",
  belowHeader,
}: Props) {
  const photoClass =
    photo === "tall" ? styles.photoTall : photo === "compact" ? styles.photoCompact : "";

  return (
    <main className={`${styles.root} ${photoClass}`}>
      {/* Invisible on a phone (`display: contents`); on a wide screen it is the
          white card holding the form on the left and the portrait on the right. */}
      <div className={styles.card}>
        <div className={styles.backdrop} aria-hidden>
          <div className={styles.photoBand}>
            {portraitUrl ? (
              // Decorative: it must never compete with the form for bandwidth on
              // a low-end Android, so it is explicitly de-prioritised.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={portraitUrl}
                alt=""
                className={styles.portrait}
                decoding="async"
                fetchPriority="low"
              />
            ) : null}
            <div className={styles.photoFade} />
          </div>
        </div>

        <div className={styles.frame}>
          {back ? <div className={styles.back}>{back}</div> : null}

          <div className={styles.hero}>
            {heroNote}
            {mic ? <span className={styles.micSlot}>{mic}</span> : null}
          </div>

          <header className={styles.header}>
            <p className={styles.eyebrow}>Acharya</p>
            <h1 className={styles.title}>{title}</h1>
            {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
          </header>

          {belowHeader}

          <div className={styles.body}>{children}</div>

          {footer ? <div className={styles.footer}>{footer}</div> : null}
        </div>
      </div>
    </main>
  );
}
