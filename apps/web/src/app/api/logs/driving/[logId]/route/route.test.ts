import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetCurrentUser,
  mockGetCurrentWorkspaceForUser,
  mockGetOrCreateCurrentUserFromSessionUser,
  mockGetWorkspaceOwnerForUser,
  mockGetDrivingLogRoutePreview,
  mockCreateClient,
  mockGetUser,
} = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockGetCurrentWorkspaceForUser: vi.fn(),
  mockGetOrCreateCurrentUserFromSessionUser: vi.fn(),
  mockGetWorkspaceOwnerForUser: vi.fn(),
  mockGetDrivingLogRoutePreview: vi.fn(),
  mockCreateClient: vi.fn(),
  mockGetUser: vi.fn(),
}));

vi.mock("@/lib/auth/workspace", () => ({
  getCurrentUser: mockGetCurrentUser,
  getCurrentWorkspaceForUser: mockGetCurrentWorkspaceForUser,
  getOrCreateCurrentUserFromSessionUser: mockGetOrCreateCurrentUserFromSessionUser,
  getWorkspaceOwnerForUser: mockGetWorkspaceOwnerForUser,
}));

vi.mock("@/features/driving-logs/service", () => ({
  getDrivingLogRoutePreview: mockGetDrivingLogRoutePreview,
}));

vi.mock("@/lib/supabase/env", () => ({
  getSupabasePublicEnv: () => ({ url: "https://example.supabase.co", anonKey: "anon-key" }),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mockCreateClient,
}));

import { GET } from "./route";

describe("driving log route preview API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ id: "user-1" });
    mockGetCurrentWorkspaceForUser.mockResolvedValue({ id: "workspace-1" });
    mockGetOrCreateCurrentUserFromSessionUser.mockResolvedValue({ id: "user-1" });
    mockGetWorkspaceOwnerForUser.mockResolvedValue({ id: "workspace-1" });
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "auth-user-1",
          email: "matts@example.com",
          user_metadata: {},
        },
      },
      error: null,
    });
    mockCreateClient.mockReturnValue({ auth: { getUser: mockGetUser } });
  });

  it("returns route samples for the authenticated user's workspace", async () => {
    mockGetDrivingLogRoutePreview.mockResolvedValue({
      id: "log-1",
      date: new Date("2026-04-21T00:00:00.000Z"),
      startTime: new Date("2026-04-21T07:30:00.000Z"),
      endTime: new Date("2026-04-21T08:00:00.000Z"),
      startLocation: "GPS trip start",
      endLocation: "GPS trip end",
      startOdometer: 100,
      endOdometer: 112,
      businessKm: 0,
      personalKm: 12,
      vehicle: { id: "vehicle-1", name: "VW Caddy" },
      Tour: { id: "Tour-1", title: "Coast Run", slug: "coast-run" },
      samples: [
        {
          id: "sample-1",
          latitude: -37.8136,
          longitude: 144.9631,
          accuracyMeters: 8,
          recordedAt: new Date("2026-04-21T07:30:00.000Z"),
        },
      ],
    });

    const response = await GET(new Request("http://localhost/api/logs/driving/log-1/route"), {
      params: Promise.resolve({ logId: "log-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: "log-1",
      vehicle: { id: "vehicle-1", name: "VW Caddy" },
      samples: [
        {
          id: "sample-1",
          latitude: -37.8136,
          longitude: 144.9631,
          accuracyMeters: 8,
          recordedAt: "2026-04-21T07:30:00.000Z",
        },
      ],
    });
    expect(mockGetDrivingLogRoutePreview).toHaveBeenCalledWith("log-1", "workspace-1");
  });

  it("accepts Supabase bearer auth from mobile", async () => {
    mockGetDrivingLogRoutePreview.mockResolvedValue({
      id: "log-1",
      date: new Date("2026-04-21T00:00:00.000Z"),
      startTime: null,
      endTime: null,
      startLocation: null,
      endLocation: null,
      startOdometer: 0,
      endOdometer: 1,
      businessKm: 0,
      personalKm: 1,
      computedDistanceKm: 1,
      vehicle: null,
      Tour: null,
      samples: [],
    });

    const response = await GET(new Request("http://localhost/api/logs/driving/log-1/route", {
      headers: { Authorization: "Bearer access-token" },
    }), {
      params: Promise.resolve({ logId: "log-1" }),
    });

    expect(response.status).toBe(200);
    expect(mockGetUser).toHaveBeenCalledWith("access-token");
    expect(mockGetWorkspaceOwnerForUser).toHaveBeenCalledWith("user-1");
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated requests", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/logs/driving/log-1/route"), {
      params: Promise.resolve({ logId: "log-1" }),
    });

    expect(response.status).toBe(401);
  });

  it("returns 404 when the trip is not in the workspace", async () => {
    mockGetDrivingLogRoutePreview.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/logs/driving/log-1/route"), {
      params: Promise.resolve({ logId: "log-1" }),
    });

    expect(response.status).toBe(404);
  });
});
