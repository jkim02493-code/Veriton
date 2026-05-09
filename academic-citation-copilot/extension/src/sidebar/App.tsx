import { useEffect, useState } from "react";
import type { CitationStyle, EvidenceCard as EvidenceCardType } from "../../../shared/types";
import { EvidenceCard } from "../components/EvidenceCard";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { ToastStack } from "../components/ToastStack";
import { useToasts } from "../hooks/useToasts";
import { findEvidence, getHealth } from "../services/api";
import type { SelectionChangedMessage } from "../types/messages";

interface Props {
  initialSelectedText: string;
  onInsertCitation: (citation: string) => Promise<boolean>;
}

export function App({ initialSelectedText, onInsertCitation }: Props) {
  const [selectedText, setSelectedText] = useState(initialSelectedText);
  const [citationStyle, setCitationStyle] = useState<CitationStyle>("APA");
  const [cards, setCards] = useState<EvidenceCardType[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toasts, showToast } = useToasts();

  useEffect(() => {
    getHealth().catch((technicalError: unknown) => {
      console.warn("Backend health check failed", technicalError);
      showToast("Backend is not reachable yet. Start FastAPI before searching.", "error");
    });
  }, [showToast]);

  useEffect(() => {
    const listener = (event: Event) => {
      const customEvent = event as CustomEvent<SelectionChangedMessage>;
      if (customEvent.detail.type === "SELECTION_CHANGED") {
        setSelectedText(customEvent.detail.text);
      }
    };
    window.addEventListener("acc-selection-changed", listener);
    return () => window.removeEventListener("acc-selection-changed", listener);
  }, []);

  async function handleFindEvidence() {
    if (!selectedText.trim()) {
      showToast("Highlight a claim in Google Docs first.", "error");
      return;
    }
    setIsLoading(true);
    setError(null);
    setWarnings([]);
    try {
      const response = await findEvidence({ text: selectedText, citationStyle });
      setCards(response.cards);
      setWarnings(response.warnings);
      if (response.cards.length === 0) {
        showToast("No strong evidence found. Try rephrasing your claim.", "info");
      } else {
        showToast("Evidence ready.", "success");
      }
    } catch (technicalError) {
      console.error("Evidence request failed", technicalError);
      setError("Could not retrieve evidence. Confirm the backend is running at the configured URL and try again.");
      showToast("Evidence request failed.", "error");
    } finally {
      setIsLoading(false);
    }
  }

  async function copyCitation(citation: string) {
    await navigator.clipboard.writeText(citation);
    showToast("Citation copied.", "success");
  }

  async function insertCitation(citation: string) {
    const inserted = await onInsertCitation(citation);
    if (inserted) {
      showToast("Citation inserted.", "success");
      return;
    }
    await navigator.clipboard.writeText(citation);
    showToast("Citation copied. Paste into your document.", "info");
  }

  return (
    <div className="acc-root fixed right-4 top-20 z-[2147483646] h-[calc(100vh-6rem)] w-[420px] overflow-hidden rounded-3xl border border-slate-200 bg-slate-100/95 text-slate-950 shadow-2xl backdrop-blur">
      <ToastStack toasts={toasts} />
      <div className="flex h-full flex-col">
        <header className="border-b border-slate-200 bg-white px-5 py-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Academic Citation Copilot</p>
          <h1 className="mt-1 text-lg font-semibold text-slate-950">Find credible evidence</h1>
          <p className="mt-1 text-xs leading-5 text-slate-600">Selected Google Docs text only. No whole-document scraping.</p>
        </header>
        <main className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-900">Selected text</h2>
              <select className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800" value={citationStyle} onChange={(event) => setCitationStyle(event.target.value as CitationStyle)}>
                <option value="APA">APA</option>
                <option value="MLA">MLA</option>
              </select>
            </div>
            <p className="mt-3 max-h-28 overflow-y-auto rounded-xl bg-slate-50 p-3 text-sm leading-5 text-slate-700">{selectedText || "Highlight a claim in Google Docs, then click Find Evidence."}</p>
            <button className="mt-4 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400" onClick={handleFindEvidence} disabled={isLoading}>Find Evidence</button>
          </section>
          {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}
          {warnings.map((warning) => <div key={warning} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{warning}</div>)}
          {isLoading ? <LoadingSkeleton /> : null}
          {!isLoading && !error && cards.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600">No strong evidence found. Try rephrasing your claim.</div> : null}
          {!isLoading && cards.length > 0 ? <section className="space-y-4">{cards.map((card) => <EvidenceCard key={card.id} card={card} citationStyle={citationStyle} onCopy={copyCitation} onInsert={insertCitation} />)}</section> : null}
        </main>
      </div>
    </div>
  );
}
