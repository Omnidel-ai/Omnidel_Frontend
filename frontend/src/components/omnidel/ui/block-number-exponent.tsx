"use client";

import { useEffect } from "react";

/**
 * `<input type="number">` allows `e` / `E` for scientific notation (e.g. 1e10).
 * That shows up as a lone "e" in fields like Rough Area. Block those keys (and
 * paste/beforeinput) on every number input in the dashboard.
 */
export function BlockNumberExponent() {
  useEffect(() => {
    function isNumberInput(target: EventTarget | null): target is HTMLInputElement {
      return target instanceof HTMLInputElement && target.type === "number";
    }

    function onKeyDown(e: KeyboardEvent) {
      if (!isNumberInput(e.target)) return;
      if (e.key === "e" || e.key === "E") e.preventDefault();
    }

    function onPaste(e: ClipboardEvent) {
      if (!isNumberInput(e.target)) return;
      const text = e.clipboardData?.getData("text") ?? "";
      if (/[eE]/.test(text)) e.preventDefault();
    }

    function onBeforeInput(e: InputEvent) {
      if (!isNumberInput(e.target)) return;
      if (e.data && /[eE]/.test(e.data)) e.preventDefault();
    }

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("paste", onPaste, true);
    document.addEventListener("beforeinput", onBeforeInput as EventListener, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("paste", onPaste, true);
      document.removeEventListener("beforeinput", onBeforeInput as EventListener, true);
    };
  }, []);

  return null;
}
