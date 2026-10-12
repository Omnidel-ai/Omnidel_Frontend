/**
 * Pacing for the live caption — the acharya's words revealed at the speed they
 * are actually SPOKEN.
 *
 * Gemini streams the output transcript as it GENERATES, several times faster
 * than the audio takes to play, and the audio is queued on a contiguous Web
 * Audio timeline. So setting the caption straight from the transcript ran the
 * whole sentence out on screen and then left the karigar listening to it arrive
 * — "the captions are fast but voice comes after that". The same gap clipped the
 * other end: `turnComplete` fires when GENERATION finishes, so clearing the
 * caption there wiped the words while they were still being said.
 *
 * Reveal is paced off the playback timeline instead: the fraction of the audio
 * received so far that has actually been heard is the fraction of the words
 * received so far that we show. Cumulative ratios, not per-chunk timestamps, on
 * purpose — a transcript delta can lead or trail its audio by a message, and
 * pairing the two would inherit that jitter, while both streams come off the
 * same generation and so keep step in the aggregate.
 *
 * Deliberately free of React, Web Audio and the DOM: the caller owns the socket,
 * the AudioContext and the ticker, and hands this the two clocks. That is what
 * makes it testable without a browser — see `scripts/verify-caption-pace.ts`.
 */

/**
 * Caption pacing cadence. The tick is fast enough that a word lands within a
 * frame or two of being spoken and slow enough that it is not a render per
 * audio chunk; the hold keeps the closing words readable for a beat after the
 * voice stops instead of blanking on the last syllable.
 */
export const CAPTION_TICK_MS = 120;
export const CAPTION_HOLD_MS = 900;
/**
 * How long a run's first words wait for its first audio chunk before giving up
 * and showing themselves. A transcript delta can arrive a message ahead of the
 * audio it describes, and with nothing on the timeline yet there is nothing to
 * pace against — but a turn whose audio never comes at all (text-only, or a
 * context the browser never unlocked) must not hold its words for ever.
 */
export const CAPTION_AUDIO_GRACE_MS = 700;

/** Playback timeline slack, in seconds, that still counts as "all heard". */
const DRAINED_EPSILON = 0.02;

/**
 * How long a PCM24k chunk will take to say, WITHOUT decoding it.
 *
 * Pacing needs every chunk's length the moment it arrives, on the
 * message-handling path — decoding there would put a base64 pass over the whole
 * turn's audio in front of the socket for a number we only compare. Base64 is 4
 * chars per 3 bytes, PCM16 mono is 2 bytes per sample, 24000 samples/second.
 */
export function pcm24kSeconds(b64: string): number {
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  const bytes = Math.max(0, (b64.length * 3) / 4 - padding);
  return bytes / 2 / 24000;
}

/** What one tick wants done. `text` absent = nothing changed on screen. */
export type CaptionTick = {
  /** New caption text, when it differs from what was last returned. */
  text?: string;
  /** The run is over and the pacer has reset — the caller may stop ticking. */
  idle?: boolean;
};

export type CaptionPacer = {
  /** Take an output-transcript delta. `nowMs` is wall clock (Date.now()). */
  pushWords: (text: string, nowMs: number) => void;
  /**
   * Put an audio chunk on the timeline.
   *
   * `audioNow` is elapsed source audio consumed by the player, excluding
   * prebuffer and starvation silence. Read it when admitting each chunk, and
   * use the same clock for tick(). Reset both clocks together on interruption.
   */
  pushAudio: (seconds: number, audioNow: number) => void;
  /** Server said turnComplete: generation is done, the voice is not. */
  markTurnDone: () => void;
  /**
   * Advance the reveal. `audioNow` is the player's consumed-source clock, or
   * null when no player exists. `nowMs` is wall clock.
   */
  tick: (audioNow: number | null, nowMs: number) => CaptionTick;
  /** Drop everything — barge-in, remint, teardown. */
  reset: () => void;
  /** Words currently on screen. Diagnostics and tests. */
  shown: () => string;
};

export function createCaptionPacer(): CaptionPacer {
  /** Words of the current spoken run, in order. */
  let words: string[] = [];
  /** Characters up to and including each word — a better stand-in for how long
   *  a word takes to say than counting words. */
  let cum: number[] = [];
  /** How many words are on screen. */
  let shown = 0;
  /** Seconds of audio received for this run. */
  let received = 0;
  /** Projected end of the playback timeline. */
  let timelineEnd = 0;
  /** Server said turnComplete — drain what is left, hold, then clear. */
  let turnDone = false;
  /** Wall clock after which a drained run's caption may leave the screen. */
  let holdUntil = 0;
  /** Wall clock when this run's first word was queued. */
  let openedAt = 0;

  function reset() {
    words = [];
    cum = [];
    shown = 0;
    received = 0;
    timelineEnd = 0;
    turnDone = false;
    holdUntil = 0;
    openedAt = 0;
  }

  /** Content arriving after a turnComplete continues the SAME run: a tool call
   *  ends a turn mid-answer and the acharya keeps talking onto the same playback
   *  timeline. A genuinely new run starts from a reset pacer. */
  function resumeRun() {
    turnDone = false;
    holdUntil = 0;
  }

  return {
    pushWords(text, nowMs) {
      resumeRun();
      if (!openedAt) openedAt = nowMs;
      for (const word of text.trim().split(/\s+/)) {
        if (!word) continue;
        words.push(word);
        cum.push((cum[cum.length - 1] || 0) + word.length + 1);
      }
    },

    pushAudio(seconds, audioNow) {
      resumeRun();
      received += seconds;
      timelineEnd = Math.max(audioNow, timelineEnd) + seconds;
    },

    markTurnDone() {
      turnDone = true;
    },

    tick(audioNow, nowMs) {
      // Seconds of this run still to be heard. Zero when there is no audio to
      // pace against at all — never hold words back for a voice that is not
      // coming.
      const remaining =
        audioNow !== null && received > 0 ? Math.max(0, timelineEnd - audioNow) : 0;
      const drained = remaining <= DRAINED_EPSILON;
      // This run's audio has not started. Give it a moment — the words for a
      // chunk can arrive a message before the chunk — then stop waiting.
      const waitingForAudio =
        received <= 0 && !turnDone && nowMs - openedAt < CAPTION_AUDIO_GRACE_MS;

      let target = shown;
      if (waitingForAudio) {
        // hold
      } else if (audioNow === null || received <= 0 || drained) {
        target = words.length;
      } else {
        const chars = cum[cum.length - 1] || 0;
        const spoken = chars * ((received - remaining) / received);
        // A word appears once its FIRST character is due, so the caption reads a
        // beat ahead of the ear rather than a beat behind it.
        while (target < words.length && (target === 0 ? 0 : cum[target - 1]) <= spoken) target++;
      }

      const out: CaptionTick = {};
      if (target !== shown) {
        shown = target;
        out.text = words.slice(0, target).join(" ");
      }

      if (!turnDone || !drained || target < words.length) {
        holdUntil = 0;
        return out;
      }
      // Everything said has been heard. Hold it a beat so the closing words are
      // readable, then the caption goes with the turn.
      if (!holdUntil) holdUntil = nowMs + CAPTION_HOLD_MS;
      if (nowMs >= holdUntil) {
        reset();
        out.text = "";
        out.idle = true;
      }
      return out;
    },

    reset,

    shown() {
      return words.slice(0, shown).join(" ");
    },
  };
}
