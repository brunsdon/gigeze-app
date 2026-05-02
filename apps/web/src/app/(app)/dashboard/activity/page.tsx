import Link from "next/link";
import { EmptyState } from "@/components/layout/empty-state";
import { ConfirmSubmitButton } from "@/components/forms/confirm-submit-button";
import { ActivityNoteForm } from "@/components/activity/activity-note-form";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireCurrentWorkspace } from "@/lib/auth/workspace";
import { listJourneys } from "@/features/tours/service";
import { createActivityNoteAction, deleteActivityNoteAction } from "@/features/activity-notes/actions";
import { formatActivityDuration, getActivityTypeLabel, listActivityNotes } from "@/features/activity-notes/service";
import { currentDateInputValue, formatInAppTimeZone } from "@/lib/datetime";

function formatDate(value: Date) {
  return formatInAppTimeZone(value, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ journeyId?: string; stopId?: string }>;
}) {
  const { journeyId: requestedJourneyId, stopId: requestedStopId } = await searchParams;
  const workspace = await requireCurrentWorkspace();
  const [Tours, activityNotes] = await Promise.all([listJourneys(workspace.id), listActivityNotes(workspace.id)]);
  const stopOptions = Tours.flatMap((Tour) => Tour.Gigs.map((Gig) => ({ ...Gig, journeyId: Tour.id })));
  const requestedStop = stopOptions.find((Gig) => Gig.id === requestedStopId);
  const defaultJourneyId = Tours.some((Tour) => Tour.id === requestedJourneyId)
    ? requestedJourneyId
    : requestedStop?.journeyId ?? Tours.find((Tour) => Tour.status === "ACTIVE")?.id ?? Tours[0]?.id ?? "";
  const defaultStopId = requestedStop?.id ?? "";

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Activity on the road</h1>
        <p className="text-muted-foreground">Capture work, maintenance, admin, and personal notes alongside your travel timeline.</p>
      </div>

      <Card id="add-activity">
        <CardHeader>
          <CardTitle>Add activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityNoteForm
            action={createActivityNoteAction}
            Tours={Tours}
            defaultJourneyId={defaultJourneyId}
            defaultStopId={defaultStopId}
            defaultDate={currentDateInputValue()}
            submitLabel="Save activity"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          {!activityNotes.length ? (
            <EmptyState
              title="No activity notes yet"
              description="Add your first note when you want to remember work, maintenance, admin, or personal details from the road."
              ctaLabel="Add first activity"
              ctaHref="#add-activity"
              secondaryCtaLabel="Go to Tours"
              secondaryCtaHref="/dashboard/Tours"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Tour</TableHead>
                  <TableHead>Gig</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activityNotes.map((note) => (
                  <TableRow key={note.id}>
                    <TableCell>{formatDate(note.date)}</TableCell>
                    <TableCell>{getActivityTypeLabel(note.type)}</TableCell>
                    <TableCell>{note.Tour.title}</TableCell>
                    <TableCell>{note.Gig?.title || "-"}</TableCell>
                    <TableCell>{formatActivityDuration(note.durationMinutes) ?? "-"}</TableCell>
                    <TableCell>{note.location || "-"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/dashboard/activity/${note.id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                          Edit
                        </Link>
                        <form action={deleteActivityNoteAction} id={`delete-activity-${note.id}`}>
                          <input type="hidden" name="noteId" value={note.id} />
                          <ConfirmSubmitButton
                            formId={`delete-activity-${note.id}`}
                            triggerLabel="Delete"
                            title="Delete activity?"
                            description="This activity note will be permanently removed."
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
          )}
        </CardContent>
      </Card>
    </section>
  );
}
