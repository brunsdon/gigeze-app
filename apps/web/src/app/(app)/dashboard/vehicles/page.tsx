import Link from "next/link";
import { ActionSubmitButton } from "@/components/forms/action-submit-button";
import { ConfirmSubmitButton } from "@/components/forms/confirm-submit-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/layout/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { createVehicleAction, deleteVehicleAction } from "@/features/vehicles/actions";
import { listVehicles } from "@/features/vehicles/service";
import { requireAuthenticatedUser, requireWorkspaceOwner } from "@/lib/auth/workspace";

export default async function VehiclesPage() {
  await requireAuthenticatedUser();
  const workspace = await requireWorkspaceOwner();
  const vehicles = await listVehicles(workspace.id);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Vehicles</h1>
        <p className="text-muted-foreground">
          Manage your vehicles. A default vehicle is auto-selected when creating driving logs.
        </p>
      </div>

      <Card id="add-vehicle">
        <CardHeader>
          <CardTitle>Add vehicle</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createVehicleAction} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input id="name" name="name" required placeholder="e.g. Tassie Cruiser" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="registration">Registration</Label>
              <Input id="registration" name="registration" placeholder="e.g. ABC-123" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicleMode">Vehicle mode</Label>
              <select id="vehicleMode" name="vehicleMode" defaultValue="DRIVE" className="w-full">
                <option value="DRIVE">Drive</option>
                <option value="RIDE">Ride</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fuelType">Fuel type</Label>
              <Input id="fuelType" name="fuelType" placeholder="e.g. Diesel" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startingOdometer">Starting odometer (km)</Label>
              <Input
                id="startingOdometer"
                name="startingOdometer"
                type="number"
                min="0"
                step="1"
                defaultValue="0"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultUse">Default log use</Label>
              <select
                id="defaultUse"
                name="defaultUse"
                defaultValue="PERSONAL"
                className="w-full"
              >
                <option value="PERSONAL">Personal</option>
                <option value="BUSINESS">Business</option>
              </select>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="enableBusinessSplit" name="enableBusinessSplit" defaultChecked />
              <Label htmlFor="enableBusinessSplit">Enable business/personal split</Label>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={2} />
            </div>
            <div className="flex items-center gap-3 md:col-span-2">
              <Switch id="isDefault" name="isDefault" />
              <Label htmlFor="isDefault">Set as default vehicle</Label>
            </div>
            <ActionSubmitButton label="Add vehicle" pendingLabel="Saving..." className="md:col-span-2 md:w-fit" />
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your vehicles</CardTitle>
        </CardHeader>
        <CardContent>
          {vehicles.length === 0 ? (
            <EmptyState
              title="No vehicles yet"
              description="Add your first vehicle to enable per-vehicle odometer tracking and default log prefilling."
              ctaLabel="Add first vehicle"
              ctaHref="#add-vehicle"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Registration</TableHead>
                  <TableHead>Fuel type</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Starting odometer</TableHead>
                  <TableHead>Default use</TableHead>
                  <TableHead>Split</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicles.map((vehicle) => (
                  <TableRow key={vehicle.id}>
                    <TableCell className="font-medium">{vehicle.name}</TableCell>
                    <TableCell>{vehicle.registration ?? "-"}</TableCell>
                    <TableCell>{vehicle.fuelType ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{vehicle.vehicleMode}</Badge>
                    </TableCell>
                    <TableCell>{vehicle.startingOdometer.toLocaleString()} km</TableCell>
                    <TableCell>
                      <Badge variant={vehicle.defaultUse === "BUSINESS" ? "default" : "outline"}>
                        {vehicle.defaultUse}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={vehicle.enableBusinessSplit ? "default" : "outline"}>
                        {vehicle.enableBusinessSplit ? "Enabled" : "Personal only"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {vehicle.isDefault ? (
                        <Badge>Default</Badge>
                      ) : (
                        <Badge variant="outline">Secondary</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/dashboard/vehicles/${vehicle.id}/edit`}
                          className={buttonVariants({ variant: "outline", size: "sm" })}
                        >
                          Edit
                        </Link>
                        <form action={deleteVehicleAction} id={`delete-vehicle-${vehicle.id}`}>
                          <input type="hidden" name="vehicleId" value={vehicle.id} />
                          <ConfirmSubmitButton
                            formId={`delete-vehicle-${vehicle.id}`}
                            triggerLabel="Delete"
                            title="Delete vehicle?"
                            description="This vehicle will be removed. Existing driving logs linked to it will not be deleted, but the vehicle link will be cleared."
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
