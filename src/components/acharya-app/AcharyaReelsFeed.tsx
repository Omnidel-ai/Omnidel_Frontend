"use client";

/**
 * Instagram-reels-style story feed — the second page of /acharyas home.
 *
 * Home is one horizontal scroll-snap track: page 1 is the acharya list, page 2
 * is this feed. Swiping left off the list lands here, exactly the way swiping on
 * Instagram opens reels; swiping right (or the back chevron) returns.
 *
 * Each acharya gets ONE full-bleed panel that fills the viewport and snaps
 * vertically, so a flick up is the next acharya. Only the panel actually on
 * screen animates its caption frames (an IntersectionObserver picks it) — four
 * panels rotating captions off-screen is wasted work on the low-end Androids
 * this app targets.
 *
 * Panel anatomy: ONE full-bleed portrait filling the panel, with a scrim at the
 * top (so the progress bars and back chevron read) and a taller one at the
 * bottom (so the name and caption read). No card, no blurred backdrop — the
 * photo IS the panel.
 *
 * The progress bars track that acharya's PORTRAITS, not caption frames: an
 * acharya carries their avatar plus up to three studio reference images, and the
 * panel pages through them on a timer like an Instagram story. Tap the left or
 * right half to step back or forward. There is no play button and no story
 * sheet — nothing here is a video, so an affordance promising one was a lie;
 * the explicit action on the panel is Open, which goes to the acharya.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import AcharyaAvatar from "@/components/acharya-avatar";
import { acharyaFieldTone } from "@/lib/acharya-field-tone";
import { getAcharyaStoryMedia, type AcharyaStoryMedia } from "@/lib/acharya-media";
import { useLang, useStrings } from "@/lib/i18n/useLang";
import type { AcharyaListItem } from "@/lib/server/acharyas";

interface Props {
  /** On-screen order from home: hero first, then the rows. */
  acharyas: AcharyaListItem[];
  /** Opens that acharya's board. */
  onOpenAcharya: (slug: string) => void;
  /** Swipes the home track back to the acharya list. */
  onBack: () => void;
  /**
   * True while home has collapsed its header for this page. Flipping it resizes
   * every panel, so the feed re-snaps to the panel that was on screen instead of
   * leaving the karigar parked on the seam between two acharyas.
   */
  immersive?: boolean;
}

/** How long one portrait holds before the panel pages to the next. */
const FRAME_MS = 3_750;

/** Every image this acharya can show, primary first. Always at least one entry
 *  so a portrait-less acharya still renders a panel (the initial fallback). */
function panelImages(acharya: AcharyaListItem): (string | null)[] {
  const urls = acharya.portraits.filter(Boolean);
  if (urls.length > 0) return urls;
  return [acharya.avatarUrl];
}

/** Cream used across the panel chrome — reads on any portrait. */
const CREAM = "#f4efdf";
/** Panel ground, also the blur tint and the caption scrim. */
const NIGHT = "#14110c";

export function AcharyaReelsFeed({
  acharyas,
  onOpenAcharya,
  onBack,
  immersive = false,
}: Props) {
  const s = useStrings();
  const lang = useLang();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  const reels = acharyas
    .map((a) => ({ acharya: a, story: getAcharyaStoryMedia(a, lang) }))
    .filter((r): r is { acharya: AcharyaListItem; story: AcharyaStoryMedia } => !!r.story);

  // Which panel is on screen. Threshold 0.6 so the switch happens once a panel
  // genuinely owns the viewport, not the instant it peeks in mid-flick.
  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    const panels = Array.from(root.querySelectorAll<HTMLElement>("[data-reel-slug]"));
    if (panels.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const slug = (entry.target as HTMLElement).dataset.reelSlug;
          if (slug) setActiveSlug(slug);
        }
      },
      { root, threshold: 0.6 },
    );
    for (const p of panels) io.observe(p);
    return () => io.disconnect();
  }, [reels.length]);

  const active = activeSlug ?? reels[0]?.acharya.slug ?? "";
  const activeIndex = Math.max(
    0,
    reels.findIndex((r) => r.acharya.slug === active),
  );
  // Bars — and the timer — track IMAGES. A single-portrait acharya gets one
  // full bar and holds, which is the honest reading of "there is one picture".
  const frameCount = reels[activeIndex]
    ? panelImages(reels[activeIndex].acharya).length
    : 1;

  // Which image the panel on screen is showing. Stamped with the slug it belongs
  // to so switching acharya reads as image 0 on the render itself — no reset
  // setState, no stale frame flashing under the new face.
  const [frameAt, setFrameAt] = useState<{ slug: string; frame: number }>({ slug: "", frame: 0 });
  const frame = frameAt.slug === active ? frameAt.frame : 0;

  // One image needs no timer at all — an interval that recomputes 0 every 3.75s
  // just re-renders the panel forever on a phone we are trying to keep cheap.
  useEffect(() => {
    if (!active || frameCount < 2) return;
    let i = 0;
    const id = window.setInterval(() => {
      i = (i + 1) % frameCount;
      setFrameAt({ slug: active, frame: i });
    }, FRAME_MS);
    return () => window.clearInterval(id);
  }, [active, frameCount]);

  // Tap-driven paging. Claims the slug so the tap wins over the timer's next
  // tick for this acharya rather than fighting it.
  const stepFrame = useCallback(
    (slug: string, count: number, delta: number) => {
      setFrameAt((prev) => {
        const at = prev.slug === slug ? prev.frame : 0;
        return { slug, frame: (at + delta + count) % count };
      });
    },
    [],
  );

  // Panel heights change with home's header. Re-snap by index (every panel is
  // exactly one scroller height) once the collapse transition has settled.
  const indexRef = useRef(0);
  useEffect(() => {
    indexRef.current = activeIndex;
  }, [activeIndex]);
  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    const id = window.setTimeout(() => {
      root.scrollTo({ top: indexRef.current * root.clientHeight, behavior: "auto" });
    }, 280);
    return () => window.clearTimeout(id);
  }, [immersive]);

  if (reels.length === 0) {
    return (
      <div style={emptyWrap}>
        <p style={emptyText}>{s.acharyaStories}</p>
      </div>
    );
  }

  return (
    <div style={feedWrap}>
      <div ref={scrollerRef} className="hide-scrollbar" style={feedScroller}>
        {reels.map(({ acharya, story }) => (
          <ReelPanel
            key={acharya.slug}
            acharya={acharya}
            story={story}
            active={acharya.slug === active}
            frame={acharya.slug === active ? frame : 0}
            onStep={(delta) =>
              stepFrame(acharya.slug, panelImages(acharya).length, delta)
            }
            onOpenAcharya={() => onOpenAcharya(acharya.slug)}
            onBack={onBack}
          />
        ))}
      </div>

      {/* Which acharya of how many — the vertical swipe is otherwise invisible. */}
      {reels.length > 1 && (
        <div style={panelRail} aria-hidden>
          {reels.map(({ acharya }, i) => (
            <span
              key={acharya.slug}
              style={{
                ...panelRailDot,
                height: i === activeIndex ? 16 : 5,
                opacity: i === activeIndex ? 1 : 0.4,
              }}
            />
          ))}
        </div>
      )}

      <style>{`
        @keyframes reelBarFill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @media (prefers-reduced-motion: reduce) {
          .reel-bar-fill { animation: none !important; transform: scaleX(1) !important; }
        }
      `}</style>
    </div>
  );
}

function ReelPanel({
  acharya,
  story,
  active,
  frame,
  onStep,
  onOpenAcharya,
  onBack,
}: {
  acharya: AcharyaListItem;
  story: AcharyaStoryMedia;
  active: boolean;
  /** Which portrait to show — driven by the feed, always 0 when off screen. */
  frame: number;
  /** Step the portrait by -1 / +1 (the tap halves). */
  onStep: (delta: number) => void;
  onOpenAcharya: () => void;
  onBack: () => void;
}) {
  const s = useStrings();
  const images = panelImages(acharya);
  const imageUrl = images[Math.min(frame, images.length - 1)] ?? acharya.avatarUrl;
  const multi = images.length > 1;

  return (
    <section data-reel-slug={acharya.slug} style={panel} aria-label={story.title}>
      {/* The portrait fills the panel. `key` on the URL so swapping images
          re-runs the fade rather than cross-dissolving into a half-decoded
          bitmap on a slow connection. */}
      <div style={mediaFill}>
        <AcharyaAvatar
          key={imageUrl ?? acharya.slug}
          slug={acharya.slug}
          name={acharya.displayName}
          imageUrl={imageUrl}
          size={480}
          shape="rounded"
          style={fillFrame}
          imageStyle={fillImage}
          textStyle={reelInitial}
        />
      </div>

      {/* Two scrims, not one wash: the photo stays true through the middle of
          the panel and only darkens where type actually sits. */}
      <span style={scrimTop} aria-hidden />
      <span style={scrimBottom} aria-hidden />

      {/* Tap halves page the portraits, Instagram-style. Only mounted when there
          is more than one image — otherwise they are two invisible buttons that
          swallow taps and do nothing. */}
      {multi ? (
        <>
          <button
            type="button"
            onClick={() => onStep(-1)}
            aria-hidden
            tabIndex={-1}
            style={{ ...tapZone, left: 0 }}
          />
          <button
            type="button"
            onClick={() => onStep(1)}
            aria-hidden
            tabIndex={-1}
            style={{ ...tapZone, right: 0 }}
          />
        </>
      ) : null}

      <div style={topChrome}>
        <div style={progressRow} aria-hidden>
          {images.map((_, i) => (
            <span key={i} style={progressTrack}>
              <span
                key={`${i}-${frame}-${active}`}
                className={active && i === frame ? "reel-bar-fill" : undefined}
                style={{
                  ...progressFill,
                  ...(i < frame
                    ? { transform: "scaleX(1)" }
                    : active && i === frame
                      ? multi
                        ? { animation: `reelBarFill ${FRAME_MS}ms linear forwards` }
                        : { transform: "scaleX(1)" }
                      : { transform: "scaleX(0)" }),
                }}
              />
            </span>
          ))}
        </div>
        <button
          type="button"
          className="press"
          onClick={onBack}
          aria-label={s.yourAcharyas}
          style={backBtn}
        >
          <BackIcon />
        </button>
      </div>

      <div style={panelBody}>
        <p style={frameLabel}>{s.storyReelSubtitle}</p>
        <div style={nameRow}>
          <h3 style={reelName}>{acharya.displayName}</h3>
          <span style={{ ...reelFieldTag, ...acharyaFieldTone(acharya.field) }}>
            {s.acharyaFieldLabel(acharya.field)}
          </span>
        </div>
        {/* Clamped AND floor-height so the button never moves under the thumb
            when a longer persona line lands. */}
        <p style={reelCaption}>{story.frameCaptions[0]}</p>
        <div style={ctaRow}>
          <button
            type="button"
            className="press"
            onClick={onOpenAcharya}
            style={openBtn}
            aria-label={s.openAcharya}
          >
            <span style={btnLabel}>{s.openAcharya}</span>
          </button>
        </div>
      </div>
    </section>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

const feedWrap: CSSProperties = {
  position: "relative",
  flex: 1,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  background: NIGHT,
};

// Flex column with `flex: 0 0 100%` panels rather than `height: 100%` ones: the
// feed lives inside a stretched flex item, where a percentage height is not
// reliably resolvable, but a flex basis against a definite main size is.
const feedScroller: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  overflowY: "auto",
  scrollSnapType: "y mandatory",
  WebkitOverflowScrolling: "touch",
  background: NIGHT,
};

const panel: CSSProperties = {
  position: "relative",
  flex: "0 0 100%",
  minHeight: 0,
  scrollSnapAlign: "start",
  scrollSnapStop: "always",
  overflow: "hidden",
  background: NIGHT,
  // Media takes the slack; the caption block sizes to its content.
  display: "flex",
  flexDirection: "column",
};

const mediaFill: CSSProperties = {
  position: "absolute",
  inset: 0,
};

const fillFrame: CSSProperties = {
  width: "100%",
  height: "100%",
  borderRadius: 0,
  borderWidth: 0,
  background: NIGHT,
  display: "block",
};

const fillImage: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  // Faces sit high in these portraits — a centred crop cuts foreheads.
  objectPosition: "center 24%",
  display: "block",
};

const reelInitial: CSSProperties = {
  fontSize: 96,
  color: `color-mix(in srgb, ${CREAM} 70%, transparent)`,
};

/**
 * Type legibility over an unknown photo. Two scrims rather than one full-panel
 * wash: a wash mutes the portrait everywhere, including the middle where there
 * is nothing to read. These darken only the bands the bars and the caption
 * occupy, so the face stays as shot.
 */
const scrimTop: CSSProperties = {
  position: "absolute",
  insetInline: 0,
  top: 0,
  height: 190,
  pointerEvents: "none",
  background: `linear-gradient(to bottom, color-mix(in srgb, ${NIGHT} 82%, transparent) 0%, color-mix(in srgb, ${NIGHT} 42%, transparent) 55%, transparent 100%)`,
};

const scrimBottom: CSSProperties = {
  position: "absolute",
  insetInline: 0,
  bottom: 0,
  height: "52%",
  pointerEvents: "none",
  background: `linear-gradient(to top, ${NIGHT} 0%, color-mix(in srgb, ${NIGHT} 88%, transparent) 22%, color-mix(in srgb, ${NIGHT} 52%, transparent) 55%, transparent 100%)`,
};

/**
 * Left / right paging halves. Transparent on purpose — the photo is the surface,
 * and a visible hit area would read as chrome. They stop short of the bottom so
 * they never sit over the Open button, and short of the top so the back chevron
 * still takes its own taps.
 *
 * Pointer-only (`aria-hidden` + `tabIndex={-1}` at the call site, `outline:none`
 * here): focused, a full-height transparent button draws a ring down the middle
 * of the acharya's face. Nothing is lost by taking them out of the tab order —
 * the portraits auto-advance, so every image is shown without a tap, and these
 * only let a thumb get there sooner.
 */
const tapZone: CSSProperties = {
  position: "absolute",
  top: 74,
  bottom: 210,
  width: "38%",
  border: "none",
  padding: 0,
  background: "transparent",
  cursor: "pointer",
  outline: "none",
  WebkitTapHighlightColor: "transparent",
};

/** Progress bars, then the back chevron under them — one top-left stack. */
const topChrome: CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  padding: "max(env(safe-area-inset-top), 10px) 14px 0",
  display: "flex",
  flexDirection: "column",
  gap: 9,
  pointerEvents: "none",
};

const progressRow: CSSProperties = {
  display: "flex",
  gap: 5,
};

const progressTrack: CSSProperties = {
  flex: 1,
  height: 3,
  borderRadius: 999,
  overflow: "hidden",
  background: `color-mix(in srgb, ${CREAM} 26%, transparent)`,
};

const progressFill: CSSProperties = {
  display: "block",
  width: "100%",
  height: "100%",
  borderRadius: 999,
  background: CREAM,
  transformOrigin: "left center",
};

const backBtn: CSSProperties = {
  alignSelf: "flex-start",
  width: 38,
  height: 38,
  borderRadius: 999,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: `color-mix(in srgb, ${CREAM} 34%, transparent)`,
  background: `color-mix(in srgb, ${NIGHT} 46%, transparent)`,
  color: CREAM,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  pointerEvents: "auto",
};

const panelBody: CSSProperties = {
  position: "relative",
  // The portrait is absolutely positioned now, so this is the panel's ONLY
  // in-flow child and a flex column would otherwise stack it at the TOP. The
  // old card had `flex: 1` and did this job by taking the slack.
  marginTop: "auto",
  padding: "26px 18px max(env(safe-area-inset-bottom), 20px)",
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  gap: 7,
  // No background of its own: `scrimBottom` already darkens this band, and a
  // second gradient stacked on it painted an opaque slab with a hard top edge
  // across the middle of the portrait.
  pointerEvents: "none",
};

const frameLabel: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: `color-mix(in srgb, ${CREAM} 72%, transparent)`,
  margin: 0,
};

/** Name and field tag share a line — the tag was eating a whole row alone. */
const nameRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 8,
  minWidth: 0,
};

const reelName: CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontStyle: "italic",
  fontSize: 26,
  fontWeight: 500,
  color: "#f7f2e4",
  margin: 0,
  lineHeight: 1.12,
  minWidth: 0,
};

const reelFieldTag: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  flexShrink: 0,
  padding: "3px 9px",
  borderRadius: 7,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: `color-mix(in srgb, ${CREAM} 30%, transparent)`,
  background: `color-mix(in srgb, ${NIGHT} 45%, transparent)`,
  color: CREAM,
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  lineHeight: 1.4,
  whiteSpace: "nowrap",
};

const reelCaption: CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontStyle: "italic",
  fontSize: 16.5,
  lineHeight: 1.36,
  color: `color-mix(in srgb, ${CREAM} 90%, transparent)`,
  margin: "1px 0 0",
  maxWidth: 460,
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 3,
  overflow: "hidden",
  // Three lines of floor so a short frame does not shrink the block.
  minHeight: "calc(3 * 1.36em)",
};

const ctaRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 10,
  marginTop: 8,
  pointerEvents: "auto",
};

/** Labels never break mid-phrase — "Watch story" was stacking into two lines. */
const btnLabel: CSSProperties = { whiteSpace: "nowrap" };

const ctaBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  // Grow to share the row, wrap to full width when both no longer fit.
  flex: "1 1 auto",
  minWidth: 0,
  minHeight: 46,
  padding: "0 18px",
  borderRadius: 999,
  fontFamily: "var(--font-sans)",
  fontSize: 14,
  cursor: "pointer",
};

const openBtn: CSSProperties = {
  ...ctaBase,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: `color-mix(in srgb, ${CREAM} 40%, transparent)`,
  background: `color-mix(in srgb, ${NIGHT} 40%, transparent)`,
  color: CREAM,
  fontWeight: 650,
};

/** Right-edge index rail: how many acharyas the flick-up gesture has left. */
const panelRail: CSSProperties = {
  position: "absolute",
  right: 7,
  top: "50%",
  transform: "translateY(-50%)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 5,
  pointerEvents: "none",
};

const panelRailDot: CSSProperties = {
  width: 3,
  borderRadius: 999,
  background: CREAM,
  transition: "height 180ms ease, opacity 180ms ease",
};

const emptyWrap: CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
};

const emptyText: CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontStyle: "italic",
  fontSize: 18,
  color: "var(--ink-soft)",
  margin: 0,
};
