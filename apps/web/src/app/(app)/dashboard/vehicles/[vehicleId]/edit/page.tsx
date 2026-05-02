import { notFound } from "next/navigation";
import { ActionSubmitButton } from "@/components/forms/action-submit-button";
import { ConfirmSubmitButton } from "@/components/forms/confirm-submit-button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { deleteVehicleAction, updateVehicleAction } from "@/features/vehicles/actions";
import { getVehicleById } from "@/features/vehicles/service";
import { requireWorkspaceOwner } from "@/lib/auth/workspace";
import Link from "next/link";

export default async function EditVehiclePage({
  params,
}: {
  params: Promise<{ vehicleId: string }>;
}) {
  const { vehicleId } = await params;
  const workspace = await requireWorkspaceOwner();
  const vehicle = await getVehicleById(vehicleId, workspace.id);

  if (!vehicle) {
    notFound();
  }

  return (
    <section className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Edit vehicle</h1>
          <p className="text-muted-foreground">{vehicle.name}</p>
        </div>
        <Link href="/dashboard/vehicles" className={buttonVariants({ variant: "outline" })}>
          Back to vehicles
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vehicle details</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateVehicleAction} className="grid gap-4 md:grid-cols-2">
            <input type="hidden" name="vehicleId" value={vehicle.id} />
            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input id="name" name="name" defaultValue={vehicle.name} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="registration">Registration</Label>
              <Input id="registration" name="registration" defaultValue={vehicle.registration ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicleMode">Vehicle mode</Label>
              <select
                id="vehicleMode"
                name="vehicleMode"
                defaultValue={vehicle.vehicleMode}
                className="w-full"
              >
                <option value="DRIVE">Drive</option>
                <option value="RIDE">Ride</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fuelType">Fuel type</Label>
              <Input id="fuelType" name="fuelType" defaultValue={vehicle.fuelType ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startingOdometer">Starting odometer (km)</Label>
              <Input
                id="startingOdometer"
                name="startingOdometer"
                type="number"
                min="0"
                step="1"
                defaultValue={vehicle.startingOdometer}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultUse">Default log use</Label>
              <select
                id="defaultUse"
                name="defaultUse"
                defaultValue={vehicle.defaultUse}
                className="w-full"
              >
                <option value="PERSONAL">Personal</option>
                <option value="BUSINESS">Business</option>
              </select>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="enableBusinessSplit" name="enableBusinessSplit" defaultChecked={vehicle.enableBusinessSplit} />
              <Label htmlFor="enableBusinessSplit">Enable business/personal split</Label>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={3} defaultValue={vehicle.notes ?? ""} />
            </div>
            <div className="flex items-center gap-3 md:col-span-2">
              <Switch id="isDefault" name="isDefault" defaultChecked={vehicle.isDefault} />
              <Label htmlFor="isDefault">Set as default vehicle</Label>
            </div>
            <ActionSubmitButton
              label="Save vehicle"
              pendingLabel="Saving..."
              className="md:col-span-2 md:w-fit"
            />
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Delete vehicle</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={deleteVehicleAction} id={`delete-vehicle-${vehicle.id}`}>
            <input type="hidden" name="vehicleId" value={vehicle.id} />
            <ConfirmSubmitButton
              formId={`delete-vehicle-${vehicle.id}`}
              triggerLabel="Delete vehicle"
              title="Delete vehicle?"
              description="This vehicle will be removed. Existing driving logs linked to it will not be deleted, but the vehicle link will be cleared."
              confirmLabel="Delete vehicle"
            />
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
