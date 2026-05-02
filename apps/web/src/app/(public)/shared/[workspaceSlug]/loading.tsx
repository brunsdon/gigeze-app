import { LoadingSkeleton } from "@/components/ui/loading-state";

export default function SharedWorkspaceLoading() {
  return (
    <section className="animate-page-enter space-y-8" role="status" aria-busy="true" aria-live="polite">
      <p className="sr-only">Loading shared workspace</p>
      <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-sm sm:p-8">
        <LoadingSkeleton className="h-4 w-40" />
        <LoadingSkeleton className="mt-4 h-10 w-72 max-w-full" />
        <LoadingSkeleton className="mt-3 h-5 w-3/4" />
        <LoadingSkeleton className="mt-2 h-5 w-2/3" />
      </div>
      <div className="space-y-4">
        <LoadingSkeleton className="h-7 w-44" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-2xl border border-border/75 bg-card p-4 shadow-sm">
              <LoadingSkeleton className="h-5 w-2/3" />
              <LoadingSkeleton className="mt-3 h-4 w-full" />
              <LoadingSkeleton className="mt-2 h-4 w-4/5" />
              <LoadingSkeleton className="mt-5 h-8 w-28 rounded-xl" />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <LoadingSkeleton className="h-7 w-36" />
        <div className="rounded-2xl border border-border/75 bg-card p-5 shadow-sm">
          <LoadingSkeleton className="h-5 w-44" />
          <LoadingSkeleton className="mt-4 h-56 w-full rounded-xl" />
        </div>
      </div>
    </section>
  );
}
