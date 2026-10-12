import { useState } from "react";
import { SubTabs } from "../../components/common";
import { ButtonsSection } from "./ButtonsSection";
import { InputsSection } from "./InputsSection";
import { SelectionSection } from "./SelectionSection";
import { TableSection } from "./TableSection";
import { OverlaysSection } from "./OverlaysSection";
import { ChromeSection } from "./ChromeSection";
import { StatesSection } from "./StatesSection";
import { UploadsSection } from "./UploadsSection";
import { DropzoneSection } from "./DropzoneSection";
import { CATALOG_COUNTS, CatalogSection } from "./CatalogSection";

const SETS = ["Common", "Acharya", "OmniDel"];
const TABS = ["All", "Buttons", "Inputs", "Selects & filters", "Table", "Empty & loading", "Overlays", "Header", "Media & files", "Uploads", "All files"];

/**
 * Component playground.
 *
 * A development harness, not part of the library. `src/components/` holds
 * three sets — `common/` (shared by both apps), `acharya/` and `omnidel/` —
 * and this page shows all three. Common renders every shared component in
 * every state it supports, so the visuals can be checked against the main
 * application side by side; "All" stacks the lot and the other tabs isolate
 * one section. Acharya and OmniDel list every file in their set.
 */
export function Playground() {
  const [set, setSet] = useState("Common");
  const [tab, setTab] = useState("All");
  const show = (name: string) => tab === "All" || tab === name;

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 30 }}>Components</h1>
        <p
          style={{
            color: "var(--ink-mute)",
            fontSize: 13.5,
            lineHeight: 1.6,
            marginTop: 8,
            maxWidth: "62ch",
          }}
        >
          Every component in the repo: the shared library both apps use, and each app&rsquo;s own.
          Shared components take props and report events, so a feature can own the logic.
        </p>
      </header>

      <div style={{ marginBottom: 16 }}>
        <SubTabs
          tabs={SETS}
          active={set}
          onChange={setSet}
          variant="pill"
          counts={{ Common: CATALOG_COUNTS.common, Acharya: CATALOG_COUNTS.acharya, OmniDel: CATALOG_COUNTS.omnidel }}
          ariaLabel="Component sets"
        />
      </div>

      {set === "Common" && (
        <>
          <div style={{ marginBottom: 26 }}>
            <SubTabs tabs={TABS} active={tab} onChange={setTab} ariaLabel="Component sections" />
          </div>

          {show("Buttons") && <ButtonsSection />}
          {show("Inputs") && <InputsSection />}
          {show("Selects & filters") && <SelectionSection />}
          {show("Table") && <TableSection />}
          {show("Empty & loading") && <StatesSection />}
          {show("Overlays") && <OverlaysSection />}
          {show("Header") && <ChromeSection />}
          {show("Media & files") && <UploadsSection />}
          {show("Uploads") && <DropzoneSection />}
          {tab === "All files" && <CatalogSection set="common" />}
        </>
      )}
      {set === "Acharya" && <CatalogSection set="acharya" />}
      {set === "OmniDel" && <CatalogSection set="omnidel" />}
    </div>
  );
}
