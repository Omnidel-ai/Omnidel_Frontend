import { Button, PageHeader } from "../components";

/**
 * Stand-in for a route the demo does not implement.
 *
 * The sidebar carries the real application's shape, so most of its routes lead
 * here on purpose — the shell is the thing being demonstrated, not the pages
 * behind it.
 */
export function PlaceholderPage({
  href,
  onNavigate,
}: {
  href: string;
  onNavigate: (href: string) => void;
}) {
  const parts = href.split("/").filter(Boolean);
  const title = parts[parts.length - 1]?.replace(/-/g, " ") ?? "Page";

  return (
    <div>
      <PageHeader
        crumbs={parts.map((p, i) => ({
          label: p.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          href: i < parts.length - 1 ? `/${parts.slice(0, i + 1).join("/")}` : undefined,
        }))}
        onNavigate={onNavigate}
      />
      <div
        className="pg-card"
        style={{ display: "grid", placeItems: "center", minHeight: 280, textAlign: "center" }}
      >
        <div style={{ maxWidth: "46ch" }}>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--ink-mute)",
            }}
          >
            Not part of the demo
          </div>
          <h3 style={{ margin: "10px 0 8px", fontSize: 22, textTransform: "capitalize" }}>{title}</h3>
          <p style={{ fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.65 }}>
            This route exists in the navigation to show the shell at full shape. The screens that
            are built are the masters and the component playground.
          </p>
          <div
            style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16, flexWrap: "wrap" }}
          >
            <Button variant="secondary" size="sm" onClick={() => onNavigate("/admin/lanes")}>
              Open a master
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onNavigate("/playground")}>
              Components
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
