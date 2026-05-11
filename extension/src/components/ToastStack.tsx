import type { Toast } from "../hooks/useToasts";

const toneClasses: Record<Toast["tone"], string> = {
  success: "border-[rgba(16,185,129,0.3)] text-[var(--accent)]",
  error: "border-[rgba(239,68,68,0.3)] text-[#fca5a5]",
  info: "border-[var(--border)] text-[var(--text-primary)]",
};

export function ToastStack({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="pointer-events-none fixed right-5 top-5 z-[2147483647] space-y-2">
      {toasts.map((toast) => (
        <div key={toast.id} className={`w-72 rounded-xl border px-4 py-3 text-sm shadow-lg ${toneClasses[toast.tone]}`} style={{ background: "var(--bg-card)" }}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
