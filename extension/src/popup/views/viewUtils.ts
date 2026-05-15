import { createErrorBanner } from "../components/ErrorBanner";
import { createLoadingSpinner } from "../components/LoadingSpinner";
import { AppStateStore } from "../state";

export function createViewShell(): HTMLElement {
  const shell = document.createElement("div");
  shell.style.cssText =
    "width:380px;min-height:520px;background:#f8fafc;color:#17212b;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:grid;grid-template-rows:auto 1fr;";
  return shell;
}

export function createContent(): HTMLElement {
  const content = document.createElement("main");
  content.style.cssText = "display:grid;align-content:start;gap:12px;padding:12px;box-sizing:border-box;";
  return content;
}

export function createPrimaryButton(label: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.style.cssText =
    "border:0;border-radius:8px;background:#1d7f68;color:white;font-weight:700;font-size:13px;padding:10px 12px;cursor:pointer;width:100%;";
  return button;
}

export function createSecondaryButton(label: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.style.cssText =
    "border:1px solid #b9c8d6;border-radius:8px;background:white;color:#1f2d3d;font-weight:700;font-size:13px;padding:9px 12px;cursor:pointer;width:100%;";
  return button;
}

export function truncate(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 3)}...`;
}

export function appendStatus(content: HTMLElement, store: AppStateStore, loadingMessage: string): void {
  const state = store.getState();
  if (state.status === "loading") {
    content.appendChild(createLoadingSpinner(loadingMessage));
  }
  if (state.status === "error" && state.errorMessage) {
    content.appendChild(createErrorBanner(state.errorMessage, () => store.setState({ status: "idle", errorMessage: null })));
  }
}

export async function postJson<TResponse>(url: string, body: unknown): Promise<TResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return (await response.json()) as TResponse;
}

export function sendActiveTabMessage<TResponse>(message: unknown): Promise<TResponse> {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (!tabId) {
        reject(new Error("No active Google Docs tab found."));
        return;
      }
      chrome.tabs.sendMessage(tabId, message, (response: TResponse) => {
        const runtimeError = chrome.runtime.lastError;
        if (runtimeError) {
          reject(new Error(runtimeError.message));
          return;
        }
        resolve(response);
      });
    });
  });
}
