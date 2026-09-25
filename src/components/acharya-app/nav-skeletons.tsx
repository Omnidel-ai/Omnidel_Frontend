import type { CSSProperties, ReactNode } from "react";

function SkeletonBlock({
  height,
  width = "100%",
  radius = 6,
  style,
}: {
  height: number | string;
  width?: number | string;
  radius?: number | string;
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden
      style={{
        height,
        width,
        borderRadius: radius,
        background: "var(--surface-sunk)",
        animation: "instant-nav-pulse 1.4s ease-in-out infinite",
        ...style,
      }}
    />
  );
}

const pulseStyle = (
  <style>{`
    @keyframes instant-nav-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.55; }
    }
  `}</style>
);

export function BoardSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--rule)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <SkeletonBlock height={44} width={44} radius="50%" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <SkeletonBlock height={10} width={64} style={{ marginBottom: 8 }} />
            <SkeletonBlock height={20} width="55%" />
          </div>
          <SkeletonBlock height={40} width={40} radius={10} />
        </div>
      </div>
      <div style={{ padding: "12px 16px", display: "flex", gap: 6 }}>
        {[1, 2, 3].map((i) => (
          <SkeletonBlock key={i} height={44} width="100%" radius="var(--r-md)" />
        ))}
      </div>
      <div style={{ padding: "8px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {[1, 2, 3, 4].map((i) => (
          <SkeletonBlock
            key={i}
            height={88}
            radius="var(--r-md)"
            style={{ animationDelay: `${i * 0.08}s` }}
          />
        ))}
      </div>
      {pulseStyle}
    </div>
  );
}

export function TaskSkeleton() {
  return (
    <div style={{ padding: 16, minHeight: "40vh" }}>
      <SkeletonBlock height={20} width={72} style={{ marginBottom: 20 }} />
      <SkeletonBlock height={28} width="85%" style={{ marginBottom: 12 }} />
      <SkeletonBlock height={14} width="60%" style={{ marginBottom: 24 }} />
      <SkeletonBlock height={120} radius="var(--r-md)" style={{ marginBottom: 16 }} />
      <SkeletonBlock height={48} radius="var(--r-md)" />
      {pulseStyle}
    </div>
  );
}

export function LearnSkeleton() {
  return (
    <div style={{ padding: 16, minHeight: "40vh" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[1, 2, 3, 4].map((i) => (
          <SkeletonBlock key={i} height={36} width={72} radius={999} />
        ))}
      </div>
      <SkeletonBlock height={180} radius="var(--r-md)" style={{ marginBottom: 16 }} />
      <SkeletonBlock height={14} width="90%" style={{ marginBottom: 10 }} />
      <SkeletonBlock height={14} width="75%" style={{ marginBottom: 10 }} />
      <SkeletonBlock height={14} width="60%" />
      {pulseStyle}
    </div>
  );
}

export function ActiveSkeleton() {
  return (
    <div
      style={{
        padding: 24,
        minHeight: "50vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 20,
      }}
    >
      <SkeletonBlock height={14} width={120} />
      <SkeletonBlock height={180} width={180} radius="50%" />
      <SkeletonBlock height={20} width="50%" />
      <SkeletonBlock height={48} width="100%" radius="var(--r-md)" style={{ marginTop: 12 }} />
      {pulseStyle}
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div style={{ padding: 16, minHeight: "100dvh" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <SkeletonBlock height={72} width={72} radius="50%" />
        <div style={{ flex: 1 }}>
          <SkeletonBlock height={22} width="60%" style={{ marginBottom: 10 }} />
          <SkeletonBlock height={14} width="40%" />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[1, 2, 3].map((i) => (
          <SkeletonBlock key={i} height={40} width="100%" radius="var(--r-md)" />
        ))}
      </div>
      {[1, 2, 3].map((i) => (
        <SkeletonBlock
          key={i}
          height={72}
          radius="var(--r-md)"
          style={{ marginBottom: 10, animationDelay: `${i * 0.08}s` }}
        />
      ))}
      {pulseStyle}
    </div>
  );
}

// Hero portrait dimensions, taken from the inline (app)/loading.tsx skeleton this
// replaces. That file carried a comment explaining why they matter: it had been a
// three-up lane rail with 88px cards — the old task board — and "the flash on load
// looked like a different app for a moment". These numbers are the shape that was
// verified against the real /acharyas home, so they are transcribed, not guessed.
const HERO_PORTRAIT_W = 128;
const HERO_PORTRAIT_H = 152;

export function HomeSkeleton() {
  return (
    <div style={{ padding: "12px 16px", minHeight: "100dvh" }}>
      {/* sticky header: title + subtitle */}
      <SkeletonBlock height={22} width={148} style={{ marginBottom: 7 }} />
      <SkeletonBlock height={10} width={96} radius={4} style={{ marginBottom: 20 }} />

      {/* hero acharya card — 128×152 portrait beside name / field / pill */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `${HERO_PORTRAIT_W}px minmax(0, 1fr)`,
          gap: 12,
          marginBottom: 16,
        }}
      >
        <SkeletonBlock
          height={HERO_PORTRAIT_H}
          width={HERO_PORTRAIT_W}
          radius="var(--r-lg)"
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <SkeletonBlock height={23} width="72%" />
          <SkeletonBlock height={16} width={74} radius={4} />
          <SkeletonBlock height={16} width={108} radius={4} />
        </div>
      </div>

      {/* 56px avatar rows — the WhatsApp-style acharya list */}
      {[1, 2, 3, 4].map((i) => (
        <SkeletonBlock
          key={i}
          height={56}
          radius="var(--r-md)"
          style={{ marginBottom: 10, animationDelay: `${i * 0.08}s` }}
        />
      ))}
      {pulseStyle}
    </div>
  );
}

function normalizePath(href: string): string {
  try {
    const url = href.startsWith("http")
      ? new URL(href)
      : new URL(href, "http://local.invalid");
    return url.pathname || "/";
  } catch {
    return href.split("?")[0]?.split("#")[0] || href;
  }
}

export function skeletonForPath(pathname: string): ReactNode {
  const path = normalizePath(pathname);
  if (path === "/acharyas" || path === "/acharyas/") return <HomeSkeleton />;
  if (path === "/profile" || path.startsWith("/profile/")) return <ProfileSkeleton />;
  if (/\/tasks\/[^/]+\/active\/?$/.test(path)) return <ActiveSkeleton />;
  if (/\/tasks\/[^/]+\/learn\/?$/.test(path)) return <LearnSkeleton />;
  if (/\/tasks\/[^/]+\/?$/.test(path)) return <TaskSkeleton />;
  if (/^\/acharyas\/[^/]+\/?$/.test(path)) return <BoardSkeleton />;
  return <HomeSkeleton />;
}
