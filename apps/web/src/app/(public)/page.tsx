import Link from "next/link";
import Image from "next/image";
import { Camera, NotebookPen, Route } from "lucide-react";
import { listJourneys, listPublicJourneys } from "@/features/tours/service";
import { listLatestPublishedPosts } from "@/features/posts/service";
import { listPublicMediaItems } from "@/features/media/service";
import { getHomepageHeroSlides } from "@/features/media/homepage-hero";
import { Logo } from "@/components/branding/logo";
import { FeaturedMomentsHero } from "@/components/layout/featured-moments-hero";
import { PublicAttribution } from "@/components/layout/public-attribution";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/layout/empty-state";
import { getCurrentUser, getCurrentWorkspaceForUser } from "@/lib/auth/workspace";
import { isDatabaseConnectionError } from "@/lib/db/errors";

async function getHomeData() {
  try {
    const [Tours, posts, mediaItems] = await Promise.all([
      listPublicJourneys(),
      listLatestPublishedPosts(3),
      listPublicMediaItems(undefined, { limit: 16 }),
    ]);
    return { Tours, posts, mediaItems, isDbUnavailable: false };
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return { Tours: [], posts: [], mediaItems: [], isDbUnavailable: true };
    }

    throw error;
  }
}

async function getAuthenticatedHomeContext() {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const displayName = user.fullName?.trim() || user.email;
  const workspace = await getCurrentWorkspaceForUser(user.id);

  if (!workspace) {
    return {
      displayName,
      continueHref: "/dashboard",
    };
  }

  const Tours = await listJourneys(workspace.id);
  const continueJourney = Tours.find((Tour) => Tour.status === "ACTIVE") ?? Tours[0] ?? null;

  return {
    displayName,
    continueHref: continueJourney ? `/dashboard/Tours/${continueJourney.id}` : "/dashboard/Tours",
  };
}

export default async function PublicHomePage() {
  const [{ Tours, posts, mediaItems, isDbUnavailable }, authContext] = await Promise.all([
    getHomeData(),
    getAuthenticatedHomeContext(),
  ]);
  const [featuredJourney] = Tours;
  const [featuredPost] = posts;
  const featuredJourneyCover = (featuredJourney as { coverImageUrl?: string | null } | undefined)?.coverImageUrl ?? null;
  const homepageHeroSlides = await getHomepageHeroSlides(
    featuredJourney
      ? {
          title: featuredJourney.title,
        slug: featuredJourney.slug,
          coverImageUrl: (featuredJourney as { coverImageUrl?: string | null }).coverImageUrl ?? null,
        createdByUser: (featuredJourney as {
          createdByUser?: {
            fullName: string | null;
            email: string;
          } | null;
        }).createdByUser ?? null,
        workspace: (featuredJourney as { workspace?: { name: string } | null }).workspace ?? null,
        }
      : null,
    mediaItems,
  );

  return (
    <div className="space-y-16 pb-8 sm:space-y-20 lg:space-y-24">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-[0_10px_24px_rgba(36,48,40,0.05)] sm:p-10 lg:p-11" aria-labelledby="public-home-hero-title">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(63,95,84,0.16),transparent_52%),radial-gradient(circle_at_90%_12%,rgba(165,181,178,0.2),transparent_48%),linear-gradient(180deg,rgba(255,255,255,0.26),rgba(255,253,249,0.04))]" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0)_28%,rgba(47,93,80,0.045)_58%,rgba(201,111,59,0.05)_100%)] opacity-80" />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:items-end lg:gap-8">
          <div className="order-2 lg:order-1">
            <Logo variant="full" size="md" className="brand-mark-emphasis" aria-label="GigEze" />
            <h1 id="public-home-hero-title" className="mt-2.5 max-w-3xl text-[2.2rem] leading-[1.01] font-semibold tracking-tight text-foreground sm:text-[3.15rem] sm:leading-[1.02]">
              Capture life on the road
            </h1>
            <p className="mt-4 max-w-prose text-[0.98rem] leading-7 text-foreground/74 sm:text-[1.05rem] sm:leading-8">
              Track your Tours, relive your moments, and keep your trip records in one place.
            </p>
            <p className="mt-2 text-sm font-medium text-foreground/78">
              Built for tour logistics across Australia.
            </p>
            <p className="mt-2 text-sm text-foreground/65">
              Automatic trip tracking. No paperwork.
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5 sm:mt-7 sm:gap-3">
              <Link href="/Tours" className={buttonVariants({ size: "lg" })}>
                Explore Tours
              </Link>
              <Link href="/login" className={buttonVariants({ variant: "outline", size: "lg" })}>
                Start your Tour
              </Link>
            </div>
            {authContext ? (
              <div className="mt-4 rounded-xl border border-border/75 bg-background/70 px-4 py-3">
                <p className="text-sm font-medium text-foreground">Welcome back, {authContext.displayName}</p>
                <Link
                  href={authContext.continueHref}
                  className="mt-1 inline-flex text-sm font-medium text-primary transition-colors hover:text-primary/80 hover:underline"
                >
                  Continue your Tour
                </Link>
              </div>
            ) : null}
          </div>

          <div className="order-1 rounded-xl border border-border bg-background/72 p-4 shadow-[0_10px_24px_rgba(36,48,40,0.05)] sm:p-5 lg:order-2">
            <FeaturedMomentsHero slides={homepageHeroSlides} />
          </div>
        </div>
      </section>

      {/* Value band */}
      <section aria-label="What GigEze offers">
        <p className="mb-4 text-sm font-medium text-foreground/70">Never manually track your logbook again.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card/90 px-4 py-4">
            <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Route className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">Trips tracked automatically</p>
              <p className="mt-0.5 text-xs leading-5 text-foreground/65">GPS-recorded trips, Gig by Gig.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card/90 px-4 py-4">
            <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <NotebookPen className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">Logs kept accurate</p>
              <p className="mt-0.5 text-xs leading-5 text-foreground/65">Driving logs built automatically from your route.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card/90 px-4 py-4">
            <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Camera className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">Export when you need it</p>
              <p className="mt-0.5 text-xs leading-5 text-foreground/65">Download your logbook anytime, ready to use.</p>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/login" className={buttonVariants({ size: "sm" })}>
            Track your trip
          </Link>
          <Link href="/login?mode=signup" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Create your logbook
          </Link>
        </div>
      </section>

      {/* From the road — unified discovery */}
      <section className="space-y-5" aria-labelledby="from-the-road-title">
        <div>
          <h2 id="from-the-road-title" className="text-[1.55rem] leading-tight font-semibold tracking-tight sm:text-[2rem]">From the road</h2>
          <p className="mt-1 text-sm text-foreground/60">Real Tours and stories shared from across Australia.</p>
        </div>
        {isDbUnavailable ? (
          <p className="rounded-xl border border-dashed border-border/80 bg-card/80 px-4 py-3 text-sm leading-6 text-foreground/70">
            Local database is unavailable. Start PostgreSQL to load Tours and stories.
          </p>
        ) : null}
        {!featuredJourney && !featuredPost ? (
          <EmptyState
            title="Nothing published yet"
            description="Tours, stories, and Gigs will appear here as they are published."
            ctaLabel="Explore Tours"
            ctaHref="/Tours"
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {featuredJourney ? (
              <Card className="group border-border/65 bg-card/97 shadow-[0_9px_24px_rgba(43,42,40,0.05)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(43,42,40,0.075)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                {featuredJourneyCover ? (
                  <div className="relative -mx-1 overflow-hidden rounded-t-[inherit] border-b border-border/60 sm:-mx-2">
                    <div className="relative h-48 overflow-hidden bg-muted/20 sm:h-60">
                      <Image
                        src={featuredJourneyCover}
                        alt={`${featuredJourney.title} cover`}
                        fill
                        sizes="(max-width: 768px) 100vw, 50vw"
                        className="object-cover transition-transform duration-400 ease-out group-hover:scale-[1.045] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                        priority
                      />
                      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(152deg,rgba(24,30,28,0.24),rgba(24,30,28,0.07)_48%,rgba(24,30,28,0.02)_100%)]" />
                    </div>
                  </div>
                ) : null}
                <CardHeader className="space-y-1.5">
                  <CardTitle className="text-xl leading-tight sm:text-2xl">{featuredJourney.title}</CardTitle>
                  <PublicAttribution source={featuredJourney} />
                </CardHeader>
                <CardContent className="space-y-3.5">
                  <p className="max-w-prose text-sm leading-7 text-foreground/75 sm:text-base">
                    {featuredJourney.description || "Fresh routes and travel notes from the latest published Tour."}
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <Link href={`/Tours/${featuredJourney.slug}`} className={buttonVariants({ size: "sm" })}>
                      View Tour
                    </Link>
                    <span className="inline-flex items-center rounded-full border border-border/80 bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                      {featuredJourney.Gigs?.length ?? 0} Gigs
                    </span>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {featuredPost ? (
              <Card className="border-border/70 bg-card shadow-sm">
                <CardHeader className="space-y-2">
                  <CardTitle className="text-xl sm:text-2xl">{featuredPost.title}</CardTitle>
                  <PublicAttribution source={featuredPost} />
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="max-w-prose text-sm leading-7 text-foreground/75 sm:text-base">
                    {featuredPost.excerpt || "A new story from the road has just been published."}
                  </p>
                  <Link href={`/posts/${featuredPost.slug}`} className={buttonVariants({ size: "sm" })}>
                    Read story
                  </Link>
                </CardContent>
              </Card>
            ) : null}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <Link href="/Tours" className={buttonVariants({ variant: "outline", size: "sm" })}>
            All Tours
          </Link>
          <Link href="/posts" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            All stories
          </Link>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="relative overflow-hidden rounded-3xl border border-border/75 bg-card/95 px-6 py-10 text-center shadow-[0_8px_26px_rgba(43,42,40,0.055)] sm:px-10 sm:py-14" aria-labelledby="closing-cta-title">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(63,95,84,0.12),transparent_60%)]" />
        <div className="relative space-y-4">
          <h2 id="closing-cta-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">Start your own Tour</h2>
          <p className="mx-auto max-w-md text-sm leading-6 text-foreground/70 sm:text-base sm:leading-7">
            Keep your travels, stories, and trip records together in one place.
          </p>
          <Link href="/login?mode=signup" className={buttonVariants({ size: "lg" })}>
            Start your Tour
          </Link>
        </div>
      </section>
    </div>
  );
}

