import Link from "next/link";
import { ExternalMediaEntityType, ExternalMediaPlatform } from "@prisma/client";
import { ExternalLink, Link2, PlayCircle } from "lucide-react";
import { ActionSubmitButton } from "@/components/forms/action-submit-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createExternalMediaLinkAction,
  deleteExternalMediaLinkAction,
  updateExternalMediaLinkAction,
} from "@/features/external-media/actions";
import { type ExternalMediaLinkRecord } from "@/features/external-media/service";

type ExternalMediaSectionProps = {
  id?: string;
  entityType: ExternalMediaEntityType;
  entityId: string;
  links: ExternalMediaLinkRecord[];
  returnTo: string;
  title?: string;
  helperText?: string;
  targetOptions?: Array<{
    entityType: ExternalMediaEntityType;
    entityId: string;
    label: string;
  }>;
  defaultTargetValue?: string;
  targetLabelByValue?: Record<string, string>;
};

function getHostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function getPlatformLabel(platform: ExternalMediaPlatform) {
  switch (platform) {
    case ExternalMediaPlatform.FLICKR:
      return "Flickr";
    case ExternalMediaPlatform.YOUTUBE:
      return "YouTube";
    case ExternalMediaPlatform.INSTAGRAM:
      return "Instagram";
    case ExternalMediaPlatform.TIKTOK:
      return "TikTok";
    case ExternalMediaPlatform.FACEBOOK:
      return "Facebook";
    case ExternalMediaPlatform.GENERIC:
      return "Link";
  }
}

function getFallbackMessage(platform: ExternalMediaPlatform) {
  switch (platform) {
    case ExternalMediaPlatform.FLICKR:
      return "Flickr photos open in their original album or photostream.";
    case ExternalMediaPlatform.YOUTUBE:
      return "Preview unavailable. Open the original YouTube link.";
    case ExternalMediaPlatform.INSTAGRAM:
      return "Instagram preview requires public embed access, so this first version opens the original post.";
    case ExternalMediaPlatform.TIKTOK:
      return "TikTok preview falls back to a safe link card in this first version.";
    case ExternalMediaPlatform.FACEBOOK:
      return "Facebook preview falls back to a safe link card in this first version.";
    case ExternalMediaPlatform.GENERIC:
      return "Preview unavailable. Open the original link.";
  }
}

export function ExternalMediaSection({
  id,
  entityType,
  entityId,
  links,
  returnTo,
  title = "Moments",
  helperText = "Add a Flickr photo or YouTube video.",
  targetOptions,
  defaultTargetValue,
  targetLabelByValue,
}: ExternalMediaSectionProps) {
  const hasTargetOptions = Boolean(targetOptions?.length);
  const wholeJourneyCount = links.filter((link) => link.entityType === ExternalMediaEntityType.Tour).length;
  const stopMomentCount = links.filter((link) => link.entityType === ExternalMediaEntityType.MOMENT).length;

  return (
    <Card id={id}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            {title}
          </CardTitle>
          {links.length ? (
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">{wholeJourneyCount} whole Tour</Badge>
              <Badge variant="outline">{stopMomentCount} Gig moments</Badge>
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <form action={createExternalMediaLinkAction} className="space-y-4 rounded-2xl border border-border/70 bg-muted/15 p-4">
          {hasTargetOptions ? (
            <div className="space-y-2">
              <Label htmlFor="external-media-target">Attach to</Label>
              <select
                id="external-media-target"
                name="target"
                defaultValue={defaultTargetValue}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                {targetOptions?.map((option) => {
                  const value = `${option.entityType}:${option.entityId}`;
                  return (
                    <option key={value} value={value}>
                      {option.label}
                    </option>
                  );
                })}
              </select>
            </div>
          ) : (
            <>
              <input type="hidden" name="entityType" value={entityType} />
              <input type="hidden" name="entityId" value={entityId} />
            </>
          )}
          <input type="hidden" name="returnTo" value={returnTo} />

          <div className="space-y-2">
            <Label htmlFor="external-media-url">Moment link</Label>
            <Input
              id="external-media-url"
              name="url"
              type="url"
              required
              placeholder="https://www.flickr.com/photos/... or https://youtube.com/watch?v=..."
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="external-media-title">Title</Label>
              <Input id="external-media-title" name="title" placeholder="Optional title" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="external-media-caption">Caption</Label>
              <Textarea id="external-media-caption" name="caption" rows={2} placeholder="Optional caption" />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {helperText} Flickr is the preferred photo host, YouTube is the preferred video host, and existing uploaded moments still work.
            </p>
            <ActionSubmitButton label="Add moment" pendingLabel="Saving..." />
          </div>
        </form>

        {links.length ? (
          <div className="space-y-4">
            {links.map((link) => {
              const canEmbedYouTube = link.platform === ExternalMediaPlatform.YOUTUBE && Boolean(link.embedUrl);
              const targetLabel = targetLabelByValue?.[`${link.entityType}:${link.entityId}`];

              return (
                <div key={link.id} className="rounded-2xl border border-border/70 bg-card/70 p-4">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,1fr)]">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{getPlatformLabel(link.platform)}</Badge>
                        <Badge variant="outline">{getHostname(link.url)}</Badge>
                        {targetLabel ? <Badge variant="outline">{targetLabel}</Badge> : null}
                      </div>

                      {canEmbedYouTube ? (
                        <div className="overflow-hidden rounded-2xl border border-border/70 bg-black">
                          <div className="aspect-video w-full">
                            <iframe
                              title={link.title || "YouTube video"}
                              src={link.embedUrl ?? undefined}
                              className="h-full w-full"
                              loading="lazy"
                              referrerPolicy="strict-origin-when-cross-origin"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                              allowFullScreen
                            />
                          </div>
                        </div>
                      ) : link.thumbnailUrl ? (
                        <div
                          role="img"
                          aria-label={link.title || link.caption || `${getPlatformLabel(link.platform)} moment`}
                          className="aspect-video rounded-2xl border border-border/70 bg-muted/35 bg-cover bg-center"
                          style={{ backgroundImage: `url(${link.thumbnailUrl})` }}
                        />
                      ) : (
                        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/18 p-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2 text-foreground">
                            <PlayCircle className="h-4 w-4" />
                            <span className="font-medium">Preview unavailable</span>
                          </div>
                          <p className="mt-2">{getFallbackMessage(link.platform)}</p>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={link.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className={buttonVariants({ variant: "outline", size: "sm" })}
                        >
                          <ExternalLink className="h-4 w-4" />
                          Open original
                        </Link>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <form action={updateExternalMediaLinkAction} className="space-y-3">
                        <input type="hidden" name="linkId" value={link.id} />
                        <input type="hidden" name="entityType" value={entityType} />
                        <input type="hidden" name="entityId" value={entityId} />
                        <input type="hidden" name="returnTo" value={returnTo} />

                        <div className="space-y-2">
                          <Label htmlFor={`external-title-${link.id}`}>Title</Label>
                          <Input id={`external-title-${link.id}`} name="title" defaultValue={link.title ?? ""} />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`external-caption-${link.id}`}>Caption</Label>
                          <Textarea
                            id={`external-caption-${link.id}`}
                            name="caption"
                            rows={4}
                            defaultValue={link.caption ?? ""}
                          />
                        </div>

                        <div className="rounded-xl border border-border/70 bg-muted/15 p-3 text-sm">
                          <p className="font-medium text-foreground">{link.title || getPlatformLabel(link.platform)}</p>
                          <p className="mt-1 break-all text-xs text-muted-foreground">{link.url}</p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <ActionSubmitButton label="Save details" pendingLabel="Saving..." variant="outline" />
                        </div>
                      </form>

                      <form action={deleteExternalMediaLinkAction}>
                        <input type="hidden" name="linkId" value={link.id} />
                        <input type="hidden" name="entityType" value={entityType} />
                        <input type="hidden" name="entityId" value={entityId} />
                        <input type="hidden" name="returnTo" value={returnTo} />
                        <ActionSubmitButton
                          label="Unlink"
                          pendingLabel="Removing..."
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          confirmMessage="Unlink this hosted moment?"
                        />
                      </form>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/15 p-5 text-sm text-muted-foreground">
            No hosted moments yet. Add a Flickr photo or YouTube video to keep the story organised without uploading the media itself.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
