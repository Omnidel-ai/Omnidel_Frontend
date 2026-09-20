import { useState } from "react";
import { Checkbox, Input, Textarea } from "../components";
import { Case, Section } from "./Case";

export function InputsSection() {
  const [filled, setFilled] = useState("Newtown Warehouse");
  const [notes, setNotes] = useState("");
  const [agreed, setAgreed] = useState(true);

  return (
    <Section id="inputs" title="Inputs">
      <Case label="Text field states" stack>
        <Input label="Empty" placeholder="Lane name" />
        <Input label="Filled" value={filled} onChange={(e) => setFilled(e.target.value)} />
        <Input
          label="With hint"
          placeholder="e.g. NT-01"
          hint="Shown on delivery labels. Letters, digits and dashes."
        />
        <Input
          label="Error"
          required
          defaultValue="nt 01"
          error="Codes cannot contain spaces."
        />
        <Input label="Disabled" value="Read-only value" disabled readOnly />
        <Input
          label="With icon and addon"
          placeholder="Search branches"
          iconLeft={<SearchIcon />}
          addonRight="⌘K"
        />
      </Case>

      <Case label="Textarea" stack>
        <Textarea
          label="Notes"
          placeholder="What changed?"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={120}
          showCount
        />
        <Textarea label="Error" defaultValue="too short" error="Give at least 20 characters." />
        <Textarea label="Disabled" defaultValue="Locked while the record is archived." disabled />
      </Case>

      <Case label="Checkbox" stack>
        <Checkbox
          label="Include archived rows"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
        />
        <Checkbox label="With a hint" hint="Applies to this session only." defaultChecked />
        <Checkbox label="Disabled" disabled />
        <Checkbox label="Disabled + checked" disabled defaultChecked />
      </Case>
    </Section>
  );
}

function SearchIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}
