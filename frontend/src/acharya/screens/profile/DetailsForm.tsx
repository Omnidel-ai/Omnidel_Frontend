"use client";

import { useEffect, useState, type CSSProperties } from "react";
import SearchableSelect from "@/components/acharya/ui/SearchableSelect";
import {
  fetchMasters, fetchCities, patchNetworkProfile,
  type NetworkProfile, type Masters, type CityOption,
} from "@/acharya/lib/api/network";
import { formatIndianPhone } from "@/acharya/lib/phone";
import type { Lang } from "@/acharya/lib/store";
import { t } from "@/acharya/lib/i18n/strings";
import {
  panelStyle, eyebrowStyle, errorTextStyle, btnPrimaryStyle,
} from "./profile-ui";
import formStyles from "./details-form.module.css";

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const PINCODE_RE = /^[1-9][0-9]{5}$/;

interface Props {
  profile: NetworkProfile;
  lang: Lang;
  phone: string;
  /** Collapsed behind the identity card's Edit button (display:none keeps edits). */
  editing: boolean;
  /** Called with the profile the server saved, so the card can show it at once. */
  onSaved: (profile: NetworkProfile) => void;
  reloadSheet: () => void;
}

export default function DetailsForm({ profile, lang, phone, editing, onSaved, reloadSheet }: Props) {
  const s = t(lang);

  const [firstName, setFirstName] = useState(profile.first_name || "");
  const [lastName, setLastName] = useState(profile.last_name || "");
  const [email, setEmail] = useState(profile.email || "");
  const [stateId, setStateId] = useState(profile.city_state_id || "");
  const [cityId, setCityId] = useState(profile.city_id || "");
  const [tradeId, setTradeId] = useState(profile.trade_id || "");
  const [addressLine, setAddressLine] = useState(profile.address_line || "");
  const [pincode, setPincode] = useState(profile.pincode || "");
  const [bio, setBio] = useState(profile.bio || "");

  const [masters, setMasters] = useState<Masters | null>(null);
  const [cities, setCities] = useState<CityOption[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchMasters()
      .then((data) => { if (!cancelled) setMasters(data); })
      .catch(() => { if (!cancelled) setMasters({ states: [], trades: [] }); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!stateId) {
      setCities([]);
      return;
    }
    let cancelled = false;
    setCitiesLoading(true);
    void fetchCities(stateId)
      .then((d) => { if (!cancelled) setCities(d.cities); })
      .catch(() => { if (!cancelled) setCities([]); })
      .finally(() => { if (!cancelled) setCitiesLoading(false); });
    return () => { cancelled = true; };
  }, [stateId]);

  function onStateChange(next: string) {
    setStateId(next);
    setCityId("");
  }

  /**
   * Save only exists once something actually changed.
   *
   * Compared with the SAME normalization `save()` applies, or a stray trailing
   * space would leave the form permanently dirty: we'd PATCH the trimmed value,
   * the reloaded profile would come back trimmed, and the untrimmed local state
   * would still not match it.
   *
   * `stateId` is deliberately absent — it is never persisted (the city implies
   * its state), so picking a state alone is not a change worth saving. It still
   * shows up indirectly: switching state clears a previously saved city.
   */
  const dirty =
    firstName.trim() !== (profile.first_name || "").trim() ||
    lastName.trim() !== (profile.last_name || "").trim() ||
    email.trim() !== (profile.email || "").trim() ||
    pincode.trim() !== (profile.pincode || "").trim() ||
    tradeId !== (profile.trade_id || "") ||
    cityId !== (profile.city_id || "") ||
    addressLine !== (profile.address_line || "") ||
    bio !== (profile.bio || "");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setSaved(false);
    if (firstName.trim().length < 2) {
      setFormError(s.enterFirstName);
      return;
    }
    if (email.trim() && !EMAIL_RE.test(email.trim())) {
      setFormError(s.enterValidEmail);
      return;
    }
    if (pincode.trim() && !PINCODE_RE.test(pincode.trim())) {
      setFormError(s.enterValidPincode);
      return;
    }
    setBusy(true);
    try {
      const { profile: savedProfile } = await patchNetworkProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        trade_id: tradeId || null,
        city_id: cityId || null,
        address_line: addressLine,
        pincode: pincode.trim(),
        bio,
      });
      setSaved(true);
      onSaved(savedProfile);
      reloadSheet();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : s.couldNotSave);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form id="your-details" onSubmit={save} style={{ ...panelStyle, display: editing ? undefined : "none" }}>
      <p style={eyebrowStyle}>{s.yourDetails}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 12 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <TextField id="first-name" label={s.firstNameLabel} value={firstName} onChange={setFirstName} required style={{ flex: 1 }} />
          <TextField id="last-name" label={s.lastNameLabel} value={lastName} onChange={setLastName} style={{ flex: 1 }} />
        </div>

        <TextField id="email" label={s.emailLabel} type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={setEmail} />

        <TextField id="phone" label={s.phoneLabel} type="tel" value={formatIndianPhone(phone)} readOnly />

        <SelectField label={s.tradeLabel}>
          <SearchableSelect
            value={tradeId}
            onChange={setTradeId}
            options={(masters?.trades ?? []).map((o) => ({ value: o.id, label: o.name }))}
            placeholder={masters ? s.selectTrade : `${s.loading}…`}
            disabled={!masters}
          />
        </SelectField>

        <SelectField label={s.stateLabel}>
          <SearchableSelect
            value={stateId}
            onChange={onStateChange}
            options={(masters?.states ?? []).map((o) => ({ value: o.id, label: o.name }))}
            placeholder={masters ? s.selectState : `${s.loading}…`}
            disabled={!masters}
          />
        </SelectField>

        <SelectField label={s.cityLabel}>
          <SearchableSelect
            value={cityId}
            onChange={setCityId}
            options={cities.map((c) => ({ value: c.id, label: c.name }))}
            placeholder={!stateId ? s.selectStateFirst : citiesLoading ? s.loadingCities : s.selectCity}
            disabled={!stateId || citiesLoading}
          />
        </SelectField>

        {/* Multi-line and growing, like a delivery app's address box: a house
            number, a lane and a landmark rarely fit on one line. */}
        <TextField id="address-line" label={s.addressLabel} placeholder={s.addressPlaceholder} value={addressLine} onChange={setAddressLine} multiline />

        <TextField
          id="pincode" label={s.pincodeLabel} inputMode="numeric" maxLength={6}
          placeholder={s.pincodePlaceholder} value={pincode}
          onChange={(v) => setPincode(v.replace(/\D/g, ""))}
        />

        <TextField id="bio" label={s.bioLabel} placeholder={s.bioPlaceholder} value={bio} onChange={setBio} multiline minRows={3} />

        {dirty ? (
          <button type="submit" disabled={busy} className="press" style={{ ...btnPrimaryStyle, width: "100%", opacity: busy ? 0.7 : 1 }}>
            {busy ? `${s.save}...` : s.save}
          </button>
        ) : null}
        {/* Suppressed the moment the form is edited again, so the confirmation
            never sits under fields whose changes are still unsaved. */}
        {saved && !dirty ? <p style={{ color: "var(--ok)", fontSize: 13, margin: 0, textAlign: "center" }}>{s.saved}</p> : null}
        {formError ? <p style={errorTextStyle}>{formError}</p> : null}
      </div>
    </form>
  );
}

/**
 * Floating-label input: the label sits in the box until the field is selected
 * or filled, then moves onto the border. See details-form.module.css.
 */
function TextField({
  id, label, value, onChange, placeholder, multiline, minRows = 1, style, ...rest
}: {
  id: string;
  label: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  minRows?: number;
  style?: CSSProperties;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
  maxLength?: number;
  required?: boolean;
  readOnly?: boolean;
}) {
  // `:placeholder-shown` needs a placeholder to exist; a space is invisible.
  const hint = placeholder || " ";
  const control = multiline ? (
    <textarea
      id={id}
      rows={minRows}
      ref={autoGrow}
      className={`${formStyles.control} ${formStyles.textarea}`}
      placeholder={hint}
      value={value}
      onFocus={(e) => autoGrow(e.currentTarget)}
      onChange={(e) => { autoGrow(e.currentTarget); onChange?.(e.target.value); }}
      maxLength={rest.maxLength}
      required={rest.required}
    />
  ) : (
    <input
      id={id}
      className={formStyles.control}
      type={rest.type ?? "text"}
      placeholder={hint}
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      {...rest}
    />
  );
  return (
    <div className={formStyles.field} style={style}>
      {control}
      <label className={formStyles.label} htmlFor={id}>{label}</label>
    </div>
  );
}

/** Dropdowns always show a value or a prompt, so their label stays on the border. */
function SelectField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={formStyles.field}>
      {children}
      <span className={`${formStyles.label} ${formStyles.labelFixed}`}>{label}</span>
    </div>
  );
}

/** Sizes a textarea to its content, so it grows line by line as the karigar types. */
function autoGrow(el: HTMLTextAreaElement | null) {
  // The form mounts hidden (display:none until Edit) and a hidden box measures
  // 0 — skip, and size it on focus instead.
  if (!el || !el.offsetParent) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight + 2}px`;
}
