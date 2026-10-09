"use client";

import { CustomSelect } from "@/components/omnidel/custom-select";
import { formatShortDate } from "./format";
import type { EvidenceSubmission } from "./types";

export function SubmissionPicker({
  submissions,
  selectedId,
  onChange,
}: {
  submissions: EvidenceSubmission[];
  selectedId: string | null;
  onChange: (id: string) => void;
}) {
  if (submissions.length <= 1) return null;

  return (
    <div style={{ minWidth: 180, maxWidth: 280, flex: "0 1 auto" }}>
      <CustomSelect
        compact
        value={selectedId || submissions[0]?.id || ""}
        onChange={onChange}
        options={submissions.map((s, i) => ({
          value: s.id,
          label: `${i + 1}. ${s.user_name || "Submission"} · ${formatShortDate(s.created_on)}`,
        }))}
      />
    </div>
  );
}
