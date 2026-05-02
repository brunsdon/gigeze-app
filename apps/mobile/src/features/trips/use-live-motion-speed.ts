import { useEffect, useState } from "react";
import * as Location from "expo-location";
import { getLiveMotionSpeedKmh, type LiveSpeedSample } from "./live-motion-speed";

export type LiveMotionStatus = "checking" | "available" | "permissionDenied" | "servicesDisabled" | "noSignal" | "error";

export type LiveMotionSpeedState = {
  speedKmh?: number;
  accuracyMeters?: number | null;
  status: LiveMotionStatus;
  locationUpdatedAt?: string;
  updatedAt?: string;
};

function mapLocationToSpeedSample(location: Location.LocationObject, sequence: number): LiveSpeedSample {
  const timestampMs = Number.isFinite(location.timestamp) ? location.timestamp : Date.now();

  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracyMeters: Number.isFinite(location.coords.accuracy) ? location.coords.accuracy ?? null : null,
    speedMetersPerSecond: Number.isFinite(location.coords.speed) ? location.coords.speed ?? null : null,
    timestampMs,
    recordedAt: new Date(timestampMs).toISOString(),
    sequence,
  };
}

export function useLiveMotionSpeed(): LiveMotionSpeedState {
  const [state, setState] = useState<LiveMotionSpeedState>({ status: "checking" });

  useEffect(() => {
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;
    let sequence = 0;
    let samples: LiveSpeedSample[] = [];

    async function startForegroundMotionWatch() {
      try {
        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (!servicesEnabled) {
          if (!cancelled) {
            setState({ status: "servicesDisabled" });
          }
          return;
        }

        let permission = await Location.getForegroundPermissionsAsync();
        if (permission.status === "undetermined") {
          permission = await Location.requestForegroundPermissionsAsync();
        }

        if (permission.status !== "granted") {
          if (!cancelled) {
            setState({ status: "permissionDenied" });
          }
          return;
        }

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 1000,
            distanceInterval: 0,
          },
          (location) => {
            sequence += 1;
            samples = [...samples, mapLocationToSpeedSample(location, sequence)].slice(-4);
            const speedKmh = getLiveMotionSpeedKmh(samples);
            const latestSample = samples.at(-1);
            setState({
              accuracyMeters: latestSample?.accuracyMeters,
              locationUpdatedAt: latestSample?.recordedAt,
              speedKmh,
              status: "available",
              updatedAt: new Date().toISOString(),
            });
          },
        );
      } catch {
        if (!cancelled) {
          setState({ status: "error" });
        }
      }
    }

    void startForegroundMotionWatch();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);

  return state;
}
