"use client";

/**
 * The feature-acharya card — MahAcharya'ji's home surface, reused at the top of
 * the work list so the mic is in the same place on both screens.
 *
 * Two stacked bands: the portrait, then a solid strip carrying the name, field
 * and persona line. Both tap targets open the acharya: the photo and the text
 * strip opens the board.
 *
 * **Why the type is not on the photo.** It was, YouTube-thumbnail style, over a
 * gradient. The type block is a fixed ~110px tall whatever the card is, so on a
 * narrow phone it covered well over half the frame and the acharya was still not
 * visible — shrinking the gradient only made the text harder to read on top of
 * a face. Giving the words their own band is the only version where the karigar
 * gets BOTH: full portrait, full text.
 *
 * **The mic never moves.** Bottom-right of the card, in the text band, clear of
 * the photograph entirely. Fixed offsets, no drag handle: this is the one
 * control a karigar reaches for mid-work, and a control that wanders is a
 * control they have to hunt for. The full-screen conversation view keeps a mic
 * in the same corner.
 */

import type { CSSProperties, KeyboardEvent } from "react";
import AcharyaAvatar from "@/components/acharya-avatar";
import { MahAcharyaInlineMic } from "@/components/voice/MahAcharyaMic";
import { useTavus, useTavusAvailable } from "@/components/voice/TavusSessionProvider";
import TavusVideoTile from "@/components/voice/TavusVideoTile";
import { acharyaFieldTone } from "@/lib/acharya-field-tone";
import { openTaskCount, type AcharyaTaskRollup } from "@/lib/acharya-tasks";
import { localizePersonaSummary } from "@/lib/i18n/localize-content";
import { useLang, useStrings } from "@/lib/i18n/useLang";
import type { AcharyaListItem } from "@/lib/server/acharyas";

/**
 * The PHOTO's shape, not the card's — the text band sits under it and adds its
 * own height. 4:3 because these are head-and-shoulders portraits: a landscape
 * crop of one is mostly turban and shoulder.
 *
 * The aspect ratio is width-driven and the max height is a hard cap, so the two
 * only agree while the card is roughly phone-width. On a desktop viewport (this
 * app sets no max content width) the band stretched to the full window while
 * staying 250px tall, and `cover` threw away everything below the forehead. From
 * 640px up the card turns into two columns so the photo keeps a 4:3 slot and the
 * spare width goes to the type instead — see `.feature-acharya-card` in
 * globals.css, which is where a media query can reach.
 */
const PHOTO_ASPECT = "4 / 3";
const PHOTO_MAX_H = 250;
/** Widest the portrait column gets before the extra width goes to the text. */
const PHOTO_MAX_W = Math.round(PHOTO_MAX_H * (4 / 3));
/** Room the pinned mic needs — the text band stops here so they never collide. */
/**
 * Control sizing. 46px keeps a comfortable touch target while stepping back from
 * the 56px discs that dominated the card — the photograph and the name are the
 * subject here, not the buttons.
 */
const CONTROL = 46;
const CONTROL_GAP = 8;
const CONTROL_INSET = 12;

/**
 * The text band reserves room for whatever is actually rendered. A fixed gutter
 * sized for ONE control is why a second one landed on top of the persona line.
 */
function controlGutter(count: number): number {
  if (count <= 0) return 14;
  return CONTROL_INSET + count * CONTROL + (count - 1) * CONTROL_GAP + 10;
}

interface Props {
  acharya: AcharyaListItem;
  rollup?: AcharyaTaskRollup;
  /** Null when the acharya has no portrait to build a reel from. */
  onOpenBoard: () => void;
}

export default function FeaturedAcharyaCard({
  acharya,
  rollup,
  onOpenBoard,
}: Props) {
  const s = useStrings();

  /**
   * Live video avatar. Shares the ONE session in the (app) layout — the card
   * only draws the control and, while a call is running for THIS acharya,
   * shows the feed in place of the photo. A still portrait above a live video
   * of the same person would read as two acharyas.
   */
  const tavus = useTavus();
  const videoAvailable = useTavusAvailable(acharya.slug);
  const videoMine = tavus?.liveSlug === acharya.slug;
  const videoLive = tavus?.status === "live" && videoMine;
  const videoBusy = (tavus?.status === "starting" || tavus?.status === "connecting") && videoMine;
  const lang = useLang();
  const openCount = openTaskCount(rollup);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpenBoard();
    }
  }

  return (
    <div
      className="feature-acharya-card"
      // The portrait column's width is derived from the height cap, so the
      // two-column rule in globals.css reads it from here rather than
      // hardcoding a second copy of the same number.
      style={{ ...heroCard, "--feature-photo-w": `${PHOTO_MAX_W}px` } as CSSProperties}
    >
      <div className="feature-acharya-photo" style={photoBand}>
        {/* The portrait opens the acharya, same as the text band below it.
            It used to open a story reel — there is no reel any more, and a photo
            that behaves differently from the card it sits in is a trap. */}
        <button
          type="button"
          className="press"
          aria-label={s.openAcharya}
          onClick={onOpenBoard}
          style={photoButton}
        >
          {videoLive && tavus?.replicaTrack ? (
            <TavusVideoTile track={tavus.replicaTrack} objectPosition="center 28%" />
          ) : (
            <AcharyaAvatar
              slug={acharya.slug}
              name={acharya.displayName}
              imageUrl={acharya.avatarUrl}
              size={480}
              shape="rounded"
              style={photoFrame}
              imageStyle={{ ...photoImage, viewTransitionName: `acharya-${acharya.slug}-portrait` }}
              textStyle={photoInitial}
            />
          )}
        </button>

        {/* Lane counts float top-left — this is a guide card, so counts are a
            status note, not the point of it. */}
        {rollup && openCount > 0 && (
          <span style={laneBox}>
            {rollup.doing > 0 && (
              <span style={{ ...laneItem, color: "var(--ochre)" }}>
                <DoingIcon />
                {rollup.doing} {s.doing}
              </span>
            )}
            {rollup.doing > 0 && rollup.todo > 0 && <span style={laneDivider} aria-hidden />}
            {rollup.todo > 0 && (
              <span style={{ ...laneItem, color: "var(--ink-soft)" }}>
                <CalendarIcon />
                {rollup.todo} {s.planned}
              </span>
            )}
          </span>
        )}

      </div>

      {/* Solid band, not a gradient over the face. This is the board link. */}
      <div
        role="link"
        tabIndex={0}
        onClick={onOpenBoard}
        onKeyDown={onKeyDown}
        className="press feature-acharya-info"
        style={{ ...infoBand, paddingRight: controlGutter(videoAvailable ? 2 : 1) }}
      >
        <h2 style={heroName}>{acharya.displayName}</h2>
        <span style={{ ...fieldTag, ...acharyaFieldTone(acharya.field) }}>
          {s.acharyaFieldLabel(acharya.field)}
        </span>
        {acharya.personaSummary && (
          <p style={heroSummary}>
            {localizePersonaSummary(acharya.personaSummary, lang) || acharya.personaSummary}
          </p>
        )}
      </div>

      {/* Pinned outside the text band so a mic tap can never bubble into the
          board link. Renders only when this card's acharya IS the one hosting
          the live session (MahAcharya'ji). */}
      <span style={micSlot}>
        {videoAvailable ? (
          <button
            type="button"
            className="press"
            onClick={() => (videoLive || videoBusy ? tavus?.end() : tavus?.start())}
            disabled={videoBusy}
            aria-label={videoLive || videoBusy ? s.endVideoCall : s.videoAvatarOpen}
            title={videoLive || videoBusy ? s.endVideoCall : s.videoAvatarOpen}
            style={videoBtn(videoLive || videoBusy, videoBusy)}
          >
            {videoLive ? (
              <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden>
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="2.5" y="6" width="13" height="12" rx="2.5" />
                <path d="m15.5 10.5 5-2.6v8.2l-5-2.6z" />
              </svg>
            )}
          </button>
        ) : null}
        <MahAcharyaInlineMic slug={acharya.slug} size={CONTROL} />
      </span>
    </div>
  );
}

/** Circular-arrow glyph for the in-progress lane count. */
function DoingIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1" />
      <path d="M20.8 4.4v4.4h-4.4" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8.5 3.2v3.4M15.5 3.2v3.4" />
    </svg>
  );
}

const heroCard: CSSProperties = {
  position: "relative",
  marginBottom: 20,
  borderRadius: "var(--r-xl)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  boxShadow: "var(--shadow-md)",
  overflow: "hidden",
  background: "var(--surface)",
};

const photoBand: CSSProperties = {
  position: "relative",
  width: "100%",
  aspectRatio: PHOTO_ASPECT,
  maxHeight: PHOTO_MAX_H,
  overflow: "hidden",
  background: "var(--ink)",
};


/** Whole-image tap target: opens the acharya. */
const photoButton: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  padding: 0,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  display: "block",
};

const photoFrame: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  borderRadius: 0,
  borderWidth: 0,
  background: "var(--ink)",
};

const photoImage: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  // Portraits are shot head-and-shoulders; a crop centred vertically slices the
  // face, so bias the window upward.
  objectPosition: "center 18%",
};

const photoInitial: CSSProperties = {
  fontSize: 72,
  color: "color-mix(in srgb, #f4efdf 70%, transparent)",
};

/**
 * minHeight so the pinned mic always has a band to sit in, even for an acharya
 * with no persona line.
 */
const infoBand: CSSProperties = {
  position: "relative",
  minHeight: 80,
  padding: "11px 14px 13px 14px",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 6,
  background: "var(--surface)",
  cursor: "pointer",
};

/** Field chip — the same coloured chip the list rows below use. */
const fieldTag: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "3px 9px",
  borderRadius: 7,
  borderWidth: 1,
  borderStyle: "solid",
  fontFamily: "var(--mono)",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  lineHeight: 1.4,
  whiteSpace: "nowrap",
};

const heroName: CSSProperties = {
  maxWidth: "100%",
  fontFamily: "var(--serif)",
  fontStyle: "italic",
  fontSize: 22,
  fontWeight: 500,
  color: "var(--ink)",
  margin: 0,
  lineHeight: 1.15,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const heroSummary: CSSProperties = {
  fontFamily: "var(--sans)",
  fontSize: 12.5,
  color: "var(--ink-mute)",
  margin: 0,
  lineHeight: 1.42,
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

/**
 * The mic's one and only home on this card: bottom-right, in the text band and
 * completely off the photograph. Not draggable, and the same corner the
 * full-screen conversation view uses.
 */
/**
 * Starting a video call is a SECONDARY action beside the mic, and it was drawn as
 * a second saturated disc — two filled circles of equal weight competing, in a
 * card whose subject is the photograph. It was also `--crit`, which in this
 * system means destructive: the End colour on a Start control.
 *
 * So: outlined while idle, carrying its meaning by shape rather than fill, and
 * `--crit` ONLY once it genuinely ends the call. Hierarchy comes from weight,
 * not from size — both controls stay 46px so the row still reads as one pair.
 */
function videoBtn(active: boolean, busy: boolean): CSSProperties {
  return {
    width: CONTROL,
    height: CONTROL,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: active ? "var(--crit)" : "var(--rule)",
    background: active ? "var(--crit)" : "var(--surface)",
    color: active ? "#f4efdf" : "var(--ink-soft)",
    boxShadow: active ? "0 4px 14px rgba(0,0,0,0.18)" : "none",
    opacity: busy ? 0.6 : 1,
    cursor: busy ? "default" : "pointer",
    flexShrink: 0,
  };
}

const micSlot: CSSProperties = {
  position: "absolute",
  right: CONTROL_INSET,
  bottom: CONTROL_INSET,
  zIndex: 6,
  display: "inline-flex",
  alignItems: "center",
  // Video sits to the LEFT so the mic keeps the corner a thumb already knows.
  gap: CONTROL_GAP,
};

/**
 * Framed lane counts floating on the portrait — one glyph + count per lane.
 * Click-through: the photo underneath is the story button, and a status chip
 * must not carve a dead patch out of it.
 */
const laneBox: CSSProperties = {
  position: "absolute",
  left: 12,
  top: 12,
  pointerEvents: "none",
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "7px 11px",
  borderRadius: "var(--r-xl)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  background: "var(--surface)",
  boxShadow: "var(--shadow-sm)",
};

const laneItem: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontFamily: "var(--sans)",
  fontSize: 12.5,
  fontWeight: 600,
  whiteSpace: "nowrap",
};

const laneDivider: CSSProperties = {
  width: 1,
  alignSelf: "stretch",
  minHeight: 16,
  background: "var(--rule)",
};
