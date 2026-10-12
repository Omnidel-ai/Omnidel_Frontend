"use client";

import { useStore, type Lang } from "@/acharya/lib/store";
import { t } from "./strings";

export function useLang(): Lang {
  return useStore((s) => s.lang);
}

export function useStrings() {
  const lang = useLang();
  return t(lang);
}
