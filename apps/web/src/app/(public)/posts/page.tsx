import Link from "next/link";
import { EmptyState } from "@/components/layout/empty-state";
import { PublicAttribution } from "@/components/layout/public-attribution";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listPublishedPosts } from "@/features/posts/service";

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

export default async function PublicPostsPage({
  searchParams,
}: {
  searchParams: Promise<{ Tour?: string | string[] }>;
}) {
  const { Tour } = await searchParams;
  const journeyFilter = Array.isArray(Tour) ? Tour[0] : Tour;
  const posts = await listPublishedPosts();
  const visiblePosts = journeyFilter
    ? posts.filter((post) => post.Tour?.slug === journeyFilter || post.Tour?.id === journeyFilter)
    : posts;

  return (
    <section className="public-page-shell">
      <div className="public-page-header">
        <h1 className="public-page-title">Stories</h1>
        <p className="public-page-intro">Stories, updates, and highlights from real tours.</p>
        <p className="public-page-meta">Shared from the backstage side of GigEze.</p>
        <div className="public-page-link-row">
          <Link href="/Tours" className="public-inline-cta">Explore public Tours</Link>
          <Link href="/gallery" className="public-inline-cta">Browse gallery highlights</Link>
        </div>
      </div>

      {!visiblePosts.length ? (
        <EmptyState
          title="No stories yet"
          description={
            journeyFilter
              ? "No stories are linked to this Tour yet."
              : "No stories yet. Publish your first tour update and the feed will come alive."
          }
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {visiblePosts.map((post) => (
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
                <CardTitle>{post.title}</CardTitle>
                <p className="text-xs text-muted-foreground">Published {formatDate(post.publishedAt)}</p>
                <PublicAttribution source={post} />
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="line-clamp-4 text-sm text-muted-foreground">{post.excerpt || "No excerpt provided."}</p>
                {post.Tour ? (
                  <p className="text-xs text-muted-foreground">
                    Related Tour:{" "}
                    <Link href={`/Tours/${post.Tour.slug}`} className="font-medium text-foreground hover:underline">
                      {post.Tour.title}
                    </Link>
                  </p>
                ) : null}
                <Link href={`/posts/${post.slug}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                  Read post
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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

