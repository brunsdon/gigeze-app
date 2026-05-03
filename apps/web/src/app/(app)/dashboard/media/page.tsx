import Link from "next/link";
import { ExternalMediaEntityType } from "@prisma/client";
import { Camera, Link2, PlayCircle, UploadCloud } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { ConfirmSubmitButton } from "@/components/forms/confirm-submit-button";
import { MediaUploadForm } from "@/components/forms/media-upload-form";
import { ActionSubmitButton } from "@/components/forms/action-submit-button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { VisibilityBadge } from "@/components/ui/visibility-badge";
import {
  createMediaMetadataAction,
  deleteMediaAction,
} from "@/features/media/actions";
import { createExternalMediaLinkAction } from "@/features/external-media/actions";
import { requireCurrentWorkspace } from "@/lib/auth/workspace";
import { visibilityOptions } from "@/lib/visibility";
import { listMediaItems } from "@/features/media/service";
import { listJourneys } from "@/features/tours/service";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    timeZone: "Australia/Sydney",
    year: "numeric",
  }).format(value);
}

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<{ journeyId?: string; stopId?: string }>;
}) {
  const { journeyId, stopId } = await searchParams;
  const workspace = await requireCurrentWorkspace();
  const [Tours, mediaItems] = await Promise.all([listJourneys(workspace.id), listMediaItems(workspace.id)]);
  const defaultJourneyFromQuery = journeyId && Tours.some((Tour) => Tour.id === journeyId) ? journeyId : undefined;
  const preferredJourneyId =
    defaultJourneyFromQuery ?? Tours.find((Tour) => Tour.status === "ACTIVE")?.id ?? Tours[0]?.id ?? "";
  const Gigs = Tours.flatMap((Tour) =>
    Tour.Gigs.map((Gig) => ({
      id: Gig.id,
      title: Gig.title,
      journeyTitle: Tour.title,
      journeyId: Tour.id,
    })),
  );

  const preferredStopId = stopId && Gigs.some((item) => item.id === stopId) ? stopId : "";
  const momentTargetOptions = [
    ...Tours.map((Tour) => ({
      value: `${ExternalMediaEntityType.Tour}:${Tour.id}`,
      label: `Whole Tour: ${Tour.title}`,
    })),
    ...Gigs.map((Gig) => ({
      value: `${ExternalMediaEntityType.MOMENT}:${Gig.id}`,
      label: `Gig: ${Gig.title} (${Gig.journeyTitle})`,
    })),
  ];
  const preferredMomentTarget = preferredStopId
    ? `${ExternalMediaEntityType.MOMENT}:${preferredStopId}`
    : preferredJourneyId
      ? `${ExternalMediaEntityType.Tour}:${preferredJourneyId}`
      : momentTargetOptions[0]?.value ?? "";

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <p className="text-[0.7rem] font-black tracking-[0.22em] text-[#FFB000] uppercase">Media bay</p>
          <h1 className="text-3xl font-semibold tracking-tight">Media</h1>
          <p className="text-muted-foreground">Attach Flickr photos, YouTube videos, and hosted media to tours and gigs.</p>
        </div>
        <Link href="/dashboard/Tours" className={buttonVariants({ variant: "outline" })}>
          Choose Tour
        </Link>
      </div>

      <Card id="add-moment" className="border-primary/25 bg-card/98 shadow-[0_18px_44px_rgba(255,46,99,0.1)]">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/8 px-2.5 py-1 text-primary">
              <Camera className="h-3.5 w-3.5" />
              Add Flickr photo
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/70 px-2.5 py-1">
              <PlayCircle className="h-3.5 w-3.5" />
              Add YouTube video
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/70 px-2.5 py-1">
              <Link2 className="h-3.5 w-3.5" />
              Paste link
            </span>
          </div>
          <CardTitle>Upload Media</CardTitle>
          <CardDescription>
            Paste a Flickr photo or YouTube video, then attach it to a whole tour or one gig.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {momentTargetOptions.length ? (
            <form action={createExternalMediaLinkAction} className="grid gap-4 md:grid-cols-2">
              <input type="hidden" name="returnTo" value="/dashboard/media" />
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="moment-target">Attach to</Label>
                <select
                  id="moment-target"
                  name="target"
                  defaultValue={preferredMomentTarget}
                  required
                  className="w-full"
                >
                  {momentTargetOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="moment-url">Moment link</Label>
                <Input
                  id="moment-url"
                  name="url"
                  type="url"
                  required
                  placeholder="https://www.flickr.com/photos/... or https://youtu.be/..."
                />
                <p className="text-xs text-muted-foreground">Flickr is best for photos. YouTube is best for videos. Other hosted links are supported when needed.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="moment-title">Title</Label>
                <Input id="moment-title" name="title" placeholder="Optional title" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="moment-caption">Caption</Label>
                <Input id="moment-caption" name="caption" placeholder="Optional caption" />
              </div>
              <div className="flex flex-wrap gap-2 md:col-span-2">
                <ActionSubmitButton label="Add Flickr photo" pendingLabel="Saving..." />
                <ActionSubmitButton label="Add YouTube video" pendingLabel="Saving..." variant="outline" />
                <ActionSubmitButton label="Paste link" pendingLabel="Saving..." variant="ghost" />
              </div>
            </form>
          ) : (
            <EmptyState
              title="Create a tour before uploading media"
              description="Media attaches to a whole tour or to one of its gigs, so create the tour first and come back with a Flickr photo or YouTube video."
              ctaLabel="Create Tour"
              ctaHref="/dashboard/Tours/new"
            />
          )}
        </CardContent>
      </Card>

      <details id="media-upload-form" className="rounded-2xl border border-border/75 bg-card/95 p-5 shadow-sm">
        <summary className="cursor-pointer list-none text-sm font-medium text-foreground marker:hidden">
          <span className="inline-flex items-center gap-2">
            <UploadCloud className="h-4 w-4 text-muted-foreground" />
            Advanced: upload files to GigEze storage
          </span>
        </summary>
        <div className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Existing uploaded moments still work. Use direct upload when you need GigEze to host the file.
          </p>
          <MediaUploadForm
            Tours={Tours.map((Tour) => ({ id: Tour.id, title: Tour.title }))}
            Gigs={Gigs}
            defaultVisibility={workspace.defaultMediaVisibility}
            initialJourneyId={preferredJourneyId}
            initialStopId={preferredStopId}
          />
        </div>
      </details>

      <details className="rounded-2xl border border-border/75 bg-card/95 p-5 shadow-sm">
        <summary className="cursor-pointer list-none text-sm font-medium text-foreground marker:hidden">
          Advanced: save details without uploading a file
        </summary>
        <div className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Use this for backfills or external upload pipelines. Most new moments should use hosted Flickr or YouTube links above.
          </p>
          <form action={createMediaMetadataAction} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="journeyId">Tour (optional)</Label>
              <select id="journeyId" name="journeyId" defaultValue={preferredJourneyId} className="w-full">
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
              <select id="stopId" name="stopId" defaultValue={preferredStopId} className="w-full">
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
              <Input id="filePath" name="filePath" placeholder="Tours/nsw-coast-run/photo-1.jpg" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fileName">File name</Label>
              <Input id="fileName" name="fileName" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="publicUrl">Public URL (optional)</Label>
              <Input id="publicUrl" name="publicUrl" type="url" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mimeType">MIME type</Label>
              <Input id="mimeType" name="mimeType" placeholder="image/jpeg" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sizeBytes">Size bytes</Label>
              <Input id="sizeBytes" name="sizeBytes" type="number" min={0} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="caption">Caption</Label>
              <Input id="caption" name="caption" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="visibility">Visibility</Label>
              <select
                id="visibility"
                name="visibility"
                defaultValue={workspace.defaultMediaVisibility}
                className="w-full"
              >
                {visibilityOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <ActionSubmitButton label="Save uploaded moment metadata" pendingLabel="Saving..." className="md:w-fit" />
          </form>
        </div>
      </details>

      <Card>
        <CardHeader>
          <CardTitle>Uploaded media archive</CardTitle>
          <CardDescription>
            These are existing storage-backed media items. New photos and videos are best added with Flickr or YouTube above.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!mediaItems.length ? (
            <EmptyState
              title="No media ready to publish"
              description="Hosted Flickr and YouTube media is the preferred path. Uploaded files will appear here when you use direct file storage."
              ctaLabel="Upload Media"
              ctaHref="#add-moment"
              secondaryCtaLabel="Go to Tours"
              secondaryCtaHref="/dashboard/Tours"
            />
          ) : (
            <>
              <div className="grid gap-3 md:hidden">
                {mediaItems.map((item) => (
                  <article key={item.id} className="rounded-xl border border-border/75 bg-card/90 p-3.5">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{item.fileName}</p>
                      <p className="text-xs text-muted-foreground">{item.caption || item.filePath}</p>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <VisibilityBadge visibility={item.visibility} />
                      <span>Tour: {item.Tour?.title || "-"}</span>
                      <span>Gig: {item.Gig?.title || "-"}</span>
                      <span>Created: {formatDate(item.createdAt)}</span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        href={`/dashboard/media/${item.id}/edit`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        Edit
                      </Link>
                      <Link
                        href={`/dashboard/posts/new?fromMediaId=${item.id}`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        Create post
                      </Link>
                      <form action={deleteMediaAction} id={`delete-media-mobile-${item.id}`}>
                        <input type="hidden" name="mediaId" value={item.id} />
                        <ConfirmSubmitButton
                          formId={`delete-media-mobile-${item.id}`}
                          triggerLabel="Delete"
                          title="Delete uploaded moment?"
                          description="This removes the storage file first, then deletes metadata. If storage deletion fails, metadata stays intact."
                          confirmLabel="Delete"
                          size="sm"
                        />
                      </form>
                    </div>
                  </article>
                ))}
              </div>

              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File</TableHead>
                      <TableHead>Tour</TableHead>
                      <TableHead>Gig</TableHead>
                      <TableHead>Visibility</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mediaItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="space-y-1 text-sm">
                            <p className="font-medium">{item.fileName}</p>
                            <p className="text-muted-foreground">{item.caption || item.filePath}</p>
                          </div>
                        </TableCell>
                        <TableCell>{item.Tour?.title || "-"}</TableCell>
                        <TableCell>{item.Gig?.title || "-"}</TableCell>
                        <TableCell><VisibilityBadge visibility={item.visibility} /></TableCell>
                        <TableCell>{formatDate(item.createdAt)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Link
                              href={`/dashboard/media/${item.id}/edit`}
                              className={buttonVariants({ variant: "outline", size: "sm" })}
                            >
                              Edit
                            </Link>
                            <Link
                              href={`/dashboard/posts/new?fromMediaId=${item.id}`}
                              className={buttonVariants({ variant: "outline", size: "sm" })}
                            >
                              Create post
                            </Link>
                            <form action={deleteMediaAction} id={`delete-media-${item.id}`}>
                              <input type="hidden" name="mediaId" value={item.id} />
                              <ConfirmSubmitButton
                                formId={`delete-media-${item.id}`}
                                triggerLabel="Delete"
                                title="Delete uploaded moment?"
                                description="This removes the storage file first, then deletes metadata. If storage deletion fails, metadata stays intact."
                                confirmLabel="Delete"
                                size="sm"
                              />
                            </form>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

