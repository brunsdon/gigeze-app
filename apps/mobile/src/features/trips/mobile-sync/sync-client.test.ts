import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrackingSampleRecord } from "../mobile-tracking/types";
import type { MobileTripSession } from "../trip-workflow";

vi.mock("../../../lib/config", () => ({
  PRODUCTION_WEB_API_BASE_URL: "https://gigeze.example",
  getMobileConfig: () => ({
    appName: "GigEze",
    appVersion: "0.1.0",
    appEnvironment: "test",
    platform: "android",
    supabaseUrl: "https://example.supabase.co",
    supabaseAnonKey: "anon",
    webApiBaseUrl: "http://10.0.2.2:3000/",
    webApiBaseUrlWarning: null,
  }),
}));

const fetchMock = vi.fn();

function createTrip(overrides: Partial<MobileTripSession> = {}): MobileTripSession {
  return {
    id: "trip-1",
    userId: "user-1",
    status: "completed",
    startedAt: "2026-04-12T00:00:00.000Z",
    endedAt: "2026-04-12T00:10:00.000Z",
    distanceMeters: 1500,
    title: "Morning run",
    sampleCount: 2,
    captureMode: "tracking",
    syncState: "pendingSync",
    createdAt: "2026-04-12T00:00:00.000Z",
    updatedAt: "2026-04-12T00:10:00.000Z",
    ...overrides,
  };
}

function createSample(overrides: Partial<TrackingSampleRecord> = {}): TrackingSampleRecord {
  return {
    sessionId: "trip-1",
    latitude: -33.86,
    longitude: 151.2,
    accuracyMeters: 8,
    timestampMs: 1,
    recordedAt: "2026-04-12T00:00:01.000Z",
    source: "expo-background-location",
    originId: "sample-1",
    sequence: 1,
    ...overrides,
  };
}

describe("mobile trip sync client", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("maps completed local trips to the web completion payload", async () => {
    const { mapCompletedTripToPayload } = await import("./sync-client");

    const payload = mapCompletedTripToPayload(createTrip({
      journeyId: "Tour-1",
      journeyTitle: "NSW Coast Run",
      vehicleId: "vehicle-1",
      backendTripId: "log-1",
      purpose: "Client meeting",
    }), [
      createSample({ sequence: 2, originId: "sample-2", recordedAt: "2026-04-12T00:05:00.000Z", latitude: -33.87 }),
      createSample({ sequence: 1, originId: "sample-1", recordedAt: "2026-04-12T00:00:01.000Z" }),
    ]);

    expect(payload).toMatchObject({
      journeyId: "Tour-1",
      journeyTitle: "NSW Coast Run",
      mobileTripId: "trip-1",
      backendTripId: "log-1",
      tripMode: "DRIVE",
      vehicleId: "vehicle-1",
      purpose: "Client meeting",
      startedAt: "2026-04-12T00:00:00.000Z",
      endedAt: "2026-04-12T00:10:00.000Z",
      stopSuggestions: [],
    });
    expect(payload.samples.map((sample) => sample.recordedAt)).toEqual([
      "2026-04-12T00:00:01.000Z",
      "2026-04-12T00:05:00.000Z",
    ]);
    expect(payload.distanceKm).toBeGreaterThan(0);
  });

  it("posts with bearer auth and returns backend identifiers", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ draftLogId: "log-1", editHref: "/dashboard/logs/driving/log-1/edit", distanceKm: 2 }),
    });
    const { syncCompletedTripToBackend } = await import("./sync-client");

    const result = await syncCompletedTripToBackend(createTrip(), [
      createSample({ sequence: 2, latitude: -33.87, recordedAt: "2026-04-12T00:05:00.000Z" }),
      createSample({ sequence: 1, latitude: -33.86, recordedAt: "2026-04-12T00:00:01.000Z" }),
    ], "access-token");

    expect(result).toEqual({
      ok: true,
      backendTripId: "log-1",
      backendEditHref: "/dashboard/logs/driving/log-1/edit",
      backendDistanceKm: 2,
      deletedAt: undefined,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://10.0.2.2:3000/api/trips/complete",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
          "Content-Type": "application/json",
        }),
      }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toMatchObject({
      samples: [
        {
          latitude: -33.86,
          longitude: 151.2,
          accuracyMeters: 8,
          recordedAt: "2026-04-12T00:00:01.000Z",
        },
        {
          latitude: -33.87,
          longitude: 151.2,
          accuracyMeters: 8,
          recordedAt: "2026-04-12T00:05:00.000Z",
        },
      ],
    });
  });

  it("treats backend tombstone responses as successful terminal sync", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ draftLogId: "log-1", deletedAt: "2026-04-20T01:00:00.000Z" }),
    });
    const { syncCompletedTripToBackend } = await import("./sync-client");

    await expect(syncCompletedTripToBackend(createTrip({ backendTripId: "log-1" }), [], "access-token")).resolves.toEqual({
      ok: true,
      backendTripId: "log-1",
      backendEditHref: undefined,
      backendDistanceKm: undefined,
      deletedAt: "2026-04-20T01:00:00.000Z",
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toMatchObject({ backendTripId: "log-1" });
  });

  it("includes selected purpose and odometer readings in the completion payload", async () => {
    const { mapCompletedTripToPayload } = await import("./sync-client");

    const payload = mapCompletedTripToPayload(createTrip({
      vehicleId: "vehicle-1",
      tripPurpose: "BUSINESS",
      purpose: "Travel between job sites",
      startOdometer: 12345,
      endOdometer: 12351,
    }), []);

    expect(payload).toMatchObject({
      vehicleId: "vehicle-1",
      tripPurpose: "BUSINESS",
      purpose: "Travel between job sites",
      startOdometer: 12345,
      endOdometer: 12351,
    });
  });

  it("omits vehicle and odometer fields for walk trips", async () => {
    const { mapCompletedTripToPayload } = await import("./sync-client");

    const payload = mapCompletedTripToPayload(createTrip({
      tripMode: "WALK",
      vehicleId: "vehicle-1",
      vehicleName: "Walking workaround",
      startOdometer: 10,
      endOdometer: 11,
    }), []);

    expect(payload).toMatchObject({
      tripMode: "WALK",
      vehicleId: undefined,
      tripPurpose: undefined,
      startOdometer: undefined,
      endOdometer: undefined,
    });
  });

  it("omits purpose when business split is not enabled for the trip", async () => {
    const { mapCompletedTripToPayload } = await import("./sync-client");

    const payload = mapCompletedTripToPayload(createTrip({
      tripMode: "DRIVE",
      vehicleId: "vehicle-1",
      tripPurpose: undefined,
      startOdometer: 12345,
      endOdometer: 12351,
    }), []);

    expect(payload).toMatchObject({
      vehicleId: "vehicle-1",
      tripPurpose: undefined,
      startOdometer: 12345,
      endOdometer: 12351,
    });
  });

  it("omits stale purpose and odometer values when no vehicle is attached", async () => {
    const { mapCompletedTripToPayload } = await import("./sync-client");

    const payload = mapCompletedTripToPayload(createTrip({
      tripMode: "DRIVE",
      tripPurpose: "BUSINESS",
      startOdometer: 12345,
      endOdometer: 12351,
    }), []);

    expect(payload).toMatchObject({
      tripMode: "DRIVE",
      vehicleId: undefined,
      tripPurpose: undefined,
      startOdometer: undefined,
      endOdometer: undefined,
    });
  });

  it("keeps offline completed trip samples in the retry sync payload", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ draftLogId: "log-1", distanceKm: 3 }),
    });
    const { syncCompletedTripToBackend } = await import("./sync-client");

    await syncCompletedTripToBackend(createTrip({ syncState: "syncFailed" }), [
      createSample({ originId: "offline-1", sequence: 1, recordedAt: "2026-04-12T00:00:01.000Z" }),
      createSample({ originId: "offline-2", sequence: 2, recordedAt: "2026-04-12T00:05:00.000Z", latitude: -33.87 }),
    ], "access-token");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as { samples: unknown[] };

    expect(body.samples).toHaveLength(2);
    expect(body.samples).toMatchObject([
      { recordedAt: "2026-04-12T00:00:01.000Z" },
      { recordedAt: "2026-04-12T00:05:00.000Z" },
    ]);
  });

  it("returns structured failure details for retryable sync attempts", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: "database unavailable" }),
    });
    const { syncCompletedTripToBackend } = await import("./sync-client");

    await expect(syncCompletedTripToBackend(createTrip(), [], "access-token")).resolves.toEqual({
      ok: false,
      error: "database unavailable",
    });
  });

  it("returns user-friendly auth failure details", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "unauthorized" }),
    });
    const { syncCompletedTripToBackend } = await import("./sync-client");

    await expect(syncCompletedTripToBackend(createTrip(), [], "access-token")).resolves.toEqual({
      ok: false,
      error: "Your sign-in needs refreshing. Sign out and back in, then try Sync again.",
    });
  });

  it("does not treat non-API 200 responses as successful sync", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => null,
    });
    const { syncCompletedTripToBackend } = await import("./sync-client");

    await expect(syncCompletedTripToBackend(createTrip(), [], "access-token")).resolves.toEqual({
      ok: false,
      error: "Trip sync returned an unexpected response. Check the Web API URL and sign-in state.",
    });
  });

  it("fails safely when auth is missing", async () => {
    const { syncCompletedTripToBackend } = await import("./sync-client");

    await expect(syncCompletedTripToBackend(createTrip(), [], "")).resolves.toEqual({
      ok: false,
      error: "Signed-in session is not available for trip sync. Sign in again, then retry.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("validates and normalizes the configured backend URL", async () => {
    const { getNormalizedWebApiBaseUrl, isProductionWebApiBaseUrl } = await import("./sync-client");

    expect(getNormalizedWebApiBaseUrl("http://10.0.2.2:3000/")).toBe("http://10.0.2.2:3000");
    expect(() => getNormalizedWebApiBaseUrl("")).toThrow("Mobile sync is not configured");
    expect(() => getNormalizedWebApiBaseUrl("ftp://example.test")).toThrow("Mobile sync backend URL must start with http:// or https://.");
    expect(isProductionWebApiBaseUrl("https://gigeze.example")).toBe(true);
    expect(isProductionWebApiBaseUrl("http://10.0.2.2:3000")).toBe(false);
  });

  it("checks API reachability without requiring a write", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
    }).mockResolvedValueOnce({
      ok: false,
      status: 405,
    });
    const { checkWebApiConnectivity } = await import("./sync-client");

    await expect(checkWebApiConnectivity("https://gigeze.example")).resolves.toMatchObject({
      status: "ok",
      statusCode: 405,
    });
    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://gigeze.example/api/health", expect.objectContaining({ method: "GET" }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://gigeze.example/api/trips/complete", expect.objectContaining({ method: "HEAD" }));
  });

  it("loads mobile vehicle options from the authenticated web API", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        vehicles: [
          {
            id: "vehicle-1",
            name: "Tour Van",
            vehicleMode: "DRIVE",
            enableBusinessSplit: true,
            registration: "ABC123",
            fuelType: "Diesel",
            notes: "Main rig",
            startingOdometer: 12000,
            isDefault: true,
            defaultUse: "BUSINESS",
            latestOdometer: 12345,
          },
        ],
      }),
    });
    const { fetchMobileVehicleOptions } = await import("./vehicle-client");

    await expect(fetchMobileVehicleOptions("access-token")).resolves.toEqual([
      {
        id: "vehicle-1",
        name: "Tour Van",
        vehicleMode: "DRIVE",
        enableBusinessSplit: true,
        registration: "ABC123",
        fuelType: "Diesel",
        notes: "Main rig",
        startingOdometer: 12000,
        isDefault: true,
        defaultUse: "BUSINESS",
        latestOdometer: 12345,
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://10.0.2.2:3000/api/mobile/vehicles",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer access-token" }),
      }),
    );
  });

  it("loads mobile Tour options from the authenticated web API", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        Tours: [
          {
            id: "Tour-1",
            title: "NSW Coast Run",
            description: "Autumn loop",
            startDate: "2026-04-01T00:00:00.000Z",
            endDate: null,
            status: "ACTIVE",
            visibility: "PRIVATE",
            coverImageUrl: null,
          },
        ],
      }),
    });
    const { fetchMobileJourneyOptions } = await import("./vehicle-client");

    await expect(fetchMobileJourneyOptions("access-token")).resolves.toEqual([
      {
        id: "Tour-1",
        title: "NSW Coast Run",
        description: "Autumn loop",
        startDate: "2026-04-01T00:00:00.000Z",
        endDate: null,
        status: "ACTIVE",
        visibility: "PRIVATE",
        coverImageUrl: null,
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://10.0.2.2:3000/api/mobile/Tours",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer access-token" }),
      }),
    );
  });

  it("uses friendly setup option errors when the website endpoint is unavailable", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: "not found" }),
    });
    const { fetchMobileJourneyOptions } = await import("./vehicle-client");

    await expect(fetchMobileJourneyOptions("access-token")).rejects.toThrow(
      "Tour options are unavailable from the website right now. You can still start a trip without selecting one.",
    );
  });

  it("uses friendly setup option errors when the website cannot be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));
    const { fetchMobileVehicleOptions } = await import("./vehicle-client");

    await expect(fetchMobileVehicleOptions("access-token")).rejects.toThrow(
      "The website is unavailable right now, so vehicle options could not load. You can still start a trip without selecting one.",
    );
  });

  it("creates mobile vehicles through the authenticated web API", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        vehicle: {
          id: "vehicle-2",
          name: "Walking",
          vehicleMode: "RIDE",
          enableBusinessSplit: false,
          startingOdometer: 0,
          isDefault: false,
          defaultUse: "PERSONAL",
          latestOdometer: 0,
        },
      }),
    });
    const { createMobileVehicle } = await import("./vehicle-client");

    await expect(createMobileVehicle("access-token", {
      name: "Walking",
      vehicleMode: "RIDE",
      enableBusinessSplit: false,
      startingOdometer: 0,
      defaultUse: "PERSONAL",
      isDefault: false,
    })).resolves.toMatchObject({
      id: "vehicle-2",
      name: "Walking",
      vehicleMode: "RIDE",
      enableBusinessSplit: false,
      defaultUse: "PERSONAL",
      latestOdometer: 0,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://10.0.2.2:3000/api/mobile/vehicles",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("updates and deletes mobile vehicles through the authenticated web API", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          vehicle: {
            id: "vehicle-1",
            name: "VW Caddy",
            vehicleMode: "DRIVE",
            enableBusinessSplit: true,
            startingOdometer: 83000,
            isDefault: true,
            defaultUse: "BUSINESS",
            latestOdometer: 83811,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ vehicleId: "vehicle-1", deleted: true }),
      });
    const { deleteMobileVehicle, updateMobileVehicle } = await import("./vehicle-client");

    await expect(updateMobileVehicle("access-token", "vehicle-1", {
      name: "VW Caddy",
      vehicleMode: "DRIVE",
      enableBusinessSplit: true,
      startingOdometer: 83000,
      defaultUse: "BUSINESS",
      isDefault: true,
    })).resolves.toMatchObject({ id: "vehicle-1", name: "VW Caddy", isDefault: true, enableBusinessSplit: true });
    await expect(deleteMobileVehicle("access-token", "vehicle-1")).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://10.0.2.2:3000/api/mobile/vehicles/vehicle-1",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://10.0.2.2:3000/api/mobile/vehicles/vehicle-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("creates mobile Tours through the authenticated web API", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        Tour: {
          id: "Tour-2",
          title: "Winter Loop",
          description: "Snowy roads",
          startDate: "2026-06-01T00:00:00.000Z",
          endDate: null,
          status: "PLANNED",
          visibility: "PRIVATE",
          coverImageUrl: null,
        },
      }),
    });
    const { createMobileJourney } = await import("./vehicle-client");

    await expect(createMobileJourney("access-token", {
      title: "Winter Loop",
      description: "Snowy roads",
      startDate: "2026-06-01",
      status: "PLANNED",
      visibility: "PRIVATE",
    })).resolves.toMatchObject({
      id: "Tour-2",
      title: "Winter Loop",
      description: "Snowy roads",
      status: "PLANNED",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://10.0.2.2:3000/api/mobile/Tours",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("updates and deletes mobile Tours through the authenticated web API", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Tour: {
            id: "Tour-1",
            title: "NSW Coast Run",
            description: null,
            startDate: "2026-04-01T00:00:00.000Z",
            endDate: "2026-04-12T00:00:00.000Z",
            status: "ACTIVE",
            visibility: "PRIVATE",
            coverImageUrl: null,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ journeyId: "Tour-1", deleted: true }),
      });
    const { deleteMobileJourney, updateMobileJourney } = await import("./vehicle-client");

    await expect(updateMobileJourney("access-token", "Tour-1", {
      title: "NSW Coast Run",
      startDate: "2026-04-01",
      endDate: "2026-04-12",
      status: "ACTIVE",
      visibility: "PRIVATE",
    })).resolves.toMatchObject({ id: "Tour-1", title: "NSW Coast Run", status: "ACTIVE" });
    await expect(deleteMobileJourney("access-token", "Tour-1")).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://10.0.2.2:3000/api/mobile/Tours/Tour-1",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://10.0.2.2:3000/api/mobile/Tours/Tour-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("syncs mobile trip deletion to the backend", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ backendTripId: "log-1", deletedAt: "2026-04-20T01:00:00.000Z" }),
    });
    const { deleteCompletedTripFromBackend } = await import("./sync-client");

    await expect(deleteCompletedTripFromBackend("log-1", "access-token")).resolves.toEqual({
      ok: true,
      backendTripId: "log-1",
      deletedAt: "2026-04-20T01:00:00.000Z",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://10.0.2.2:3000/api/mobile/trips/log-1",
      expect.objectContaining({
        method: "DELETE",
        headers: expect.objectContaining({ Authorization: "Bearer access-token" }),
      }),
    );
  });

  it("loads backend trip tombstones for web-to-mobile deletion sync", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        deletedTrips: [
          { backendTripId: "log-1", deletedAt: "2026-04-20T01:00:00.000Z", updatedAt: "2026-04-20T01:00:01.000Z" },
          { backendTripId: null, deletedAt: "bad" },
        ],
      }),
    });
    const { fetchDeletedBackendTrips } = await import("./sync-client");

    await expect(fetchDeletedBackendTrips("access-token")).resolves.toEqual([
      { backendTripId: "log-1", deletedAt: "2026-04-20T01:00:00.000Z", updatedAt: "2026-04-20T01:00:01.000Z" },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://10.0.2.2:3000/api/mobile/trips/deletions",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer access-token" }),
      }),
    );
  });

  it("treats missing backend tombstone refresh endpoint as an empty refresh", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: "not found" }),
    });
    const { fetchDeletedBackendTrips } = await import("./sync-client");

    await expect(fetchDeletedBackendTrips("access-token")).resolves.toEqual([]);
  });

  it("loads backend trip summaries for web-to-mobile metadata refresh", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        trips: [
          {
            backendTripId: "log-1",
            journeyId: "Tour-1",
            journeyTitle: "NSW Coast Run",
            tripMode: "DRIVE",
            vehicleId: "vehicle-1",
            vehicleName: "VW Caddy",
            tripPurpose: "BUSINESS",
            date: "2026-04-20T00:00:00.000Z",
            startedAt: "2026-04-20T07:05:00.000Z",
            endedAt: "2026-04-20T07:52:00.000Z",
            startLocation: "Coburg VIC, Australia",
            endLocation: "Brunswick VIC, Australia",
            startOdometer: 83804,
            endOdometer: 83807,
            distanceKm: 3,
            updatedAt: "2026-04-20T08:00:00.000Z",
          },
          { backendTripId: null, distanceKm: 9 },
        ],
      }),
    });
    const { fetchBackendTripSummaries } = await import("./sync-client");

    await expect(fetchBackendTripSummaries("access-token")).resolves.toEqual([
      {
        backendTripId: "log-1",
        journeyId: "Tour-1",
        journeyTitle: "NSW Coast Run",
        tripMode: "DRIVE",
        vehicleId: "vehicle-1",
        vehicleName: "VW Caddy",
        tripPurpose: "BUSINESS",
        date: "2026-04-20T00:00:00.000Z",
        startedAt: "2026-04-20T07:05:00.000Z",
        endedAt: "2026-04-20T07:52:00.000Z",
        startLocation: "Coburg VIC, Australia",
        endLocation: "Brunswick VIC, Australia",
        startOdometer: 83804,
        endOdometer: 83807,
        backendDistanceKm: 3,
        updatedAt: "2026-04-20T08:00:00.000Z",
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://10.0.2.2:3000/api/mobile/trips",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer access-token" }),
      }),
    );
  });

  it("treats missing backend summary refresh endpoint as an empty refresh", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: "not found" }),
    });
    const { fetchBackendTripSummaries } = await import("./sync-client");

    await expect(fetchBackendTripSummaries("access-token")).resolves.toEqual([]);
  });

  it("keeps unreachable backend failures structured for retry", async () => {
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));
    const { syncCompletedTripToBackend } = await import("./sync-client");

    await expect(syncCompletedTripToBackend(createTrip(), [], "access-token")).resolves.toEqual({
      ok: false,
      error: "Network request failed",
    });
  });

  it("falls back to an adb-reversed localhost URL when the Android emulator URL is unreachable", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("Network request failed"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ draftLogId: "log-1" }),
      });
    const { syncCompletedTripToBackend } = await import("./sync-client");

    await expect(syncCompletedTripToBackend(createTrip(), [], "access-token")).resolves.toEqual({
      ok: true,
      backendTripId: "log-1",
      backendEditHref: undefined,
      backendDistanceKm: undefined,
      deletedAt: undefined,
    });
    expect(fetchMock).toHaveBeenNthCalledWith(1, "http://10.0.2.2:3000/api/trips/complete", expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://127.0.0.1:3000/api/trips/complete", expect.any(Object));
  });

  it("fetches backend route samples for synced trip detail previews", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "log-1",
        computedDistanceKm: 1,
        samples: [
          {
            id: "sample-1",
            latitude: -37.74311,
            longitude: 144.96983,
            accuracyMeters: 8,
            recordedAt: "2026-04-27T02:53:00.000Z",
          },
          {
            id: "sample-2",
            latitude: -37.74862,
            longitude: 144.9653,
            accuracyMeters: null,
            recordedAt: "2026-04-27T02:57:00.000Z",
          },
        ],
      }),
    });
    const { fetchDrivingLogRoutePreview } = await import("./sync-client");

    await expect(fetchDrivingLogRoutePreview("log-1", "access-token", "trip-1")).resolves.toMatchObject({
      id: "log-1",
      computedDistanceKm: 1,
      samples: [
        expect.objectContaining({
          sessionId: "trip-1",
          latitude: -37.74311,
          longitude: 144.96983,
          originId: "backend:sample-1",
          sequence: 1,
        }),
        expect.objectContaining({
          sessionId: "trip-1",
          latitude: -37.74862,
          longitude: 144.9653,
          originId: "backend:sample-2",
          sequence: 2,
        }),
      ],
    });
    expect(fetchMock).toHaveBeenCalledWith("http://10.0.2.2:3000/api/logs/driving/log-1/route", expect.objectContaining({
      method: "GET",
      headers: { Authorization: "Bearer access-token" },
    }));
  });
});
