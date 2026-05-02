import { LoadingSkeleton } from "@/components/ui/loading-state";

export default function PublicLoading() {
  return (
    <div className="animate-page-enter space-y-16 sm:space-y-20" role="status" aria-busy="true" aria-live="polite">
      <p className="sr-only">Loading public content</p>
      <section className="rounded-3xl border border-border/75 bg-card/96 p-6 shadow-[0_10px_28px_rgba(43,42,40,0.05)] sm:p-9 lg:p-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:items-end">
          <div className="space-y-4">
            <LoadingSkeleton className="h-3 w-32" />
            <LoadingSkeleton className="h-10 max-w-2xl" />
            <LoadingSkeleton className="h-10 max-w-xl" />
            <LoadingSkeleton className="h-5 max-w-prose" />
            <LoadingSkeleton className="h-5 max-w-md" />
            <div className="flex flex-wrap gap-3 pt-2">
              <LoadingSkeleton className="h-10 w-48 rounded-xl" />
              <LoadingSkeleton className="h-10 w-40 rounded-xl" />
            </div>
          </div>

          <div className="space-y-4 rounded-3xl border border-border/70 bg-background/55 p-4 sm:p-5">
            <LoadingSkeleton className="h-44 rounded-2xl sm:h-48" />
            <div className="grid grid-cols-2 gap-2">
              <LoadingSkeleton className="h-16 rounded-xl" />
              <LoadingSkeleton className="h-16 rounded-xl" />
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div className="space-y-2">
          <LoadingSkeleton className="h-3 w-36" />
          <LoadingSkeleton className="h-7 w-64" />
        </div>
        <div className="rounded-3xl border border-border/75 bg-card/96 p-6 shadow-[0_10px_28px_rgba(43,42,40,0.05)]">
          <LoadingSkeleton className="h-4 w-32" />
          <LoadingSkeleton className="mt-4 h-7 w-2/3" />
          <LoadingSkeleton className="mt-4 h-5 w-full" />
          <LoadingSkeleton className="mt-2 h-5 w-3/4" />
          <LoadingSkeleton className="mt-5 h-8 w-28 rounded-xl" />
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <LoadingSkeleton className="h-3 w-32" />
            <LoadingSkeleton className="h-7 w-48" />
          </div>
          <LoadingSkeleton className="h-8 w-28 rounded-xl" />
        </div>
        <div className="rounded-3xl border border-border/75 bg-card/96 p-6 shadow-[0_10px_28px_rgba(43,42,40,0.05)]">
          <LoadingSkeleton className="h-4 w-28" />
          <LoadingSkeleton className="mt-4 h-7 w-2/3" />
          <LoadingSkeleton className="mt-4 h-5 w-full" />
          <LoadingSkeleton className="mt-2 h-5 w-2/3" />
          <LoadingSkeleton className="mt-5 h-8 w-24 rounded-xl" />
        </div>
      </section>
    </div>
  );
}
