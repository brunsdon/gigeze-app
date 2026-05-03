import Link from "next/link";
import { notFound } from "next/navigation";
import { Compass, MapPin, Route } from "lucide-react";
import { formatDistanceKm } from "@gigeze/shared";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/layout/empty-state";
import { buttonVariants } from "@/components/ui/button-variants";
import { PublicAttribution } from "@/components/layout/public-attribution";

type RecentActivity = {
  id: string;
  title: string;
  details: string;
  timestamp: Date;
  type: "Gig" | "media" | "post";
};

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function segmentDistanceKm(fromLat: number, fromLon: number, toLat: number, toLon: number) {
  const earthRadiusKm = 6371;
  const latDelta = toRadians(toLat - fromLat);
  const lonDelta = toRadians(toLon - fromLon);
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) * Math.sin(lonDelta / 2) ** 2;

  return earthRadiusKm * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function getJourneyDistanceKm(
  Gigs: Array<{ latitude: { toNumber(): number } | number; longitude: { toNumber(): number } | number }>,
) {
  let total = 0;

  for (let index = 1; index < Gigs.length; index += 1) {
    const previous = Gigs[index - 1];
    const current = Gigs[index];
    const prevLat = typeof previous.latitude === "number" ? previous.latitude : previous.latitude.toNumber();
    const prevLon = typeof previous.longitude === "number" ? previous.longitude : previous.longitude.toNumber();
    const nextLat = typeof current.latitude === "number" ? current.latitude : current.latitude.toNumber();
    const nextLon = typeof current.longitude === "number" ? current.longitude : current.longitude.toNumber();

    total += segmentDistanceKm(prevLat, prevLon, nextLat, nextLon);
  }

  return total;
}

function formatRelativeTime(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) {
    return "Updated just now";
  }

  if (diffHours < 24) {
    return `Updated ${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) {
    return `Updated ${diffDays}d ago`;
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    timeZone: "Australia/Sydney",
    year: "numeric",
  }).format(date);
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ profileSlug: string }>;
}) {
  const { profileSlug } = await params;

  const workspace = await prisma.workspace.findUnique({
    where: { slug: profileSlug },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      owner: {
        select: {
          fullName: true,
          email: true,
        },
      },
    },
  });

  if (!workspace) {
    notFound();
  }

  const [Tours, mediaItems, posts, recentStops] = await Promise.all([
    prisma.tour.findMany({
      where: { workspaceId: workspace.id, visibility: "PUBLIC" },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        status: true,
        updatedAt: true,
        Gigs: {
          where: { visibility: "PUBLIC" },
          select: {
            id: true,
            title: true,
            latitude: true,
            longitude: true,
            createdAt: true,
          },
          orderBy: { orderIndex: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 12,
    }),
    prisma.media.findMany({
      where: { workspaceId: workspace.id, visibility: "PUBLIC" },
      select: {
        id: true,
        caption: true,
        createdAt: true,
        Tour: {
          select: {
            title: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.publicPost.findMany({
      where: {
        workspaceId: workspace.id,
        visibility: "PUBLIC",
        status: "PUBLISHED",
      },
      select: {
        id: true,
        title: true,
        slug: true,
        publishedAt: true,
      },
      orderBy: { publishedAt: "desc" },
      take: 8,
    }),
    prisma.gig.findMany({
      where: {
        workspaceId: workspace.id,
        visibility: "PUBLIC",
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        Tour: {
          select: {
            title: true,
            slug: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const totalStops = Tours.reduce((sum, Tour) => sum + Tour.Gigs.length, 0);
  const approxDistanceKm = Math.round(
    Tours.reduce((sum, Tour) => sum + getJourneyDistanceKm(Tour.Gigs), 0),
  );

  const recentMediaActivity: RecentActivity[] = mediaItems.map((item) => ({
    id: `media-${item.id}`,
    type: "media",
    title: item.caption?.trim() || "Shared a photo",
    details: item.Tour?.title || "Tour moment",
    timestamp: item.createdAt,
  }));

  const recentPostActivity: RecentActivity[] = posts
    .filter((post) => post.publishedAt)
    .map((post) => ({
      id: `post-${post.id}`,
      type: "post",
      title: `Published: ${post.title}`,
      details: "Story update",
      timestamp: post.publishedAt as Date,
    }));

  const recentStopActivity: RecentActivity[] = recentStops.map((Gig) => ({
    id: `Gig-${Gig.id}`,
    type: "Gig",
    title: `New Gig: ${Gig.title}`,
    details: Gig.Tour?.title || "Tour update",
    timestamp: Gig.createdAt,
  }));

  const recentActivity = [...recentStopActivity, ...recentMediaActivity, ...recentPostActivity]
    .sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime())
    .slice(0, 8);

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-border/75 bg-card/95 p-6">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Public profile</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{workspace.name}</h1>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          {workspace.description || "Public highlights from this workspace's shared tours, gigs, and media."}
        </p>
        <div className="mt-3">
          <PublicAttribution
            source={{
              workspace: { name: workspace.name },
              createdByUser: workspace.owner,
            }}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/Tours" className={buttonVariants({ size: "sm" })}>Explore all Tours</Link>
          <Link href={`/shared/${workspace.slug}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Open shared workspace view
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-muted-foreground">Tours</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{Tours.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-muted-foreground">Gigs</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{totalStops}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-muted-foreground">Distance</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatDistanceKm(approxDistanceKm)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-muted-foreground">Media</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{mediaItems.length}</CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Public Tours</h2>
        {!Tours.length ? (
          <EmptyState
            title="No public Tours yet"
            description="Public routes appear here once this workspace shares Tour visibility."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {Tours.map((Tour) => (
              <Card key={Tour.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{Tour.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground">{Tour.description || "No description yet."}</p>
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{Tour.Gigs.length} Gigs</span>
                    <span className="inline-flex items-center gap-1"><Route className="size-3.5" />{formatDistanceKm(getJourneyDistanceKm(Tour.Gigs))}</span>
                  </div>
                  <Link href={`/Tours/${Tour.slug}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                    View Tour
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Recent activity</h2>
        {!recentActivity.length ? (
          <EmptyState title="No public activity yet" description="Shared Gigs, photos, and stories will appear here." />
        ) : (
          <Card>
            <CardContent className="pt-5">
              <ul className="space-y-3 text-sm">
                {recentActivity.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/75 bg-muted/15 px-3 py-2.5">
                    <div>
                      <p className="font-medium text-foreground">{item.title}</p>
                      <p className="text-muted-foreground">{item.details}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatRelativeTime(item.timestamp)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Latest story links</h2>
        {!posts.length ? (
          <EmptyState title="No published stories yet" description="Published posts and Tour stories will show here." />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/posts/${post.slug}`}
                className="inline-flex items-center justify-between rounded-lg border border-border/75 bg-card/90 px-3 py-2 text-sm transition-colors hover:bg-muted/35"
              >
                <span className="inline-flex items-center gap-2">
                  <Compass className="size-3.5 text-primary" />
                  {post.title}
                </span>
                <span className="text-xs text-muted-foreground">Read</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
