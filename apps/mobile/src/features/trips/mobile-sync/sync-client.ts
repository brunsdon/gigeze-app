import type { TripMode } from "@gigeze/shared";
import { getMobileConfig } from "../../../lib/config";
import type { TrackingSampleRecord } from "../mobile-tracking/types";
import { calculateSampleDistanceKm, isValidDistanceKm } from "../trip-distance";
import { getUserFacingTripErrorMessage } from "../trip-errors";
import type { TripPurpose } from "../trip-setup";
import type { MobileTripSession } from "../trip-workflow";

export type CompleteTripSyncPayload = {
  mobileTripId?: string;
  backendTripId?: string;
  journeyId?: string;
  journeyTitle?: string;
  tripMode?: TripMode;
  vehicleId?: string;
  tripPurpose?: TripPurpose;
  purpose?: string;
  startOdometer?: number;
  endOdometer?: number;
  startedAt: string;
  endedAt: string;
  distanceKm: number;
  samples: {
    latitude: number;
    longitude: number;
    accuracyMeters: number | null;
    recordedAt: string;
  }[];
  routePolyline: {
    latitude: number;
    longitude: number;
  }[];
  stopSuggestions: {
    title: string;
    latitude: number;
    longitude: number;
    dwellMinutes: number;
  }[];
};

export type CompleteTripSyncSuccess = {
  ok: true;
  backendTripId?: string;
  backendEditHref?: string;
  backendDistanceKm?: number;
  deletedAt?: string;
};

export type CompleteTripSyncFailure = {
  ok: false;
  error: string;
};

export type CompleteTripSyncResult = CompleteTripSyncSuccess | CompleteTripSyncFailure;

export type DeletedBackendTrip = {
  backendTripId: string;
  deletedAt: string;
  updatedAt?: string;
};

export type BackendTripSummary = {
  backendTripId: string;
  journeyId?: string;
  journeyTitle?: string;
  tripMode?: TripMode;
  vehicleId?: string;
  vehicleName?: string;
  tripPurpose?: TripPurpose;
  purpose?: string;
  date?: string;
  startedAt?: string;
  endedAt?: string;
  startOdometer?: number;
  endOdometer?: number;
  startLocation?: string;
  endLocation?: string;
  backendDistanceKm?: number;
  updatedAt?: string;
};

export type BackendRoutePreview = {
  id: string;
  computedDistanceKm?: number;
  samples: TrackingSampleRecord[];
};

export type TripDeletionSyncSuccess = {
  ok: true;
  backendTripId: string;
  deletedAt: string;
};

export type TripDeletionSyncFailure = {
  ok: false;
  error: string;
};

export type TripDeletionSyncResult = TripDeletionSyncSuccess | TripDeletionSyncFailure;

export type ApiConnectivityResult = {
  status: "ok" | "failed";
  responseTimeMs?: number;
  statusCode?: number;
  error?: string;
};

const maxPolylinePoints = 120;
const defaultTimeoutMs = 15000;
const healthCheckTimeoutMs = 8000;

function downsampleRoute(samples: TrackingSampleRecord[]) {
  if (samples.length <= maxPolylinePoints) {
    return samples;
  }

  const step = Math.ceil(samples.length / maxPolylinePoints);
  return samples.filter((_, index) => index % step === 0 || index === samples.length - 1);
}

export function getNormalizedWebApiBaseUrl(webApiBaseUrl = getMobileConfig().webApiBaseUrl) {
  const baseUrl = webApiBaseUrl.trim().replace(/\/+$/, "");

  if (!baseUrl) {
    throw new Error("Mobile sync is not configured. Set EXPO_PUBLIC_WEB_API_URL for the mobile app.");
  }

  const parsedUrl = new URL(baseUrl);
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error("Mobile sync backend URL must start with http:// or https://.");
  }

  return baseUrl;
}

export function isProductionWebApiBaseUrl(webApiBaseUrl = getMobileConfig().webApiBaseUrl) {
  try {
    return getNormalizedWebApiBaseUrl(webApiBaseUrl) === "https://gigeze.example";
  } catch {
    return false;
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.name === "AbortError") {
    return "Trip sync timed out while contacting the web backend.";
  }

  return error instanceof Error ? error.message : "Trip sync failed.";
}

function parseBackendRoutePreview(body: unknown, tripId: string): BackendRoutePreview | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const candidate = body as { id?: unknown; computedDistanceKm?: unknown; samples?: unknown };
  if (typeof candidate.id !== "string" || !Array.isArray(candidate.samples)) {
    return null;
  }

  return {
    id: candidate.id,
    computedDistanceKm: isValidDistanceKm(candidate.computedDistanceKm) ? candidate.computedDistanceKm : undefined,
    samples: candidate.samples.flatMap((sample, index) => {
      const routeSample = sample as {
        id?: unknown;
        latitude?: unknown;
        longitude?: unknown;
        accuracyMeters?: unknown;
        recordedAt?: unknown;
      };

      if (
        typeof routeSample.latitude !== "number" ||
        typeof routeSample.longitude !== "number" ||
        typeof routeSample.recordedAt !== "string"
      ) {
        return [];
      }

      const timestampMs = new Date(routeSample.recordedAt).getTime();
      return [{
        sessionId: tripId,
        latitude: routeSample.latitude,
        longitude: routeSample.longitude,
        accuracyMeters: typeof routeSample.accuracyMeters === "number" ? routeSample.accuracyMeters : null,
        timestampMs: Number.isFinite(timestampMs) ? timestampMs : index,
        recordedAt: routeSample.recordedAt,
        source: "expo-background-location" as const,
        originId: typeof routeSample.id === "string" ? `backend:${routeSample.id}` : `backend:${candidate.id}:${index}`,
        sequence: index + 1,
      }];
    }),
  };
}

export async function checkWebApiConnectivity(webApiBaseUrl = getMobileConfig().webApiBaseUrl): Promise<ApiConnectivityResult> {
  const startedAt = Date.now();

  try {
    const baseUrl = getNormalizedWebApiBaseUrl(webApiBaseUrl);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), healthCheckTimeoutMs);

    try {
      const healthResponse = await fetch(`${baseUrl}/api/health`, {
        method: "GET",
        signal: controller.signal,
      });

      if (healthResponse.ok) {
        return {
          status: "ok",
          responseTimeMs: Date.now() - startedAt,
          statusCode: healthResponse.status,
        };
      }

      if (healthResponse.status !== 404 && healthResponse.status !== 405) {
        return {
          status: "failed",
          responseTimeMs: Date.now() - startedAt,
          statusCode: healthResponse.status,
          error: `Health check returned HTTP ${healthResponse.status}.`,
        };
      }

      const tripsResponse = await fetch(`${baseUrl}/api/trips/complete`, {
        method: "HEAD",
        signal: controller.signal,
      });
      const endpointReachable = tripsResponse.status < 500;

      return {
        status: endpointReachable ? "ok" : "failed",
        responseTimeMs: Date.now() - startedAt,
        statusCode: tripsResponse.status,
        error: endpointReachable ? undefined : `Trip sync endpoint returned HTTP ${tripsResponse.status}.`,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    return {
      status: "failed",
      responseTimeMs: Date.now() - startedAt,
      error: getErrorMessage(error),
    };
  }
}

export function createDiagnosticTripSyncInput(now = new Date()): {
  trip: MobileTripSession;
  samples: TrackingSampleRecord[];
} {
  const dayKey = now.toISOString().slice(0, 10);
  const startedAt = `${dayKey}T00:00:00.000Z`;
  const endedAt = `${dayKey}T00:01:00.000Z`;

  return {
    trip: {
      id: `field-test-${dayKey}`,
      userId: "field-test",
      status: "completed",
      startedAt,
      endedAt,
      distanceMeters: 0,
      title: `Field test diagnostic sync ${dayKey}`,
      sampleCount: 0,
      captureMode: "manual",
      syncState: "pendingSync",
      createdAt: startedAt,
      updatedAt: endedAt,
    },
    samples: [],
  };
}

function getSyncBaseUrlAttempts(baseUrl: string) {
  const attempts = [baseUrl];

  try {
    const parsedUrl = new URL(baseUrl);
    if (parsedUrl.hostname === "10.0.2.2") {
      parsedUrl.hostname = "127.0.0.1";
      attempts.push(parsedUrl.toString().replace(/\/+$/, ""));
    }
  } catch {
    return attempts;
  }

  return attempts;
}

function getResponseError(body: unknown, status: number) {
  if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
    return getUserFacingTripErrorMessage(body.error);
  }

  return getUserFacingTripErrorMessage(`Trip sync failed with HTTP ${status}.`);
}

function parseSuccessResponse(body: unknown): CompleteTripSyncResult {
  const responseBody = body as { draftLogId?: unknown; editHref?: unknown; distanceKm?: unknown; deletedAt?: unknown } | null;
  if (!responseBody || typeof responseBody.draftLogId !== "string") {
    return {
      ok: false,
      error: "Trip sync returned an unexpected response. Check the Web API URL and sign-in state.",
    };
  }

  return {
    ok: true,
    backendTripId: responseBody.draftLogId,
    backendEditHref: typeof responseBody.editHref === "string" ? responseBody.editHref : undefined,
    backendDistanceKm: isValidDistanceKm(responseBody.distanceKm) ? responseBody.distanceKm : undefined,
    deletedAt: typeof responseBody.deletedAt === "string" ? responseBody.deletedAt : undefined,
  };
}

export function mapCompletedTripToPayload(trip: MobileTripSession, samples: TrackingSampleRecord[]): CompleteTripSyncPayload {
  if (!trip.endedAt) {
    throw new Error("Completed trip is missing an end time.");
  }

  const sortedSamples = [...samples].sort((left, right) => left.sequence - right.sequence);
  const sampleDistanceKm = calculateSampleDistanceKm(sortedSamples);
  const storedDistanceKm = (trip.distanceMeters ?? 0) / 1000;
  const distanceKm = Math.max(sampleDistanceKm, storedDistanceKm, 0);
  const vehicleId = trip.tripMode === "WALK" ? undefined : trip.vehicleId;
  const tripPurpose = trip.tripMode === "WALK" || !vehicleId ? undefined : trip.tripPurpose;

  return {
    mobileTripId: trip.id,
    backendTripId: trip.backendTripId,
    tripMode: trip.tripMode ?? "DRIVE",
    vehicleId,
    tripPurpose,
    purpose: trip.purpose?.trim() || undefined,
    startOdometer: trip.tripMode === "WALK" || !vehicleId ? undefined : trip.startOdometer,
    endOdometer: trip.tripMode === "WALK" || !vehicleId ? undefined : trip.endOdometer,
    journeyId: trip.journeyId,
    journeyTitle: trip.journeyTitle,
    startedAt: trip.startedAt,
    endedAt: trip.endedAt,
    distanceKm,
    samples: sortedSamples.map((sample) => ({
      latitude: sample.latitude,
      longitude: sample.longitude,
      accuracyMeters: sample.accuracyMeters,
      recordedAt: sample.recordedAt,
    })),
    routePolyline: downsampleRoute(sortedSamples).map((sample) => ({
      latitude: sample.latitude,
      longitude: sample.longitude,
    })),
    stopSuggestions: [],
  };
}

export async function syncCompletedTripToBackend(
  trip: MobileTripSession,
  samples: TrackingSampleRecord[],
  accessToken: string,
): Promise<CompleteTripSyncResult> {
  if (!accessToken.trim()) {
    return {
      ok: false,
      error: "Signed-in session is not available for trip sync. Sign in again, then retry.",
    };
  }

  const payload = mapCompletedTripToPayload(trip, samples);
  let lastError: unknown;
  try {
    for (const baseUrl of getSyncBaseUrlAttempts(getNormalizedWebApiBaseUrl())) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), defaultTimeoutMs);

      try {
        const response = await fetch(`${baseUrl}/api/trips/complete`, {
          method: "POST",
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        const body = (await response.json().catch(() => null)) as unknown;

        if (!response.ok) {
          return {
            ok: false,
            error: getResponseError(body, response.status),
          };
        }

        return parseSuccessResponse(body);
      } catch (error) {
        lastError = error;
      } finally {
        clearTimeout(timeoutId);
      }
    }

    throw lastError;
  } catch (error) {
    return {
      ok: false,
      error: getErrorMessage(error),
    };
  }
}

export async function fetchDrivingLogRoutePreview(
  backendTripId: string,
  accessToken: string,
  tripId = backendTripId,
): Promise<BackendRoutePreview | null> {
  if (!accessToken.trim() || !backendTripId.trim()) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), defaultTimeoutMs);

  try {
    const response = await fetch(
      `${getNormalizedWebApiBaseUrl()}/api/logs/driving/${encodeURIComponent(backendTripId)}/route`,
      {
        method: "GET",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      return null;
    }

    const body = await response.json().catch(() => null);
    return parseBackendRoutePreview(body, tripId);
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function deleteCompletedTripFromBackend(backendTripId: string, accessToken: string): Promise<TripDeletionSyncResult> {
  if (!accessToken.trim()) {
    return {
      ok: false,
      error: "Signed-in session is not available for trip deletion sync. Sign in again, then retry.",
    };
  }

  let lastError: unknown;
  try {
    for (const baseUrl of getSyncBaseUrlAttempts(getNormalizedWebApiBaseUrl())) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), defaultTimeoutMs);

      try {
        const response = await fetch(`${baseUrl}/api/mobile/trips/${encodeURIComponent(backendTripId)}`, {
          method: "DELETE",
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        const body = (await response.json().catch(() => null)) as { backendTripId?: unknown; deletedAt?: unknown } | null;

        if (!response.ok) {
          return {
            ok: false,
            error: getResponseError(body, response.status),
          };
        }

        if (!body || typeof body.backendTripId !== "string" || typeof body.deletedAt !== "string") {
          return {
            ok: false,
            error: "Trip deletion returned an unexpected response. Check the Web API URL and sign-in state.",
          };
        }

        return {
          ok: true,
          backendTripId: body.backendTripId,
          deletedAt: body.deletedAt,
        };
      } catch (error) {
        lastError = error;
      } finally {
        clearTimeout(timeoutId);
      }
    }

    throw lastError;
  } catch (error) {
    return {
      ok: false,
      error: getErrorMessage(error),
    };
  }
}

export async function fetchDeletedBackendTrips(accessToken: string): Promise<DeletedBackendTrip[]> {
  if (!accessToken.trim()) {
    return [];
  }

  const baseUrl = getNormalizedWebApiBaseUrl();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), defaultTimeoutMs);

  try {
    const response = await fetch(`${baseUrl}/api/mobile/trips/deletions`, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const body = (await response.json().catch(() => null)) as { deletedTrips?: unknown } | null;

    if (response.status === 404) {
      return [];
    }

    if (!response.ok) {
      throw new Error(getResponseError(body, response.status));
    }

    if (!body || !Array.isArray(body.deletedTrips)) {
      return [];
    }

    return body.deletedTrips.flatMap((trip) => {
      const candidate = trip as { backendTripId?: unknown; deletedAt?: unknown; updatedAt?: unknown };
      if (typeof candidate.backendTripId !== "string" || typeof candidate.deletedAt !== "string") {
        return [];
      }

      return [{
        backendTripId: candidate.backendTripId,
        deletedAt: candidate.deletedAt,
        updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : undefined,
      }];
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchBackendTripSummaries(accessToken: string): Promise<BackendTripSummary[]> {
  if (!accessToken.trim()) {
    return [];
  }

  const baseUrl = getNormalizedWebApiBaseUrl();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), defaultTimeoutMs);

  try {
    const response = await fetch(`${baseUrl}/api/mobile/trips`, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const body = (await response.json().catch(() => null)) as { trips?: unknown } | null;

    if (response.status === 404) {
      return [];
    }

    if (!response.ok) {
      throw new Error(getResponseError(body, response.status));
    }

    if (!body || !Array.isArray(body.trips)) {
      return [];
    }

    return body.trips.flatMap((trip) => {
      const candidate = trip as {
        backendTripId?: unknown;
        journeyId?: unknown;
        journeyTitle?: unknown;
        tripMode?: unknown;
        vehicleId?: unknown;
        vehicleName?: unknown;
        tripPurpose?: unknown;
        purpose?: unknown;
        date?: unknown;
        startedAt?: unknown;
        endedAt?: unknown;
        startOdometer?: unknown;
        endOdometer?: unknown;
        startLocation?: unknown;
        endLocation?: unknown;
        distanceKm?: unknown;
        updatedAt?: unknown;
      };

      if (typeof candidate.backendTripId !== "string") {
        return [];
      }

      return [{
        backendTripId: candidate.backendTripId,
        journeyId: typeof candidate.journeyId === "string" ? candidate.journeyId : undefined,
        journeyTitle: typeof candidate.journeyTitle === "string" ? candidate.journeyTitle : undefined,
        tripMode: candidate.tripMode === "WALK" || candidate.tripMode === "RIDE" || candidate.tripMode === "DRIVE" ? candidate.tripMode : undefined,
        vehicleId: typeof candidate.vehicleId === "string" ? candidate.vehicleId : undefined,
        vehicleName: typeof candidate.vehicleName === "string" ? candidate.vehicleName : undefined,
        tripPurpose: candidate.tripPurpose === "PRIVATE" || candidate.tripPurpose === "BUSINESS" ? candidate.tripPurpose : undefined,
        purpose: typeof candidate.purpose === "string" ? candidate.purpose : undefined,
        date: typeof candidate.date === "string" ? candidate.date : undefined,
        startedAt: typeof candidate.startedAt === "string" ? candidate.startedAt : undefined,
        endedAt: typeof candidate.endedAt === "string" ? candidate.endedAt : undefined,
        startOdometer: typeof candidate.startOdometer === "number" && Number.isFinite(candidate.startOdometer) ? candidate.startOdometer : undefined,
        endOdometer: typeof candidate.endOdometer === "number" && Number.isFinite(candidate.endOdometer) ? candidate.endOdometer : undefined,
        startLocation: typeof candidate.startLocation === "string" ? candidate.startLocation : undefined,
        endLocation: typeof candidate.endLocation === "string" ? candidate.endLocation : undefined,
        backendDistanceKm: isValidDistanceKm(candidate.distanceKm) ? candidate.distanceKm : undefined,
        updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : undefined,
      }];
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
