import { LoadingSkeleton } from "@/components/ui/loading-state";

export default function AppLoading() {
  return (
    <section className="animate-page-enter space-y-6" role="status" aria-busy="true" aria-live="polite">
      <p className="sr-only">Loading dashboard</p>
      <div className="space-y-2">
        <LoadingSkeleton className="h-3 w-36" />
        <LoadingSkeleton className="h-9 w-72 max-w-full" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-border/75 bg-card p-4 shadow-sm">
            <LoadingSkeleton className="h-4 w-24" />
            <LoadingSkeleton className="mt-3 h-8 w-2/3" />
            <LoadingSkeleton className="mt-2 h-4 w-1/2" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <div className="rounded-2xl border border-border/75 bg-card p-5 shadow-sm">
          <LoadingSkeleton className="h-5 w-40" />
          <LoadingSkeleton className="mt-4 h-52 w-full rounded-xl" />
        </div>
        <div className="rounded-2xl border border-border/75 bg-card p-5 shadow-sm">
          <LoadingSkeleton className="h-5 w-36" />
          <div className="mt-4 space-y-3">
            <LoadingSkeleton className="h-12 w-full rounded-lg" />
            <LoadingSkeleton className="h-12 w-full rounded-lg" />
            <LoadingSkeleton className="h-12 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </section>
  );
}
