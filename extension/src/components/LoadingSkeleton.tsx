export function LoadingSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading evidence cards">
      {[0, 1, 2].map((item) => (
        <div key={item} className="animate-pulse rounded-2xl border p-4" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
          <div className="h-4 w-3/4 rounded" style={{ background: "var(--border)" }} />
          <div className="mt-3 h-3 w-1/2 rounded" style={{ background: "var(--border)" }} />
          <div className="mt-4 h-16 rounded" style={{ background: "var(--bg-input)" }} />
          <div className="mt-4 flex gap-2">
            <div className="h-8 w-24 rounded" style={{ background: "var(--border)" }} />
            <div className="h-8 w-24 rounded" style={{ background: "var(--border)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}
