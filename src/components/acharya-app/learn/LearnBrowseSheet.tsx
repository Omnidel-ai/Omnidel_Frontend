"use client";

import { LearnFullscreenSheet } from "@/components/learn/LearnFullscreenSheet";
import { LearnSectionHeader } from "@/components/learn/LearnPanelShell";
import {
  learnCardGrid,
  ResourceCardView,
  ToolCardView,
  type ResourceCard,
  type ToolCard,
} from "@/components/learn/learn-resource-cards";

export interface LearnBrowseData {
  briefing: string;
  guides: ResourceCard[];
  tools: ToolCard[];
  references: ResourceCard[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  activeChip: string;
  activeQuery: string;
  googleSearchUrl?: string;
  data: LearnBrowseData;
  onPreviewLink?: (url: string, title: string) => void;
}

export function LearnBrowseSheet({
  open,
  onClose,
  activeChip,
  activeQuery,
  googleSearchUrl,
  data,
  onPreviewLink,
}: Props) {
  const hasContent = data.guides.length > 0 || data.tools.length > 0 || data.references.length > 0;

  return (
    <LearnFullscreenSheet
      open={open}
      title="Browse resources"
      subtitle={`${activeChip} · “${activeQuery}”`}
      onClose={onClose}
    >
      <p
        style={{
          fontFamily: "var(--serif)",
          fontSize: 15,
          lineHeight: 1.65,
          color: "var(--ink)",
          margin: "0 0 16px",
        }}
      >
        {data.briefing || "Curated guides and tools for this task."}
      </p>

      {data.guides.length > 0 ? (
        <section style={{ marginBottom: 20 }}>
          <LearnSectionHeader label="Suggested picks" subtitle="Guides and tutorials" />
          <div style={learnCardGrid}>
            {data.guides.map((item, i) => (
              <ResourceCardView
                key={`${item.link}-${i}`}
                item={item}
                onPreview={onPreviewLink ? (card) => onPreviewLink(card.link, card.title) : undefined}
              />
            ))}
          </div>
        </section>
      ) : null}

      {data.tools.length > 0 ? (
        <section style={{ marginBottom: 20 }}>
          <LearnSectionHeader label="Tools & APIs" subtitle="What you may need for this task" />
          <div style={learnCardGrid}>
            {data.tools.map((tool, i) => (
              <ToolCardView
                key={`${tool.name}-${i}`}
                tool={tool}
                onPreview={onPreviewLink ? (url, title) => onPreviewLink(url, title) : undefined}
              />
            ))}
          </div>
        </section>
      ) : null}

      {data.references.length > 0 ? (
        <section style={{ marginBottom: 8 }}>
          <LearnSectionHeader label="More references" subtitle="Extra reading and examples" />
          <div style={learnCardGrid}>
            {data.references.map((item, i) => (
              <ResourceCardView
                key={`${item.link}-${i}`}
                item={item}
                onPreview={onPreviewLink ? (card) => onPreviewLink(card.link, card.title) : undefined}
              />
            ))}
          </div>
        </section>
      ) : null}

      {!hasContent ? (
        <p style={{ fontSize: 13, color: "var(--ink-mute)", marginTop: 8, textAlign: "center" }}>
          No picks loaded yet. Try another chip or search on Google.
        </p>
      ) : null}

      {googleSearchUrl ? (
        <p style={{ fontSize: 11, color: "var(--ink-faint)", margin: "16px 0 0", textAlign: "center" }}>
          Need more?{" "}
          <a href={googleSearchUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--green-deep)", fontWeight: 700 }}>
            Search on Google ↗
          </a>
        </p>
      ) : null}
    </LearnFullscreenSheet>
  );
}
