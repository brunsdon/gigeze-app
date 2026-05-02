import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetMobileBearerAuthContext,
  mockDeleteDrivingLog,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockGetMobileBearerAuthContext: vi.fn(),
  mockDeleteDrivingLog: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

vi.mock("@/app/api/mobile/auth", () => ({
  getMobileBearerAuthContext: mockGetMobileBearerAuthContext,
}));

vi.mock("@/features/driving-logs/service", () => ({
  deleteDrivingLog: mockDeleteDrivingLog,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

import { DELETE } from "@/app/api/mobile/trips/[tripId]/route";

describe("mobile trip delete route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMobileBearerAuthContext.mockResolvedValue({ user: { id: "user-1" }, workspace: { id: "workspace-1" } });
  });

  it("soft deletes a trip for the authenticated workspace", async () => {
    mockDeleteDrivingLog.mockResolvedValue({
      id: "log-1",
      deletedAt: new Date("2026-04-20T01:00:00.000Z"),
    });

    const response = await DELETE(
      new Request("http://localhost/api/mobile/trips/log-1", {
        method: "DELETE",
        headers: { Authorization: "Bearer access-token" },
      }),
      { params: Promise.resolve({ tripId: "log-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      backendTripId: "log-1",
      deletedAt: "2026-04-20T01:00:00.000Z",
    });
    expect(mockDeleteDrivingLog).toHaveBeenCalledWith("log-1", "workspace-1");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/logs/driving");
  });

  it("rejects unauthenticated requests", async () => {
    mockGetMobileBearerAuthContext.mockResolvedValue(null);

    const response = await DELETE(
      new Request("http://localhost/api/mobile/trips/log-1", { method: "DELETE" }),
      { params: Promise.resolve({ tripId: "log-1" }) },
    );

    expect(response.status).toBe(401);
    expect(mockDeleteDrivingLog).not.toHaveBeenCalled();
  });
});
