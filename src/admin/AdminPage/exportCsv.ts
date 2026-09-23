import type { DemoColumn, DemoRow } from "../../data/types";

/** RFC 4180 quoting: wrap in quotes and double any quote inside. */
function cell(value: unknown): string {
  if (value == null) return "";
  const s = Array.isArray(value) ? value.join("; ") : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(columns: DemoColumn[], rows: DemoRow[]): string {
  const head = columns.map((c) => cell(c.header)).join(",");
  const body = rows.map((r) => columns.map((c) => cell(r[c.key])).join(",")).join("\n");
  return `${head}\n${body}\n`;
}

/**
 * Download the rows currently in view as a CSV.
 *
 * Entirely client-side — a Blob and an object URL, no request. The export
 * carries exactly the columns the table shows, so what lands in the file is
 * what the reader was looking at.
 */
export function downloadCsv(filename: string, columns: DemoColumn[], rows: DemoRow[]) {
  if (typeof document === "undefined") return;
  // The BOM is what makes Excel read UTF-8 rather than the system codepage —
  // without it the ₹ and the Bengali names arrive mangled.
  const blob = new Blob(["﻿", toCsv(columns, rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
