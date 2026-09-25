"use client";

import Link from "next/link";
import { ghostIconButtonStyle } from "@/components/ghost-icon-button";

interface Props {
  href?: string;
  onClick?: () => void;
  label?: string;
}

/** Ghost back control — icon only, matches app chrome. */
export default function AuthBackButton({ href, onClick, label = "Back" }: Props) {
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

  if (href) {
    return (
      <Link href={href} className="press" aria-label={label} title={label} style={ghostIconButtonStyle}>
        {icon}
      </Link>
    );
  }

  return (
    <button type="button" className="press" aria-label={label} title={label} onClick={onClick} style={ghostIconButtonStyle}>
      {icon}
    </button>
  );
}
