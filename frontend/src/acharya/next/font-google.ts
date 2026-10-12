/**
 * `next/font/google` for the Vite build.
 *
 * Next self-hosts the font and hands back class names; here the font comes
 * from the Google Fonts CSS API, and the returned `variable` class defines the
 * same CSS custom property (`--font-fraunces`, …) the Acharya stylesheet
 * reads. `className` sets the family directly, as in Next.
 */
interface FontOptions {
  subsets?: string[];
  weight?: string | string[];
  style?: string | string[];
  variable?: string;
  display?: string;
  preload?: boolean;
}

export interface NextFont {
  className: string;
  variable: string;
  style: { fontFamily: string };
}

function inject(id: string, build: () => HTMLElement) {
  if (typeof document === "undefined" || document.getElementById(id)) return;
  const el = build();
  el.id = id;
  document.head.appendChild(el);
}

function font(family: string, fallback: string) {
  return (opts: FontOptions = {}): NextFont => {
    const slug = family.toLowerCase().replace(/\s+/g, "-");
    const weights = (Array.isArray(opts.weight) ? opts.weight : [opts.weight ?? "400"]).join(";");
    const italic = (Array.isArray(opts.style) ? opts.style : [opts.style ?? "normal"]).includes("italic");
    const axis = italic
      ? `ital,wght@${weights.split(";").map((w) => `0,${w}`).join(";")};${weights.split(";").map((w) => `1,${w}`).join(";")}`
      : `wght@${weights}`;
    const stack = `'${family}', ${fallback}`;

    inject(`font-${slug}`, () => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:${axis}&display=${opts.display ?? "swap"}`;
      return link;
    });

    const variableClass = `__font-var-${slug}`;
    const familyClass = `__font-${slug}`;
    inject(`font-css-${slug}`, () => {
      const style = document.createElement("style");
      style.textContent =
        (opts.variable ? `.${variableClass}{${opts.variable}:${stack};}` : "") +
        `.${familyClass}{font-family:${stack};}`;
      return style;
    });

    return { className: familyClass, variable: variableClass, style: { fontFamily: stack } };
  };
}

export const Fraunces = font("Fraunces", "Georgia, serif");
export const Inter_Tight = font("Inter Tight", "system-ui, sans-serif");
export const JetBrains_Mono = font("JetBrains Mono", "ui-monospace, monospace");
export const Hind = font("Hind", "system-ui, sans-serif");
export const Hind_Siliguri = font("Hind Siliguri", "system-ui, sans-serif");
export const Hind_Guntur = font("Hind Guntur", "system-ui, sans-serif");
export const Noto_Sans_Ethiopic = font("Noto Sans Ethiopic", "system-ui, sans-serif");
