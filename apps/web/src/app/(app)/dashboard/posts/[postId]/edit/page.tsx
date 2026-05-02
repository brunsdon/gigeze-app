import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionSubmitButton } from "@/components/forms/action-submit-button";
import { ConfirmSubmitButton } from "@/components/forms/confirm-submit-button";
import { PublicPostForm } from "@/components/forms/public-post-form";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCurrentWorkspace } from "@/lib/auth/workspace";
import { listJourneys } from "@/features/tours/service";
import {
  deletePostAction,
  publishPostAction,
  unpublishPostAction,
  updatePostAction,
} from "@/features/posts/actions";
import { getPostByIdForWorkspace } from "@/features/posts/service";

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

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  const workspace = await requireCurrentWorkspace();
  const [post, Tours] = await Promise.all([
    getPostByIdForWorkspace(postId, workspace.id),
    listJourneys(workspace.id),
  ]);

  if (!post) {
    notFound();
  }

  const isPublished = post.status === "PUBLISHED";

  return (
    <section className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Edit post</h1>
          <p className="text-muted-foreground">Updated {formatDate(post.updatedAt)}. Published {formatDate(post.publishedAt)}.</p>
        </div>
        <Link href="/dashboard/posts" className={buttonVariants({ variant: "outline" })}>
          Back to posts
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Post details</CardTitle>
        </CardHeader>
        <CardContent>
          <PublicPostForm
            action={updatePostAction}
            Tours={Tours}
            defaults={{
              postId: post.id,
              title: post.title,
              slug: post.slug,
              excerpt: post.excerpt ?? "",
              content: post.content,
              status: post.status,
              visibility: post.visibility,
              coverImageUrl: post.coverImageUrl ?? "",
              journeyId: post.journeyId ?? "",
              stopId: post.stopId ?? "",
            }}
            submitLabel="Save post"
            pendingLabel="Saving..."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Publishing and deletion</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <form action={isPublished ? unpublishPostAction : publishPostAction}>
            <input type="hidden" name="postId" value={post.id} />
            <ActionSubmitButton
              label={isPublished ? "Unpublish post" : "Publish post"}
              pendingLabel={isPublished ? "Unpublishing..." : "Publishing..."}
              variant="outline"
            />
          </form>

          <form action={deletePostAction} id={`delete-post-${post.id}`}>
            <input type="hidden" name="postId" value={post.id} />
            <ConfirmSubmitButton
              formId={`delete-post-${post.id}`}
              triggerLabel="Delete post"
              title="Delete post?"
              description="This post will be permanently removed from both dashboard and public site."
              confirmLabel="Delete post"
            />
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
