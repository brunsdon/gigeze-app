"use client";

import type { TripMode } from "@gigeze/shared";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OdometerInputs } from "@/components/forms/odometer-inputs";

type VehicleOption = {
  id: string;
  name: string;
  isDefault: boolean;
  enableBusinessSplit: boolean;
};

type VehicleOdometerFieldsProps = {
  vehicles: VehicleOption[];
  vehicleOdometerMap: Record<string, number | null>;
  defaultVehicleId?: string;
  initialStartOdometer?: number;
  initialEndOdometer?: number;
  initialBusinessKm?: number;
  initialPersonalKm?: number;
  initialTripMode?: TripMode;
  className?: string;
};

export function VehicleOdometerFields({
  vehicles,
  vehicleOdometerMap,
  defaultVehicleId,
  initialStartOdometer,
  initialEndOdometer,
  initialBusinessKm,
  initialPersonalKm,
  initialTripMode = "DRIVE",
  className,
}: VehicleOdometerFieldsProps) {
  const [tripMode, setTripMode] = useState<TripMode>(initialTripMode);
  const [selectedId, setSelectedId] = useState(defaultVehicleId ?? "");
  const [currentStartOdometer, setCurrentStartOdometer] = useState<number | null>(
    typeof initialStartOdometer === "number" ? initialStartOdometer : null,
  );
  const totalDistanceKm =
    typeof initialEndOdometer === "number" && typeof initialStartOdometer === "number"
      ? Math.max(0, initialEndOdometer - initialStartOdometer)
      : undefined;

  const selectedVehicleName = vehicles.find((vehicle) => vehicle.id === selectedId)?.name;
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === selectedId);
  const latestOdometer = selectedId ? (vehicleOdometerMap[selectedId] ?? null) : null;
  const showBusinessSplit = tripMode !== "WALK" && selectedVehicle?.enableBusinessSplit === true;
  const isBasedOnPreviousLog =
    latestOdometer !== null && currentStartOdometer !== null && currentStartOdometer === latestOdometer;
  const hasContinuityGap =
    latestOdometer !== null && currentStartOdometer !== null && currentStartOdometer !== latestOdometer;

  return (
    <div className={className}>
      <div className="space-y-2">
        <Label htmlFor="tripMode">Trip mode</Label>
        <select id="tripMode" name="tripMode" value={tripMode} onChange={(event) => setTripMode(event.currentTarget.value as TripMode)} className="w-full">
          <option value="WALK">Walk</option>
          <option value="RIDE">Ride</option>
          <option value="DRIVE">Drive</option>
        </select>
      </div>

      {tripMode === "WALK" ? (
        <div className="mt-4 space-y-4 rounded-lg border border-border/70 bg-muted/15 p-4">
          <div className="space-y-2">
            <Label htmlFor="totalDistanceKm">Distance</Label>
            <Input
              id="totalDistanceKm"
              name="totalDistanceKm"
              type="number"
              min={0}
              step="0.1"
              defaultValue={typeof totalDistanceKm === "number" ? String(totalDistanceKm) : ""}
              required
            />
            <p className="text-xs text-muted-foreground">Walk trips use distance instead of odometer readings.</p>
          </div>
          <div>
            <input type="hidden" name="vehicleId" value="" />
            <input type="hidden" name="startOdometer" value="" />
            <input type="hidden" name="endOdometer" value="" />
            <input type="hidden" name="businessKm" value="0" />
            <input type="hidden" name="personalKm" value={typeof totalDistanceKm === "number" ? String(totalDistanceKm) : "0"} />
          </div>
        </div>
      ) : vehicles.length > 0 ? (
        <div className="mt-4 space-y-2">
          <Label htmlFor="vehicleId">Vehicle (optional)</Label>
          <select
            id="vehicleId"
            name="vehicleId"
            value={selectedId}
            onChange={(event) => {
              setSelectedId(event.currentTarget.value);
            }}
            className="w-full"
          >
            <option value="">No vehicle</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.name}
                {vehicle.isDefault ? " (default)" : ""}
              </option>
            ))}
          </select>
          {selectedVehicleName ? (
            <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-sm">
              <p>
                Vehicle: <span className="font-semibold">{selectedVehicleName}</span>
              </p>
              {latestOdometer !== null ? (
                <p className="text-muted-foreground">Last recorded odometer: {latestOdometer.toLocaleString()} km</p>
              ) : (
                <p className="text-muted-foreground">Last recorded odometer: no previous log yet</p>
              )}
            </div>
          ) : null}
          {isBasedOnPreviousLog ? (
            <p className="text-xs text-emerald-700">Based on previous log</p>
          ) : null}
          {hasContinuityGap ? (
            <p className="text-xs text-amber-700">Gap detected since last recorded trip</p>
          ) : null}
        </div>
      ) : (
        <input type="hidden" name="vehicleId" value="" />
      )}

      {tripMode !== "WALK" ? (
        <OdometerInputs
          initialStartOdometer={initialStartOdometer}
          initialEndOdometer={initialEndOdometer}
          previousEndOdometer={latestOdometer ?? undefined}
          initialBusinessKm={initialBusinessKm}
          initialPersonalKm={initialPersonalKm}
          showBusinessSplit={showBusinessSplit}
          onStartOdometerChange={setCurrentStartOdometer}
        />
      ) : null}
    </div>
  );
}
