export function LoadingSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading evidence cards">
      {[0, 1, 2].map((item) => (
        <div key={item} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="h-4 w-3/4 rounded bg-slate-200" />
          <div className="mt-3 h-3 w-1/2 rounded bg-slate-200" />
          <div className="mt-4 h-16 rounded bg-slate-100" />
          <div className="mt-4 flex gap-2">
            <div className="h-8 w-24 rounded bg-slate-200" />
            <div className="h-8 w-24 rounded bg-slate-200" />
          </div>
        </div>
      ))}
    </div>
  );
}
