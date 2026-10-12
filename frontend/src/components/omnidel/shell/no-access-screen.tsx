export function NoAccessScreen({ area, resource }: { area?: string; resource?: string }) {
  const label = area ?? resource ?? "this page";
  return (
    <section
      aria-labelledby="no-access-title"
      style={{
        minHeight: "min(520px, 70vh)",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "min(460px, 100%)",
          padding: "32px 28px",
          textAlign: "center",
          background: "var(--surface)",
          border: "1px solid var(--rule)",
          borderRadius: "var(--r-md)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 42,
            height: 42,
            margin: "0 auto 16px",
            display: "grid",
            placeItems: "center",
            borderRadius: "50%",
            background: "var(--crit-wash)",
            color: "var(--crit)",
            fontFamily: "var(--mono)",
            fontWeight: 700,
          }}
        >
          !
        </div>
        <h2 id="no-access-title" style={{ fontFamily: "var(--serif)", fontSize: 24, marginBottom: 8 }}>
          You don&apos;t have access
        </h2>
        <p style={{ color: "var(--ink-mute)", fontSize: 13, lineHeight: 1.6 }}>
          Your current permissions do not include access to {label}.
        </p>
      </div>
    </section>
  );
}
