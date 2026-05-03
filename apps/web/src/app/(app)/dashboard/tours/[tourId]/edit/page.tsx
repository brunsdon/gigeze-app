import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionSubmitButton } from "@/components/forms/action-submit-button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateJourneyAction } from "@/features/tours/actions";
import { requireCurrentWorkspace } from "@/lib/auth/workspace";
import { formatDateInputValue } from "@/lib/datetime";
import { visibilityOptions } from "@/lib/visibility";
import { getJourneyByIdOrSlug } from "@/features/tours/service";

export default async function EditJourneyPage({
  params,
}: {
  params: Promise<{ journeyId: string }>;
}) {
  const { journeyId } = await params;
  const workspace = await requireCurrentWorkspace();
  const Tour = await getJourneyByIdOrSlug(workspace.id, journeyId);

  if (!Tour) {
    notFound();
  }

  return (
    <section className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Edit Tour</h1>
          <p className="text-muted-foreground">Update Tour details, slug, and visibility.</p>
        </div>
        <Link href={`/dashboard/tours/${Tour.id}`} className={buttonVariants({ variant: "outline" })}>
          Back to Tour
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tour details</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateJourneyAction} className="space-y-4">
            <input type="hidden" name="journeyId" value={Tour.id} />

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" defaultValue={Tour.title} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" name="slug" defaultValue={Tour.slug} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={3} defaultValue={Tour.description ?? ""} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start date</Label>
                <Input
                  id="startDate"
                  name="startDate"
                  type="date"
                  defaultValue={formatDateInputValue(Tour.startDate)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">End date</Label>
                <Input
                  id="endDate"
                  name="endDate"
                  type="date"
                  defaultValue={formatDateInputValue(Tour.endDate)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  name="status"
                  defaultValue={Tour.status}
                  className="w-full"
                >
                  <option value="PLANNED">Planned</option>
                  <option value="ACTIVE">Active</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="coverImageUrl">Cover image URL</Label>
                <Input id="coverImageUrl" name="coverImageUrl" type="url" defaultValue={Tour.coverImageUrl ?? ""} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="visibility">Visibility</Label>
              <select
                id="visibility"
                name="visibility"
                defaultValue={Tour.visibility}
                className="w-full"
              >
                {visibilityOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <ActionSubmitButton label="Save Tour" pendingLabel="Saving..." />
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
