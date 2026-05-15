import type { AppState } from "./types";

function createInitialState(): AppState {
  return {
    currentView: "home",
    status: "idle",
    errorMessage: null,
    config: {
      essayType: "argumentative",
      targetWordCount: 800,
      citationFormat: "mla",
    },
    documentText: null,
    evidenceNodes: [],
    essayPlan: null,
    generatedDraft: null,
    reviewerNotes: null,
    citations: [],
  };
}

export class AppStateStore {
  private state: AppState;
  private listeners: Array<(state: AppState) => void>;

  constructor() {
    this.state = createInitialState();
    this.listeners = [];
  }

  getState(): AppState {
    return {
      ...this.state,
      config: { ...this.state.config },
      evidenceNodes: [...this.state.evidenceNodes],
      citations: [...this.state.citations],
    };
  }

  setState(partial: Partial<AppState>): void {
    this.state = {
      ...this.state,
      ...partial,
      config: partial.config ? { ...this.state.config, ...partial.config } : this.state.config,
    };
    this.listeners.forEach((listener) => listener(this.getState()));
  }

  subscribe(listener: (state: AppState) => void): () => void {
    this.listeners.push(listener);

    return () => {
      this.listeners = this.listeners.filter((candidate) => candidate !== listener);
    };
  }

  reset(): void {
    this.state = createInitialState();
    this.listeners.forEach((listener) => listener(this.getState()));
  }
}
