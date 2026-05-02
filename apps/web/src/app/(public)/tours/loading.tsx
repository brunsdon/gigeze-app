import { LoadingSkeleton } from "@/components/ui/loading-state";

export default function PublicJourneysLoading() {
  return (
    <section className="animate-page-enter space-y-8" role="status" aria-busy="true" aria-live="polite">
      <p className="sr-only">Loading public Tours</p>
      <div className="space-y-2">
        <LoadingSkeleton className="h-10 w-60" />
        <LoadingSkeleton className="h-5 w-96 max-w-full" />
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-3xl border border-border/75 bg-card/96 p-6 shadow-[0_10px_28px_rgba(43,42,40,0.05)]">
            <LoadingSkeleton className="h-6 w-2/3" />
            <LoadingSkeleton className="mt-3 h-4 w-full" />
            <LoadingSkeleton className="mt-2 h-4 w-4/5" />
            <LoadingSkeleton className="mt-5 h-8 w-28 rounded-xl" />
          </div>
        ))}
      </div>
    </section>
  );
}
