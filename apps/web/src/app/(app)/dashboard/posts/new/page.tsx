import Link from "next/link";
import { PublicPostForm } from "@/components/forms/public-post-form";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCurrentWorkspace } from "@/lib/auth/workspace";
import { createPostAction } from "@/features/posts/actions";
import { listJourneys } from "@/features/tours/service";
import { getMediaItemById } from "@/features/media/service";

function buildPostPrefillFromMedia(media: Awaited<ReturnType<typeof getMediaItemById>>) {
  if (!media) {
    return {};
  }

  const titleSource = media.caption?.trim() || media.fileName;
  const trimmedTitle = titleSource.length > 80 ? `${titleSource.slice(0, 77).trimEnd()}...` : titleSource;
  const contentLines = [media.caption?.trim(), media.publicUrl ? `![${media.fileName}](${media.publicUrl})` : null].filter(
    (line): line is string => Boolean(line),
  );

  return {
    title: trimmedTitle,
    excerpt: media.caption ?? "",
    content: contentLines.join("\n\n"),
    coverImageUrl: media.publicUrl ?? "",
    journeyId: media.journeyId ?? "",
    stopId: media.stopId ?? "",
  };
}

export default async function NewPostPage({
  searchParams,
}: {
  searchParams: Promise<{ fromMediaId?: string }>;
}) {
  const workspace = await requireCurrentWorkspace();
  const { fromMediaId } = await searchParams;
  const [Tours, sourceMedia] = await Promise.all([
    listJourneys(workspace.id),
    fromMediaId ? getMediaItemById(workspace.id, fromMediaId) : Promise.resolve(null),
  ]);

  const preferredJourneyId = Tours.find((Tour) => Tour.status === "ACTIVE")?.id ?? Tours[0]?.id;
  const mediaPrefill = buildPostPrefillFromMedia(sourceMedia);

  return (
    <section className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">New post</h1>
          <p className="text-muted-foreground">Create a draft or publish immediately.</p>
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
            action={createPostAction}
            Tours={Tours}
            defaults={{
              visibility: workspace.defaultPostVisibility,
              journeyId: mediaPrefill.journeyId || preferredJourneyId,
              ...mediaPrefill,
            }}
            submitLabel="Create post"
            pendingLabel="Creating..."
          />
        </CardContent>
      </Card>
    </section>
  );
}

