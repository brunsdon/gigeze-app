import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequireAuthenticatedUser,
  mockRequireWorkspaceOwner,
  mockGetOrCreateCurrentUserFromSessionUser,
  mockGetWorkspaceOwnerForUser,
  mockCreateDrivingLogWithGpsSamples,
  mockAppendDrivingLogGpsSamples,
  mockFindMatchingTripCompletionDraftByMobileTripId,
  mockFindMatchingTripCompletionDraft,
  mockGetDeletedDrivingLogById,
  mockGetStartOdometerForVehicle,
  mockUpdateDrivingLogTripMetadata,
  mockGetVehicleById,
  mockReverseGeocodeTripEndpoints,
  mockRevalidatePath,
  mockCreateClient,
  mockGetUser,
} = vi.hoisted(() => ({
  mockRequireAuthenticatedUser: vi.fn(),
  mockRequireWorkspaceOwner: vi.fn(),
  mockGetOrCreateCurrentUserFromSessionUser: vi.fn(),
  mockGetWorkspaceOwnerForUser: vi.fn(),
  mockCreateDrivingLogWithGpsSamples: vi.fn(),
  mockAppendDrivingLogGpsSamples: vi.fn(),
  mockFindMatchingTripCompletionDraftByMobileTripId: vi.fn(),
  mockFindMatchingTripCompletionDraft: vi.fn(),
  mockGetDeletedDrivingLogById: vi.fn(),
  mockGetStartOdometerForVehicle: vi.fn(),
  mockUpdateDrivingLogTripMetadata: vi.fn(),
  mockGetVehicleById: vi.fn(),
  mockReverseGeocodeTripEndpoints: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockCreateClient: vi.fn(),
  mockGetUser: vi.fn(),
}));

vi.mock("@/lib/auth/workspace", () => ({
  getOrCreateCurrentUserFromSessionUser: mockGetOrCreateCurrentUserFromSessionUser,
  getWorkspaceOwnerForUser: mockGetWorkspaceOwnerForUser,
  requireAuthenticatedUser: mockRequireAuthenticatedUser,
  requireWorkspaceOwner: mockRequireWorkspaceOwner,
}));

vi.mock("@/lib/supabase/env", () => ({
  getSupabasePublicEnv: () => ({ url: "https://example.supabase.co", anonKey: "anon-key" }),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@/features/driving-logs/service", () => ({
  appendDrivingLogGpsSamples: mockAppendDrivingLogGpsSamples,
  createDrivingLogWithGpsSamples: mockCreateDrivingLogWithGpsSamples,
  findMatchingTripCompletionDraftByMobileTripId: mockFindMatchingTripCompletionDraftByMobileTripId,
  findMatchingTripCompletionDraft: mockFindMatchingTripCompletionDraft,
  getDeletedDrivingLogById: mockGetDeletedDrivingLogById,
  getStartOdometerForVehicle: mockGetStartOdometerForVehicle,
  updateDrivingLogTripMetadata: mockUpdateDrivingLogTripMetadata,
}));

vi.mock("@/features/vehicles/service", () => ({
  getVehicleById: mockGetVehicleById,
}));

vi.mock("@/lib/maps/geocoding", () => ({
  reverseGeocodeTripEndpoints: mockReverseGeocodeTripEndpoints,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

import { POST } from "@/app/api/trips/complete/route";

function buildPayload() {
  return {
    mobileTripId: "local-trip-1",
    journeyId: "Tour-1",
    journeyTitle: "Tasmania Loop",
    tripMode: "DRIVE",
    vehicleId: "vehicle-1",
    startedAt: "2026-04-09T08:00:00.000Z",
    endedAt: "2026-04-09T09:15:00.000Z",
    distanceKm: 42.4,
    samples: [
      { latitude: -42.8821, longitude: 147.3272, accuracyMeters: 8, recordedAt: "2026-04-09T08:05:00.000Z" },
      { latitude: -42.9, longitude: 147.35, accuracyMeters: 10, recordedAt: "2026-04-09T09:10:00.000Z" },
    ],
    routePolyline: [
      { latitude: -42.8821, longitude: 147.3272 },
      { latitude: -42.9, longitude: 147.35 },
    ],
    stopSuggestions: [
      { title: "Hobart", latitude: -42.8821, longitude: 147.3272, dwellMinutes: 12 },
      { title: "Richmond", latitude: -42.735, longitude: 147.438, dwellMinutes: 18 },
    ],
  };
}

describe("trip completion route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockReturnValue({ auth: { getUser: mockGetUser } });
    mockGetUser.mockResolvedValue({ data: { user: { id: "supabase-user-1", email: "user@example.com", user_metadata: {} } }, error: null });
    mockGetOrCreateCurrentUserFromSessionUser.mockResolvedValue({ id: "user-1" });
    mockRequireAuthenticatedUser.mockResolvedValue({ id: "user-1" });
    mockRequireWorkspaceOwner.mockResolvedValue({ id: "workspace-1" });
    mockGetWorkspaceOwnerForUser.mockResolvedValue({ id: "workspace-1" });
    mockGetVehicleById.mockResolvedValue({ id: "vehicle-1", defaultUse: "PERSONAL", vehicleMode: "DRIVE", enableBusinessSplit: true });
    mockReverseGeocodeTripEndpoints.mockResolvedValue({ startLocation: null, endLocation: null });
    mockFindMatchingTripCompletionDraftByMobileTripId.mockResolvedValue(null);
    mockGetDeletedDrivingLogById.mockResolvedValue(null);
    mockGetStartOdometerForVehicle.mockResolvedValue(1000);
    mockUpdateDrivingLogTripMetadata.mockResolvedValue({ id: "log-1" });
    mockAppendDrivingLogGpsSamples.mockResolvedValue({ count: 0 });
  });

  it("returns 400 for invalid payload", async () => {
    const response = await POST(new Request("http://localhost/api/trips/complete", {
      method: "POST",
      body: JSON.stringify({ startedAt: "2026-04-09T08:00:00.000Z" }),
      headers: { "Content-Type": "application/json" },
    }));

    expect(response.status).toBe(400);
  });

  it("creates a driving log draft for a completed trip", async () => {
    mockFindMatchingTripCompletionDraft.mockResolvedValue(null);
    mockCreateDrivingLogWithGpsSamples.mockResolvedValue({ id: "log-1" });

    const response = await POST(new Request("http://localhost/api/trips/complete", {
      method: "POST",
      body: JSON.stringify(buildPayload()),
      headers: { "Content-Type": "application/json" },
    }));

    const body = await response.json() as { draftLogId: string; editHref: string; distanceKm: number };

    expect(response.status).toBe(200);
    expect(body).toEqual({
      draftLogId: "log-1",
      editHref: "/dashboard/logs/driving/log-1/edit",
      distanceKm: 42,
    });
    expect(mockFindMatchingTripCompletionDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        journeyId: "Tour-1",
        tripMode: "DRIVE",
        vehicleId: "vehicle-1",
        startTime: expect.any(Date),
        endTime: expect.any(Date),
        startLocation: "Hobart",
        endLocation: "Richmond",
        businessKm: 0,
        personalKm: 42,
        notes: expect.stringContaining("Started 2026-04-09T08:00:00.000Z. Ended 2026-04-09T09:15:00.000Z."),
      }),
      { workspaceId: "workspace-1", userId: "user-1" },
    );
    expect(mockCreateDrivingLogWithGpsSamples).toHaveBeenCalledWith(
      expect.objectContaining({
        journeyId: "Tour-1",
        tripMode: "DRIVE",
        vehicleId: "vehicle-1",
        startTime: expect.any(Date),
        endTime: expect.any(Date),
      }),
      [
        expect.objectContaining({ latitude: -42.8821, longitude: 147.3272, accuracyMeters: 8, recordedAt: expect.any(Date) }),
        expect.objectContaining({ latitude: -42.9, longitude: 147.35, accuracyMeters: 10, recordedAt: expect.any(Date) }),
      ],
      { workspaceId: "workspace-1", userId: "user-1" },
    );
    expect(mockGetStartOdometerForVehicle).toHaveBeenCalledWith("workspace-1", "vehicle-1");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/logs/driving");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/tours");
  });

  it("reuses an existing draft for repeated completion requests", async () => {
    const existingDraft = { id: "log-1" };
    mockFindMatchingTripCompletionDraft
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingDraft);
    mockCreateDrivingLogWithGpsSamples.mockResolvedValue(existingDraft);

    const firstResponse = await POST(new Request("http://localhost/api/trips/complete", {
      method: "POST",
      body: JSON.stringify(buildPayload()),
      headers: { "Content-Type": "application/json" },
    }));
    const secondResponse = await POST(new Request("http://localhost/api/trips/complete", {
      method: "POST",
      body: JSON.stringify(buildPayload()),
      headers: { "Content-Type": "application/json" },
    }));

    const firstBody = await firstResponse.json() as { draftLogId: string };
    const secondBody = await secondResponse.json() as { draftLogId: string };

    expect(firstBody.draftLogId).toBe("log-1");
    expect(secondBody.draftLogId).toBe("log-1");
    expect(mockCreateDrivingLogWithGpsSamples).toHaveBeenCalledTimes(1);
    expect(mockAppendDrivingLogGpsSamples).toHaveBeenCalledTimes(1);
    expect(mockAppendDrivingLogGpsSamples).toHaveBeenCalledWith(
      "log-1",
      [
        expect.objectContaining({ latitude: -42.8821, longitude: 147.3272, accuracyMeters: 8, recordedAt: expect.any(Date) }),
        expect.objectContaining({ latitude: -42.9, longitude: 147.35, accuracyMeters: 10, recordedAt: expect.any(Date) }),
      ],
      { workspaceId: "workspace-1", userId: "user-1" },
    );
    expect(mockGetStartOdometerForVehicle).toHaveBeenCalledTimes(1);
  });

  it("reuses an existing draft by mobile trip id when a retry derives different locations", async () => {
    mockFindMatchingTripCompletionDraftByMobileTripId.mockResolvedValue({ id: "log-1" });
    mockAppendDrivingLogGpsSamples.mockResolvedValue({ count: 2 });
    mockReverseGeocodeTripEndpoints.mockResolvedValue({
      startLocation: "Coburg VIC",
      endLocation: "Brunswick VIC",
    });

    const response = await POST(new Request("http://localhost/api/trips/complete", {
      method: "POST",
      body: JSON.stringify({
        ...buildPayload(),
        stopSuggestions: [],
      }),
      headers: { "Content-Type": "application/json" },
    }));

    const body = await response.json() as { draftLogId: string };

    expect(response.status).toBe(200);
    expect(body.draftLogId).toBe("log-1");
    expect(mockFindMatchingTripCompletionDraftByMobileTripId).toHaveBeenCalledWith(
      "local-trip-1",
      { workspaceId: "workspace-1", userId: "user-1" },
    );
    expect(mockFindMatchingTripCompletionDraft).not.toHaveBeenCalled();
    expect(mockCreateDrivingLogWithGpsSamples).not.toHaveBeenCalled();
  });

  it("stores reverse-geocoded start and end locations when available", async () => {
    mockFindMatchingTripCompletionDraft.mockResolvedValue(null);
    mockCreateDrivingLogWithGpsSamples.mockResolvedValue({ id: "log-1" });
    mockReverseGeocodeTripEndpoints.mockResolvedValue({
      startLocation: "Coburg VIC",
      endLocation: "Brunswick VIC",
    });

    const response = await POST(new Request("http://localhost/api/trips/complete", {
      method: "POST",
      body: JSON.stringify({
        ...buildPayload(),
        stopSuggestions: [],
      }),
      headers: { "Content-Type": "application/json" },
    }));

    expect(response.status).toBe(200);
    expect(mockReverseGeocodeTripEndpoints).toHaveBeenCalledWith([
      { latitude: -42.8821, longitude: 147.3272, accuracyMeters: 8, recordedAt: "2026-04-09T08:05:00.000Z" },
      { latitude: -42.9, longitude: 147.35, accuracyMeters: 10, recordedAt: "2026-04-09T09:10:00.000Z" },
    ]);
    expect(mockFindMatchingTripCompletionDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        startLocation: "Coburg VIC",
        endLocation: "Brunswick VIC",
      }),
      { workspaceId: "workspace-1", userId: "user-1" },
    );
    expect(mockCreateDrivingLogWithGpsSamples).toHaveBeenCalledWith(
      expect.objectContaining({
        startLocation: "Coburg VIC",
        endLocation: "Brunswick VIC",
        startFormattedAddress: "Coburg VIC",
        endFormattedAddress: "Brunswick VIC",
        hasRouteSamples: true,
      }),
      expect.any(Array),
      { workspaceId: "workspace-1", userId: "user-1" },
    );
  });

  it("keeps safe fallback locations when geocoding is unavailable", async () => {
    mockFindMatchingTripCompletionDraft.mockResolvedValue(null);
    mockCreateDrivingLogWithGpsSamples.mockResolvedValue({ id: "log-1" });
    mockReverseGeocodeTripEndpoints.mockResolvedValue({ startLocation: null, endLocation: null });

    const response = await POST(new Request("http://localhost/api/trips/complete", {
      method: "POST",
      body: JSON.stringify({
        ...buildPayload(),
        stopSuggestions: [],
      }),
      headers: { "Content-Type": "application/json" },
    }));

    expect(response.status).toBe(200);
    expect(mockCreateDrivingLogWithGpsSamples).toHaveBeenCalledWith(
      expect.objectContaining({
        startLocation: "GPS route recorded",
        endLocation: "GPS route recorded",
        hasRouteSamples: true,
      }),
      expect.any(Array),
      { workspaceId: "workspace-1", userId: "user-1" },
    );
  });

  it("does not break trip sync when geocoding throws unexpectedly", async () => {
    mockFindMatchingTripCompletionDraft.mockResolvedValue(null);
    mockCreateDrivingLogWithGpsSamples.mockResolvedValue({ id: "log-1" });
    mockReverseGeocodeTripEndpoints.mockRejectedValue(new Error("geocoder unavailable"));

    const response = await POST(new Request("http://localhost/api/trips/complete", {
      method: "POST",
      body: JSON.stringify({
        ...buildPayload(),
        stopSuggestions: [],
      }),
      headers: { "Content-Type": "application/json" },
    }));

    expect(response.status).toBe(200);
    expect(mockCreateDrivingLogWithGpsSamples).toHaveBeenCalledWith(
      expect.objectContaining({
        startLocation: "GPS route recorded",
        endLocation: "GPS route recorded",
        hasRouteSamples: true,
      }),
      expect.any(Array),
      { workspaceId: "workspace-1", userId: "user-1" },
    );
  });

  it("uses explicit mobile purpose and odometer overrides when supplied", async () => {
    mockFindMatchingTripCompletionDraft.mockResolvedValue(null);
    mockCreateDrivingLogWithGpsSamples.mockResolvedValue({ id: "log-1" });

    await POST(new Request("http://localhost/api/trips/complete", {
      method: "POST",
      body: JSON.stringify({
        ...buildPayload(),
        tripPurpose: "BUSINESS",
        purpose: "Client meeting",
        startOdometer: 20400,
        endOdometer: 20450,
      }),
      headers: { "Content-Type": "application/json" },
    }));

    expect(mockCreateDrivingLogWithGpsSamples).toHaveBeenCalledWith(
      expect.objectContaining({
        startOdometer: 20400,
        endOdometer: 20450,
        businessKm: 42,
        personalKm: 0,
        purpose: "Client meeting",
      }),
      expect.any(Array),
      { workspaceId: "workspace-1", userId: "user-1" },
    );
    expect(mockGetStartOdometerForVehicle).not.toHaveBeenCalled();
  });

  it("defaults non-split vehicles to personal distance when purpose is missing", async () => {
    mockFindMatchingTripCompletionDraft.mockResolvedValue(null);
    mockCreateDrivingLogWithGpsSamples.mockResolvedValue({ id: "log-1" });
    mockGetVehicleById.mockResolvedValue({ id: "vehicle-1", defaultUse: "BUSINESS", vehicleMode: "DRIVE", enableBusinessSplit: false });

    await POST(new Request("http://localhost/api/trips/complete", {
      method: "POST",
      body: JSON.stringify(buildPayload()),
      headers: { "Content-Type": "application/json" },
    }));

    expect(mockCreateDrivingLogWithGpsSamples).toHaveBeenCalledWith(
      expect.objectContaining({
        businessKm: 0,
        personalKm: 42,
      }),
      expect.any(Array),
      { workspaceId: "workspace-1", userId: "user-1" },
    );
  });

  it("backfills GPS samples on an existing draft from an offline mobile retry", async () => {
    mockFindMatchingTripCompletionDraft.mockResolvedValue({ id: "log-1" });
    mockAppendDrivingLogGpsSamples.mockResolvedValue({ count: 2 });

    const response = await POST(new Request("http://localhost/api/trips/complete", {
      method: "POST",
      body: JSON.stringify(buildPayload()),
      headers: {
        Authorization: "Bearer access-token",
        "Content-Type": "application/json",
      },
    }));

    const body = await response.json() as { draftLogId: string };

    expect(response.status).toBe(200);
    expect(body.draftLogId).toBe("log-1");
    expect(mockCreateDrivingLogWithGpsSamples).not.toHaveBeenCalled();
    expect(mockAppendDrivingLogGpsSamples).toHaveBeenCalledWith(
      "log-1",
      [
        expect.objectContaining({ latitude: -42.8821, longitude: 147.3272, recordedAt: expect.any(Date) }),
        expect.objectContaining({ latitude: -42.9, longitude: 147.35, recordedAt: expect.any(Date) }),
      ],
      { workspaceId: "workspace-1", userId: "user-1" },
    );
  });

  it("updates metadata on an existing backend trip without creating a duplicate draft", async () => {
    mockUpdateDrivingLogTripMetadata.mockResolvedValue({ id: "log-1" });
    mockAppendDrivingLogGpsSamples.mockResolvedValue({ count: 2 });

    const response = await POST(new Request("http://localhost/api/trips/complete", {
      method: "POST",
      body: JSON.stringify({
        ...buildPayload(),
        backendTripId: "log-1",
        tripPurpose: "BUSINESS",
        vehicleId: "vehicle-2",
      }),
      headers: {
        Authorization: "Bearer access-token",
        "Content-Type": "application/json",
      },
    }));

    await expect(response.json()).resolves.toEqual({
      draftLogId: "log-1",
      editHref: "/dashboard/logs/driving/log-1/edit",
      distanceKm: 42,
    });
    expect(mockUpdateDrivingLogTripMetadata).toHaveBeenCalledWith(
      "log-1",
      {
        journeyId: "Tour-1",
        tripMode: "DRIVE",
        vehicleId: "vehicle-2",
        startLocation: "Hobart",
        endLocation: "Richmond",
        startFormattedAddress: undefined,
        endFormattedAddress: undefined,
        startOdometer: undefined,
        endOdometer: undefined,
        businessKm: 42,
        personalKm: 0,
        purpose: undefined,
        hasRouteSamples: true,
      },
      { workspaceId: "workspace-1", userId: "user-1" },
    );
    expect(mockAppendDrivingLogGpsSamples).toHaveBeenCalledWith(
      "log-1",
      [
        expect.objectContaining({ latitude: -42.8821, longitude: 147.3272, recordedAt: expect.any(Date) }),
        expect.objectContaining({ latitude: -42.9, longitude: 147.35, recordedAt: expect.any(Date) }),
      ],
      { workspaceId: "workspace-1", userId: "user-1" },
    );
    expect(mockFindMatchingTripCompletionDraft).not.toHaveBeenCalled();
    expect(mockCreateDrivingLogWithGpsSamples).not.toHaveBeenCalled();
  });

  it("returns a tombstone instead of recreating a backend-deleted mobile trip", async () => {
    mockGetDeletedDrivingLogById.mockResolvedValue({
      id: "log-1",
      deletedAt: new Date("2026-04-20T01:00:00.000Z"),
      updatedAt: new Date("2026-04-20T01:00:00.000Z"),
    });

    const response = await POST(new Request("http://localhost/api/trips/complete", {
      method: "POST",
      body: JSON.stringify({
        ...buildPayload(),
        backendTripId: "log-1",
      }),
      headers: {
        Authorization: "Bearer access-token",
        "Content-Type": "application/json",
      },
    }));

    await expect(response.json()).resolves.toEqual({
      draftLogId: "log-1",
      deletedAt: "2026-04-20T01:00:00.000Z",
    });
    expect(mockFindMatchingTripCompletionDraft).not.toHaveBeenCalled();
    expect(mockCreateDrivingLogWithGpsSamples).not.toHaveBeenCalled();
    expect(mockAppendDrivingLogGpsSamples).not.toHaveBeenCalled();
    expect(mockUpdateDrivingLogTripMetadata).not.toHaveBeenCalled();
  });

  it("returns a tombstone if an existing backend trip is deleted during metadata update", async () => {
    mockUpdateDrivingLogTripMetadata.mockResolvedValue({
      id: "log-1",
      deletedAt: new Date("2026-04-20T01:00:00.000Z"),
    });

    const response = await POST(new Request("http://localhost/api/trips/complete", {
      method: "POST",
      body: JSON.stringify({
        ...buildPayload(),
        backendTripId: "log-1",
        tripPurpose: "BUSINESS",
      }),
      headers: {
        Authorization: "Bearer access-token",
        "Content-Type": "application/json",
      },
    }));

    await expect(response.json()).resolves.toEqual({
      draftLogId: "log-1",
      deletedAt: "2026-04-20T01:00:00.000Z",
    });
    expect(mockAppendDrivingLogGpsSamples).not.toHaveBeenCalled();
    expect(mockCreateDrivingLogWithGpsSamples).not.toHaveBeenCalled();
  });

  it("accepts Supabase bearer auth for mobile completion requests", async () => {
    mockFindMatchingTripCompletionDraft.mockResolvedValue(null);
    mockCreateDrivingLogWithGpsSamples.mockResolvedValue({ id: "log-1" });

    const response = await POST(new Request("http://localhost/api/trips/complete", {
      method: "POST",
      body: JSON.stringify(buildPayload()),
      headers: {
        Authorization: "Bearer access-token",
        "Content-Type": "application/json",
      },
    }));

    expect(response.status).toBe(200);
    expect(mockCreateClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "anon-key",
      expect.objectContaining({
        global: { headers: { Authorization: "Bearer access-token" } },
      }),
    );
    expect(mockGetUser).toHaveBeenCalledWith("access-token");
    expect(mockGetOrCreateCurrentUserFromSessionUser).toHaveBeenCalledWith(expect.objectContaining({
      id: "supabase-user-1",
      email: "user@example.com",
    }));
    expect(mockGetWorkspaceOwnerForUser).toHaveBeenCalledWith("user-1");
    expect(mockRequireAuthenticatedUser).not.toHaveBeenCalled();
    expect(mockRequireWorkspaceOwner).not.toHaveBeenCalled();
  });

  it("defaults missing trip mode to DRIVE for older mobile clients", async () => {
    mockFindMatchingTripCompletionDraft.mockResolvedValue(null);
    mockCreateDrivingLogWithGpsSamples.mockResolvedValue({ id: "log-1" });
    const legacyPayload = { ...buildPayload(), tripMode: undefined };

    const response = await POST(new Request("http://localhost/api/trips/complete", {
      method: "POST",
      body: JSON.stringify(legacyPayload),
      headers: { "Content-Type": "application/json" },
    }));

    expect(response.status).toBe(200);
    expect(mockCreateDrivingLogWithGpsSamples).toHaveBeenCalledWith(
      expect.objectContaining({ tripMode: "DRIVE", vehicleId: "vehicle-1" }),
      expect.any(Array),
      { workspaceId: "workspace-1", userId: "user-1" },
    );
  });

  it("accepts walk trips with no vehicle reference", async () => {
    mockFindMatchingTripCompletionDraft.mockResolvedValue(null);
    mockCreateDrivingLogWithGpsSamples.mockResolvedValue({ id: "log-walk-1" });

    const response = await POST(new Request("http://localhost/api/trips/complete", {
      method: "POST",
      body: JSON.stringify({
        ...buildPayload(),
        tripMode: "WALK",
        vehicleId: undefined,
      }),
      headers: { "Content-Type": "application/json" },
    }));

    expect(response.status).toBe(200);
    expect(mockGetVehicleById).not.toHaveBeenCalled();
    expect(mockCreateDrivingLogWithGpsSamples).toHaveBeenCalledWith(
      expect.objectContaining({
        tripMode: "WALK",
        vehicleId: undefined,
        startOdometer: 0,
        endOdometer: 42,
        businessKm: 0,
        personalKm: 42,
      }),
      expect.any(Array),
      { workspaceId: "workspace-1", userId: "user-1" },
    );
  });

  it("rejects invalid trip modes", async () => {
    const response = await POST(new Request("http://localhost/api/trips/complete", {
      method: "POST",
      body: JSON.stringify({
        ...buildPayload(),
        tripMode: "FLY",
      }),
      headers: { "Content-Type": "application/json" },
    }));

    expect(response.status).toBe(400);
  });

  it("rejects a ride trip using a drive-only vehicle", async () => {
    mockGetVehicleById.mockResolvedValue({ id: "vehicle-1", defaultUse: "PERSONAL", vehicleMode: "DRIVE" });

    const response = await POST(new Request("http://localhost/api/trips/complete", {
      method: "POST",
      body: JSON.stringify({
        ...buildPayload(),
        tripMode: "RIDE",
      }),
      headers: { "Content-Type": "application/json" },
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "driving-log-vehicle-mode-mismatch" });
  });
});
