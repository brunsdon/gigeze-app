import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/layout/empty-state";
import { VisibilityBadge } from "@/components/ui/visibility-badge";
import { requireAuthenticatedUser } from "@/lib/auth/workspace";
import { getSharedPostBySlugForViewer } from "@/features/posts/service";
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

export default async function SharedPostDetailPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; postSlug: string }>;
}) {
  const { workspaceSlug, postSlug } = await params;
  const user = await requireAuthenticatedUser();
  const memberWorkspace = await getWorkspaceForMemberBySlug(workspaceSlug, user.id);

  if (!memberWorkspace) {
    notFound();
  }

  const post = await getSharedPostBySlugForViewer(memberWorkspace.workspace.id, postSlug);

  if (!post) {
    return (
      <section className="space-y-6">
        <Link href={`/shared/${workspaceSlug}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          Back to workspace
        </Link>
        <EmptyState title="Post unavailable" description={RESTRICTED_MESSAGE} />
      </section>
    );
  }

  return (
    <article className="mx-auto max-w-4xl space-y-7">
      <Link href={`/shared/${workspaceSlug}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
        Back to workspace
      </Link>

      <header className="space-y-4 rounded-3xl border border-border/80 bg-card/85 p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Viewer Mode</Badge>
          <VisibilityBadge visibility={post.visibility} />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{post.title}</h1>
        <p className="text-sm font-medium text-muted-foreground">Published {formatDate(post.publishedAt)}</p>
        {post.excerpt ? <p className="max-w-prose text-base leading-7 text-muted-foreground">{post.excerpt}</p> : null}
      </header>

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

      <Card>
        <CardHeader>
          <CardTitle>Tour context</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          {post.Tour ? (
            <p>
              Tour: {" "}
              <Link href={`/shared/${workspaceSlug}/Tours/${post.Tour.slug}`} className="font-medium text-foreground hover:underline">
                {post.Tour.title}
              </Link>
            </p>
          ) : (
            <p>Tour: {RESTRICTED_MESSAGE}</p>
          )}
          {post.Gig && post.Gig.Tour ? (
            <p>
              Gig: {" "}
              <Link href={`/shared/${workspaceSlug}/Tours/${post.Gig.Tour.slug}`} className="font-medium text-foreground hover:underline">
                {post.Gig.title}
              </Link>
              {post.Gig.locationName ? ` (${post.Gig.locationName})` : ""}
            </p>
          ) : (
            <p>Gig: {RESTRICTED_MESSAGE}</p>
          )}
        </CardContent>
      </Card>
    </article>
  );
}
