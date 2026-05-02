import Link from "next/link";
import { EmptyState } from "@/components/layout/empty-state";
import { PublicMediaGrid } from "@/components/gallery/public-media-grid";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { listPublicMediaFilterOptions, listPublicMediaItems } from "@/features/media/service";

function normalizeSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0]?.trim() || undefined;
  }

  return value?.trim() || undefined;
}

export default async function PublicGalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ Tour?: string | string[]; Gig?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;
  const journeyId = normalizeSearchParam(resolvedSearchParams.Tour);
  const stopId = normalizeSearchParam(resolvedSearchParams.Gig);
  const hasActiveFilters = Boolean(journeyId || stopId);

  const [items, filterOptions] = await Promise.all([
    listPublicMediaItems({ journeyId, stopId }),
    listPublicMediaFilterOptions({ journeyId }),
  ]);

  return (
    <section className="public-page-shell">
      <div className="public-page-header">
        <h1 className="public-page-title">Gallery</h1>
        <p className="public-page-intro">Moments captured on the road.</p>
        <p className="public-page-meta">Captured from real Tours tracked with GigEze.</p>
        <div className="public-page-link-row">
          <Link href="/Tours" className="public-inline-cta">Open Tours</Link>
          <Link href="/map" className="public-inline-cta">Explore public map</Link>
        </div>
      </div>

      <Card className="bg-card/92">
        <CardHeader>
          <CardTitle>Filter media</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="Tour">Tour</Label>
              <select
                id="Tour"
                name="Tour"
                defaultValue={journeyId ?? ""}
                className="w-full rounded-xl border border-border/80 bg-background px-3 py-2.5 text-sm"
              >
                <option value="">All Tours</option>
                {filterOptions.Tours.map((Tour) => (
                  <option key={Tour.id} value={Tour.id}>
                    {Tour.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="Gig">Gig</Label>
              <select
                id="Gig"
                name="Gig"
                defaultValue={stopId ?? ""}
                className="w-full rounded-xl border border-border/80 bg-background px-3 py-2.5 text-sm"
              >
                <option value="">All Gigs</option>
                {filterOptions.Gigs.map((Gig) => (
                  <option key={Gig.id} value={Gig.id}>
                    {Gig.title} ({Gig.journeyTitle})
                  </option>
                ))}
              </select>
            </div>

            <button type="submit" className={buttonVariants({ size: "sm" })}>
              Apply filters
            </button>

            {hasActiveFilters ? (
              <Link href="/gallery" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Clear
              </Link>
            ) : null}
          </form>
        </CardContent>
      </Card>

      {!items.length ? (
        <EmptyState
          title={hasActiveFilters ? "No public media matched these filters" : "No public media yet"}
          description={
            hasActiveFilters
              ? "Try a different Tour or Gig filter to see more public media."
              : "No gallery moments yet. Share your first trip photos and highlights will appear here."
          }
          ctaLabel={hasActiveFilters ? "Clear filters" : undefined}
          ctaHref={hasActiveFilters ? "/gallery" : undefined}
        />
      ) : (
        <PublicMediaGrid items={items} />
      )}

      <div className="public-page-cta-row">
        <Link href="/login" className="public-inline-cta">
          Track your trip
        </Link>
        <Link href="/login?mode=signup" className="public-inline-cta">
          Start your Tour -&gt;
        </Link>
      </div>
    </section>
  );
}
