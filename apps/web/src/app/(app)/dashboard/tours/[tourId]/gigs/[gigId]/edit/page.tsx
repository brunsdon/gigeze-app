import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionSubmitButton } from "@/components/forms/action-submit-button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requireCurrentWorkspace } from "@/lib/auth/workspace";
import { formatDateInputValue } from "@/lib/datetime";
import { visibilityOptions } from "@/lib/visibility";
import { updateStopAction } from "@/features/gigs/actions";
import { getStopById } from "@/features/gigs/service";

export default async function EditStopPage({
  params,
}: {
  params: Promise<{ journeyId: string; stopId: string }>;
}) {
  const { journeyId, stopId } = await params;
  const workspace = await requireCurrentWorkspace();
  const Gig = await getStopById(workspace.id, stopId);

  if (!Gig || Gig.journeyId !== journeyId) {
    notFound();
  }

  return (
    <section className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Edit Gig</h1>
          <p className="text-muted-foreground">Update location details, dates, and visibility for this Gig.</p>
        </div>
        <Link href={`/dashboard/tours/${journeyId}`} className={buttonVariants({ variant: "outline" })}>
          Back to Tour
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gig details</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateStopAction} className="space-y-4">
            <input type="hidden" name="journeyId" value={journeyId} />
            <input type="hidden" name="stopId" value={Gig.id} />

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" defaultValue={Gig.title} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="locationName">Location name</Label>
              <Input id="locationName" name="locationName" defaultValue={Gig.locationName ?? ""} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="latitude">Latitude</Label>
                <Input
                  id="latitude"
                  name="latitude"
                  type="number"
                  step="0.000001"
                  defaultValue={Number(Gig.latitude)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="longitude">Longitude</Label>
                <Input
                  id="longitude"
                  name="longitude"
                  type="number"
                  step="0.000001"
                  defaultValue={Number(Gig.longitude)}
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="arrivalDate">Arrival date</Label>
                <Input
                  id="arrivalDate"
                  name="arrivalDate"
                  type="date"
                  defaultValue={formatDateInputValue(Gig.arrivalDate)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="departureDate">Departure date</Label>
                <Input
                  id="departureDate"
                  name="departureDate"
                  type="date"
                  defaultValue={formatDateInputValue(Gig.departureDate)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="orderIndex">Order</Label>
              <Input id="orderIndex" name="orderIndex" type="number" min={1} defaultValue={Gig.orderIndex} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={4} defaultValue={Gig.description ?? ""} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="visibility">Visibility</Label>
              <select id="visibility" name="visibility" defaultValue={Gig.visibility} className="w-full">
                {visibilityOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <ActionSubmitButton label="Save Gig" pendingLabel="Saving..." />
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
