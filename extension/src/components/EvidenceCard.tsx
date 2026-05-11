import type { CSSProperties } from "react";
import type { CitationStyle, EvidenceCard as EvidenceCardType } from "../../../shared/types";
import { citationForStyle } from "../utils/citation";

interface Props {
  card: EvidenceCardType;
  citationStyle: CitationStyle;
  documentLanguage?: string;
  theme: "dark" | "light";
  onCopy: (citation: string) => void;
  onInsert: (citation: string) => void;
}

function sourceLanguageBadge(card: EvidenceCardType, documentLanguage?: string): string | null {
  if (!documentLanguage || documentLanguage === "en" || documentLanguage === "unknown") {
    return null;
  }
  const sourceLanguage = card.language?.toLowerCase();
  if (sourceLanguage && (sourceLanguage === documentLanguage || sourceLanguage.startsWith(`${documentLanguage}-`))) {
    return `Native source (${documentLanguage})`;
  }
  return "International source";
}

function tierStyle(tier: EvidenceCardType["sourceTier"], theme: "dark" | "light"): CSSProperties {
  if (theme === "light") {
    if (tier === "high") {
      return { background: "#f0faf5", borderColor: "#bbf7d0", color: "#166534" };
    }
    if (tier === "medium") {
      return { background: "#fffbeb", borderColor: "#fde68a", color: "#92400e" };
    }
    return { background: "#f8fafc", borderColor: "#e2e8f0", color: "#475569" };
  }
  if (tier === "high") {
    return { background: "rgba(110, 231, 183, 0.10)", borderColor: "rgba(110, 231, 183, 0.30)", color: "var(--accent)" };
  }
  if (tier === "medium") {
    return { background: "rgba(245, 158, 11, 0.10)", borderColor: "rgba(245, 158, 11, 0.30)", color: "#fbbf24" };
  }
  return { background: "rgba(100, 116, 139, 0.10)", borderColor: "rgba(100, 116, 139, 0.30)", color: "#94a3b8" };
}

export function EvidenceCard({ card, citationStyle, documentLanguage, theme, onCopy, onInsert }: Props) {
  const selectedCitation = citationForStyle(card, citationStyle);
  const languageBadge = sourceLanguageBadge(card, documentLanguage);
  const surfaceStyle = {
    background: "var(--bg-card)",
    borderColor: "var(--border)",
    boxShadow: theme === "light" ? "0 1px 3px rgba(180, 100, 40, 0.08)" : "none",
  };
  const pillStyle = {
    background: "var(--bg-input)",
    borderColor: "var(--border)",
    color: "var(--text-secondary)",
  };

  return (
    <article className="rounded-2xl border p-4 transition hover:border-[var(--accent)]" style={surfaceStyle}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-5" style={{ color: "var(--text-primary)" }}>{card.title}</h3>
          <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>{card.authors.join(", ") || "Unknown author"}{card.year ? ` - ${card.year}` : ""}</p>
        </div>
        <span className="shrink-0 rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide" style={tierStyle(card.sourceTier, theme)}>{card.sourceTier}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-medium">
        <span className="rounded-full border px-2 py-1" style={pillStyle}>{card.sourceType}</span>
        {card.year ? <span className="rounded-full border px-2 py-1" style={pillStyle}>Year: {card.year}</span> : null}
        {card.ageBucket ? <span className="rounded-full border px-2 py-1" style={pillStyle}>{card.ageBucket}</span> : null}
        {languageBadge ? <span className="rounded-full border px-2 py-1" style={pillStyle}>{languageBadge}</span> : null}
        {card.doi ? <span className="rounded-full border px-2 py-1" style={pillStyle}>DOI</span> : null}
      </div>
      <p className="mt-3 rounded-xl p-3 text-xs leading-5" style={{ background: "var(--bg-input)", color: theme === "light" ? "var(--text-primary)" : "#cbd5e1" }}>{card.snippet}</p>
      <p className="mt-3 text-xs leading-5" style={{ color: "var(--text-secondary)" }}><span className="font-semibold" style={{ color: "var(--text-secondary)" }}>Why this fits:</span> {card.relevanceExplanation}</p>
      <div className="mt-3 rounded-xl border p-3 text-xs leading-5" style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-secondary)" }}>
        <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{citationStyle} citation</p>
        <p className="mt-1" style={{ color: "var(--text-secondary)" }}>{selectedCitation}</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="rounded-lg px-3 py-2 text-xs font-semibold hover:opacity-80" style={{ background: "var(--copy-bg)", color: "var(--copy-text)" }} onClick={() => onCopy(selectedCitation)}>Copy citation</button>
        <button className="rounded-lg border px-3 py-2 text-xs font-semibold hover:border-[var(--accent)] hover:text-[var(--accent)]" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} onClick={() => onInsert(selectedCitation)}>Insert citation</button>
        {card.url ? <button className="rounded-lg border px-3 py-2 text-xs font-semibold hover:border-[var(--accent)] hover:text-[var(--accent)]" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} onClick={() => window.open(card.url, "_blank", "noopener,noreferrer")}>Open source</button> : null}
      </div>
    </article>
  );
}
