import { normalizeLang, type Lang } from "@/acharya/lib/i18n/registry";

/** Normalize profile / API language codes to a supported client UI lang. */
export function normalizeClientLang(code?: string | null): Lang {
  return normalizeLang(code);
}
