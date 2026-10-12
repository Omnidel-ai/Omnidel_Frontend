/**
 * Guide portraits.
 *
 * Supabase `acharya-avatars` is a public bucket, so those load anywhere.
 *
 * MahAcharya'ji, Dr Swapan, Lakshman and Soumyajit are stored in a private
 * Vercel Blob store and served through the app's `/api/acharyas/avatar-blob`
 * proxy, which on the PR #207 preview sits behind Vercel SSO — a page on
 * another origin cannot load them. Until local copies are added under
 * `public/acharya/portraits/`, those guides have no URL here and the screens
 * show their own no-photo state, exactly as production does for a guide
 * without a portrait. To add one: put the file in that folder and set e.g.
 * `mahacharya: "/acharya/portraits/mahacharya.png"`.
 */
const SUPABASE = "https://diwyeuthiiuzhfnzelab.supabase.co/storage/v1/object/public/acharya-avatars";

export const PORTRAITS: Record<string, string> = {
  neeranjan: `${SUPABASE}/3592e535-954b-4809-9e8b-3d10909cec5f/avatar-1782198824835.png`,
  subhas: `${SUPABASE}/fb4e4c08-2b09-4bf2-ab78-7e8c98113a6f/avatar-1782198764954.png`,
  vivek: `${SUPABASE}/710e08ef-298d-4181-9997-67598df78b8a/avatar-1782198476613.png`,
};

/** MahAcharya'ji's wider studio shot (home card, sign-in hero), when available. */
export const MAHACHARYA_STUDIO: string | null = null;
