import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

/**
 * What every test file gets before it runs.
 *
 * `cleanup` unmounts whatever a test rendered. Without it the previous test's
 * markup is still in the document and a query like "find the Cancel button"
 * finds two, which fails for a reason that has nothing to do with the code.
 */
afterEach(() => {
  cleanup();
});

/**
 * jsdom implements no layout and no media, so a few browser APIs the
 * components legitimately use are simply absent. Each stub below is here
 * because a component calls it, not for tidiness.
 */

// `URL.createObjectURL` — the demo upload path shows a picked file from one.
if (!URL.createObjectURL) {
  URL.createObjectURL = vi.fn(() => "blob:test/preview");
  URL.revokeObjectURL = vi.fn();
}

// `matchMedia` — `useIsMobile` asks for the viewport width.
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

// `scrollIntoView` — menus and pickers move the focused option into view.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}
