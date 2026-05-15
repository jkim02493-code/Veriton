import { createHeader } from "../components/Header";
import { Router } from "../router";
import { AppStateStore } from "../state";
import type { EssayTypeOption, PopupMessage } from "../types";
import { appendStatus, createContent, createPrimaryButton, createViewShell, sendActiveTabMessage } from "./viewUtils";

const ESSAY_TYPES: EssayTypeOption[] = [
  { value: "argumentative", label: "Argumentative" },
  { value: "expository", label: "Expository" },
  { value: "analytical", label: "Analytical" },
  { value: "compareContrast", label: "Compare / Contrast" },
  { value: "personalStatement", label: "Personal Statement" },
];

export function createHomeView(store: AppStateStore, router: Router): HTMLElement {
  const shell = createViewShell();
  const content = createContent();
  const state = store.getState();
  shell.append(createHeader("Veriton"), content);

  const essayType = document.createElement("select");
  essayType.style.cssText = "width:100%;padding:9px;border:1px solid #bcccdc;border-radius:8px;";
  for (const option of ESSAY_TYPES) {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent = option.label;
    element.selected = option.value === state.config.essayType;
    essayType.appendChild(element);
  }
  essayType.addEventListener("change", () =>
    store.setState({ config: { ...store.getState().config, essayType: essayType.value as EssayTypeOption["value"] } }),
  );

  const wordCount = document.createElement("input");
  wordCount.type = "number";
  wordCount.min = "200";
  wordCount.max = "10000";
  wordCount.value = String(state.config.targetWordCount);
  wordCount.style.cssText = "width:100%;padding:9px;border:1px solid #bcccdc;border-radius:8px;box-sizing:border-box;";
  wordCount.addEventListener("input", () =>
    store.setState({ config: { ...store.getState().config, targetWordCount: Number(wordCount.value) } }),
  );

  const citationToggle = document.createElement("div");
  citationToggle.style.cssText = "display:flex;gap:12px;font-size:13px;";
  for (const format of ["mla", "apa"] as const) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "citation-format";
    input.checked = state.config.citationFormat === format;
    input.addEventListener("change", () =>
      store.setState({ config: { ...store.getState().config, citationFormat: format } }),
    );
    label.append(input, format.toUpperCase());
    citationToggle.appendChild(label);
  }

  const button = createPrimaryButton("Find Evidence");
  button.addEventListener("click", async () => {
    store.setState({ status: "loading", errorMessage: null });
    try {
      const response = await sendActiveTabMessage<{ text: string }>({ type: "VERITON_GET_DOC_TEXT" } satisfies PopupMessage);
      store.setState({ documentText: response.text, status: "success" });
      router.navigate("evidence");
    } catch (error) {
      store.setState({ status: "error", errorMessage: error instanceof Error ? error.message : String(error) });
    }
  });

  content.append(labelWrap("Essay type", essayType), labelWrap("Target words", wordCount), labelWrap("Citation format", citationToggle), button);
  appendStatus(content, store, "Reading Google Doc...");
  return shell;
}

function labelWrap(label: string, control: HTMLElement): HTMLElement {
  const wrapper = document.createElement("label");
  wrapper.style.cssText = "display:grid;gap:6px;font-size:12px;font-weight:700;color:#334e68;";
  wrapper.append(label, control);
  return wrapper;
}
