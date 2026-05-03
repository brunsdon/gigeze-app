import Link from "next/link";
import { notFound } from "next/navigation";
import { Compass, GalleryHorizontalEnd, MapPinned, NotebookText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/branding/logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/layout/empty-state";
import { MapBoundary } from "@/components/maps/map-boundary";
import { SharedMediaGrid, type SharedGalleryMediaItem } from "@/components/gallery/shared-media-grid";
import { VisibilityBadge } from "@/components/ui/visibility-badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { requireAuthenticatedUser } from "@/lib/auth/workspace";
import { listJourneysForViewer } from "@/features/tours/service";
import { mapJourneyToMapData } from "@/features/maps/service";
import { listMediaItemsForViewer } from "@/features/media/service";
import { listSharedPostsForViewer } from "@/features/posts/service";
import { getWorkspaceForMemberBySlug } from "@/features/workspaces/service";

const RESTRICTED_MESSAGE = "This content is private or not shared with you";

function formatDate(value?: Date | null) {
  if (!value) {
    return "Recently";
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    timeZone: "Australia/Sydney",
    year: "numeric",
  }).format(value);
}

function mapViewerMediaToSharedGallery(items: Awaited<ReturnType<typeof listMediaItemsForViewer>>): SharedGalleryMediaItem[] {
  return items.map((item) => ({
    id: item.id,
    filePath: item.filePath,
    fileName: item.fileName,
    publicUrl: item.publicUrl,
    mimeType: item.mimeType,
    caption: item.caption,
    createdAt: item.createdAt,
    visibility: item.visibility,
    Tour: item.Tour
      ? {
          id: item.Tour.id,
          title: item.Tour.title,
          slug: item.Tour.slug,
        }
      : null,
    Gig: item.Gig
      ? {
          id: item.Gig.id,
          title: item.Gig.title,
        }
      : null,
  }));
}

export default async function SharedWorkspaceProfilePage({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = await params;
  const user = await requireAuthenticatedUser();
  const memberWorkspace = await getWorkspaceForMemberBySlug(workspaceSlug, user.id);

  if (!memberWorkspace) {
    notFound();
  }

  const [sharedJourneys, posts, mediaItems] = await Promise.all([
    listJourneysForViewer(memberWorkspace.workspace.id),
    listSharedPostsForViewer(memberWorkspace.workspace.id),
    listMediaItemsForViewer(memberWorkspace.workspace.id),
  ]);

  const sharedMapData = sharedJourneys.map((Tour) =>
    mapJourneyToMapData(Tour, { journeyHrefBase: `/shared/${workspaceSlug}/tours` }),
  );

  const sharedGalleryItems = mapViewerMediaToSharedGallery(mediaItems);

  return (
    <section className="space-y-8">
      <header className="rounded-3xl border border-border/80 bg-card/90 p-6 shadow-sm sm:p-8">
        <Link href="/" className="inline-flex items-center rounded-lg transition-opacity hover:opacity-88 focus-visible:ring-2 focus-visible:ring-ring/65">
          <Logo variant="full" size="sm" className="brand-mark-muted" aria-label="GigEze home" />
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Viewer Mode</Badge>
          <Badge variant="secondary">Read-only profile</Badge>
        </div>
        <p className="mt-4 text-xs font-medium uppercase tracking-[0.14em] text-foreground/60">
          Following {memberWorkspace.workspace.name}&apos;s Tour
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{memberWorkspace.workspace.name}</h1>
        <p className="mt-3 max-w-prose text-base leading-7 text-muted-foreground">
          {memberWorkspace.workspace.description || "A shared tour profile with gigs, posts, map locations, and gallery highlights available to invited viewers."}
        </p>

        <nav className="mt-5 flex flex-wrap gap-2">
          <a href="#Tours" className={buttonVariants({ variant: "outline", size: "sm" })}>Tours</a>
          <a href="#map" className={buttonVariants({ variant: "outline", size: "sm" })}>Map</a>
          <a href="#gallery" className={buttonVariants({ variant: "outline", size: "sm" })}>Gallery</a>
          <a href="#posts" className={buttonVariants({ variant: "outline", size: "sm" })}>Posts</a>
        </nav>
      </header>

      <section id="Tours" className="space-y-4 scroll-mt-24">
        <div className="flex items-center gap-2">
          <Compass className="size-5 text-muted-foreground" />
          <h2 className="text-xl font-semibold tracking-tight">Tours</h2>
        </div>

        {!sharedJourneys.length ? (
          <EmptyState title="No Tours available" description={RESTRICTED_MESSAGE} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sharedJourneys.map((Tour) => (
              <Card key={Tour.id} className="overflow-hidden transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                {Tour.coverImageUrl ? (
                  <div
                    role="img"
                    aria-label={`${Tour.title} cover image`}
                    className="aspect-video border-b border-border/70 bg-muted bg-cover bg-center"
                    style={{ backgroundImage: `url(${Tour.coverImageUrl})` }}
                  />
                ) : null}
                <CardHeader className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle>{Tour.title}</CardTitle>
                    <Badge variant="secondary">{Tour.status.toLowerCase()}</Badge>
                  </div>
                  <CardDescription>{Tour.description || "No description available."}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Gigs</span>
                    <span>{Tour.Gigs.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Visibility</span>
                    <VisibilityBadge visibility={Tour.visibility} />
                  </div>
                  <Link href={`/shared/${workspaceSlug}/tours/${Tour.slug}`} className={buttonVariants({ size: "sm" })}>
                    View Tour
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section id="map" className="space-y-4 scroll-mt-24">
        <div className="flex items-center gap-2">
          <MapPinned className="size-5 text-muted-foreground" />
          <h2 className="text-xl font-semibold tracking-tight">Map</h2>
        </div>
        <MapBoundary
          data={sharedMapData}
          mode="private"
          showRouteLines
          emptyTitle="No shared Gigs on the map"
          emptyDescription={RESTRICTED_MESSAGE}
        />
      </section>

      <section id="gallery" className="space-y-4 scroll-mt-24">
        <div className="flex items-center gap-2">
          <GalleryHorizontalEnd className="size-5 text-muted-foreground" />
          <h2 className="text-xl font-semibold tracking-tight">Gallery</h2>
        </div>

        {!sharedGalleryItems.length ? (
          <EmptyState title="No gallery items available" description={RESTRICTED_MESSAGE} />
        ) : (
          <SharedMediaGrid workspaceSlug={workspaceSlug} items={sharedGalleryItems} />
        )}
      </section>

      <section id="posts" className="space-y-4 scroll-mt-24">
        <div className="flex items-center gap-2">
          <NotebookText className="size-5 text-muted-foreground" />
          <h2 className="text-xl font-semibold tracking-tight">Posts</h2>
        </div>

        {!posts.length ? (
          <EmptyState title="No posts available" description={RESTRICTED_MESSAGE} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {posts.map((post) => (
              <Card key={post.id} className="transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                {post.coverImageUrl ? (
                  <div
                    role="img"
                    aria-label={`${post.title} cover image`}
                    className="aspect-video rounded-t-2xl border-b border-border/70 bg-muted bg-cover bg-center"
                    style={{ backgroundImage: `url(${post.coverImageUrl})` }}
                  />
                ) : null}
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle>{post.title}</CardTitle>
                    <VisibilityBadge visibility={post.visibility} />
                  </div>
                  <CardDescription>{post.excerpt || "No excerpt available."}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-muted-foreground">Published {formatDate(post.publishedAt)}</p>
                  <Link href={`/shared/${workspaceSlug}/posts/${post.slug}`} className={buttonVariants({ size: "sm" })}>
                    Read post
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
