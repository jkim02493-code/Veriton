export function createErrorBanner(message: string, onDismiss: () => void): HTMLElement {
  const banner = document.createElement("div");
  banner.style.cssText =
    "display:flex;align-items:center;justify-content:space-between;gap:8px;background:#fff1f0;color:#9f1c12;border:1px solid #ffccc7;border-radius:8px;padding:8px 10px;font-size:12px;line-height:1.35;";

  const text = document.createElement("div");
  text.textContent = message;
  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.textContent = "×";
  dismiss.setAttribute("aria-label", "Dismiss error");
  dismiss.style.cssText = "border:0;background:transparent;color:#9f1c12;font-size:18px;cursor:pointer;";
  dismiss.addEventListener("click", onDismiss);

  banner.append(text, dismiss);
  return banner;
}
