import { buildStyleProfile } from "../../../../lib/style-profiler";
import type { EssayPlan } from "../../../../lib/essay-planner";
import { createHeader } from "../components/Header";
import { Router } from "../router";
import { AppStateStore } from "../state";
import { appendStatus, createContent, createPrimaryButton, createViewShell, postJson, truncate } from "./viewUtils";

export function createEvidenceView(store: AppStateStore, router: Router): HTMLElement {
  const shell = createViewShell();
  const content = createContent();
  const state = store.getState();
  shell.append(createHeader("Evidence Found", () => router.navigate("home")), content);

  if (state.evidenceNodes.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "No evidence found yet.";
    empty.style.cssText = "font-size:13px;color:#627d98;";
    content.appendChild(empty);
  }

  for (const node of state.evidenceNodes) {
    const card = document.createElement("article");
    card.style.cssText = "display:grid;gap:5px;background:white;border:1px solid #d9e2ec;border-radius:8px;padding:10px;font-size:12px;";
    card.innerHTML = `<strong>${truncate(node.title, 60)}</strong><span>${node.author || "Unknown author"} · ${node.year ?? "n.d."}</span><span>${node.sourceType} · ${Math.round(node.credibilityScore * 100)}%</span><span>${truncate(node.citationMla, 80)}</span>`;
    content.appendChild(card);
  }

  const button = createPrimaryButton("Generate Plan");
  button.addEventListener("click", async () => {
    const latest = store.getState();
    store.setState({ status: "loading", errorMessage: null });
    try {
      const profile = buildStyleProfile(latest.documentText ?? "");
      const plan = await postJson<EssayPlan>("/api/essay-planner/plan", {
        evidence: latest.evidenceNodes,
        profile,
        essayType: latest.config.essayType,
        targetWordCount: latest.config.targetWordCount,
      });
      store.setState({ essayPlan: plan, status: "success" });
      router.navigate("plan");
    } catch (error) {
      store.setState({ status: "error", errorMessage: error instanceof Error ? error.message : String(error) });
    }
  });
  content.appendChild(button);
  appendStatus(content, store, "Generating plan...");
  return shell;
}
