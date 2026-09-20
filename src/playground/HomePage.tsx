import { Badge, Button, PageHeader } from "../components";
import type { DemoData } from "../data/types";

/**
 * Landing screen for the demo shell.
 *
 * It exists so the shell opens on something that explains itself, and so the
 * masters are reachable in one click. Nothing here is a shared component — it
 * is demo content, like the playground.
 */
export function HomePage({ data, onNavigate }: { data: DemoData; onNavigate: (href: string) => void }) {
  const totalRows = data.masters.reduce((n, m) => n + m.rows.length, 0);

  return (
    <div>
      <PageHeader
        eyebrow="Isolated workspace"
        crumbs={[{ label: data.brand.name }, { label: "Shared UI" }]}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => onNavigate("/playground")}>
              Components
            </Button>
            <Button size="sm" onClick={() => onNavigate("/admin/lanes")}>
              Open a master
            </Button>
          </>
        }
      />

      <p style={{ color: "var(--ink-mute)", fontSize: 13.5, lineHeight: 1.65, maxWidth: "70ch" }}>
        This workspace is separate from the Next.js application: its own dependencies, its own CSS,
        its own dev server. Everything on screen is rendered from{" "}
        <code style={{ fontFamily: "var(--mono)", fontSize: 12 }}>src/data/demo.json</code> — the
        navigation, the person in the topbar, the notifications, the assistant&apos;s answers and
        every admin table below. There is no API and no database.
      </p>

      <div className="pg-grid-2" style={{ marginTop: 22 }}>
        <Stat label="Shared components" value="16" hint="Buttons, inputs, table, filters, overlays" />
        <Stat label="Shell components" value="5" hint="Sidebar, topbar, profile, status bar, assistant" />
        <Stat label="Admin screens" value={String(data.masters.length)} hint="One component, five descriptors" />
        <Stat label="Demo rows" value={String(totalRows)} hint="In memory — edits reset on reload" />
      </div>

      <h3 style={{ marginTop: 32, marginBottom: 12, fontSize: 18 }}>Masters</h3>
      <div className="pg-grid-2">
        {data.masters.map((m) => (
          <button
            key={m.key}
            type="button"
            className="pg-card"
            onClick={() => onNavigate(`/admin/${m.key}`)}
            style={{ textAlign: "left", cursor: "pointer", font: "inherit" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <span style={{ fontFamily: "var(--serif)", fontSize: 17 }}>{m.label}</span>
              <Badge tone="neutral">{m.module}</Badge>
            </div>
            <p style={{ fontSize: 12.5, color: "var(--ink-mute)", marginTop: 8, lineHeight: 1.6 }}>
              {m.columns.length} columns · {m.fields.length} form fields · {m.rows.length} rows
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="pg-card">
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--ink-mute)",
        }}
      >
        {label}
      </div>
      <div style={{ fontFamily: "var(--serif)", fontSize: 28, marginTop: 6 }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 4, lineHeight: 1.5 }}>
        {hint}
      </div>
    </div>
  );
}
