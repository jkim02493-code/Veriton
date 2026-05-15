import { AppStateStore } from "./state";
import type { ViewName } from "./types";

export class Router {
  private store: AppStateStore;
  private container: HTMLElement;
  private views: Map<ViewName, () => HTMLElement>;

  constructor(store: AppStateStore, container: HTMLElement) {
    this.store = store;
    this.container = container;
    this.views = new Map();
  }

  register(name: ViewName, factory: () => HTMLElement): void {
    this.views.set(name, factory);
  }

  navigate(view: ViewName): void {
    this.store.setState({ currentView: view });
    this.container.replaceChildren();

    const factory = this.views.get(view);
    if (!factory) {
      return;
    }

    this.container.appendChild(factory());
  }

  getCurrentView(): ViewName {
    return this.store.getState().currentView;
  }
}
