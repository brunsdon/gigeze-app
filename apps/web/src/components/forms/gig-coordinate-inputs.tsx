"use client";

import { useState } from "react";
import { buttonVariants } from "@/components/ui/button-variants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type StopCoordinateInputsProps = {
  latitudeName?: string;
  longitudeName?: string;
  initialLatitude?: string;
  initialLongitude?: string;
};

export function StopCoordinateInputs({
  latitudeName = "latitude",
  longitudeName = "longitude",
  initialLatitude = "",
  initialLongitude = "",
}: StopCoordinateInputsProps) {
  const [latitude, setLatitude] = useState(initialLatitude);
  const [longitude, setLongitude] = useState(initialLongitude);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  async function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationError("Location is not supported in this browser.");
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setIsLocating(false);
      },
      (error) => {
        setLocationError(error.message || "Unable to get location.");
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      },
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label>Coordinates</Label>
        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={isLocating}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          {isLocating ? "Finding location..." : "Use current location"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={latitudeName}>Latitude</Label>
          <Input
            id={latitudeName}
            name={latitudeName}
            type="number"
            step="0.000001"
            value={latitude}
            onChange={(event) => setLatitude(event.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={longitudeName}>Longitude</Label>
          <Input
            id={longitudeName}
            name={longitudeName}
            type="number"
            step="0.000001"
            value={longitude}
            onChange={(event) => setLongitude(event.target.value)}
            required
          />
        </div>
      </div>

      {locationError ? <p className="text-sm text-destructive">{locationError}</p> : null}
    </div>
  );
}
