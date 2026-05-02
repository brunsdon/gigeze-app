import Link from "next/link";
import { ActionSubmitButton } from "@/components/forms/action-submit-button";
import { EmptyState } from "@/components/layout/empty-state";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { duplicateJourneyAction, setJourneyActiveStateAction } from "@/features/tours/actions";
import { VisibilityBadge } from "@/components/ui/visibility-badge";
import { getCompletedStopsCount, getJourneyProgressPercent } from "@/lib/tours/progress";
import { requireCurrentWorkspace } from "@/lib/auth/workspace";
import { listJourneys } from "@/features/tours/service";

export default async function DashboardJourneysPage() {
  const workspace = await requireCurrentWorkspace();
  const Tours = await listJourneys(workspace.id);

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">My Tours</h1>
          <p className="text-muted-foreground">Plan your next route, track progress, and share each Tour your way.</p>
        </div>
        <Link href="/dashboard/Tours/new" className={buttonVariants()}>
          Start Tour
        </Link>
      </div>

      {!Tours.length ? (
        <EmptyState
          title="No Tours yet"
          description="Ready to start your first trip? Create a Tour and we will help you build it Gig by Gig."
          ctaLabel="Start a Tour"
          ctaHref="/dashboard/Tours/new"
          secondaryCtaLabel="Add moment"
          secondaryCtaHref="/dashboard/media"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {Tours.map((Tour) => (
            <Card key={Tour.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle>{Tour.title}</CardTitle>
                    {Tour.status === "ACTIVE" ? <Badge>Active</Badge> : null}
                  </div>
                  <VisibilityBadge visibility={Tour.visibility} />
                </div>
                <CardDescription>{Tour.description || "No description"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      {getCompletedStopsCount(Tour.Gigs)}/{Tour.Gigs.length} Gigs logged
                    </span>
                    <span className="text-muted-foreground">{getJourneyProgressPercent(Tour.Gigs)}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-[width]"
                      style={{ width: `${getJourneyProgressPercent(Tour.Gigs)}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{Tour.Gigs.length} Gigs</span>
                  <Link href={`/dashboard/Tours/${Tour.id}`} className="font-medium hover:underline">
                    Open Tour
                  </Link>
                </div>

                <div className="flex flex-wrap gap-2">
                  <form action={setJourneyActiveStateAction}>
                    <input type="hidden" name="journeyId" value={Tour.id} />
                    <input type="hidden" name="returnTo" value="/dashboard/Tours" />
                    <input
                      type="hidden"
                      name="makeActive"
                      value={Tour.status === "ACTIVE" ? "false" : "true"}
                    />
                    <ActionSubmitButton
                      label={Tour.status === "ACTIVE" ? "Clear active" : "Set active"}
                      pendingLabel="Saving..."
                      size="sm"
                      variant="outline"
                    />
                  </form>

                  <form action={duplicateJourneyAction}>
                    <input type="hidden" name="journeyId" value={Tour.id} />
                    <input type="hidden" name="returnTo" value="/dashboard/Tours" />
                    <ActionSubmitButton label="Duplicate" pendingLabel="Duplicating..." size="sm" variant="outline" />
                  </form>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

