"use client";

import AcharyaAvatar from "@/components/acharya-avatar";

export type HelperAcharya = {
  slug: string;
  displayName: string;
  avatarUrl: string | null;
  personaSummary: string | null;
};

interface Props {
  acharya: HelperAcharya;
  onAsk: () => void;
}

/** Prominent register-screen entry to MahAcharya'ji form help. */
export default function MahAcharyaHelpCard({ acharya, onAsk }: Props) {
  const summary =
    acharya.personaSummary?.trim() ||
    "Calm teacher who helps you fill this form, one step at a time.";

  return (
    <section
      className="mb-5 text-left"
      style={{
        borderRadius: "var(--r-md)",
        border: "1px solid var(--rule)",
        background: "var(--surface)",
        boxShadow: "var(--shadow-sm)",
        padding: "12px 12px 12px 12px",
      }}
      aria-label={`${acharya.displayName} can help fill this form`}
    >
      <div className="flex items-start gap-3">
        <AcharyaAvatar
          slug={acharya.slug}
          name={acharya.displayName}
          imageUrl={acharya.avatarUrl}
          size={48}
          shape="rounded"
        />
        <div className="min-w-0 flex-1">
          <p
            className="font-mono text-[10px] tracking-[0.16em] uppercase m-0"
            style={{ color: "var(--ink-mute)" }}
          >
            Your Acharya
          </p>
          <h2
            className="font-serif italic text-lg leading-tight mt-0.5 mb-1 text-ink"
            style={{ fontWeight: 500 }}
          >
            {acharya.displayName}
          </h2>
          <p
            className="text-[12px] leading-snug m-0 line-clamp-2"
            style={{ color: "var(--ink-soft)" }}
          >
            {summary}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onAsk}
        className="press mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold"
        style={{
          borderRadius: "var(--r-md)",
          background: "var(--green-deep)",
          color: "var(--surface)",
          border: "1px solid var(--green-deep)",
        }}
      >
        Ask {acharya.displayName} to help fill this form
      </button>
    </section>
  );
}
