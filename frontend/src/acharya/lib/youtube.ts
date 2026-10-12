/** Shared YouTube URL helpers (safe for client + server). */

export function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      return u.pathname.slice(1).split("/")[0] || null;
    }
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;
      const embed = u.pathname.match(/^\/embed\/([^/?]+)/);
      if (embed) return embed[1];
      const shorts = u.pathname.match(/^\/shorts\/([^/?]+)/);
      if (shorts) return shorts[1];
    }
  } catch {
    return null;
  }
  return null;
}

export function isYouTubeWatchUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (!host.includes("youtube.com") && !host.includes("youtu.be")) return false;
    if (url.includes("/results") || url.includes("/playlist")) return false;
    return Boolean(extractYouTubeId(url));
  } catch {
    return false;
  }
}

/** Canonical watch URL for opening in YouTube app / browser. */
export function normalizeYouTubeWatchUrl(url: string): string | null {
  const id = extractYouTubeId(url);
  if (!id) return null;
  return `https://www.youtube.com/watch?v=${id}`;
}

export function youtubeThumbnailUrl(videoId: string, quality: "default" | "mqdefault" | "hqdefault" = "mqdefault"): string {
  return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
}
