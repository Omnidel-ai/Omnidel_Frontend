"use client";

import { useState } from "react";
import { CustomSelect } from "./custom-select";
import { DatePicker } from "./date-picker";
import { useTr } from "@/lib/client/language";

function localDateString(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function computeExportDateRange(range: "all" | "last_7" | "last_30" | "custom", customFrom: string, customTo: string) {
  if (range === "custom") return { from: customFrom, to: customTo };
  if (range === "all") return { from: "", to: "" };
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (range === "last_7" ? 6 : 29));
  return { from: localDateString(from), to: localDateString(to) };
}

type DateFieldOption = { value: string; label: string };

interface ExportCsvModalProps {
  endpoint: string;
  filePrefix: string;
  dateFieldLabel?: string;
  dateFieldOptions?: DateFieldOption[];
  defaultDateField?: string;
  buildParams?: (params: URLSearchParams) => void;
  // Optional external open control. When `open`/`onOpenChange` are supplied the
  // modal is controlled by the parent (e.g. opened from a Settings menu item);
  // otherwise it manages its own open state via the built-in trigger button.
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  // Hide the built-in "Export CSV" button — used when the trigger lives
  // elsewhere (e.g. inside a Settings menu) and open is controlled externally.
  hideTrigger?: boolean;
}

export function ExportCsvModal({
  endpoint,
  filePrefix,
  dateFieldOptions,
  defaultDateField = "",
  buildParams,
  open: openProp,
  onOpenChange,
  hideTrigger,
}: ExportCsvModalProps) {
  const tr = useTr();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;
  const [exportRange, setExportRange] = useState<"all" | "last_7" | "last_30" | "custom">("all");
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const [dateField, setDateField] = useState(defaultDateField);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  function setOpenState(next: boolean) {
    if (isControlled) onOpenChange?.(next);
    else setInternalOpen(next);
  }

  function handleOpen() {
    setOpenState(true);
    setError("");
  }

  function handleClose() {
    setOpenState(false);
    setError("");
  }

  async function handleExport() {
    if (exportRange === "custom" && (!exportFrom || !exportTo)) {
      setError("Please select both From and To dates.");
      return;
    }
    const range = computeExportDateRange(exportRange, exportFrom, exportTo);
    if (range.from && range.to && range.from > range.to) {
      setError("From date cannot be after To date.");
      return;
    }
    setError("");
    setExporting(true);
    const params = new URLSearchParams();
    if (dateField) params.set("date_field", dateField);
    if (range.from) params.set("from", range.from);
    if (range.to) params.set("to", range.to);
    if (buildParams) buildParams(params);
    try {
      const res = await fetch(`${endpoint}?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Export failed.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const suffix = range.from || range.to ? `${range.from || "start"}_to_${range.to || "today"}` : new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `${filePrefix}-${suffix}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  const showCustomRange = exportRange === "custom";

  return (
    <>
      {!hideTrigger && (
        <button onClick={handleOpen} className="export-btn" disabled={exporting}>
          {exporting ? tr("Exporting...") : tr("Export CSV")}
        </button>
      )}

      {open && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) handleClose(); }}>
          <div className="modal-card" style={{ width: 440 }}>
            <h3 style={{ fontFamily: "var(--serif)", marginBottom: 12 }}>{tr("Export CSV")}</h3>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.5, marginBottom: 18 }}>
              {tr("Configure date filters and download your data.")}
            </p>

            {dateFieldOptions && dateFieldOptions.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <span className="export-modal-field-label">{tr("Date field")}</span>
                <CustomSelect
                  value={dateField}
                  onChange={v => setDateField(v)}
                  placeholder={tr("Due date")}
                  options={dateFieldOptions}
                />
              </div>
            )}

            <div style={{ marginBottom: showCustomRange ? 12 : 16 }}>
              <span className="export-modal-field-label">{tr("Date range")}</span>
              <CustomSelect
                value={exportRange}
                onChange={value => {
                  setExportRange(value as "all" | "last_7" | "last_30" | "custom");
                  setError("");
                }}
                placeholder={tr("All dates")}
                options={[
                  { value: "all", label: "All dates" },
                  { value: "last_7", label: "Last 7 days" },
                  { value: "last_30", label: "Last 30 days" },
                  { value: "custom", label: "Custom range" },
                ]}
              />
            </div>

            {showCustomRange && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span className="export-modal-field-label">{tr("From")}</span>
                  <DatePicker
                    value={exportFrom}
                    onChange={(v) => { setExportFrom(v); setError(""); }}
                    max={exportTo || undefined}
                    placeholder={tr("From")}
                  />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span className="export-modal-field-label">{tr("To")}</span>
                  <DatePicker
                    value={exportTo}
                    onChange={(v) => { setExportTo(v); setError(""); }}
                    min={exportFrom || undefined}
                    placeholder={tr("To")}
                  />
                </label>
              </div>
            )}

            {error && (
              <p style={{ fontSize: 12, color: "var(--crit)", marginBottom: 14 }}>{error}</p>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
              <button onClick={handleClose} className="btn-secondary">{tr("Cancel")}</button>
              <button onClick={handleExport} className="btn-primary" disabled={exporting}>
                {exporting ? tr("Exporting...") : tr("Download")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
