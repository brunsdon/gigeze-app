import Link from "next/link";
import { listPublicJourneys } from "@/features/tours/service";
import { PublicAttribution } from "@/components/layout/public-attribution";
import { EmptyState } from "@/components/layout/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function PublicJourneysPage() {
  const Tours = await listPublicJourneys();

  if (!Tours.length) {
    return (
      <EmptyState
        title="No Tours yet"
        description="Start tracking your first tour and shared gigs will appear here."
      />
    );
  }

  return (
    <section className="public-page-shell">
      <div className="public-page-header">
        <h1 className="public-page-title">Tours</h1>
        <p className="public-page-intro">Explore tours shared by crews, artists, and tour managers.</p>
        <p className="public-page-meta">Published from GigEze tour records.</p>
        <p className="public-page-meta">Each tour can connect gigs, venues, media, notes, and trip sync.</p>
        <div className="public-page-link-row">
          <Link href="/map" className="public-inline-cta">Explore gigs on map</Link>
          <Link href="/gallery" className="public-inline-cta">Open public gallery</Link>
          <Link href="/posts" className="public-inline-cta">Read latest stories</Link>
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {Tours.map((Tour) => (
          <Card key={Tour.id} className="transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{Tour.title}</CardTitle>
                <Badge variant="secondary">{Tour.status.toLowerCase()}</Badge>
              </div>
              <CardDescription>{Tour.description || "No description"}</CardDescription>
              <PublicAttribution source={Tour} className="pt-1" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{Tour.Gigs.length} public Gigs</span>
                <Link href={`/Tours/${Tour.slug}`} className="font-medium text-primary hover:text-primary/80 hover:underline">
                  View Tour
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="public-page-cta-row">
        <Link href="/login?mode=signup" className="public-inline-cta">
          Start your Tour -&gt;
        </Link>
        <Link href="/login" className="public-inline-cta">
          Build tour records
        </Link>
      </div>
    </section>
  );
}
