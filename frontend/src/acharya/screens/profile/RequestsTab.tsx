"use client";

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import {
  fetchInvites, fetchOrgs, respondToInvite, requestJoin, cancelJoinRequest,
  type InviteRow, type OrgRow,
} from "@/acharya/lib/api/network";
import type { Lang } from "@/acharya/lib/store";
import { t } from "@/acharya/lib/i18n/strings";
import { localizeContent } from "@/acharya/lib/i18n/localize-content";
import NoticeBanner from "@/components/acharya/shell/NoticeBanner";
import {
  panelStyle, eyebrowStyle, listStyle, listTitleStyle,
  listMetaStyle, errorTextStyle, loadingRowStyle, spinnerStyle,
  btnPrimaryStyle, btnSecondaryStyle, statusBadgeStyle,
} from "./profile-ui";
import {
  OrgIcon, PinIcon, AcceptIcon, DeclineIcon, JoinIcon, EmptyInboxIcon, orgGlyphStyle,
} from "./network-icons";

interface Props {
  lang: Lang;
  /** Refreshes the shared sheet so Report/History reflect accepted invites. */
  reloadSheet: () => void;
}

export default function RequestsTab({ lang, reloadSheet }: Props) {
  const s = t(lang);
  const [invites, setInvites] = useState<InviteRow[] | null>(null);
  const [orgs, setOrgs] = useState<OrgRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setError(null);
    try {
      const [inv, org] = await Promise.all([fetchInvites(), fetchOrgs()]);
      setInvites(inv.items);
      setOrgs(org.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : t(lang).couldNotLoadRequests);
    }
  }, [lang]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onRespond(linkId: string, action: "accept" | "decline") {
    setBusyId(`${linkId}:${action}`);
    setRowError((prev) => ({ ...prev, [linkId]: "" }));
    try {
      await respondToInvite(linkId, action);
      await load();
      reloadSheet();
    } catch (err) {
      setRowError((prev) => ({ ...prev, [linkId]: err instanceof Error ? err.message : s.couldNotRespond }));
    } finally {
      setBusyId(null);
    }
  }

  async function onRequest(orgId: string) {
    setBusyId(orgId);
    setRowError((prev) => ({ ...prev, [orgId]: "" }));
    try {
      await requestJoin(orgId);
      await load();
      reloadSheet();
    } catch (err) {
      setRowError((prev) => ({ ...prev, [orgId]: err instanceof Error ? err.message : s.couldNotSendRequest }));
    } finally {
      setBusyId(null);
    }
  }

  async function onCancel(orgId: string) {
    setBusyId(orgId);
    setRowError((prev) => ({ ...prev, [orgId]: "" }));
    try {
      await cancelJoinRequest(orgId);
      await load();
      reloadSheet();
    } catch (err) {
      setRowError((prev) => ({ ...prev, [orgId]: err instanceof Error ? err.message : s.couldNotCancel }));
    } finally {
      setBusyId(null);
    }
  }

  if (invites === null || orgs === null) {
    return (
      <section style={panelStyle} aria-live="polite">
        {error ? (
          <div>
            <p style={errorTextStyle}>{error}</p>
            <button type="button" onClick={() => void load()} className="press" style={{ ...btnSecondaryStyle, marginTop: 10 }}>
              {s.tryAgain}
            </button>
          </div>
        ) : (
          <div style={loadingRowStyle}>
            <span style={spinnerStyle} aria-hidden />
            <span>{s.loading}...</span>
          </div>
        )}
      </section>
    );
  }

  return (
    <div>
      {/* Unlink / link notices land here too — this tab is where MSME links are managed. */}
      {/* Company/link notices only — task assignment/mention notices belong in
          the home bell, not on a tab about MSME links. */}
      <NoticeBanner variant="inline" scope="network" style={{ padding: 0 }} />

      <section style={panelStyle}>
        <p style={eyebrowStyle}>{s.invitesToYou}</p>
        {invites.length === 0 ? (
          <p style={emptyStateStyle}>
            <span style={emptyIconStyle} aria-hidden><EmptyInboxIcon /></span>
            {s.noInvites}
          </p>
        ) : (
          <div style={listStyle}>
            {invites.map((invite) => (
              <div key={invite.id} style={inviteRowStyle}>
                <OrgIdentity
                  name={invite.org?.name ? localizeContent(invite.org.name, lang) : "MSME"}
                  city={invite.org?.city ? localizeContent(invite.org.city, lang) : null}
                  about={invite.org?.about ? localizeContent(invite.org.about, lang) : null}
                />
                <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => void onRespond(invite.id, "accept")}
                    className="press"
                    style={{ ...btnPrimaryStyle, flex: 1, opacity: busyId && busyId !== `${invite.id}:accept` ? 0.6 : 1 }}
                  >
                    <AcceptIcon />
                    {busyId === `${invite.id}:accept` ? `${s.accept}...` : s.accept}
                  </button>
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => void onRespond(invite.id, "decline")}
                    className="press"
                    style={{ ...btnSecondaryStyle, flex: 1, opacity: busyId && busyId !== `${invite.id}:decline` ? 0.6 : 1 }}
                  >
                    <DeclineIcon />
                    {busyId === `${invite.id}:decline` ? `${s.decline}...` : s.decline}
                  </button>
                </div>
                {rowError[invite.id] ? <p style={{ ...errorTextStyle, marginTop: 8 }}>{rowError[invite.id]}</p> : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={panelStyle}>
        <p style={eyebrowStyle}>{s.exploreMsmes}</p>
        <p style={{ ...listMetaStyle, marginTop: 6 }}>{s.exploreMsmesSub}</p>
        {orgs.length === 0 ? (
          <p style={emptyStateStyle}>
            <span style={emptyIconStyle} aria-hidden><EmptyInboxIcon /></span>
            {s.noOrgsYet}
          </p>
        ) : (
          <div style={listStyle}>
            {orgs.map((org) => (
              <div key={org.id} style={inviteRowStyle}>
                <OrgIdentity
                  name={localizeContent(org.name, lang)}
                  city={org.city ? localizeContent(org.city, lang) : null}
                  about={org.about ? localizeContent(org.about, lang) : null}
                  badge={org.myLink?.status === "active" ? (
                    <span style={statusBadgeStyle("active")}>{s.linkedStamp}</span>
                  ) : null}
                />
                <OrgActionArea
                  org={org}
                  busy={busyId === org.id}
                  anyBusy={busyId !== null}
                  labels={s}
                  onRequest={() => void onRequest(org.id)}
                  onCancel={() => void onCancel(org.id)}
                />
                {rowError[org.id] ? <p style={{ ...errorTextStyle, marginTop: 8 }}>{rowError[org.id]}</p> : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function OrgActionArea({ org, busy, anyBusy, labels, onRequest, onCancel }: {
  org: OrgRow;
  busy: boolean;
  anyBusy: boolean;
  labels: ReturnType<typeof t>;
  onRequest: () => void;
  onCancel: () => void;
}) {
  const status = org.myLink?.status ?? null;
  if (status === "active") return null;
  if (status === "invited") {
    return <p style={{ ...listMetaStyle, marginTop: 8 }}>{labels.respondAbove}</p>;
  }
  if (status === "requested") {
    return (
      <button
        type="button"
        disabled={anyBusy}
        onClick={onCancel}
        className="press"
        style={{ ...btnSecondaryStyle, marginTop: 10, width: "100%", opacity: anyBusy && !busy ? 0.6 : 1 }}
      >
        {busy ? `${labels.cancelRequest}...` : labels.cancelRequest}
      </button>
    );
  }
  return (
    <button
      type="button"
      disabled={anyBusy}
      onClick={onRequest}
      className="press"
      style={{ ...btnPrimaryStyle, marginTop: 10, width: "100%", opacity: anyBusy && !busy ? 0.6 : 1 }}
    >
      <JoinIcon />
      {busy ? `${labels.requestToJoin}...` : labels.requestToJoin}
    </button>
  );
}

/**
 * An MSME, as both lists show it: the building glyph, the name, the city on a
 * pin, and the description under them.
 *
 * It was three stacked paragraphs — name, bare city, full about — with nothing
 * to anchor them and the city indistinguishable from a sentence. The glyph
 * gives the row a left edge, the pin says what the city IS without the word,
 * and the description is held to two lines so a long one cannot push the join
 * button off the card.
 */
function OrgIdentity({ name, city, about, badge }: {
  name: string;
  city: string | null;
  about: string | null;
  badge?: ReactNode;
}) {
  return (
    <div style={{ display: "flex", gap: 11 }}>
      <span style={orgGlyphStyle} aria-hidden><OrgIcon /></span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <p style={listTitleStyle}>{name}</p>
          {badge}
        </div>
        {city ? (
          <p style={cityStyle}>
            <span style={{ display: "inline-flex", color: "var(--ink-faint)" }} aria-hidden><PinIcon /></span>
            {city}
          </p>
        ) : null}
        {about ? <p style={aboutStyle}>{about}</p> : null}
      </div>
    </div>
  );
}

const inviteRowStyle: CSSProperties = {
  borderTopWidth: 1,
  borderTopStyle: "solid",
  borderTopColor: "var(--rule)",
  paddingTop: 10,
};

const cityStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  color: "var(--ink-mute)",
  fontSize: 12,
  lineHeight: 1.3,
  margin: "3px 0 0",
};

/** Two lines, then an ellipsis — a long description must not own the card. */
const aboutStyle: CSSProperties = {
  color: "var(--ink-soft)",
  fontSize: 13,
  lineHeight: 1.45,
  margin: "6px 0 0",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

/** Nothing waiting: a glyph and one line, centred, rather than a stray sentence. */
const emptyStateStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 7,
  margin: "14px 0 6px",
  color: "var(--ink-mute)",
  fontSize: 13,
  textAlign: "center",
};

const emptyIconStyle: CSSProperties = {
  display: "grid",
  placeItems: "center",
  width: 40,
  height: 40,
  borderRadius: 12,
  background: "var(--surface-sunk)",
  color: "var(--ink-faint)",
};
