import { useState } from "react";
import { SubTabs } from "../components";
import { ButtonsSection } from "./ButtonsSection";
import { InputsSection } from "./InputsSection";
import { SelectionSection } from "./SelectionSection";
import { TableSection } from "./TableSection";
import { OverlaysSection } from "./OverlaysSection";
import { ChromeSection } from "./ChromeSection";

const TABS = ["All", "Buttons", "Inputs", "Selects & filters", "Table", "Overlays", "Header"];

/**
 * Component playground.
 *
 * A development harness, not part of the library: it renders every shared
 * component in every state it supports, so the visuals can be checked against
 * the main application side by side. "All" stacks the lot; the other tabs
 * isolate one section at a time.
 */
export function Playground() {
  const [tab, setTab] = useState("All");
  const show = (name: string) => tab === "All" || tab === name;

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 30 }}>Shared Components</h1>
        <p
          style={{
            color: "var(--ink-mute)",
            fontSize: 13.5,
            lineHeight: 1.6,
            marginTop: 8,
            maxWidth: "62ch",
          }}
        >
          Every shared component, in every state it supports. Nothing here fetches data or knows a
          domain object — each one takes props and reports events, so a feature can own the logic.
        </p>
      </header>

      <div style={{ marginBottom: 26 }}>
        <SubTabs tabs={TABS} active={tab} onChange={setTab} ariaLabel="Component sections" />
      </div>

      {show("Buttons") && <ButtonsSection />}
      {show("Inputs") && <InputsSection />}
      {show("Selects & filters") && <SelectionSection />}
      {show("Table") && <TableSection />}
      {show("Overlays") && <OverlaysSection />}
      {show("Header") && <ChromeSection />}
    </div>
  );
}
