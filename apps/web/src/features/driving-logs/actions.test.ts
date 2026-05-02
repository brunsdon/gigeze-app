import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/utils/app-error";

class RedirectSignal extends Error {
  constructor(public readonly url: string) {
    super(url);
  }
}

const {
  mockRequireAuthenticatedUser,
  mockRequireWorkspaceOwner,
  mockUpdateDrivingLog,
  mockDeleteDrivingLog,
  mockRedirect,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockRequireAuthenticatedUser: vi.fn(),
  mockRequireWorkspaceOwner: vi.fn(),
  mockUpdateDrivingLog: vi.fn(),
  mockDeleteDrivingLog: vi.fn(),
  mockRedirect: vi.fn((url: string) => {
    throw new RedirectSignal(url);
  }),
  mockRevalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/workspace", () => ({
  requireAuthenticatedUser: mockRequireAuthenticatedUser,
  requireWorkspaceOwner: mockRequireWorkspaceOwner,
}));

vi.mock("@/features/driving-logs/service", () => ({
  createDrivingLog: vi.fn(),
  updateDrivingLog: mockUpdateDrivingLog,
  deleteDrivingLog: mockDeleteDrivingLog,
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

import { deleteDrivingLogAction, updateDrivingLogAction } from "@/features/driving-logs/actions";

function buildFormData(entries: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

describe("driving log actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuthenticatedUser.mockResolvedValue({ id: "user-1" });
    mockRequireWorkspaceOwner.mockResolvedValue({ id: "workspace-1" });
  });

  it("redirects to success after update", async () => {
    mockUpdateDrivingLog.mockResolvedValue({ id: "log-1" });

    await expect(
      updateDrivingLogAction(
        buildFormData({
          logId: "log-1",
          date: "2026-04-01",
          startLocation: "A",
          endLocation: "B",
          startOdometer: "100",
          endOdometer: "180",
          businessKm: "40",
          personalKm: "40",
          notes: "",
        }),
      ),
    ).rejects.toMatchObject({ url: "/dashboard/logs/driving?success=driving-log-updated" });

    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/logs/driving");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("preserves submitted start and end wall-clock times when updating a driving log", async () => {
    mockUpdateDrivingLog.mockResolvedValue({ id: "log-1" });

    await expect(
      updateDrivingLogAction(
        buildFormData({
          logId: "log-1",
          date: "2026-04-21",
          startTime: "05:31",
          endTime: "06:14",
          startLocation: "GPS trip start",
          endLocation: "GPS trip end",
          totalDistanceKm: "3",
          businessKm: "0",
          personalKm: "3",
          tripMode: "WALK",
          notes: "",
        }),
      ),
    ).rejects.toMatchObject({ url: "/dashboard/logs/driving?success=driving-log-updated" });

    const payload = mockUpdateDrivingLog.mock.calls[0]?.[1];
    expect(payload.date.toISOString()).toBe("2026-04-20T14:00:00.000Z");
    expect(payload.startTime?.toISOString()).toBe("2026-04-20T19:31:00.000Z");
    expect(payload.endTime?.toISOString()).toBe("2026-04-20T20:14:00.000Z");
  });

  it("redirects with invalid-input error when split does not equal trip distance", async () => {
    await expect(
      updateDrivingLogAction(
        buildFormData({
          logId: "log-1",
          date: "2026-04-01",
          startLocation: "A",
          endLocation: "B",
          startOdometer: "100",
          endOdometer: "180",
          businessKm: "30",
          personalKm: "20",
          notes: "",
        }),
      ),
    ).rejects.toMatchObject({ url: "/dashboard/logs/driving?error=driving-log-invalid-input" });

    expect(mockUpdateDrivingLog).not.toHaveBeenCalled();
  });

  it("redirects with encoded service error on delete", async () => {
    mockDeleteDrivingLog.mockRejectedValue(new AppError("driving-log-not-found", "DRIVING_LOG_NOT_FOUND"));

    await expect(deleteDrivingLogAction(buildFormData({ logId: "log-1" }))).rejects.toMatchObject({
      url: "/dashboard/logs/driving?error=driving-log-not-found",
    });

    expect(mockDeleteDrivingLog).toHaveBeenCalledWith("log-1", "workspace-1");
  });
});
