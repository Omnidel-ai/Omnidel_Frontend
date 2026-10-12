"use client";

import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { uploadPhoto, removePhoto, type NetworkProfile } from "@/acharya/lib/api/network";
import { formatIndianPhone } from "@/acharya/lib/phone";
import { fitWithinLimit, needsReencoding } from "@/acharya/lib/image-intake";
import type { Lang } from "@/acharya/lib/store";
import { t } from "@/acharya/lib/i18n/strings";
import { localizeContent } from "@/acharya/lib/i18n/localize-content";
import {
  identityCardStyle, avatarStyle, nameStyle, metaStyle, profileIdStyle,
  errorTextStyle, initialsFor,
  profileRoleStyle,
} from "./profile-ui";
import {
  ghostIconButtonActiveStyle,
  framedIconButtonStyle,
} from "@/components/acharya/ui/ghost-icon-button";
import { ProfilePhotoActionSheet } from "./ProfilePhotoActionSheet";
import { ProfilePhotoPreview } from "./ProfilePhotoPreview";
import { ProfilePhotoCropSheet } from "./ProfilePhotoCropSheet";
import detailsStyles from "./profile-details.module.css";

const MAX_BYTES = 4 * 1024 * 1024;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

interface Props {
  profile: NetworkProfile;
  lang: Lang;
  userRole: string | null;
  fallbackName: string;
  reloadSheet: () => void;
  editing: boolean;
  onToggleEdit: () => void;
}

/**
 * Always-visible profile header — avatar (tap → photo options sheet), name, trade,
 * ID + account role, edit icon. The submitted fields sit below it in
 * `ProfileDetailsPanel`, permanently open — one screenful of content never earned
 * a disclosure.
 */
export default function IdentityCard({
  profile, lang, userRole, fallbackName, reloadSheet, editing, onToggleEdit,
}: Props) {
  const s = t(lang);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [cropSourceUrl, setCropSourceUrl] = useState<string | null>(null);

  const rawDisplayName = profile.display_name || fallbackName || s.karigarFallback;
  // Every display word (including person names) → selected script for hi/bn.
  const displayName = localizeContent(rawDisplayName, lang) || rawDisplayName;
  const trade = profile.trade_master?.name ?? profile.trade ?? null;
  const city = profile.city_master?.name ?? profile.city ?? null;
  const initials = initialsFor(rawDisplayName);
  const shown = preview || profile.photo_url;

  // The account role, not the "Karigar" placeholder — OmniDel's role name wins,
  // then the session role, and only an unset role falls back to the generic label.
  const roleLabel = s.roleLabelFor(profile.account_role_name?.trim() || userRole);
  // Trade / city only when they exist; the old "Karigar" fallback moved into
  // roleLabel, so an empty trade must not repeat the role a line above it.
  const tradeLine = [trade, city]
    .filter((v): v is string => Boolean(v?.trim()))
    .map((v) => localizeContent(v, lang) || v)
    .join(" · ");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    // No size check on the ORIGINAL: the crop sheet always re-encodes to a small
    // square JPEG, and that output is what uploads (and is checked in
    // uploadCropped). Refusing originals over 4 MB rejected most camera photos,
    // which is what "profile photo won't upload on mobile" was.
    let source: File = file;
    if (needsReencoding(file)) {
      // iPhone HEIC/HEIF: most browsers cannot paint it, so the crop sheet
      // would load a blank image. Convert first; null = cannot decode here.
      const fitted = await fitWithinLimit(file);
      if (!fitted) {
        setError(s.photoTypeError);
        return;
      }
      source = fitted.file;
    } else if (file.type && !TYPES.has(file.type)) {
      // Some Android pickers report no type at all — let those through and
      // let the crop sheet decode them; only refuse a type we know is wrong.
      setError(s.photoTypeError);
      return;
    }
    // Open crop sheet before upload.
    const localPreview = URL.createObjectURL(source);
    setCropSourceUrl(localPreview);
  }

  async function uploadCropped(file: File) {
    if (cropSourceUrl) {
      try { URL.revokeObjectURL(cropSourceUrl); } catch { /* ignore */ }
    }
    setCropSourceUrl(null);
    setError("");
    if (file.size > MAX_BYTES) {
      setError(s.photoSizeError);
      return;
    }
    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);
    setBusy(true);
    try {
      const data = await uploadPhoto(file);
      setPreview(data.photo_url);
      reloadSheet();
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : s.couldNotUploadPhoto);
    } finally {
      setBusy(false);
      URL.revokeObjectURL(localPreview);
    }
  }

  function cancelCrop() {
    if (cropSourceUrl) {
      try { URL.revokeObjectURL(cropSourceUrl); } catch { /* ignore */ }
    }
    setCropSourceUrl(null);
  }

  async function onRemovePhoto() {
    setSheetOpen(false);
    setError("");
    setRemoving(true);
    try {
      await removePhoto();
      setPreview(null);
      reloadSheet();
    } catch (err) {
      setError(err instanceof Error ? err.message : s.couldNotRemovePhoto);
    } finally {
      setRemoving(false);
    }
  }

  function openTakePhoto() {
    setSheetOpen(false);
    cameraInputRef.current?.click();
  }

  function openChooseGallery() {
    setSheetOpen(false);
    galleryInputRef.current?.click();
  }

  function openPreview() {
    setSheetOpen(false);
    setPreviewOpen(true);
  }

  return (
    <section className={detailsStyles.identityCard} style={{ ...identityCardStyle, background: "var(--green-deep)", borderColor: "var(--green-deep)", flexWrap: "wrap", alignItems: "flex-start" }}>
      <button
        type="button"
        aria-label={shown ? s.photoOptions : s.addPhoto}
        title={shown ? s.photoOptions : s.addPhoto}
        disabled={busy || removing}
        onClick={() => setSheetOpen(true)}
        className="press"
        style={avatarButtonStyle}
      >
        {shown ? (
          <span
            style={{
              ...avatarStyle,
              backgroundImage: `url("${shown.replace(/"/g, "%22")}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              opacity: busy || removing ? 0.45 : 1,
            }}
            role="img"
            aria-label={displayName}
          />
        ) : (
          <span style={{ ...avatarStyle, backgroundColor: "var(--surface)", color: "var(--green-deep)", opacity: busy || removing ? 0.45 : 1 }} aria-hidden>
            {initials}
          </span>
        )}
        {busy || removing ? (
          <span style={uploadOverlayStyle} aria-live="polite">
            <span style={uploadSpinnerStyle} aria-hidden />
            <span style={uploadLabelStyle}>{removing ? s.removingPhoto : s.uploadingPhoto}</span>
          </span>
        ) : (
          <span style={cameraBadgeStyle} aria-hidden>
            <CameraIcon />
          </span>
        )}
      </button>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        style={{ display: "none" }}
        onChange={onFile}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: "none" }}
        onChange={onFile}
      />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 style={{ ...nameStyle, color: "var(--surface)" }}>{displayName}</h2>
            {tradeLine ? <p style={{ ...metaStyle, color: "var(--green-soft)" }}>{tradeLine}</p> : null}
          </div>
          <button
            type="button"
            aria-label={s.edit}
            aria-expanded={editing}
            title={s.edit}
            onClick={onToggleEdit}
            className="press"
            style={{ ...framedIconButtonStyle, width: 44, height: 44, ...(editing ? ghostIconButtonActiveStyle : null) }}
          >
            <PencilIcon />
          </button>
        </div>
      </div>

      {/* Its own full-width line under BOTH the avatar and the name column — the
          card wraps, so this is a third flex row rather than a nested one. Beside
          the name it only had ~130px and ellipsised the slug to "shi…". */}
      <p style={identityMetaRowStyle}>
        <span style={{ ...profileIdStyle, color: "var(--green-soft)" }}>{s.profileIdLabel} · {profile.slug}</span>
        <span style={{ ...profileIdStyle, color: "var(--green-soft)", flexShrink: 0 }} aria-hidden>·</span>
        <span style={{ ...profileRoleStyle, color: "var(--surface)" }}>{roleLabel}</span>
      </p>
      {/* No ADMIN pill under the ID line: `roleLabel` on that line already reads
          "Admin" for an admin, so the card said it twice, one above the other. */}

      {error ? <p style={{ ...errorTextStyle, color: "var(--terra-soft)", width: "100%", margin: "6px 0 0" }}>{error}</p> : null}

      <ProfilePhotoActionSheet
        open={sheetOpen}
        lang={lang}
        hasPhoto={Boolean(shown)}
        busy={busy || removing}
        onClose={() => setSheetOpen(false)}
        onPreview={openPreview}
        onRemove={() => void onRemovePhoto()}
        onTakePhoto={openTakePhoto}
        onChooseGallery={openChooseGallery}
      />
      <ProfilePhotoCropSheet
        open={Boolean(cropSourceUrl)}
        sourceUrl={cropSourceUrl}
        onCancel={cancelCrop}
        onConfirm={(file) => void uploadCropped(file)}
      />
      {shown ? (
        <ProfilePhotoPreview
          open={previewOpen}
          lang={lang}
          photoUrl={shown}
          alt={displayName}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </section>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  );
}

/**
 * Supporting profile details in compact groups. Name, trade, and city stay in
 * the identity card above; the remaining values are grouped here so each field
 * remains visible without repeating the identity summary. Empty values render as
 * an em dash rather than disappearing — a blank row is the prompt to fill it in.
 *
 * Hidden (not unmounted) while the edit form is open, so the two never show the
 * same field twice.
 */
export function ProfileDetailsPanel({
  profile, lang, phone, userRole, editing,
}: {
  profile: NetworkProfile;
  lang: Lang;
  phone: string;
  userRole: string | null;
  editing: boolean;
}) {
  const s = t(lang);
  const dash = "—";
  const groupCopy = lang === "hi"
    ? { contact: "संपर्क", name: "नाम", location: "स्थान" }
    : lang === "bn"
      ? { contact: "যোগাযোগ", name: "নাম", location: "অবস্থান" }
      : { contact: "Contact", name: "Name", location: "Location" };
  const localizeValue = (value: string | null | undefined) =>
    value?.trim() ? (localizeContent(value, lang) || value) : "";
  // All values localized for hi/bn, including first/last name transliteration.
  // Emails, phones, pincodes and numeric IDs stay as stored.
  const contactRows = [
    {
      label: groupCopy.name,
      value: [profile.first_name, profile.last_name].map(localizeValue).filter(Boolean).join(" "),
    },
    { label: s.emailLabel, value: profile.email },
    { label: s.phoneLabel, value: phone ? formatIndianPhone(phone) : null },
  ];
  const workRows = [
    { label: s.roleLabel, value: profile.account_role_name?.trim() || userRole, localize: true },
    { label: s.branchLabel, value: profile.account_branch_name, localize: true },
    { label: s.primaryTeamLabel, value: profile.account_primary_team_name, localize: true },
  ];
  const locationRows = [
    {
      label: [s.cityLabel, s.stateLabel].join(" / "),
      value: [profile.city_master?.name ?? profile.city, profile.state_name]
        .map(localizeValue)
        .filter(Boolean)
        .join(", "),
    },
    { label: s.addressLabel, value: profile.address_line, localize: true },
    { label: s.pincodeLabel, value: profile.pincode },
  ];

  return (
    <section className={detailsStyles.detailsPanel} style={{ display: editing ? "none" : undefined }} aria-labelledby="profile-details-heading">
      <p className={detailsStyles.panelHeading} id="profile-details-heading">{s.yourDetails}</p>
      <div className={detailsStyles.groupGrid}>
        <DetailGroup lang={lang} emptyValue={dash} title={groupCopy.contact} tone="sage" icon={<ContactIcon />} rows={contactRows} />
        <DetailGroup lang={lang} emptyValue={dash} title={s.yourWork} tone="ochre" icon={<WorkIcon />} rows={workRows} />
        <DetailGroup lang={lang} emptyValue={dash} title={groupCopy.location} tone="terracotta" icon={<LocationIcon />} rows={locationRows} />
        <section className={detailsStyles.groupCard} style={{ gridColumn: "1 / -1" }} data-tone="slate">
          <header className={detailsStyles.groupHeader}>
            <span className={detailsStyles.groupIcon} aria-hidden><AboutIcon /></span>
            <h3 className={detailsStyles.groupTitle}>{s.bioLabel}</h3>
          </header>
          <p className={detailsStyles.bioValue} data-empty={!profile.bio?.trim() ? "true" : undefined}>
            {!profile.bio?.trim() ? dash : (localizeContent(profile.bio || "", lang) || profile.bio)}
          </p>
        </section>
      </div>
    </section>
  );
}

type DetailTone = "sage" | "ochre" | "terracotta" | "slate";
type DetailRow = { label: string; value: string | null | undefined; localize?: boolean };

function DetailGroup({
  lang, emptyValue, title, tone, icon, rows,
}: {
  lang: Lang;
  emptyValue: string;
  title: string;
  tone: DetailTone;
  icon: ReactNode;
  rows: DetailRow[];
}) {
  return (
    <section className={detailsStyles.groupCard} data-tone={tone}>
      <header className={detailsStyles.groupHeader}>
        <span className={detailsStyles.groupIcon} aria-hidden>{icon}</span>
        <h3 className={detailsStyles.groupTitle}>{title}</h3>
      </header>
      <dl className={detailsStyles.fieldList}>
        {rows.map((row) => {
          const empty = !row.value?.trim();
          return (
            <div className={detailsStyles.fieldRow} key={row.label}>
              <dt className={detailsStyles.fieldLabel}>{row.label}</dt>
              <dd className={detailsStyles.fieldValue} data-empty={empty ? "true" : undefined}>
                {empty ? emptyValue : (row.value && row.localize ? localizeContent(row.value, lang) || row.value : row.value)}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

function ContactIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m4 6 8 6 8-6M8 16h.01M12 16h4" /></svg>;
}

function WorkIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8.5h16v11H4zM8 8.5V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2.5M4 13h16M10 13v2h4v-2" /></svg>;
}

function LocationIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>;
}

function AboutIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" /></svg>;
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

export function SettingsHeaderButton({
  open, onToggle, label,
}: { open: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={open}
      title={label}
      onClick={onToggle}
      className="press"
      style={{ ...framedIconButtonStyle, width: 44, height: 44, ...(open ? ghostIconButtonActiveStyle : null), marginLeft: "auto" }}
    >
      <GearIcon />
    </button>
  );
}

const avatarButtonStyle: CSSProperties = {
  position: "relative",
  padding: 0,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  flexShrink: 0,
  display: "inline-flex",
};

const cameraBadgeStyle: CSSProperties = {
  position: "absolute",
  right: -2,
  bottom: -2,
  width: 24,
  height: 24,
  borderRadius: "50%",
  background: "var(--surface)",
  border: "1px solid var(--rule-strong)",
  color: "var(--green-deep)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "var(--shadow-sm)",
};

const uploadOverlayStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  borderRadius: "50%",
  background: "color-mix(in srgb, var(--ink) 45%, transparent)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
  color: "#f4efdf",
};

const uploadSpinnerStyle: CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: "50%",
  border: "2px solid color-mix(in srgb, #f4efdf 35%, transparent)",
  borderTopColor: "#f4efdf",
  animation: "spin 0.7s linear infinite",
};

const uploadLabelStyle: CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const identityMetaRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 8,
  width: "100%",
  minWidth: 0,
  margin: "2px 0 0",
};
