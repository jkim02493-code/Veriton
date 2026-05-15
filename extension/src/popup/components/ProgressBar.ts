export function createProgressBar(label: string, current: number, total: number): HTMLElement {
  const percentage = total <= 0 ? 0 : Math.round(Math.min(Math.max(current / total, 0), 1) * 100);
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "display:grid;gap:6px;font-family:Inter,system-ui,sans-serif;font-size:12px;color:#334e68;";

  const row = document.createElement("div");
  row.style.cssText = "display:flex;justify-content:space-between;gap:8px;";
  const labelElement = document.createElement("span");
  labelElement.textContent = label;
  const percentElement = document.createElement("span");
  percentElement.textContent = `${percentage}%`;
  row.append(labelElement, percentElement);

  const track = document.createElement("div");
  track.style.cssText = "height:8px;background:#d9e2ec;border-radius:999px;overflow:hidden;";
  const fill = document.createElement("div");
  fill.style.cssText = `height:100%;width:${percentage}%;background:#1d7f68;border-radius:999px;`;
  track.appendChild(fill);
  wrapper.append(row, track);

  return wrapper;
}
