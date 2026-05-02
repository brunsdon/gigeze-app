import { MapBoundary } from "@/components/maps/map-boundary";
import Link from "next/link";
import { listPublicJourneyMapData } from "@/features/maps/service";

export default async function PublicMapPage() {
  const mapData = await listPublicJourneyMapData();

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Public map</h1>
        <p className="mt-2 max-w-prose text-base leading-7 text-muted-foreground">Explore public Gigs across published Tours from multiple travellers and workspaces.</p>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <Link href="/Tours" className="font-medium text-primary hover:underline">View Tour list</Link>
          <Link href="/posts" className="font-medium text-primary hover:underline">Read Tour posts</Link>
          <Link href="/gallery" className="font-medium text-primary hover:underline">See route media</Link>
        </div>
      </div>
      <MapBoundary
        data={mapData}
        mode="public"
        showRouteLines={false}
        emptyTitle="No public Gig locations yet"
        emptyDescription="Public Gig markers will appear here once Tours and Gigs are shared."
      />
    </section>
  );
}
