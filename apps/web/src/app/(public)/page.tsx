import Link from "next/link";
import { Camera, ClipboardList, MapPin } from "lucide-react";
import { listJourneys, listPublicJourneys } from "@/features/tours/service";
import { listLatestPublishedPosts } from "@/features/posts/service";
import { Logo } from "@/components/branding/logo";
import { PublicAttribution } from "@/components/layout/public-attribution";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser, getCurrentWorkspaceForUser } from "@/lib/auth/workspace";
import { isDatabaseConnectionError } from "@/lib/db/errors";

async function getHomeData() {
  try {
    const [Tours, posts] = await Promise.all([
      listPublicJourneys(),
      listLatestPublishedPosts(3),
    ]);
    return { Tours, posts, isDbUnavailable: false };
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return { Tours: [], posts: [], isDbUnavailable: true };
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

function BackstagePassMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[25rem] lg:ml-6 lg:translate-x-8 lg:translate-y-7 lg:rotate-[2deg] xl:translate-x-14">
      <div aria-hidden="true" className="absolute -inset-10 rounded-[2.25rem] bg-[radial-gradient(circle_at_16%_4%,rgba(255,46,99,0.58),transparent_44%),radial-gradient(circle_at_84%_80%,rgba(255,176,0,0.36),transparent_42%),radial-gradient(circle_at_58%_54%,rgba(0,229,168,0.16),transparent_34%)] blur-2xl" />
      <div className="gig-pass-float relative overflow-hidden rounded-[1.35rem] border border-[#FFB000]/28 bg-[#151018] p-4 shadow-[0_42px_95px_rgba(0,0,0,0.74),0_0_42px_rgba(255,46,99,0.22)] sm:p-5">
        <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(138deg,rgba(255,255,255,0.13),transparent_28%),radial-gradient(circle_at_16%_0%,rgba(255,46,99,0.34),transparent_34%),radial-gradient(circle_at_100%_100%,rgba(255,176,0,0.23),transparent_42%),linear-gradient(180deg,#211A28_0%,#0B0B0F_100%)]" />
        <div aria-hidden="true" className="absolute inset-0 opacity-[0.09] [background-image:linear-gradient(rgba(255,255,255,0.55)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.55)_1px,transparent_1px)] [background-size:18px_18px]" />
        <div className="relative rounded-xl border border-white/16 bg-[#100C13]/94 p-5 shadow-[inset_0_0_0_1px_rgba(255,176,0,0.12)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[0.72rem] font-black tracking-[0.34em] text-[#FFB000] uppercase">All Access</p>
              <p className="mt-2 text-[2.7rem] leading-none font-black tracking-tight text-[#FFF7EA]">GigEze</p>
            </div>
            <div className="rounded-lg border border-[#00E5A8]/55 bg-[#00E5A8]/12 px-2.5 py-1.5 text-right shadow-[0_0_22px_rgba(0,229,168,0.14)]">
              <p className="text-[0.6rem] font-bold tracking-[0.2em] text-[#00E5A8] uppercase">Tour Ops</p>
              <p className="flex items-center justify-end gap-1.5 text-xs font-black text-[#FFF7EA]">
                <span className="size-1.5 rounded-full bg-[#00E5A8] shadow-[0_0_12px_rgba(0,229,168,0.9)] animate-[live-pulse_1.45s_ease-in-out_infinite]" aria-hidden />
                LIVE
              </p>
            </div>
          </div>

          <p className="mt-4 text-[0.68rem] font-black tracking-[0.22em] text-[#B8AFC0] uppercase">
            Tours · Gigs · Venues · Media
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2 text-xs font-semibold text-[#D8D0DD]">
            <span className="rounded-md bg-white/[0.055] px-2.5 py-2">Tours</span>
            <span className="rounded-md bg-white/[0.055] px-2.5 py-2">Gigs</span>
            <span className="rounded-md bg-white/[0.055] px-2.5 py-2">Venues</span>
            <span className="rounded-md bg-white/[0.055] px-2.5 py-2">Media</span>
          </div>

          <div className="mt-7 border-t border-dashed border-white/18 pt-5">
            <div className="flex items-center justify-between gap-4">
              <p className="text-[0.68rem] font-bold tracking-[0.22em] text-[#FFB000] uppercase">Backstage telemetry</p>
              <p className="text-[0.62rem] font-black tracking-[0.18em] text-[#00E5A8] uppercase">Online</p>
            </div>
            <div className="mt-3 flex h-14 items-end gap-1.5" aria-hidden="true">
              {[18, 28, 14, 38, 24, 32, 12, 42, 20, 30, 16, 36, 26, 22].map((height, index) => (
                <span
                  key={`${height}-${index}`}
                  className="w-2 rounded-sm bg-gradient-to-t from-[#FF2E63] via-[#FFB000] to-[#FFF7EA]"
                  style={{ height }}
                />
              ))}
            </div>
            <div className="mt-5 space-y-1.5" aria-hidden="true">
              <span className="block h-1.5 w-full rounded-full bg-[#FFF7EA]" />
              <span className="block h-1.5 w-11/12 rounded-full bg-[#FFF7EA]" />
              <span className="block h-1.5 w-4/5 rounded-full bg-[#FFF7EA]" />
              <span className="block h-1.5 w-10/12 rounded-full bg-[#FFF7EA]" />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-[0.65rem] font-bold tracking-[0.18em] text-[#FF2E63] uppercase">Field Capture</p>
              <p className="text-[0.65rem] font-bold tracking-[0.18em] text-[#FFB000] uppercase">Trip Sync</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function PublicHomePage() {
  const [{ Tours, posts, isDbUnavailable }, authContext] = await Promise.all([
    getHomeData(),
    getAuthenticatedHomeContext(),
  ]);
  const [featuredJourney] = Tours;
  const [featuredPost] = posts;

  return (
    <div className="space-y-16 pb-8 sm:space-y-20 lg:space-y-24">
      {/* Hero */}
      <section className="gig-hero-poster relative overflow-visible rounded-[1.45rem] border border-white/12 bg-[#151018] px-5 py-16 shadow-[0_34px_110px_rgba(0,0,0,0.72)] sm:px-9 sm:py-20 lg:px-12 lg:py-28" aria-labelledby="public-home-hero-title">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-[1.45rem]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_6%_4%,rgba(255,46,99,0.62),transparent_26%),radial-gradient(circle_at_88%_82%,rgba(255,176,0,0.36),transparent_30%),radial-gradient(circle_at_76%_20%,rgba(0,229,168,0.12),transparent_18%),linear-gradient(128deg,#211A28_0%,#151018_34%,#08070A_76%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(8,7,10,0)_0%,rgba(8,7,10,0.38)_44%,rgba(8,7,10,0.88)_100%)]" />
          <div className="absolute -left-24 top-24 h-40 w-[45rem] -rotate-12 bg-[#FF2E63]/12 blur-3xl" />
          <div className="absolute -right-20 bottom-10 h-40 w-[34rem] rotate-[-8deg] bg-[#FFB000]/14 blur-3xl" />
        </div>
        <div className="relative grid gap-8 lg:min-h-[35rem] lg:grid-cols-[minmax(0,1fr)_20rem_minmax(12rem,0.32fr)] lg:items-center">
          <div className="z-10 lg:col-span-2 lg:pr-24">
            <Logo variant="full" size="md" className="brand-mark-emphasis" aria-label="GigEze" />
            <p className="mt-6 inline-flex rounded-full border border-[#FFB000]/50 bg-[#FFB000]/10 px-3 py-1 text-[11px] font-black tracking-[0.22em] text-[#FFB000] uppercase">
              Live tour command centre
            </p>
            <h1 id="public-home-hero-title" className="mt-4 max-w-[68rem] text-[3.45rem] leading-[0.92] font-black tracking-[-0.045em] text-[#FFF7EA] uppercase drop-shadow-[0_8px_26px_rgba(0,0,0,0.42)] sm:text-[6rem] sm:leading-[0.9] lg:-mr-28 lg:text-[7.25rem] lg:leading-[0.88]">
              Run the tour like a headliner
            </h1>
            <p className="mt-7 max-w-2xl text-[1rem] leading-7 text-[#EFE5F4] sm:text-[1.14rem] sm:leading-8">
              Plan tours, manage gigs, capture field activity, and keep media, notes, and trip sync in one backstage-ready workspace.
            </p>
            <p className="mt-4 text-xs font-black tracking-[0.22em] text-[#00E5A8] uppercase sm:text-sm">
              Venues. Gigs. Activity notes. Tour records.
            </p>
            <p className="mt-2 max-w-xl text-sm text-[#B8AFC0]">
              Built for tour managers who need the show details without the spreadsheet scramble.
            </p>
            <div className="mt-8 flex flex-wrap gap-2.5 sm:mt-10 sm:gap-3">
              <Link href="/Tours" className="inline-flex h-12 items-center justify-center rounded-lg border border-[#FF2E63] bg-[#FF2E63] px-5 text-sm font-black text-white shadow-[0_14px_34px_rgba(255,46,99,0.38)] transition hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-[#ff4778] hover:shadow-[0_18px_42px_rgba(255,46,99,0.52)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#FF2E63]/35">
                Explore Tours
              </Link>
              <Link href="/login" className="inline-flex h-12 items-center justify-center rounded-lg border border-[#FFB000]/80 bg-[#FFB000] px-5 text-sm font-black text-[#08070A] shadow-[0_14px_34px_rgba(255,176,0,0.24)] transition hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-[#ffc247] hover:shadow-[0_18px_42px_rgba(255,176,0,0.36)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#FFB000]/35">
                Open Backstage
              </Link>
            </div>
            {authContext ? (
              <div className="mt-4 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3">
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

          <div className="z-20 lg:col-start-2 lg:row-start-1">
            <BackstagePassMockup />
          </div>
        </div>
      </section>

      {/* Value band */}
      <section aria-label="What GigEze offers" className="relative">
        <p className="mb-5 text-sm font-black tracking-[0.22em] text-[#FFB000] uppercase">Backstage operations, one setlist</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          <div className="relative overflow-hidden rounded-xl bg-[linear-gradient(145deg,rgba(255,46,99,0.13),#1E1724_42%,#17141D)] px-4 py-5 shadow-[0_18px_46px_rgba(0,0,0,0.42)] ring-1 ring-white/14 sm:translate-y-2">
            <div className="absolute inset-x-0 top-0 h-1 bg-[#FF2E63]" aria-hidden />
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[#FF2E63]/18 text-[#FF2E63]">
              <MapPin className="size-4" />
            </span>
            <p className="mt-4 text-base font-black text-[#FFF7EA]">Gigs tracked automatically</p>
            <p className="mt-1 text-sm leading-6 text-[#B8AFC0]">Keep venues, dates, and field activity tied to each tour.</p>
          </div>
          <div className="relative overflow-hidden rounded-xl bg-[linear-gradient(145deg,#211A28,#1E1724_46%,#17141D)] px-4 py-5 shadow-[0_18px_46px_rgba(0,0,0,0.42)] ring-1 ring-white/14">
            <div className="absolute inset-x-0 top-0 h-1 bg-[#FFB000]" aria-hidden />
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[#FFB000]/18 text-[#FFB000]">
              <ClipboardList className="size-4" />
            </span>
            <p className="mt-4 text-base font-black text-[#FFF7EA]">Notes stay show-ready</p>
            <p className="mt-1 text-sm leading-6 text-[#B8AFC0]">Capture activity notes, logistics, and trip records as work happens.</p>
          </div>
          <div className="relative overflow-hidden rounded-xl bg-[linear-gradient(145deg,rgba(0,229,168,0.1),#1E1724_42%,#17141D)] px-4 py-5 shadow-[0_18px_46px_rgba(0,0,0,0.42)] ring-1 ring-white/14 sm:-translate-y-2">
            <div className="absolute inset-x-0 top-0 h-1 bg-[#00E5A8]" aria-hidden />
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[#00E5A8]/14 text-[#00E5A8]">
              <Camera className="size-4" />
            </span>
            <p className="mt-4 text-base font-black text-[#FFF7EA]">Media ready to publish</p>
            <p className="mt-1 text-sm leading-6 text-[#B8AFC0]">Turn tour moments into public pages, posts, and gallery highlights.</p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/login" className={buttonVariants({ size: "sm" })}>
            Capture field activity
          </Link>
          <Link href="/login?mode=signup" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Build tour records
          </Link>
        </div>
      </section>

      {/* Backstage feed — unified discovery */}
      <section className="space-y-5 border-y border-white/10 bg-[#151018]/45 py-8 sm:py-10" aria-labelledby="backstage-feed-title">
        <div>
          <p className="text-xs font-black tracking-[0.2em] text-[#00E5A8] uppercase">Published activity</p>
          <h2 id="backstage-feed-title" className="mt-2 text-[1.75rem] leading-tight font-black tracking-tight text-[#FFF7EA] sm:text-[2.25rem]">Backstage feed</h2>
          <p className="mt-1 text-sm text-muted-foreground">Published tours, gig notes, and media from the GigEze community.</p>
        </div>
        {isDbUnavailable ? (
          <p className="rounded-xl border border-dashed border-border/80 bg-card/80 px-4 py-3 text-sm leading-6 text-foreground/70">
            Local database is unavailable. Start PostgreSQL to load Tours and stories.
          </p>
        ) : null}
        {!featuredJourney && !featuredPost ? (
          <div className="rounded-xl border border-dashed border-white/18 bg-[#0B0B0F]/70 p-8 text-center">
            <p className="text-xl font-black tracking-tight text-[#FFF7EA]">No backstage updates yet</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#B8AFC0]">Tours, gig notes, media, and stories will appear here once published.</p>
            <Link href="/Tours" className={`${buttonVariants({ size: "sm" })} mt-5`}>
              Explore Tours
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {featuredJourney ? (
              <Card className="group border-white/12 bg-[#1E1724] shadow-[0_18px_44px_rgba(0,0,0,0.32)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_54px_rgba(255,46,99,0.14)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                <CardHeader className="space-y-1.5">
                  <CardTitle className="text-xl leading-tight sm:text-2xl">{featuredJourney.title}</CardTitle>
                  <PublicAttribution source={featuredJourney} />
                </CardHeader>
                <CardContent className="space-y-3.5">
                  <p className="max-w-prose text-sm leading-7 text-foreground/75 sm:text-base">
                    {featuredJourney.description || "Fresh gig notes, media, and tour logistics from the latest published tour."}
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
              <Card className="border-white/12 bg-[#1E1724] shadow-[0_18px_44px_rgba(0,0,0,0.28)]">
                <CardHeader className="space-y-2">
                  <CardTitle className="text-xl sm:text-2xl">{featuredPost.title}</CardTitle>
                  <PublicAttribution source={featuredPost} />
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="max-w-prose text-sm leading-7 text-foreground/75 sm:text-base">
                    {featuredPost.excerpt || "A new backstage update has just been published."}
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
      <section className="relative overflow-hidden rounded-2xl border border-white/12 bg-[#151018] px-6 py-11 text-center shadow-[0_24px_74px_rgba(0,0,0,0.52)] sm:px-10 sm:py-16" aria-labelledby="closing-cta-title">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_0%,rgba(255,46,99,0.38),transparent_34%),radial-gradient(circle_at_78%_24%,rgba(255,176,0,0.26),transparent_32%),linear-gradient(135deg,#1E1724_0%,#0B0B0F_58%,#08070A_100%)]" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-6 rounded-2xl bg-[radial-gradient(circle_at_50%_0%,rgba(255,247,234,0.12),transparent_44%)] blur-xl" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,247,234,0.45)_1px,transparent_1px)] [background-size:100%_12px]" />
        <div className="relative space-y-4">
          <p className="text-xs font-black tracking-[0.24em] text-[#FFB000] uppercase">Setlist for the whole crew</p>
          <h2 id="closing-cta-title" className="mx-auto max-w-2xl text-3xl leading-[0.95] font-black tracking-[-0.025em] text-[#FFF7EA] uppercase sm:text-5xl">Get the tour out of the group chat</h2>
          <p className="mx-auto max-w-lg text-sm leading-6 text-[#D8D0DD] sm:text-base sm:leading-7">
            Keep gigs, venues, activity notes, media, and trip records together in one tour-management workspace.
          </p>
          <Link href="/login?mode=signup" className="inline-flex h-12 items-center justify-center rounded-lg border border-[#FF2E63] bg-[#FF2E63] px-5 text-sm font-black text-white shadow-[0_14px_34px_rgba(255,46,99,0.38)] transition hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-[#ff4778] hover:shadow-[0_18px_42px_rgba(255,46,99,0.52)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#FF2E63]/35">
            Start a Tour
          </Link>
        </div>
      </section>
    </div>
  );
}

