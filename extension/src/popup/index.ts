import { initPopup } from "./main";

export type * from "./types";
export { AppStateStore } from "./state";
export { Router } from "./router";
export { initPopup } from "./main";
export { createHeader } from "./components/Header";
export { createLoadingSpinner } from "./components/LoadingSpinner";
export { createErrorBanner } from "./components/ErrorBanner";
export { createProgressBar } from "./components/ProgressBar";

const root = document.getElementById("root");
if (root) {
  initPopup(root);
}
