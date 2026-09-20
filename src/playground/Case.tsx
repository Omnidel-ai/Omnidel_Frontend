import type { ReactNode } from "react";

/** One labelled state inside a playground section. */
export function Case({
  label,
  children,
  stack = false,
}: {
  label: string;
  children: ReactNode;
  /** Lay the examples out in a column instead of a wrapping row. */
  stack?: boolean;
}) {
  return (
    <div className="pg-case">
      <div className="pg-case__label">{label}</div>
      {stack ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 420 }}>
          {children}
        </div>
      ) : (
        <div className="pg-row">{children}</div>
      )}
    </div>
  );
}

export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="pg-section">
      <h3 className="pg-section__title">{title}</h3>
      {children}
    </section>
  );
}
