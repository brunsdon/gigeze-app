import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionSubmitButton } from "@/components/forms/action-submit-button";
import { ConfirmSubmitButton } from "@/components/forms/confirm-submit-button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireCurrentWorkspace } from "@/lib/auth/workspace";
import { visibilityOptions } from "@/lib/visibility";
import { deleteMediaAction, updateMediaMetadataAction } from "@/features/media/actions";
import { getMediaItemById } from "@/features/media/service";
import { listJourneys } from "@/features/tours/service";

export default async function EditMediaPage({
  params,
}: {
  params: Promise<{ mediaId: string }>;
}) {
  const { mediaId } = await params;
  const workspace = await requireCurrentWorkspace();
  const [item, Tours] = await Promise.all([getMediaItemById(workspace.id, mediaId), listJourneys(workspace.id)]);

  if (!item) {
    notFound();
  }

  const Gigs = Tours.flatMap((Tour) =>
    Tour.Gigs.map((Gig) => ({
      id: Gig.id,
      title: Gig.title,
      journeyId: Tour.id,
      journeyTitle: Tour.title,
    })),
  );

  return (
    <section className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Edit uploaded moment metadata</h1>
          <p className="text-muted-foreground">Manage the storage-backed record for this uploaded moment.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/dashboard/posts/new?fromMediaId=${item.id}`} className={buttonVariants({ variant: "outline" })}>
            Create post
          </Link>
          <Link href="/dashboard/media" className={buttonVariants({ variant: "outline" })}>
            Back to Moments
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Metadata details</CardTitle>
          <CardDescription>
            Deleting this entry removes only the uploaded moment metadata record. It does not delete the storage object automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateMediaMetadataAction} className="grid gap-4 md:grid-cols-2">
            <input type="hidden" name="mediaId" value={item.id} />

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="journeyId">Tour (optional)</Label>
              <select
                id="journeyId"
                name="journeyId"
                defaultValue={item.Tour?.id ?? ""}
                className="w-full"
              >
                <option value="">No Tour link</option>
                {Tours.map((Tour) => (
                  <option key={Tour.id} value={Tour.id}>
                    {Tour.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="stopId">Gig (optional)</Label>
              <select
                id="stopId"
                name="stopId"
                defaultValue={item.Gig?.id ?? ""}
                className="w-full"
              >
                <option value="">No Gig link</option>
                {Gigs.map((Gig) => (
                  <option key={Gig.id} value={Gig.id}>
                    {Gig.title} ({Gig.journeyTitle})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filePath">File path</Label>
              <Input id="filePath" name="filePath" defaultValue={item.filePath} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fileName">File name</Label>
              <Input id="fileName" name="fileName" defaultValue={item.fileName} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="publicUrl">Public URL (optional)</Label>
              <Input id="publicUrl" name="publicUrl" type="url" defaultValue={item.publicUrl ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mimeType">MIME type</Label>
              <Input id="mimeType" name="mimeType" defaultValue={item.mimeType ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sizeBytes">Size bytes</Label>
              <Input id="sizeBytes" name="sizeBytes" type="number" min={0} defaultValue={item.sizeBytes ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="caption">Caption</Label>
              <Input id="caption" name="caption" defaultValue={item.caption ?? ""} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="visibility">Visibility</Label>
              <select id="visibility" name="visibility" defaultValue={item.visibility} className="w-full">
                {visibilityOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <ActionSubmitButton label="Save uploaded moment metadata" pendingLabel="Saving..." className="md:col-span-2 md:w-fit" />
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Delete entry</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={deleteMediaAction} id={`delete-media-${item.id}`}>
            <input type="hidden" name="mediaId" value={item.id} />
            <ConfirmSubmitButton
              formId={`delete-media-${item.id}`}
              triggerLabel="Delete uploaded moment metadata"
              title="Delete uploaded moment metadata?"
              description="This removes only the database record. The storage object is left untouched for safety."
              confirmLabel="Delete uploaded moment metadata"
            />
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
