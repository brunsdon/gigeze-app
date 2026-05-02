import { useEffect, useMemo, useState } from "react";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import {
  hasReliableHomeDashboardMovement,
  shouldKeepHomeDashboardAwake,
} from "./trip-dashboard";

type UseDrivingScreenKeepAwakeInput = {
  enabled?: boolean;
  active?: boolean;
  liveMotionStatus: "checking" | "available" | "permissionDenied" | "servicesDisabled" | "noSignal" | "error";
  driveState: string;
  accuracyMeters?: number | null;
};

const drivingDashboardKeepAwakeTag = "gigeze-driving-dashboard";
const keepAwakeRefreshMs = 5000;

export function useDrivingScreenKeepAwake({
  enabled = true,
  active = false,
  liveMotionStatus,
  driveState,
  accuracyMeters,
}: UseDrivingScreenKeepAwakeInput) {
  const [lastReliableMovementAt, setLastReliableMovementAt] = useState<string | undefined>(undefined);
  const [nowIso, setNowIso] = useState(() => new Date().toISOString());
  const reliableMovement = hasReliableHomeDashboardMovement({
    liveMotionStatus,
    driveState,
    accuracyMeters,
  }) && enabled;

  useEffect(() => {
    if (reliableMovement) {
      const now = new Date().toISOString();
      setLastReliableMovementAt(now);
      setNowIso(now);
    }
  }, [reliableMovement]);

  useEffect(() => {
    if (!lastReliableMovementAt) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      setNowIso(new Date().toISOString());
    }, keepAwakeRefreshMs);

    return () => {
      clearInterval(intervalId);
    };
  }, [lastReliableMovementAt]);

  const keepAwake = useMemo(
    () =>
      shouldKeepHomeDashboardAwake({
        enabled,
        active,
        liveMotionStatus,
        driveState,
        accuracyMeters,
        lastReliableMovementAt,
        now: new Date(nowIso),
      }),
    [accuracyMeters, active, driveState, enabled, lastReliableMovementAt, liveMotionStatus, nowIso],
  );

  useEffect(() => {
    if (!keepAwake) {
      void deactivateKeepAwake(drivingDashboardKeepAwakeTag).catch(() => undefined);
      return undefined;
    }

    void activateKeepAwakeAsync(drivingDashboardKeepAwakeTag).catch(() => undefined);

    return () => {
      void deactivateKeepAwake(drivingDashboardKeepAwakeTag).catch(() => undefined);
    };
  }, [keepAwake]);

  return keepAwake;
}

export const useHomeScreenKeepAwake = useDrivingScreenKeepAwake;
