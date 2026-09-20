import { useState } from "react";
import { Button, Spinner } from "../components";
import { Case, Section } from "./Case";

export function ButtonsSection() {
  const [saving, setSaving] = useState(false);

  return (
    <Section id="buttons" title="Buttons">
      <Case label="Variants">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="ghost">Ghost</Button>
      </Case>

      <Case label="Sizes">
        <Button size="sm">Small</Button>
        <Button>Medium</Button>
        <Button size="lg">Large</Button>
      </Case>

      <Case label="Disabled">
        <Button disabled>Primary</Button>
        <Button variant="secondary" disabled>
          Secondary
        </Button>
        <Button variant="danger" disabled>
          Danger
        </Button>
        <Button variant="ghost" disabled>
          Ghost
        </Button>
      </Case>

      <Case label="Loading — click to run a 1.5s action">
        <Button
          loading={saving}
          onClick={() => {
            setSaving(true);
            window.setTimeout(() => setSaving(false), 1500);
          }}
        >
          Save changes
        </Button>
        <Button variant="secondary" loading loadingLabel="Loading…">
          Secondary
        </Button>
        <Button variant="danger" loading loadingLabel="Archiving…">
          Archive
        </Button>
      </Case>

      <Case label="With icons / full width">
        <Button iconLeft={<PlusIcon />}>Add Lane</Button>
        <Button variant="secondary" iconRight={<ChevronIcon />}>
          More
        </Button>
        <div style={{ width: 240 }}>
          <Button block>Block</Button>
        </div>
      </Case>

      <Case label="Spinner (standalone)">
        <Spinner size={14} />
        <Spinner size={20} />
        <Spinner size={28} />
        <Spinner size={20} color="var(--terracotta)" />
      </Case>

      <p style={{ fontSize: 12, color: "var(--ink-mute)", maxWidth: 560, lineHeight: 1.6 }}>
        Hover, active and focus-visible states are defined in{" "}
        <code style={{ fontFamily: "var(--mono)" }}>global.css</code> — tab through the row above to
        see the focus ring, and hold a click to see the active tone.
      </p>
    </Section>
  );
}

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
      <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
