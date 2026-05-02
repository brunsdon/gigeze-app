import { LoadingSkeleton } from "@/components/ui/loading-state";

export default function PublicGalleryLoading() {
  return (
    <section className="animate-page-enter space-y-8" role="status" aria-busy="true" aria-live="polite">
      <p className="sr-only">Loading public gallery</p>
      <div className="space-y-2">
        <LoadingSkeleton className="h-10 w-64" />
        <LoadingSkeleton className="h-5 w-96 max-w-full" />
      </div>
      <div className="rounded-3xl border border-border/75 bg-card/96 p-6 shadow-[0_10px_28px_rgba(43,42,40,0.05)]">
        <LoadingSkeleton className="h-5 w-32" />
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <LoadingSkeleton className="h-10 md:col-span-1" />
          <LoadingSkeleton className="h-10 md:col-span-1" />
          <LoadingSkeleton className="h-10 md:col-span-1" />
          <LoadingSkeleton className="h-10 md:col-span-1" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <LoadingSkeleton key={index} className="aspect-square rounded-3xl" />
        ))}
      </div>
    </section>
  );
}
