import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityNoteForm } from "@/components/activity/activity-note-form";
import { ConfirmSubmitButton } from "@/components/forms/confirm-submit-button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCurrentWorkspace } from "@/lib/auth/workspace";
import { listJourneys } from "@/features/tours/service";
import { deleteActivityNoteAction, updateActivityNoteAction } from "@/features/activity-notes/actions";
import { getActivityNoteById } from "@/features/activity-notes/service";
import { formatDateInputValue } from "@/lib/datetime";

export default async function EditActivityNotePage({
  params,
}: {
  params: Promise<{ noteId: string }>;
}) {
  const { noteId } = await params;
  const workspace = await requireCurrentWorkspace();
  const [note, Tours] = await Promise.all([getActivityNoteById(noteId, workspace.id), listJourneys(workspace.id)]);

  if (!note) {
    notFound();
  }

  return (
    <section className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Edit activity</h1>
          <p className="text-muted-foreground">Update the Tour, Gig, type, and details for this activity note.</p>
        </div>
        <Link href="/dashboard/activity" className={buttonVariants({ variant: "outline" })}>
          Back to activity
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity details</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityNoteForm
            action={updateActivityNoteAction}
            Tours={Tours}
            noteId={note.id}
            defaultJourneyId={note.journeyId}
            defaultStopId={note.stopId ?? undefined}
            defaultType={note.type}
            defaultDate={formatDateInputValue(note.date)}
            defaultDurationMinutes={note.durationMinutes}
            defaultLocation={note.location}
            defaultNotes={note.notes}
            defaultVisibility={note.visibility}
            submitLabel="Save activity"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Delete entry</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={deleteActivityNoteAction} id={`delete-activity-${note.id}`}>
            <input type="hidden" name="noteId" value={note.id} />
            <ConfirmSubmitButton
              formId={`delete-activity-${note.id}`}
              triggerLabel="Delete activity"
              title="Delete activity?"
              description="This activity note will be permanently removed."
              confirmLabel="Delete activity"
            />
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
