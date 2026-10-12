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
  return <div aria-busy="true" style={{ padding: 16, minHeight: "100%" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
      <SkeletonBlock height={92} width={92} radius="50%" />
      <div style={{ flex: 1 }}><SkeletonBlock height={22} width="80%" /><SkeletonBlock height={12} width="95%" style={{ marginTop: 10 }} /></div>
    </div>
    <SkeletonBlock height={36} radius={18} style={{ marginBottom: 16 }} />
    <SkeletonBlock height={40} radius={10} style={{ marginBottom: 12 }} />
    <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>{[1, 2, 3, 4].map(i => <SkeletonBlock key={i} height={44} radius={24} />)}</div>
    {[1, 2, 3, 4].map(i => <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, border: "1px solid var(--rule)", borderRadius: 16, background: "var(--surface)", marginBottom: 8 }}>
      <SkeletonBlock height={48} width={48} radius="50%" />
      <div style={{ flex: 1 }}><SkeletonBlock height={16} width="75%" /><SkeletonBlock height={10} width="90%" style={{ marginTop: 10 }} /></div>
    </div>)}
    {pulseStyle}
  </div>;
}

export function WorkSkeleton() {
  return <div aria-busy="true" style={{ padding: 16 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}><SkeletonBlock height={24} width={100} /><SkeletonBlock height={44} width={100} radius={24} /></div>
    <SkeletonBlock height={48} radius={24} style={{ marginBottom: 16 }} />
    {[1, 2, 3, 4].map(i => <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, border: "1px solid var(--rule)", borderRadius: 16, background: "var(--surface)", marginBottom: 8 }}><SkeletonBlock height={48} width={48} radius="50%" /><div style={{ flex: 1 }}><SkeletonBlock height={16} width="80%" /><SkeletonBlock height={10} width="65%" style={{ marginTop: 10 }} /></div></div>)}
    {pulseStyle}
  </div>;
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

export function SettingsSkeleton() {
  return <div aria-busy="true" style={{ padding: 16 }}>
    <SkeletonBlock height={24} width={140} style={{ marginBottom: 24 }} />
    {[1, 2, 3, 4].map(i => <div key={i} style={{ padding: 12, border: "1px solid var(--rule)", borderRadius: 16, background: "var(--surface)", marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}><SkeletonBlock height={30} width={30} radius="50%" /><SkeletonBlock height={14} width={100} /></div>
      <SkeletonBlock height={14} width="80%" style={{ marginTop: 12 }} />
      <SkeletonBlock height={42} radius={12} style={{ marginTop: 12 }} />
    </div>)}
    {pulseStyle}
  </div>;
}

export function ProfileSkeleton({ mode = "report" }: { mode?: "profile" | "report" }) {
  const isProfile = mode === "profile";

  return (
    <div aria-busy="true" style={{ padding: "0 16px 16px", minHeight: "100dvh" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "0 -16px", padding: "16px 16px" }}>
        <SkeletonBlock height={25} width={104} />
        <SkeletonBlock height={44} width={44} radius="50%" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 4, padding: 5, marginBottom: 16, border: "1px solid var(--rule)", borderRadius: "var(--r-xl)", background: "var(--surface-sunk)" }}>
        {[1, 2, 3, 4].map((i) => (
          <SkeletonBlock key={i} height={44} radius="calc(var(--r-xl) - 4px)" style={{ animationDelay: `${i * 0.06}s` }} />
        ))}
      </div>
      {isProfile ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "72px minmax(0, 1fr)", gap: 14, alignItems: "center", padding: 16, marginBottom: 12, border: "1px solid var(--rule)", borderRadius: 20, background: "var(--green-deep)" }}>
            <SkeletonBlock height={64} width={64} radius="50%" style={{ background: "var(--green-soft)", border: "4px solid var(--surface)" }} />
            <div style={{ minWidth: 0 }}>
              <SkeletonBlock height={10} width="42%" style={{ background: "var(--green-wash)", marginBottom: 9 }} />
              <SkeletonBlock height={23} width="76%" style={{ background: "var(--surface)" }} />
              <SkeletonBlock height={11} width="52%" style={{ background: "var(--green-wash)", marginTop: 9 }} />
            </div>
          </div>
          <div data-profile-skeleton-grid="true" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ minHeight: 112, padding: 14, border: "1px solid var(--rule)", borderRadius: 16, background: "var(--surface)", animationDelay: `${i * 0.08}s` }}>
                <SkeletonBlock height={28} width={28} radius="50%" style={{ marginBottom: 12 }} />
                <SkeletonBlock height={10} width="42%" style={{ marginBottom: 9 }} />
                <SkeletonBlock height={13} width="82%" />
                <SkeletonBlock height={13} width="62%" style={{ marginTop: 8 }} />
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginBottom: 16 }}>
            {[1, 2, 3].map((i) => (
              <SkeletonBlock key={i} height={118} radius={16} style={{ animationDelay: `${i * 0.08}s` }} />
            ))}
          </div>
          <SkeletonBlock height={20} width={132} style={{ marginBottom: 12 }} />
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 72, padding: 12, marginBottom: 10, border: "1px solid var(--rule)", borderRadius: 16, background: "var(--surface)" }}>
              <SkeletonBlock height={36} width={36} radius="50%" />
              <div style={{ flex: 1 }}>
                <SkeletonBlock height={14} width="70%" />
                <SkeletonBlock height={10} width="88%" style={{ marginTop: 9 }} />
              </div>
            </div>
          ))}
        </>
      )}
      {pulseStyle}
      <style>{`@media (max-width: 520px) { [data-profile-skeleton-grid="true"] { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}

export function HomeSkeleton() {
  return <div aria-busy="true" style={{ padding: 16, minHeight: "100dvh" }}>
    <SkeletonBlock height={24} width={128} style={{ marginBottom: 8 }} />
    <SkeletonBlock height={10} width={152} style={{ marginBottom: 24 }} />
    <div className="journey-home-top">
      <div>
        <div style={{
          display: "grid", gridTemplateColumns: "clamp(82px, 15vw, 116px) minmax(0, 1fr)", gap: 14,
          minHeight: "clamp(132px, 37vw, 160px)", padding: 12, border: "1px solid var(--rule-strong)",
          borderRadius: 20, background: "var(--surface)", marginBottom: 10,
        }}>
          <div style={{ aspectRatio: "1", minWidth: 0, overflow: "hidden", borderRadius: 12, background: "var(--green-deep)" }}>
            <SkeletonBlock height="100%" width="100%" radius={12} style={{ background: "var(--green-soft)" }} />
          </div>
          <div style={{ display: "flex", minWidth: 0, flexDirection: "column", justifyContent: "center", gap: 9 }}>
            <SkeletonBlock height={10} width="45%" style={{ background: "var(--green-wash)" }} />
            <SkeletonBlock height={24} width="85%" />
            <SkeletonBlock height={24} width="90%" style={{ background: "var(--surface-sunk)" }} />
            <SkeletonBlock height={44} width={108} radius={24} style={{ background: "var(--green-deep)" }} />
          </div>
        </div>
        <SkeletonBlock height={70} radius={20} />
      </div>
      <div className="journey-overview">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBlock: 12 }}><SkeletonBlock height={68} width={68} radius="50%" /><div style={{ flex: 1 }}><SkeletonBlock height={16} width="70%" /><SkeletonBlock height={10} width="90%" style={{ marginTop: 10 }} /></div></div>
        <div style={{ display: "flex", gap: 12 }}>{[1, 2, 3].map(i => <SkeletonBlock key={i} height={44} radius={8} />)}</div>
      </div>
    </div>
    <SkeletonBlock height={18} width={116} style={{ marginBlock: 20 }} />
    <div className="journey-mentor-list">{[1, 2, 3, 4, 5, 6].map(i => <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: 12, border: "1px solid var(--rule)", borderRadius: 16, background: "var(--surface)" }}><SkeletonBlock height={68} width={68} radius="50%" /><SkeletonBlock height={14} width="80%" /></div>)}</div>
    {pulseStyle}
  </div>;
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

function profileSkeletonMode(href: string): "profile" | "report" {
  try {
    const url = href.startsWith("http")
      ? new URL(href)
      : new URL(href, "http://local.invalid");
    return url.searchParams.get("tab")?.trim().toLowerCase() === "profile" ? "profile" : "report";
  } catch {
    return "report";
  }
}

export function skeletonForPath(pathname: string): ReactNode {
  const path = normalizePath(pathname);
  if (path === "/acharyas" || path === "/acharyas/") return <HomeSkeleton />;
  if (path === "/tasks") return <WorkSkeleton />;
  if (path === "/settings") return <SettingsSkeleton />;
  if (path === "/profile" || path.startsWith("/profile/")) {
    return <ProfileSkeleton mode={profileSkeletonMode(pathname)} />;
  }
  if (/\/tasks\/[^/]+\/active\/?$/.test(path)) return <ActiveSkeleton />;
  if (/\/tasks\/[^/]+\/learn\/?$/.test(path)) return <LearnSkeleton />;
  if (/\/tasks\/[^/]+\/?$/.test(path)) return <TaskSkeleton />;
  if (/^\/acharyas\/[^/]+\/?$/.test(path)) return <BoardSkeleton />;
  return <HomeSkeleton />;
}
