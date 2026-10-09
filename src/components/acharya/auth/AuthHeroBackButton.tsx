"use client";

import Link from "next/link";
import styles from "./auth-hero.module.css";

interface Props {
  /** Where back goes. Omit and pass `onClick` for a step that is not a route. */
  href?: string;
  onClick?: () => void;
  label?: string;
}

/** Back control for the auth screens — a disc that reads over the portrait. */
export default function AuthHeroBackButton({ href, onClick, label = "Back" }: Props) {
  const icon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15 6L9 12l6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  // Register's OTP step goes back to the form it is standing on, not to a URL —
  // a Link there would reload the page and take the draft with it.
  if (!href) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`press ${styles.backControl}`}
        aria-label={label}
        title={label}
      >
        {icon}
      </button>
    );
  }

  return (
    <Link href={href} className={`press ${styles.backControl}`} aria-label={label} title={label}>
      {icon}
    </Link>
  );
}
