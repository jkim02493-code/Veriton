import type { CitationFormat, CitationManagerState, FormattedCitation } from "./types";

export class CitationStore {
  private state: CitationManagerState;

  constructor(format: CitationFormat) {
    this.state = {
      citations: [],
      selectedIds: [],
      format,
      lastUpdated: new Date().toISOString(),
    };
  }

  loadCitations(citations: FormattedCitation[]): void {
    this.state = {
      ...this.state,
      citations,
      selectedIds: this.state.selectedIds.filter((id) => citations.some((citation) => citation.id === id)),
      lastUpdated: new Date().toISOString(),
    };
  }

  getCitations(): FormattedCitation[] {
    return [...this.state.citations];
  }

  selectCitation(id: string): void {
    if (!this.state.selectedIds.includes(id)) {
      this.state = {
        ...this.state,
        selectedIds: [...this.state.selectedIds, id],
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  deselectCitation(id: string): void {
    this.state = {
      ...this.state,
      selectedIds: this.state.selectedIds.filter((selectedId) => selectedId !== id),
      lastUpdated: new Date().toISOString(),
    };
  }

  selectAll(): void {
    this.state = {
      ...this.state,
      selectedIds: this.state.citations.map((citation) => citation.id),
      lastUpdated: new Date().toISOString(),
    };
  }

  deselectAll(): void {
    this.state = {
      ...this.state,
      selectedIds: [],
      lastUpdated: new Date().toISOString(),
    };
  }

  getSelected(): FormattedCitation[] {
    const selectedIds = new Set(this.state.selectedIds);

    return this.state.citations.filter((citation) => selectedIds.has(citation.id));
  }

  setFormat(format: CitationFormat): void {
    this.state = {
      ...this.state,
      format,
      lastUpdated: new Date().toISOString(),
    };
  }

  getState(): CitationManagerState {
    return {
      citations: [...this.state.citations],
      selectedIds: [...this.state.selectedIds],
      format: this.state.format,
      lastUpdated: this.state.lastUpdated,
    };
  }
}
