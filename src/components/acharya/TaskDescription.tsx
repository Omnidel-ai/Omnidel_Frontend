"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { resolveTaskDescription, type TaskLang } from "@/lib/task-text";

/**
 * Task-description renderer.
 *
 * Most descriptions are plain text, so we ONLY invoke the markdown renderer
 * when the text actually contains markdown syntax. That keeps the plain-text
 * path byte-for-byte identical to before (whitespace-pre-line preserves the
 * author's line breaks; no reflow), and only the rare markdown description
 * (e.g. a planning note pasted from OmniDel) gets formatted instead of showing
 * literal `##` / `**` / backticks.
 */
const MD_HINT =
  /(^|\n)\s{0,3}#{1,6}\s|\*\*[^*\n]+\*\*|(^|\n)\s*[-*+]\s+|(^|\n)\s*\d+\.\s+|`[^`\n]+`|\[[^\]\n]+\]\([^)\n]+\)|(^|\n)\s*>\s/;

export function looksLikeMarkdown(s: string): boolean {
  return MD_HINT.test(s);
}

export function TaskDescription({ text, lang = "bn" }: { text: string; lang?: TaskLang }) {
  // Description-specific resolve: keeps the paragraphs / bullets / line breaks
  // the manager typed in OmniDel. Rich text authored there arrives as a
  // ProseMirror doc, which used to be flattened into one run-on paragraph.
  const resolved = resolveTaskDescription(text, lang);
  if (!resolved.trim()) return null;

  // Plain text — unchanged from the original rendering.
  if (!looksLikeMarkdown(resolved)) {
    return (
      <p
        className="text-[14.5px] leading-relaxed whitespace-pre-line break-words mb-6"
        style={{ color: "var(--ink-soft)" }}
      >
        {resolved}
      </p>
    );
  }

  // Markdown — render a readable, lightly-styled subset matching the app's
  // type scale and palette.
  return (
    <div
      className="text-[14.5px] leading-relaxed break-words mb-6"
      style={{ color: "var(--ink-soft)" }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (p) => <h2 className="text-[16px] font-semibold mt-3 mb-1.5 first:mt-0" style={{ color: "var(--ink)" }} {...p} />,
          h2: (p) => <h2 className="text-[15px] font-semibold mt-3 mb-1.5 first:mt-0" style={{ color: "var(--ink)" }} {...p} />,
          h3: (p) => <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.08em] mt-3 mb-1 first:mt-0" style={{ color: "var(--ink-mute)" }} {...p} />,
          p: (p) => <p className="mb-2 last:mb-0" {...p} />,
          strong: (p) => <strong className="font-semibold" style={{ color: "var(--ink)" }} {...p} />,
          em: (p) => <em {...p} />,
          ul: (p) => <ul className="list-disc pl-5 mb-2 space-y-1" {...p} />,
          ol: (p) => <ol className="list-decimal pl-5 mb-2 space-y-1" {...p} />,
          li: (p) => <li className="leading-relaxed" {...p} />,
          a: ({ href, children, ...rest }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 break-all"
              style={{ color: "var(--ink)" }}
              {...rest}
            >
              {children}
            </a>
          ),
          code: ({ className, children, ...rest }) => {
            const isBlock = /\blanguage-/.test(className || "");
            return isBlock ? (
              <pre
                className="rounded-md p-2.5 my-2 overflow-x-auto text-[12.5px]"
                style={{ background: "var(--surface-sunk)" }}
              >
                <code className="font-mono" {...rest}>{children}</code>
              </pre>
            ) : (
              <code
                className="font-mono text-[12.5px] px-1 py-0.5 rounded"
                style={{ background: "var(--surface-sunk)", color: "var(--ink)" }}
                {...rest}
              >
                {children}
              </code>
            );
          },
          blockquote: (p) => (
            <blockquote
              className="border-l-2 pl-3 my-2 italic"
              style={{ borderColor: "var(--rule)", color: "var(--ink-mute)" }}
              {...p}
            />
          ),
          hr: () => <hr className="my-3" style={{ borderColor: "var(--rule)" }} />,
        }}
      >
        {resolved}
      </ReactMarkdown>
    </div>
  );
}
