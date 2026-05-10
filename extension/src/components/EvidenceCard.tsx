import type { CitationStyle, EvidenceCard as EvidenceCardType } from "../../../shared/types";
import { citationForStyle } from "../utils/citation";

interface Props {
  card: EvidenceCardType;
  citationStyle: CitationStyle;
  onCopy: (citation: string) => void;
  onInsert: (citation: string) => void;
}

export function EvidenceCard({ card, citationStyle, onCopy, onInsert }: Props) {
  const selectedCitation = citationForStyle(card, citationStyle);
  const tierClass = card.sourceTier === "high" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : card.sourceTier === "medium" ? "bg-amber-50 text-amber-700 ring-amber-200" : "bg-slate-100 text-slate-700 ring-slate-200";

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold leading-5 text-slate-950">{card.title}</h3>
          <p className="mt-1 text-xs text-slate-600">{card.authors.join(", ") || "Unknown author"}{card.year ? ` · ${card.year}` : ""}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1 ${tierClass}`}>{card.sourceTier}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-medium text-slate-600">
        <span className="rounded-full bg-slate-100 px-2 py-1">{card.sourceType}</span>
        {card.year ? <span className="rounded-full bg-slate-100 px-2 py-1">Year: {card.year}</span> : null}
        {card.ageBucket ? <span className="rounded-full bg-slate-100 px-2 py-1">{card.ageBucket}</span> : null}
        {card.doi ? <span className="rounded-full bg-slate-100 px-2 py-1">DOI</span> : null}
      </div>
      <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm leading-5 text-slate-700">{card.snippet}</p>
      <p className="mt-3 text-xs leading-5 text-slate-600"><span className="font-semibold text-slate-800">Why this fits:</span> {card.relevanceExplanation}</p>
      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700">
        <p className="font-semibold text-slate-900">{citationStyle} citation</p>
        <p className="mt-1">{selectedCitation}</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800" onClick={() => onCopy(selectedCitation)}>Copy citation</button>
        <button className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50" onClick={() => onInsert(selectedCitation)}>Insert citation</button>
        {card.url ? <button className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50" onClick={() => window.open(card.url, "_blank", "noopener,noreferrer")}>Open source</button> : null}
      </div>
    </article>
  );
}
