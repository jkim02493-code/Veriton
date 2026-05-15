import { createCitationView } from "./views/CitationView";
import { createDraftView } from "./views/DraftView";
import { createEvidenceView } from "./views/EvidenceView";
import { createHomeView } from "./views/HomeView";
import { createPlanView } from "./views/PlanView";
import { createReviewerNotesView } from "./views/ReviewerNotesView";
import { createErrorBanner } from "./components/ErrorBanner";
import { Router } from "./router";
import { AppStateStore } from "./state";

export function initPopup(rootElement: HTMLElement): void {
  const store = new AppStateStore();
  const router = new Router(store, rootElement);

  router.register("home", () => createHomeView(store, router));
  router.register("evidence", () => createEvidenceView(store, router));
  router.register("plan", () => createPlanView(store, router));
  router.register("draft", () => createDraftView(store, router));
  router.register("reviewerNotes", () => createReviewerNotesView(store, router));
  router.register("citations", () => createCitationView(store, router));

  store.subscribe((state) => {
    if (state.status === "error" && state.errorMessage) {
      const existing = rootElement.querySelector("[data-veriton-global-error]");
      existing?.remove();
      const banner = createErrorBanner(state.errorMessage, () => store.setState({ status: "idle", errorMessage: null }));
      banner.setAttribute("data-veriton-global-error", "true");
      rootElement.prepend(banner);
    }
  });

  router.navigate("home");
}
