import type { Toast } from "../hooks/useToasts";

const toneClasses: Record<Toast["tone"], string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  error: "border-red-200 bg-red-50 text-red-900",
  info: "border-slate-200 bg-white text-slate-900",
};

export function ToastStack({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="pointer-events-none fixed right-5 top-5 z-[2147483647] space-y-2">
      {toasts.map((toast) => (
        <div key={toast.id} className={`w-72 rounded-xl border px-4 py-3 text-sm shadow-lg ${toneClasses[toast.tone]}`}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
