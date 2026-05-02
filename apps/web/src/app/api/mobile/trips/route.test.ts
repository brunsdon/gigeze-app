import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetMobileBearerAuthContext,
  mockListMobileDrivingLogSummaries,
} = vi.hoisted(() => ({
  mockGetMobileBearerAuthContext: vi.fn(),
  mockListMobileDrivingLogSummaries: vi.fn(),
}));

vi.mock("@/app/api/mobile/auth", () => ({
  getMobileBearerAuthContext: mockGetMobileBearerAuthContext,
}));

vi.mock("@/features/driving-logs/service", () => ({
  listMobileDrivingLogSummaries: mockListMobileDrivingLogSummaries,
}));

import { GET } from "@/app/api/mobile/trips/route";

describe("mobile trips route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMobileBearerAuthContext.mockResolvedValue({ user: { id: "user-1" }, workspace: { id: "workspace-1" } });
  });

  it("returns editable backend trip summaries for mobile refresh", async () => {
    mockListMobileDrivingLogSummaries.mockResolvedValue([
      {
        id: "log-1",
        journeyId: "Tour-1",
        journeyTitle: "NSW Coast Run",
        tripMode: "DRIVE",
        vehicleId: "vehicle-1",
        vehicleName: "VW Caddy",
        date: new Date("2026-04-20T00:00:00.000Z"),
        startedAt: new Date("2026-04-20T20:43:00.000Z"),
        endedAt: new Date("2026-04-20T20:45:00.000Z"),
        startOdometer: 83807,
        endOdometer: 83810,
        businessKm: 3,
        personalKm: 0,
        purpose: "Client delivery",
        startLocation: "Coburg VIC, Australia",
        endLocation: "Brunswick VIC, Australia",
        computedDistanceKm: 3,
        updatedAt: new Date("2026-04-21T08:00:00.000Z"),
      },
    ]);

    const response = await GET(new Request("http://localhost/api/mobile/trips", {
      headers: { Authorization: "Bearer access-token" },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      trips: [
        {
          backendTripId: "log-1",
          journeyId: "Tour-1",
          journeyTitle: "NSW Coast Run",
          tripMode: "DRIVE",
          vehicleId: "vehicle-1",
          vehicleName: "VW Caddy",
          tripPurpose: "BUSINESS",
          purpose: "Client delivery",
          date: "2026-04-20T00:00:00.000Z",
          startedAt: "2026-04-20T20:43:00.000Z",
          endedAt: "2026-04-20T20:45:00.000Z",
          startLocation: "Coburg VIC, Australia",
          endLocation: "Brunswick VIC, Australia",
          startOdometer: 83807,
          endOdometer: 83810,
          distanceKm: 3,
          businessKm: 3,
          personalKm: 0,
          updatedAt: "2026-04-21T08:00:00.000Z",
        },
      ],
    });
    expect(mockListMobileDrivingLogSummaries).toHaveBeenCalledWith("workspace-1");
  });

  it("falls back to the driving log date for web-created logs without times", async () => {
    mockListMobileDrivingLogSummaries.mockResolvedValue([
      {
        id: "log-web-1",
        journeyId: null,
        journeyTitle: null,
        tripMode: "WALK",
        vehicleId: "vehicle-1",
        vehicleName: "VW Caddy",
        date: new Date("2026-04-21T00:00:00.000Z"),
        startedAt: null,
        endedAt: null,
        startOdometer: 83808,
        endOdometer: 83808,
        businessKm: 0,
        personalKm: 0,
        purpose: null,
        startLocation: null,
        endLocation: null,
        computedDistanceKm: 0.6,
        updatedAt: new Date("2026-04-21T08:42:00.000Z"),
      },
    ]);

    const response = await GET(new Request("http://localhost/api/mobile/trips", {
      headers: { Authorization: "Bearer access-token" },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      trips: [
        {
          backendTripId: "log-web-1",
          tripMode: "WALK",
          date: "2026-04-21T00:00:00.000Z",
          startedAt: "2026-04-21T00:00:00.000Z",
          endedAt: "2026-04-21T00:00:00.000Z",
          distanceKm: 0.6,
          endOdometer: 83808,
          tripPurpose: "PRIVATE",
        },
      ],
    });
  });

  it("returns computed distance for walk logs even when odometer and split totals are zero", async () => {
    mockListMobileDrivingLogSummaries.mockResolvedValue([
      {
        id: "log-walk-2",
        journeyId: null,
        journeyTitle: null,
        tripMode: "WALK",
        vehicleId: null,
        vehicleName: null,
        date: new Date("2026-04-25T00:00:00.000Z"),
        startedAt: new Date("2026-04-25T00:12:00.000Z"),
        endedAt: new Date("2026-04-25T00:52:00.000Z"),
        startOdometer: 0,
        endOdometer: 0,
        businessKm: 0,
        personalKm: 0,
        purpose: null,
        startLocation: null,
        endLocation: null,
        computedDistanceKm: 0.6,
        updatedAt: new Date("2026-04-25T01:00:00.000Z"),
      },
    ]);

    const response = await GET(new Request("http://localhost/api/mobile/trips", {
      headers: { Authorization: "Bearer access-token" },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      trips: [
        {
          backendTripId: "log-walk-2",
          tripMode: "WALK",
          vehicleId: null,
          distanceKm: 0.6,
        },
      ],
    });
  });

  it("rejects unauthenticated requests", async () => {
    mockGetMobileBearerAuthContext.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/mobile/trips"));

    expect(response.status).toBe(401);
  });
});
