import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { backgroundTaskDiagnosticsStore } from "./background-task-diagnostics-store";
import { trackingNativeBufferStore } from "./native-buffer-store";
import { trackingSessionStorage } from "./session-storage";

export const androidTripTrackingTaskName = "gigeze-android-trip-tracking";

type LocationTaskData = {
  locations?: Location.LocationObject[];
};

try {
  if (!TaskManager.isTaskDefined(androidTripTrackingTaskName)) {
    TaskManager.defineTask<LocationTaskData>(androidTripTrackingTaskName, async ({ data, error }) => {
      await backgroundTaskDiagnosticsStore.recordCallback();

      try {
        if (error) {
          throw error;
        }

        if (!data?.locations?.length) {
          return;
        }

        const activeSession = await trackingSessionStorage.getActiveSession();
        const sessionId = activeSession?.sessionId;
        if (!sessionId) {
          return;
        }

        await backgroundTaskDiagnosticsStore.clearError();

        for (const location of data.locations) {
          const timestampMs = Number.isFinite(location.timestamp) ? location.timestamp : Date.now();
          await trackingNativeBufferStore.appendSample({
            sessionId,
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracyMeters: Number.isFinite(location.coords.accuracy) ? location.coords.accuracy ?? null : null,
            timestampMs,
            recordedAt: new Date(timestampMs).toISOString(),
            source: "expo-background-location",
            originId: `${sessionId}:background:${timestampMs}:${location.coords.latitude}:${location.coords.longitude}`,
          });
        }
      } catch (unknownError) {
        await backgroundTaskDiagnosticsStore.recordError(unknownError);
        console.warn("[gigeze/mobile] Android background tracking task failed", unknownError);
      }
    });
  }
} catch (error) {
  console.warn("[gigeze/mobile] Android background tracking task registration skipped", error);
}
