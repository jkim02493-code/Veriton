import { buildStyleProfile } from "../../../../lib/style-profiler";
import type { GenerationResult } from "../../../../lib/generation";
import { createHeader } from "../components/Header";
import { Router } from "../router";
import { AppStateStore } from "../state";
import { appendStatus, createContent, createPrimaryButton, createViewShell, postJson } from "./viewUtils";

function strengthColor(strength: number): string {
  if (strength >= 0.65) return "#1d7f68";
  if (strength >= 0.35) return "#d69e2e";
  return "#c53030";
}

export function createPlanView(store: AppStateStore, router: Router): HTMLElement {
  const shell = createViewShell();
  const content = createContent();
  const state = store.getState();
  shell.append(createHeader("Essay Plan", () => router.navigate("evidence")), content);

  if (!state.essayPlan) {
    const empty = document.createElement("p");
    empty.textContent = "No plan generated yet.";
    content.appendChild(empty);
    return shell;
  }

  const overview = document.createElement("div");
  overview.style.cssText = "font-size:13px;background:white;border:1px solid #d9e2ec;border-radius:8px;padding:10px;";
  overview.textContent = `${state.essayPlan.essayType} · ${state.essayPlan.targetWordCount} words · ${state.essayPlan.sections.length} sections`;
  content.appendChild(overview);

  for (const section of state.essayPlan.sections) {
    const row = document.createElement("div");
    row.style.cssText = "display:grid;grid-template-columns:10px 1fr;gap:8px;align-items:start;background:white;border:1px solid #d9e2ec;border-radius:8px;padding:10px;font-size:12px;";
    const dot = document.createElement("span");
    dot.style.cssText = `width:10px;height:10px;border-radius:999px;background:${strengthColor(section.blockStrength)};margin-top:3px;`;
    const detail = document.createElement("div");
    detail.textContent = `${section.label} (${section.role}) · ${section.assignedEvidence.length} sources · ${section.targetWordCount} words`;
    row.append(dot, detail);
    content.appendChild(row);
  }

  if (state.essayPlan.validation.warnings.length > 0) {
    const warnings = document.createElement("ul");
    warnings.style.cssText = "font-size:12px;color:#9a6700;";
    for (const warning of state.essayPlan.validation.warnings) {
      const item = document.createElement("li");
      item.textContent = warning;
      warnings.appendChild(item);
    }
    content.appendChild(warnings);
  }

  const button = createPrimaryButton("Generate Draft");
  button.addEventListener("click", async () => {
    const latest = store.getState();
    if (!latest.essayPlan) return;
    store.setState({ status: "loading", errorMessage: null });
    try {
      const profile = buildStyleProfile(latest.documentText ?? "");
      const result = await postJson<GenerationResult>("/api/generation/draft", {
        plan: latest.essayPlan,
        profile,
        config: { citationFormat: latest.config.citationFormat },
      });
      store.setState({ generatedDraft: result.draft, status: "success" });
      router.navigate("draft");
    } catch (error) {
      store.setState({ status: "error", errorMessage: error instanceof Error ? error.message : String(error) });
    }
  });
  content.appendChild(button);
  appendStatus(content, store, "Generating draft...");
  return shell;
}
