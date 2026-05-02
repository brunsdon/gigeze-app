import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetMobileBearerAuthContext,
  mockListDeletedDrivingLogs,
} = vi.hoisted(() => ({
  mockGetMobileBearerAuthContext: vi.fn(),
  mockListDeletedDrivingLogs: vi.fn(),
}));

vi.mock("@/app/api/mobile/auth", () => ({
  getMobileBearerAuthContext: mockGetMobileBearerAuthContext,
}));

vi.mock("@/features/driving-logs/service", () => ({
  listDeletedDrivingLogs: mockListDeletedDrivingLogs,
}));

import { GET } from "@/app/api/mobile/trips/deletions/route";

describe("mobile deleted trips route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMobileBearerAuthContext.mockResolvedValue({ user: { id: "user-1" }, workspace: { id: "workspace-1" } });
  });

  it("returns workspace trip tombstones", async () => {
    mockListDeletedDrivingLogs.mockResolvedValue([
      {
        id: "log-1",
        deletedAt: new Date("2026-04-20T01:00:00.000Z"),
        updatedAt: new Date("2026-04-20T01:00:01.000Z"),
      },
    ]);

    const response = await GET(new Request("http://localhost/api/mobile/trips/deletions", {
      headers: { Authorization: "Bearer access-token" },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      deletedTrips: [
        {
          backendTripId: "log-1",
          deletedAt: "2026-04-20T01:00:00.000Z",
          updatedAt: "2026-04-20T01:00:01.000Z",
        },
      ],
    });
    expect(mockListDeletedDrivingLogs).toHaveBeenCalledWith("workspace-1");
  });

  it("rejects unauthenticated requests", async () => {
    mockGetMobileBearerAuthContext.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/mobile/trips/deletions"));

    expect(response.status).toBe(401);
  });
});
