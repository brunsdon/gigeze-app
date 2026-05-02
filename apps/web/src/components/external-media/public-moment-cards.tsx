import Link from "next/link";
import { ExternalMediaEntityType, ExternalMediaPlatform } from "@prisma/client";
import { ExternalLink, PlayCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button-variants";
import { type ExternalMediaLinkRecord } from "@/features/external-media/service";

type PublicMomentCardsProps = {
  title: string;
  links: ExternalMediaLinkRecord[];
  stopTitleById?: Map<string, string>;
  framed?: boolean;
};

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

function MomentGrid({ links, stopTitleById }: Omit<PublicMomentCardsProps, "title" | "framed">) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {links.map((link) => {
        const isYouTube = link.platform === ExternalMediaPlatform.YOUTUBE && Boolean(link.embedUrl);
        const stopTitle =
          link.entityType === ExternalMediaEntityType.MOMENT ? stopTitleById?.get(link.entityId) : undefined;

        return (
          <article key={link.id} className="overflow-hidden rounded-xl border border-border/75 bg-background/80 shadow-sm">
            {isYouTube ? (
              <div className="aspect-video bg-black">
                <iframe
                  title={link.title || "YouTube moment"}
                  src={link.embedUrl ?? undefined}
                  className="h-full w-full"
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            ) : link.thumbnailUrl ? (
              <div
                role="img"
                aria-label={link.title || link.caption || "Tour moment"}
                className="aspect-video w-full bg-muted/35 bg-cover bg-center"
                style={{ backgroundImage: `url(${link.thumbnailUrl})` }}
              />
            ) : (
              <div className="flex aspect-video flex-col items-center justify-center gap-2 bg-muted/35 text-muted-foreground">
                <PlayCircle className="h-7 w-7" />
                <span className="text-xs">Open this moment</span>
              </div>
            )}
            <div className="space-y-2 p-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{getPlatformLabel(link.platform)}</Badge>
                {stopTitle ? <Badge variant="outline">{stopTitle}</Badge> : null}
              </div>
              <p className="font-medium text-foreground">{link.title || link.caption || (link.platform === ExternalMediaPlatform.YOUTUBE ? "Tour video" : "Tour photo")}</p>
              {link.caption && link.title ? <p className="text-muted-foreground">{link.caption}</p> : null}
              <Link href={link.url} target="_blank" rel="noreferrer noopener" className={buttonVariants({ variant: "outline", size: "sm" })}>
                <ExternalLink className="h-4 w-4" />
                Open on {getPlatformLabel(link.platform)}
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function PublicMomentCards({ title, links, stopTitleById, framed = true }: PublicMomentCardsProps) {
  if (!links.length) {
    return null;
  }

  if (!framed) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <MomentGrid links={links} stopTitleById={stopTitleById} />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <MomentGrid links={links} stopTitleById={stopTitleById} />
      </CardContent>
    </Card>
  );
}
