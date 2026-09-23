import { useMemo, useState } from "react";
import { Button, PageHeader, Skeleton, emitToast } from "../../components";
import type { DemoSettings } from "../../data/types";
import { FieldControl, coerce, defaultFor, validate } from "../fields";

export interface SettingsPageProps {
  settings: DemoSettings;
}

/**
 * The other admin layout: one record, edited in place.
 *
 * Business Details, company settings, anything that is a single row rather
 * than a list. It is descriptor-driven in exactly the way the master page is —
 * groups of fields instead of columns — and it shares the field controls, the
 * validation and the number coercion with the master dialog, so a new field
 * type appears in both at once.
 *
 * The save bar only appears once something has changed: a form that always
 * offers Save cannot tell the reader whether it has anything to save.
 */
export function SettingsPage({ settings }: SettingsPageProps) {
  const fields = useMemo(() => settings.groups.flatMap((g) => g.fields), [settings]);

  const initial = useMemo(() => {
    const v: Record<string, unknown> = {};
    for (const f of fields) v[f.key] = settings.values[f.key] ?? defaultFor(f);
    return v;
  }, [fields, settings.values]);

  const [values, setValues] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Fresh state when the screen switches to another settings record.
  const [loadedKey, setLoadedKey] = useState(settings.key);
  if (loadedKey !== settings.key) {
    setLoadedKey(settings.key);
    setValues(initial);
    setSaved(initial);
    setErrors({});
  }

  const dirty = fields.some((f) => !same(values[f.key], saved[f.key]));

  function set(key: string, value: unknown) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
  }

  function save() {
    const next = validate(fields, values);
    if (Object.keys(next).length > 0) {
      setErrors(next);
      emitToast("Some fields need attention");
      return;
    }
    setSaving(true);
    // Where the write goes.
    window.setTimeout(() => {
      const clean = coerce(fields, values);
      setValues(clean);
      setSaved(clean);
      setSaving(false);
      emitToast(`${settings.label} saved`, "success");
    }, 500);
  }

  return (
    <div>
      <PageHeader
        eyebrow={settings.eyebrow}
        crumbs={[{ label: settings.module }, { label: settings.section }, { label: settings.label }]}
        actions={
          dirty ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setValues(saved)} disabled={saving}>
                Discard
              </Button>
              <Button size="sm" loading={saving} loadingLabel="Saving…" onClick={save}>
                Save changes
              </Button>
            </>
          ) : (
            <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-mute)" }}>
              No unsaved changes
            </span>
          )
        }
      />

      {settings.description && (
        <p
          style={{
            color: "var(--ink-mute)",
            fontSize: 13,
            lineHeight: 1.6,
            maxWidth: "70ch",
            marginBottom: 18,
          }}
        >
          {settings.description}
        </p>
      )}

      <div style={{ display: "grid", gap: 18, maxWidth: 860 }}>
        {settings.groups.map((g) => (
          <section
            key={g.title}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--rule)",
              borderRadius: "var(--r-md)",
              padding: "var(--card-pad)",
            }}
          >
            <header style={{ marginBottom: 14 }}>
              <h3 style={{ fontSize: 16 }}>{g.title}</h3>
              {g.description && (
                <p style={{ fontSize: 12.5, color: "var(--ink-mute)", marginTop: 4, lineHeight: 1.55 }}>
                  {g.description}
                </p>
              )}
            </header>
            <div className="settings-grid">
              {g.fields.map((f) => (
                <div key={f.key} style={{ gridColumn: f.type === "textarea" ? "1 / -1" : undefined }}>
                  <FieldControl
                    field={f}
                    value={values[f.key]}
                    error={errors[f.key]}
                    onChange={(v) => set(f.key, v)}
                  />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {dirty && (
        <p style={{ fontSize: 12, color: "var(--amber)", marginTop: 14 }}>
          Unsaved changes on this page.
        </p>
      )}
    </div>
  );
}

/** Placeholder while a settings record is being read. */
export function SettingsSkeleton() {
  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 860 }}>
      {[0, 1].map((i) => (
        <div
          key={i}
          aria-busy="true"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--rule)",
            borderRadius: "var(--r-md)",
            padding: "var(--card-pad)",
          }}
        >
          <Skeleton width="30%" height={13} />
          <div className="settings-grid" style={{ marginTop: 16 }}>
            {[0, 1, 2, 3].map((j) => (
              <Skeleton key={j} height={34} shape="block" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function same(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  // Numbers arrive from inputs as strings; "12" and 12 are not a change.
  return String(a ?? "") === String(b ?? "");
}
