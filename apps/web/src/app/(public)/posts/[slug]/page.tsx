import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicAttribution } from "@/components/layout/public-attribution";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPublishedPostBySlug } from "@/features/posts/service";

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

export default async function PublicPostDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const hasPublicJourneyContext = Boolean(post.Tour || post.Gig);

  return (
    <article className="mx-auto max-w-4xl public-page-shell">
      <div className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-[0_10px_24px_rgba(36,48,40,0.05)] sm:p-8">
        <Link href="/posts" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Back to posts
        </Link>

        <h1 className="public-page-title-lg">{post.title}</h1>
        <p className="text-sm font-medium text-muted-foreground">Published {formatDate(post.publishedAt)}</p>
        <p className="public-page-meta">Shared from the backstage side of GigEze.</p>
        <PublicAttribution source={post} />
        {post.excerpt ? <p className="public-page-intro">{post.excerpt}</p> : null}
        <div className="public-page-link-row">
          <Link href="/tours" className="public-inline-cta">Browse Tours</Link>
          <Link href="/gallery" className="public-inline-cta">See gallery moments</Link>
          <Link href="/login?mode=signup" className="public-inline-cta">Start tracking your own Tour -&gt;</Link>
        </div>
      </div>

      {post.coverImageUrl ? (
        <div
          role="img"
          aria-label={`${post.title} cover image`}
          className="aspect-video w-full rounded-3xl border border-border/80 bg-muted bg-cover bg-center"
          style={{ backgroundImage: `url(${post.coverImageUrl})` }}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Post</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="whitespace-pre-wrap text-base leading-8 text-foreground/95">{post.content}</div>
        </CardContent>
      </Card>

      {hasPublicJourneyContext ? (
        <Card>
          <CardHeader>
            <CardTitle>Tour context</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {post.Tour ? (
              <p>
                Tour: <Link href={`/tours/${post.Tour.slug}`} className="font-medium text-foreground hover:underline">{post.Tour.title}</Link>
              </p>
            ) : null}
            {post.Gig && post.Gig.Tour ? (
              <p>
                Gig: <Link href={`/tours/${post.Gig.Tour.slug}`} className="font-medium text-foreground hover:underline">{post.Gig.title}</Link>
                {post.Gig.locationName ? ` (${post.Gig.locationName})` : ""}
              </p>
            ) : null}
            {post.Tour ? (
              <p>
                <Link href={`/tours/${post.Tour.slug}`} className="font-medium text-primary hover:underline">Back to Tour</Link>
              </p>
            ) : null}
            <p>
              <Link href="/login" className="font-medium text-primary hover:underline">Build tour records</Link>
            </p>
          </CardContent>
        </Card>
      ) : null}
    </article>
  );
}
