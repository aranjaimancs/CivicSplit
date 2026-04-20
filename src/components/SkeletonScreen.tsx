/** Full-page skeleton that mimics the GroupHome layout while data loads */
export function GroupHomeSkeleton() {
  return (
    <div className="min-h-screen bg-app-bg animate-fade-in">
      {/* Header skeleton */}
      <div className="bg-gradient-to-br from-primary-700 to-primary-500 px-5 pb-12 pt-14">
        <div className="skeleton mb-4 h-5 w-28 opacity-40" />
        <div className="skeleton mb-2 h-8 w-48 opacity-40" />
        <div className="skeleton h-4 w-36 opacity-30" />
      </div>

      <div className="-mt-6 space-y-5 px-4">
        {/* Balance board card skeleton */}
        <div className="card relative z-10 p-4 shadow-card-lift">
          <div className="skeleton mb-4 h-3.5 w-20" />
          <div className="flex gap-2.5 overflow-hidden">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-[118px] shrink-0 rounded-2xl border border-slate-100 bg-app-bg p-3.5">
                <div className="skeleton mb-3 h-10 w-10 rounded-full" />
                <div className="skeleton mb-1.5 h-3.5 w-16" />
                <div className="skeleton h-4 w-12" />
              </div>
            ))}
          </div>
        </div>

        {/* Receipts skeleton */}
        <div>
          <div className="skeleton mb-3 h-3.5 w-28" />
          <div className="space-y-2.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card flex items-center gap-3.5 p-3.5">
                <div className="skeleton h-12 w-12 rounded-2xl" />
                <div className="flex-1">
                  <div className="skeleton mb-2 h-4 w-32" />
                  <div className="skeleton h-3 w-24" />
                </div>
                <div className="skeleton h-5 w-14" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
