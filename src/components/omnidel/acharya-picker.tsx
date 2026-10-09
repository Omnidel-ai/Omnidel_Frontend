"use client";

import { useEffect, useState } from "react";
import { CustomSelect } from "@/components/omnidel/custom-select";

export interface AcharyaOption {
  id: string;
  slug: string;
  display_name: string;
}

interface Props {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  label?: string;
}

export function AcharyaPicker({
  value,
  onChange,
  disabled = false,
  label = "Acharya",
}: Props) {
  const [options, setOptions] = useState<AcharyaOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/omnipulse/acharyas")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setOptions(d.items || []);
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const selectOptions = options.map((a) => ({ value: a.id, label: a.display_name }));

  const selectValue = value ?? "";

  return (
    <div className="picker-field">
      {label && (
        <div style={{
          fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.1em",
          textTransform: "uppercase", color: "var(--ink-mute)", marginBottom: 6,
        }}>
          {label}
        </div>
      )}
      <CustomSelect
        value={selectValue}
        onChange={(v) => onChange(v || null)}
        options={selectOptions}
        placeholder={loading ? "Loading..." : "Select acharya"}
        disabled={disabled || loading}
      />
    </div>
  );
}

export function formatAcharyaSource(source: string | null | undefined): string {
  switch (source) {
    case "task": return "task override";
    case "list": return "column";
    case "board": return "project";
    case "workspace": return "team";
    default: return "";
  }
}
