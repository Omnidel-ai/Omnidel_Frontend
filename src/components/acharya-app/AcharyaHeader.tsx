"use client";

/**
 * Persistent header band reused across the acharya board, task detail, and
 * learn screens — only text/variant changes between them. Matches the
 * folio design system: CSS-variable tokens, Fraunces italic titles, mono
 * eyebrows, solid pill chips.
 */

import type { CSSProperties, ReactNode } from "react";
import AcharyaAvatar from "@/components/acharya-avatar";
import AcharyaPortrait from "@/components/AcharyaPortrait";
import TavusVideoTile from "@/components/voice/TavusVideoTile";
import { useAcharyaHeaderMorph } from "@/components/AcharyaHeaderMorph";
import { useInstantNav } from "@/components/instant-nav";
import {
  canRenderAcharyaAvatarUrl,
  toKarigarAvatarUrl,
} from "@/lib/acharya-avatar-url";

// Font tokens match the app convention (--serif/--mono/--sans, as used by
// task-card / TasksPageClient / learn screens) so this header renders
// consistently alongside them. (The canonical --font-* tokens exist in
// globals.css; reconciling the short aliases is a separate follow-up.)

export type ChipTone = "doing" | "planned" | "done" | "muted";

export interface AcharyaHeaderChip {
  label: string;
  tone: ChipTone;
}

export interface AcharyaHeaderProps {
  name: string;
  slug?: string;
  avatarUrl?: string | null;
  /** Primary avatar + extras; cross-faded while `live`. Falls back to avatarUrl. */
  portraits?: string[];
  /** Voice session is live — animate the portrait. */
  live?: boolean;
  /**
   * Live Tavus video track. When set, the hero band shows the REAL acharya
   * talking instead of `AcharyaPortrait` — which has described itself as a
   * "placeholder until a real lip-sync video exists" since it was written. The
   * band, its edge-to-edge crop and the `live` trigger are all unchanged; only
   * what fills the frame differs, so every other acharya is untouched.
   */
  videoTrack?: MediaStreamTrack | null;
  initial?: string;
  variant: "board" | "task" | "learn";
  eyebrow?: string;
  description?: string | null;
  contextLine?: string;
  chips?: AcharyaHeaderChip[];
  onBack?: () => void;
  trailing?: ReactNode;
}

// Solid pill fills — cream text (#f4efdf) is the one tolerated hex per the
// folio system's primary-button convention (tone backgrounds are all vars).
const CHIP_TONE_STYLE: Record<ChipTone, CSSProperties> = {
  doing: { background: "var(--ochre)", color: "#f4efdf" },
  planned: { background: "var(--color-status-todo)", color: "#f4efdf" },
  done: { background: "var(--green)", color: "#f4efdf" },
  muted: { background: "var(--ink-mute)", color: "var(--surface)" },
};

function BackIcon({ size = 13 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}

/**
 * Where the face sits in each box. The landscape band has to bias upward (these
 * portraits are head-and-shoulders, so a centred crop slices the face); the
 * square avatar is already mostly face, so it stays centred. Named here because
 * the morph animates BETWEEN them — a ghost that lands on a different crop than
 * the real avatar reads as a jump at the end of the flight.
 */
const HERO_CROP = "center 20%";
const AVATAR_CROP = "center 50%";

// ── Board hero (portrait band + a solid strip of type under it) ─────────────

const heroHeader: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 30,
  background: "var(--ink)",
  flexShrink: 0,
};

/**
 * The portrait band, and NOTHING else — the name, persona and chips moved to
 * their own strip underneath (see `heroInfoBand`).
 *
 * It used to be 16:9 at 220px with the type on a black gradient across the
 * bottom half, which is the same mistake the home feature card already fixed:
 * the words need a fixed ~90px whatever the photo is, so on a phone they covered
 * the chin and the acharya was never actually visible. 4:3 now, so the frame is
 * TALLER while every pixel of it shows the photograph.
 *
 * The cap is `min(px, dvh)` rather than a flat number because this header shares
 * a fixed-height shell with the board's tabs and cards: a 252px photo is right on
 * a 850px phone and half the screen on a 640px one, and the board still has to
 * show its Planned/Doing/Review/Done tabs without scrolling.
 */
const heroFrame: CSSProperties = {
  position: "relative",
  width: "100%",
  aspectRatio: "4 / 3",
  maxHeight: "min(252px, 32dvh)",
  minHeight: 150,
  overflow: "hidden",
  background: "var(--ink)",
};

const heroImageFrame: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  borderRadius: 0,
  borderWidth: 0,
  background: "var(--ink)",
};

/**
 * Top-down only, and light: with no type on the photo the sole job left is
 * keeping the white back chevron legible against a pale turban. The old
 * bottom-up scrim was 90% black over the lower half of the frame — it existed
 * for text that is not there any more, and it was covering the face.
 */
const heroScrim: CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: 96,
  pointerEvents: "none",
  background:
    "linear-gradient(to bottom, rgba(0,0,0,0.44) 0%, rgba(0,0,0,0.16) 46%, rgba(0,0,0,0) 100%)",
};

const heroBackBtn: CSSProperties = {
  position: "absolute",
  top: 10,
  left: 10,
  zIndex: 5,
  width: 40,
  height: 40,
  borderRadius: 999,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,0.34)",
  background: "rgba(0,0,0,0.46)",
  color: "#fff",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  padding: 0,
  WebkitTapHighlightColor: "transparent",
  touchAction: "manipulation",
};

/**
 * The words, on their own ground under the photo. Same surface as the chat row
 * below it, so the two read as one block of chrome rather than a card floating
 * on a face. Kept tight: every pixel here is a pixel the board's tabs lose.
 */
const heroInfoBand: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  padding: "9px 16px 11px",
  background: "var(--surface)",
  borderBottomWidth: 1,
  borderBottomStyle: "solid",
  borderBottomColor: "var(--rule)",
  minWidth: 0,
};

const heroBody: CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const heroEyebrow: CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 10,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--ink-mute)",
  margin: 0,
};

const heroTitle: CSSProperties = {
  fontFamily: "var(--serif)",
  fontStyle: "italic",
  fontSize: 24,
  fontWeight: 500,
  color: "var(--ink)",
  margin: "1px 0 0",
  lineHeight: 1.14,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const heroSubline: CSSProperties = {
  fontFamily: "var(--sans)",
  fontSize: 12.5,
  color: "var(--ink-soft)",
  lineHeight: 1.4,
  margin: "4px 0 0",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

const heroTrailing: CSSProperties = {
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
};

function ChipRow({ chips }: { chips: AcharyaHeaderChip[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
      {chips.map((chip, i) => (
        <span
          key={`${chip.label}-${i}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            fontFamily: "var(--mono)",
            fontSize: 10,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontWeight: 600,
            padding: "3px 9px",
            borderRadius: 999,
            ...CHIP_TONE_STYLE[chip.tone],
          }}
        >
          {chip.label}
        </span>
      ))}
    </div>
  );
}

export default function AcharyaHeader({
  name,
  slug,
  avatarUrl,
  portraits,
  live = false,
  videoTrack = null,
  initial,
  variant,
  eyebrow,
  description,
  contextLine,
  chips,
  onBack,
  trailing,
}: AcharyaHeaderProps) {
  const isBoard = variant === "board";
  /**
   * The big portrait band: ANY screen while the mic is live, and only then.
   * A compact row is right whenever the karigar is reading — a board of task
   * cards as much as a task itself — but a live conversation is not reading, it
   * is talking to the acharya, and the small square in the corner is not who
   * you talk to. The portrait morphs between the two sizes (see
   * AcharyaHeaderMorph), so the mic going on or off reads as one movement
   * rather than a re-layout.
   *
   * The board used to be pinned expanded (`isBoard || live`), which made the
   * hero the board's resting state and left the mic with nothing to expand
   * there. That is why the morph looked like it only worked for whichever
   * acharya you happened to open a TASK under — the behaviour was never
   * per-acharya, it was per-screen. One trigger now: `live`.
   */
  const expanded = live;
  const avatarSize = expanded ? 128 : 92;
  const subline = description?.trim() || contextLine?.trim() || "";
  /**
   * The persona line is an introduction, and a live conversation is past being
   * introduced — the karigar is talking to this acharya right now, and what the
   * acharya is SAYING is on screen a few pixels below. Dropping it while the mic
   * is open also hands its ~35px back to the portrait.
   */
  const showSubline = Boolean(subline) && !live;

  // Board hero ⇄ compact avatar: fly the portrait between the two boxes instead
  // of cutting. `pending` is the nav skeleton — the morph waits it out, or it
  // would play behind a full-screen cream panel. See AcharyaHeaderMorph.
  const { pending } = useInstantNav();
  const morphSource = toKarigarAvatarUrl(portraits?.[0] ?? avatarUrl ?? null);
  const portraitBoxRef = useAcharyaHeaderMorph({
    expanded,
    imageUrl: canRenderAcharyaAvatarUrl(morphSource) ? morphSource : null,
    // Match the resting radius each variant actually draws, so the ghost
    // lands on the real avatar's corners instead of squaring off at the end.
    radius: expanded ? 0 : isBoard ? 22 : 18,
    objectPosition: expanded ? HERO_CROP : AVATAR_CROP,
    hold: pending,
  });

  // Board = the acharya's own screen, so it gets the same treatment as the home
  // feature card, now including the part that matters: portrait edge to edge in
  // its own band, name and persona in a solid strip UNDER it, never over the
  // face. The nested task / learn variants keep the compact row — they belong to
  // a task, and a 250px photo above it would push the work off screen — until
  // the mic opens, when the conversation is the screen and the photo earns it.
  if (expanded) {
    return (
      <header className="pt-safe" style={heroHeader}>
        <div ref={portraitBoxRef} style={heroFrame}>
          {videoTrack ? (
            <TavusVideoTile track={videoTrack} objectPosition={HERO_CROP} />
          ) : portraits && portraits.length > 0 ? (
            <AcharyaPortrait
              slug={slug}
              name={name}
              portraits={portraits}
              initial={initial}
              live={live}
              fill
              size={avatarSize}
              radius={0}
              imageStyle={{
                objectPosition: HERO_CROP,
                viewTransitionName: slug ? `acharya-${slug}-portrait` : undefined,
              } as CSSProperties}
            />
          ) : (
            <AcharyaAvatar
              slug={slug}
              name={name}
              imageUrl={avatarUrl}
              initial={initial}
              size={480}
              shape="rounded"
              style={heroImageFrame}
              imageStyle={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: HERO_CROP,
                viewTransitionName: slug ? `acharya-${slug}-portrait` : undefined,
              } as CSSProperties}
              textStyle={{ fontSize: 72, color: "rgba(244,239,223,0.7)" }}
            />
          )}

          <span style={heroScrim} aria-hidden />

          {onBack ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onBack();
              }}
              aria-label="Back"
              style={heroBackBtn}
            >
              <BackIcon size={16} />
            </button>
          ) : null}
        </div>

        <div style={heroInfoBand}>
          <div style={heroBody}>
            {eyebrow && <p style={heroEyebrow}>{eyebrow}</p>}
            <h1 style={heroTitle}>{name}</h1>
            {showSubline ? <p style={heroSubline}>{subline}</p> : null}
            {chips && chips.length > 0 && <ChipRow chips={chips} />}
          </div>

          {/* Kept for callers that still pass one; the voice control itself is
              the floating dock, not a header slot. */}
          {trailing ? <div style={heroTrailing}>{trailing}</div> : null}
        </div>
      </header>
    );
  }

  return (
    <header
      className="pt-safe"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 30,
        background: "var(--ochre-wash)",
        borderBottomWidth: 1,
        borderBottomStyle: "solid",
        borderBottomColor: "var(--rule)",
        padding: isBoard ? "14px 16px 16px" : "12px 16px 12px",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isBoard
            ? `${avatarSize}px minmax(0, 1fr)`
            : `${avatarSize}px minmax(0, 1fr) auto`,
          alignItems: "center",
          gap: isBoard ? 16 : 12,
        }}
      >
        <div
          ref={portraitBoxRef}
          style={{
            position: "relative",
            width: avatarSize,
            height: avatarSize,
            flexShrink: 0,
            // Let the overlaid back control win touches in the corner.
            ...(onBack ? { isolation: "isolate" as const } : null),
          }}
        >
          <div style={onBack ? { pointerEvents: "none" } : undefined}>
          {portraits && portraits.length > 0 ? (
            <AcharyaPortrait
              slug={slug}
              name={name}
              portraits={portraits}
              initial={initial}
              size={avatarSize}
              live={live}
              radius={isBoard ? 22 : 18}
              imageStyle={{ viewTransitionName: slug ? `acharya-${slug}-portrait` : undefined } as CSSProperties}
            />
          ) : (
            <AcharyaAvatar
              slug={slug}
              name={name}
              imageUrl={avatarUrl}
              initial={initial}
              size={avatarSize}
              shape="rounded"
              style={{
                borderRadius: isBoard ? 22 : 18,
                boxShadow: "0 1px 0 color-mix(in srgb, var(--ink) 12%, transparent)",
              }}
              imageStyle={{ viewTransitionName: slug ? `acharya-${slug}-portrait` : undefined } as CSSProperties}
            />
          )}
          </div>
          {onBack ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onBack();
              }}
              aria-label="Back"
              style={{
                // Large hit target — do NOT use `.press` scale here: scaling a
                // small control under the finger cancels the click on mobile
                // (feels like needing 2–3 taps).
                position: "absolute",
                top: 0,
                left: 0,
                zIndex: 5,
                width: 48,
                height: 48,
                borderRadius: 999,
                border: "none",
                background: "transparent",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "var(--ink)",
                padding: 0,
                WebkitTapHighlightColor: "transparent",
                touchAction: "manipulation",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  background: "white",
                  boxShadow: "0 1px 4px color-mix(in srgb, var(--ink) 22%, transparent)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <BackIcon size={13} />
              </span>
            </button>
          ) : null}
        </div>

        <div
          style={{
            minWidth: 0,
            minHeight: avatarSize,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            {eyebrow && (
              <p
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "var(--ink-mute)",
                  margin: 0,
                }}
              >
                {eyebrow}
              </p>
            )}

            <h1
              style={{
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: isBoard ? 24 : 19,
                fontWeight: 500,
                color: "var(--ink)",
                margin: 0,
                lineHeight: 1.15,
                whiteSpace: isBoard ? "nowrap" : undefined,
                overflow: isBoard ? "hidden" : undefined,
                textOverflow: isBoard ? "ellipsis" : undefined,
              }}
            >
              {name}
            </h1>

            {showSubline ? (
              isBoard ? (
                <p
                  style={{
                    fontFamily: "var(--sans)",
                    fontSize: 14,
                    color: "var(--ink-soft)",
                    lineHeight: 1.45,
                    margin: 0,
                    marginTop: 6,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {subline}
                </p>
              ) : (
                <p
                  style={{
                    fontFamily: "var(--sans)",
                    fontSize: 13,
                    color: "var(--ink-soft)",
                    margin: 0,
                    marginTop: 3,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {subline}
                </p>
              )
            ) : null}

            {chips && chips.length > 0 && <ChipRow chips={chips} />}
          </div>

          {trailing && (
            <div
              style={{
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                alignSelf: "flex-end",
              }}
            >
              {trailing}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
