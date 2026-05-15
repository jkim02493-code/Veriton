export function createHeader(title: string, onBack?: () => void): HTMLElement {
  const header = document.createElement("header");
  header.style.cssText =
    "height:48px;display:grid;grid-template-columns:64px 1fr 64px;align-items:center;border-bottom:1px solid #d9e2ec;padding:0 10px;box-sizing:border-box;font-family:Inter,system-ui,sans-serif;";

  const left = document.createElement("div");
  if (onBack) {
    const back = document.createElement("button");
    back.type = "button";
    back.textContent = "←";
    back.setAttribute("aria-label", "Back");
    back.style.cssText = "border:0;background:transparent;font-size:20px;cursor:pointer;padding:6px;";
    back.addEventListener("click", onBack);
    left.appendChild(back);
  } else {
    left.textContent = "Veriton";
    left.style.cssText = "font-weight:700;font-size:13px;";
  }

  const titleElement = document.createElement("div");
  titleElement.textContent = title;
  titleElement.style.cssText = "text-align:center;font-weight:700;font-size:14px;";

  const right = document.createElement("div");
  right.textContent = onBack ? "Veriton" : "";
  right.style.cssText = "text-align:right;font-weight:700;font-size:13px;";

  header.append(left, titleElement, right);
  return header;
}
