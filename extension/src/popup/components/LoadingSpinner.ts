let spinnerStylesInjected = false;

function injectSpinnerStyles(): void {
  if (spinnerStylesInjected) {
    return;
  }

  const style = document.createElement("style");
  style.textContent = `
    @keyframes veriton-spin { to { transform: rotate(360deg); } }
    .veriton-spinner {
      animation: veriton-spin 0.8s linear infinite;
      border: 3px solid #d9e2ec;
      border-top-color: #1d7f68;
      border-radius: 999px;
      height: 28px;
      width: 28px;
    }
  `;
  document.head.appendChild(style);
  spinnerStylesInjected = true;
}

export function createLoadingSpinner(message?: string): HTMLElement {
  injectSpinnerStyles();

  const wrapper = document.createElement("div");
  wrapper.style.cssText = "display:grid;justify-items:center;gap:8px;padding:16px;color:#425466;font-size:13px;";
  const spinner = document.createElement("div");
  spinner.className = "veriton-spinner";
  wrapper.appendChild(spinner);

  if (message) {
    const label = document.createElement("div");
    label.textContent = message;
    wrapper.appendChild(label);
  }

  return wrapper;
}
