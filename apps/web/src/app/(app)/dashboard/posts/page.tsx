import Link from "next/link";
import { ConfirmSubmitButton } from "@/components/forms/confirm-submit-button";
import { ActionSubmitButton } from "@/components/forms/action-submit-button";
import { EmptyState } from "@/components/layout/empty-state";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VisibilityBadge } from "@/components/ui/visibility-badge";
import {
  deletePostAction,
  publishPostAction,
  unpublishPostAction,
} from "@/features/posts/actions";
import { requireCurrentWorkspace } from "@/lib/auth/workspace";
import { getVisibilityLabel } from "@/lib/visibility";
import { listPostsForWorkspace } from "@/features/posts/service";

function formatDate(value?: Date | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    timeZone: "Australia/Sydney",
    year: "numeric",
  }).format(value);
}

export default async function DashboardPostsPage() {
  const workspace = await requireCurrentWorkspace();
  const posts = await listPostsForWorkspace(workspace.id);

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Tour stories</h1>
          <p className="text-muted-foreground">Shape your travel updates, keep drafts in progress, and publish when ready.</p>
        </div>
        <Link href="/dashboard/posts/new" className={buttonVariants()}>
          New story
        </Link>
      </div>

      {!posts.length ? (
        <EmptyState
          title="No stories yet"
          description="Write your first travel story and publish when it feels right."
          ctaLabel="Create story"
          ctaHref="/dashboard/posts/new"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {posts.map((post: (typeof posts)[number]) => {
            const isPublished = post.status === "PUBLISHED";

            return (
              <Card key={post.id}>
                <CardHeader className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-lg">{post.title}</CardTitle>
                    <Badge variant={isPublished ? "default" : "secondary"}>{post.status}</Badge>
                  </div>
                  <CardDescription>{post.excerpt || "No excerpt yet."}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>Slug: {post.slug}</p>
                    <p>Updated: {formatDate(post.updatedAt)}</p>
                    <p>Published: {formatDate(post.publishedAt)}</p>
                    <div className="flex items-center gap-2">Visibility: <VisibilityBadge visibility={post.visibility} /></div>
                    <p>
                      Linked Tour: {post.Tour ? post.Tour.title : "-"}
                      {post.Tour ? ` (${getVisibilityLabel(post.Tour.visibility).toLowerCase()})` : ""}
                    </p>
                    <p>
                      Linked Gig: {post.Gig ? post.Gig.title : "-"}
                      {post.Gig ? ` (${getVisibilityLabel(post.Gig.visibility).toLowerCase()})` : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/dashboard/posts/${post.id}/edit`} className={buttonVariants({ size: "sm" })}>
                      Edit post
                    </Link>

                    <form action={isPublished ? unpublishPostAction : publishPostAction}>
                      <input type="hidden" name="postId" value={post.id} />
                      <ActionSubmitButton
                        variant="outline"
                        size="sm"
                        label={isPublished ? "Unpublish" : "Publish"}
                        pendingLabel={isPublished ? "Unpublishing..." : "Publishing..."}
                      />
                    </form>

                    <form action={deletePostAction} id={`delete-post-${post.id}`}>
                      <input type="hidden" name="postId" value={post.id} />
                      <ConfirmSubmitButton
                        formId={`delete-post-${post.id}`}
                        triggerLabel="Delete"
                        title="Delete post?"
                        description="This post will be permanently removed."
                        confirmLabel="Delete post"
                        size="sm"
                      />
                    </form>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}

