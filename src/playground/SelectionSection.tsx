import { useState } from "react";
import { CustomSelect, DatePicker, MultiFilter, MultiSelect, SubTabs } from "../components";
import { Case, Section } from "./Case";

const STATUS_OPTIONS = [
  { value: "active", label: "Active", color: "var(--ok)" },
  { value: "paused", label: "Paused", color: "var(--amber)" },
  { value: "archived", label: "Archived", color: "var(--ink-mute)" },
  { value: "locked", label: "Locked (unavailable)", disabled: true },
];

const PEOPLE = [
  { value: "u1", label: "Ananya", sublabel: "Operations", color: "var(--green-deep)" },
  { value: "u2", label: "Bikram", sublabel: "Dispatch", color: "var(--terracotta)" },
  { value: "u3", label: "Chandni", sublabel: "Catalogue", color: "var(--ochre)" },
  { value: "u4", label: "Devraj", sublabel: "Finance", color: "var(--ok)" },
  { value: "u5", label: "Esha", sublabel: "Support", color: "#6a5acd" },
  { value: "u6", label: "Farhan", sublabel: "Warehouse", color: "#0f7b6c" },
  { value: "u7", label: "Gitanjali", sublabel: "Quality", color: "var(--crit)" },
  { value: "u8", label: "Harshit", sublabel: "Platform", color: "var(--green)" },
];

export function SelectionSection() {
  const [status, setStatus] = useState("active");
  const [empty, setEmpty] = useState("");
  const [members, setMembers] = useState<string[]>(["u1", "u3"]);
  const [capped, setCapped] = useState<string[]>(["u2", "u4"]);
  const [date, setDate] = useState("");
  const [tab, setTab] = useState("Overview");
  const [pillTab, setPillTab] = useState("All");

  const [search, setSearch] = useState("");
  const [lanes, setLanes] = useState<string[]>(["north"]);
  const [priority, setPriority] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [matchMode, setMatchMode] = useState<"all" | "any">("all");

  return (
    <Section id="selection" title="Selects, filters & tabs">
      <Case label="CustomSelect — selected · placeholder · compact · disabled">
        <div style={{ width: 200 }}>
          <CustomSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} aria-label="Status" />
        </div>
        <div style={{ width: 200 }}>
          <CustomSelect
            value={empty}
            onChange={setEmpty}
            options={STATUS_OPTIONS}
            placeholder="All statuses"
            allowDeselect
          />
        </div>
        <div style={{ width: 90 }}>
          <CustomSelect
            value="20"
            onChange={() => {}}
            options={[10, 20, 30].map((n) => ({ value: String(n), label: String(n) }))}
            compact
          />
        </div>
        <div style={{ width: 160 }}>
          <CustomSelect value="active" onChange={() => {}} options={STATUS_OPTIONS} disabled />
        </div>
      </Case>

      <Case label="MultiSelect — chips, search past 8 options, max 3">
        <div style={{ width: 260 }}>
          <MultiSelect
            options={PEOPLE}
            value={members}
            onChange={setMembers}
            placeholder="Assign members"
          />
        </div>
        <div style={{ width: 260 }}>
          <MultiSelect
            options={PEOPLE}
            value={capped}
            onChange={setCapped}
            max={3}
            placeholder="Up to three"
          />
        </div>
        <div style={{ width: 200 }}>
          <MultiSelect options={PEOPLE} value={[]} onChange={() => {}} disabled placeholder="Disabled" />
        </div>
      </Case>

      <Case label="DatePicker — empty · selected · range-limited · error · disabled">
        <div style={{ width: 190 }}>
          <DatePicker value={date} onChange={setDate} />
        </div>
        <div style={{ width: 190 }}>
          <DatePicker value="2026-09-20" onChange={() => {}} />
        </div>
        <div style={{ width: 190 }}>
          <DatePicker value="" onChange={() => {}} min="2026-09-01" max="2026-09-30" placeholder="Sept only" />
        </div>
        <div style={{ width: 190 }}>
          <DatePicker value="" onChange={() => {}} error placeholder="Required" />
        </div>
        <div style={{ width: 190 }}>
          <DatePicker value="2026-01-01" onChange={() => {}} disabled />
        </div>
      </Case>

      <Case label="MultiFilter — search + filter popover">
        <MultiFilter
          searchInput={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search tasks & filters…"
          matchMode={matchMode}
          onMatchModeChange={setMatchMode}
          sections={[
            {
              kind: "checklist",
              key: "lane",
              label: "Lane",
              selected: lanes,
              onChange: setLanes,
              options: [
                { value: "north", label: "North", count: 12 },
                { value: "south", label: "South", count: 4 },
                { value: "east", label: "East", count: 0 },
              ],
            },
            {
              kind: "radio",
              key: "priority",
              label: "Priority",
              selected: priority,
              onChange: setPriority,
              options: [
                { value: "high", label: "High", color: "var(--crit)" },
                { value: "normal", label: "Normal", color: "var(--amber)" },
                { value: "low", label: "Low", color: "var(--ok)" },
              ],
            },
            {
              kind: "toggle",
              key: "mine",
              label: "Only mine",
              checked: onlyMine,
              onChange: setOnlyMine,
            },
          ]}
        />
      </Case>

      <Case label="SubTabs — segmented (with counts) and pill" stack>
        <SubTabs
          tabs={["Overview", "Branches", "Locations", "Products"]}
          active={tab}
          onChange={setTab}
          counts={{ Branches: 12, Locations: 34 }}
        />
        <SubTabs
          variant="pill"
          tabs={["All", "Open", "Done"]}
          active={pillTab}
          onChange={setPillTab}
        />
      </Case>
    </Section>
  );
}
