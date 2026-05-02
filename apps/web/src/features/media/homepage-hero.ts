import { unstable_cache } from "next/cache";
import { formatDateInputValue } from "@/lib/datetime";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { formatPublicAttribution } from "@/lib/public-attribution";
import {
  isPublicMediaImageLike,
  resolvePublicMediaUrlBySize,
} from "@/features/media/public-url";
import {
  listPublicMediaItems,
  type PublicGalleryMediaItem,
} from "@/features/media/service";

const HOMEPAGE_HERO_FALLBACK_IMAGE = "/og-image.svg";
const HOMEPAGE_HERO_MEDIA_LIMIT = 16;
const HOMEPAGE_HERO_SLIDES_MIN = 3;
const HOMEPAGE_HERO_SLIDES_MAX = 5;

type FeaturedJourneyLike = {
  title: string;
  slug?: string;
  coverImageUrl?: string | null;
  createdByUser?: {
    fullName: string | null;
    email: string;
  } | null;
  workspace?: {
    name: string;
  } | null;
};

type HomepageHeroRenderableMedia = {
  id: string;
  fileName: string;
  filePath?: string | null;
  publicUrl?: string | null;
  mimeType?: string | null;
  caption?: string | null;
  Tour?: {
    title: string;
  } | null;
};

export type HomepageHeroImage = {
  source: "featured-Tour" | "latest-public-media" | "random-public-media" | "fallback-static";
  alt: string;
  media: HomepageHeroRenderableMedia | null;
  fallbackSrc: string;
};

export type HomepageHeroSlide = {
  id: string;
  source: "featured-Tour" | "strong-recent-public-media" | "latest-public-media" | "random-public-media" | "fallback-static";
  imageUrl: string;
  title: string;
  subtitle: string;
  href: string;
  ctaLabel: string;
  attribution: string;
  journeyTitle?: string | null;
  workspaceName?: string | null;
  ownerName?: string | null;
  alt: string;
  media: HomepageHeroRenderableMedia | null;
  fallbackSrc: string;
  isFallback: boolean;
};

const getCachedHomepageHeroMediaCandidates = unstable_cache(
  async () => listPublicMediaItems(undefined, { limit: HOMEPAGE_HERO_MEDIA_LIMIT }),
  ["homepage-hero-media-candidates"],
  { revalidate: 600 },
);

function hasResolvableMediumImage(item: Pick<PublicGalleryMediaItem, "filePath" | "fileName" | "publicUrl" | "mimeType">) {
  if (!isPublicMediaImageLike(item)) {
    return false;
  }

  const resolved = resolvePublicMediaUrlBySize(item, "medium", {
    supabaseUrl: getSupabasePublicEnv().url,
  });

  return Boolean(resolved);
}

function toRenderableMedia(item: PublicGalleryMediaItem): HomepageHeroRenderableMedia {
  return {
    id: item.id,
    fileName: item.fileName,
    filePath: item.filePath,
    publicUrl: item.publicUrl,
    mimeType: item.mimeType,
    caption: item.caption,
    Tour: item.Tour ? { title: item.Tour.title } : null,
  };
}

function buildFallbackImage(index = 0): HomepageHeroSlide {
  const fallbackSlides = [
    {
      title: "Featured moments from the road",
      subtitle: "Published Tours and shared stories from the GigEze community.",
      href: "/Tours",
      ctaLabel: "Explore Tours",
    },
    {
      title: "Fresh stories, shared openly",
      subtitle: "Discover routes, Gigs, and memories published by travellers across the platform.",
      href: "/posts",
      ctaLabel: "Read the story",
    },
    {
      title: "Scenic captures from real Tours",
      subtitle: "Browse photo moments from public Tours and shared road journals.",
      href: "/gallery",
      ctaLabel: "Browse gallery",
    },
  ] as const;

  const variant = fallbackSlides[index % fallbackSlides.length] ?? fallbackSlides[0];

  return {
    id: `fallback-static-${index}`,
    source: "fallback-static",
    imageUrl: HOMEPAGE_HERO_FALLBACK_IMAGE,
    title: variant.title,
    subtitle: variant.subtitle,
    href: variant.href,
    ctaLabel: variant.ctaLabel,
    attribution: "Shared by the road community",
    journeyTitle: null,
    workspaceName: null,
    ownerName: null,
    alt: "Tour logistics dashboard illustration",
    media: null,
    fallbackSrc: HOMEPAGE_HERO_FALLBACK_IMAGE,
    isFallback: true,
  };
}

function getOwnerName(owner?: { fullName: string | null; email: string } | null) {
  if (!owner) {
    return null;
  }

  const fullName = owner.fullName?.trim();
  if (fullName) {
    return fullName;
  }

  const prefix = owner.email.split("@")[0]?.trim();
  return prefix || null;
}

function buildFeaturedJourneySlide(featuredJourney: FeaturedJourneyLike): HomepageHeroSlide | null {
  const featuredJourneyCover = featuredJourney.coverImageUrl?.trim();
  if (!featuredJourneyCover) {
    return null;
  }

  return {
    id: "featured-Tour-cover",
    source: "featured-Tour",
    imageUrl: featuredJourneyCover,
    title: featuredJourney.title,
    subtitle: "A published Tour from the road community.",
    href: featuredJourney.slug ? `/Tours/${featuredJourney.slug}` : "/Tours",
    ctaLabel: featuredJourney.slug ? "View Tour" : "Explore this moment",
    attribution: `Shared by ${formatPublicAttribution(featuredJourney)}`,
    journeyTitle: featuredJourney.title,
    workspaceName: featuredJourney.workspace?.name ?? null,
    ownerName: getOwnerName(featuredJourney.createdByUser),
    alt: `${featuredJourney.title} featured cover image`,
    media: {
      id: "featured-Tour-cover",
      fileName: "featured-Tour-cover.jpg",
      publicUrl: featuredJourneyCover,
      mimeType: "image/jpeg",
      caption: featuredJourney.title,
      Tour: { title: featuredJourney.title },
    },
    fallbackSrc: HOMEPAGE_HERO_FALLBACK_IMAGE,
    isFallback: false,
  };
}

function buildMediaSlide(
  item: PublicGalleryMediaItem,
  source: HomepageHeroSlide["source"],
): HomepageHeroSlide | null {
  const imageUrl = resolvePublicMediaUrlBySize(item, "medium", {
    supabaseUrl: getSupabasePublicEnv().url,
  });

  if (!imageUrl) {
    return null;
  }

  const stopTitle = item.Gig?.title?.trim() || null;
  const journeyTitle = item.Tour?.title?.trim() || null;
  const caption = item.caption?.trim() || null;
  const hasJourney = Boolean(item.Tour?.slug);
  const title = stopTitle || journeyTitle || caption || "Featured moment";

  let subtitle = "Shared moments from Tours across the community.";
  if (stopTitle && journeyTitle) {
    subtitle = `At ${stopTitle} on ${journeyTitle}`;
  } else if (caption && caption !== title) {
    subtitle = caption;
  } else if (journeyTitle) {
    subtitle = `Along ${journeyTitle}`;
  } else if (stopTitle) {
    subtitle = `Shared from ${stopTitle}`;
  }

  return {
    id: item.id,
    source,
    imageUrl,
    title,
    subtitle,
    href: hasJourney ? `/Tours/${item.Tour?.slug}` : "/gallery",
    ctaLabel: hasJourney ? "View Tour" : "Explore this moment",
    attribution: `Shared by ${formatPublicAttribution(item)}`,
    journeyTitle: journeyTitle,
    workspaceName: item.workspace?.name ?? null,
    ownerName: getOwnerName(item.createdByUser),
    alt: title,
    media: toRenderableMedia(item),
    fallbackSrc: HOMEPAGE_HERO_FALLBACK_IMAGE,
    isFallback: false,
  };
}

function deterministicIndex(seed: string, length: number) {
  if (length <= 1) {
    return 0;
  }

  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return hash % length;
}

function getDeterministicRotation(items: PublicGalleryMediaItem[]) {
  if (items.length <= 1) {
    return items;
  }

  const daySeed = formatDateInputValue(new Date());
  const idsSeed = items.map((item) => item.id).join("|");
  const startIndex = deterministicIndex(`${daySeed}:${idsSeed}:rotation`, items.length);

  return [...items.slice(startIndex), ...items.slice(0, startIndex)];
}

export async function getHomepageHeroSlides(
  featuredJourney?: FeaturedJourneyLike | null,
  mediaCandidates?: PublicGalleryMediaItem[],
): Promise<HomepageHeroSlide[]> {
  const slides: HomepageHeroSlide[] = [];
  const usedIds = new Set<string>();

  const featuredSlide = featuredJourney ? buildFeaturedJourneySlide(featuredJourney) : null;
  if (featuredSlide) {
    slides.push(featuredSlide);
    usedIds.add(featuredSlide.id);
  }

  const candidatePool = mediaCandidates ?? await getCachedHomepageHeroMediaCandidates();
  const validImageCandidates = candidatePool.filter((item) => hasResolvableMediumImage(item));

  const strongRecentCandidates = validImageCandidates
    .filter((item) => Boolean(item.caption?.trim()) || Boolean(item.Tour?.title))
    .slice(0, 2);

  for (const item of strongRecentCandidates) {
    if (usedIds.has(item.id)) {
      continue;
    }

    const slide = buildMediaSlide(item, "strong-recent-public-media");
    if (!slide) {
      continue;
    }

    slides.push(slide);
    usedIds.add(item.id);

    if (slides.length >= HOMEPAGE_HERO_SLIDES_MAX) {
      return slides.slice(0, HOMEPAGE_HERO_SLIDES_MAX);
    }
  }

  const latestMediaCandidate = validImageCandidates[0] ?? null;
  if (latestMediaCandidate && !usedIds.has(latestMediaCandidate.id)) {
    const latestSlide = buildMediaSlide(latestMediaCandidate, "latest-public-media");
    if (latestSlide) {
      slides.push(latestSlide);
      usedIds.add(latestMediaCandidate.id);
    }
  }

  const remainingCandidates = getDeterministicRotation(
    validImageCandidates.filter((item) => !usedIds.has(item.id)),
  );

  for (const item of remainingCandidates) {
    if (slides.length >= HOMEPAGE_HERO_SLIDES_MAX) {
      break;
    }

    const randomSlide = buildMediaSlide(item, "random-public-media");
    if (!randomSlide) {
      continue;
    }

    slides.push(randomSlide);
    usedIds.add(item.id);
  }

  if (!slides.length) {
    return [buildFallbackImage()];
  }

  while (slides.length < HOMEPAGE_HERO_SLIDES_MIN && slides.length < HOMEPAGE_HERO_SLIDES_MAX) {
    slides.push(buildFallbackImage(slides.length));
  }

  return slides.slice(0, HOMEPAGE_HERO_SLIDES_MAX);
}

export async function getHomepageHeroImage(
  featuredJourney?: FeaturedJourneyLike | null,
  mediaCandidates?: PublicGalleryMediaItem[],
): Promise<HomepageHeroImage> {
  const slides = await getHomepageHeroSlides(featuredJourney, mediaCandidates);
  const firstSlide = slides[0] ?? buildFallbackImage();

  if (firstSlide.source === "featured-Tour") {
    return {
      source: "featured-Tour",
      alt: firstSlide.alt,
      media: firstSlide.media,
      fallbackSrc: HOMEPAGE_HERO_FALLBACK_IMAGE,
    };
  }

  if (firstSlide.source === "fallback-static") {
    return {
      source: "fallback-static",
      alt: firstSlide.alt,
      media: null,
      fallbackSrc: HOMEPAGE_HERO_FALLBACK_IMAGE,
    };
  }

  if (firstSlide.source === "latest-public-media" || firstSlide.source === "strong-recent-public-media") {
    return {
      source: "latest-public-media",
      alt: firstSlide.alt,
      media: firstSlide.media,
      fallbackSrc: HOMEPAGE_HERO_FALLBACK_IMAGE,
    };
  }

  return {
    source: "random-public-media",
    alt: firstSlide.alt,
    media: firstSlide.media,
    fallbackSrc: HOMEPAGE_HERO_FALLBACK_IMAGE,
  };
}
