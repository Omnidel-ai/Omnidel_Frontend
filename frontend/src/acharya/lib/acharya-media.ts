import type { Lang } from "@/acharya/lib/store";
import { t } from "@/acharya/lib/i18n/strings";

export interface AcharyaMediaSource {
  slug: string;
  displayName: string;
  personaSummary: string | null;
  avatarUrl: string | null;
}

export interface AcharyaStoryMedia {
  acharyaSlug: string;
  title: string;
  posterUrl: string;
  portraitUrl: string;
  durationSeconds: 15;
  source: "generated_from_omnidel_portrait";
  frameCaptions: [string, string, string, string];
}

/**
 * Build a 15s story reel for an Acharya.
 * Titles/captions use the karigar's UI language (en/hi/bn) via strings.ts —
 * never hardcode English-only copy for home UI.
 */
export function getAcharyaStoryMedia(
  acharya: AcharyaMediaSource,
  lang: Lang = "en",
): AcharyaStoryMedia | null {
  if (!acharya.avatarUrl) return null;

  const s = t(lang);
  const title = s.storyTitleFor(acharya.displayName);
  const frameCaptions = s.storyFrameCaptionsFor(
    acharya.displayName,
    acharya.personaSummary,
  );

  return {
    acharyaSlug: acharya.slug,
    title,
    posterUrl: acharya.avatarUrl,
    portraitUrl: acharya.avatarUrl,
    durationSeconds: 15,
    source: "generated_from_omnidel_portrait",
    frameCaptions,
  };
}
