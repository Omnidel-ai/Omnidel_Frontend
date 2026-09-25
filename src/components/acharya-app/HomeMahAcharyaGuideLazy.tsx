"use client";

import dynamic from "next/dynamic";

/**
 * Code-split the MahAcharya guide chrome away from the initial (app) layout
 * chunk. VoiceSessionProvider still mounts immediately (required for session
 * survival); this only defers the guide UI module parse.
 *
 * ssr:true keeps first paint of the home guide label without remounting voice.
 */
export const HomeMahAcharyaGuideLazy = dynamic(
  () =>
    import("@/components/HomeMahAcharyaGuide").then((m) => ({
      default: m.HomeMahAcharyaGuide,
    })),
  { ssr: true },
);
