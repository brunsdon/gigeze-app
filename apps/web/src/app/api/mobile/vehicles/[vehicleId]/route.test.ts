import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetMobileBearerAuthContext,
  mockUpdateVehicle,
  mockDeleteVehicle,
  mockGetLatestOdometerForVehicle,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockGetMobileBearerAuthContext: vi.fn(),
  mockUpdateVehicle: vi.fn(),
  mockDeleteVehicle: vi.fn(),
  mockGetLatestOdometerForVehicle: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

vi.mock("@/app/api/mobile/auth", () => ({
  getMobileBearerAuthContext: mockGetMobileBearerAuthContext,
}));

vi.mock("@/features/vehicles/service", () => ({
  updateVehicle: mockUpdateVehicle,
  deleteVehicle: mockDeleteVehicle,
  getLatestOdometerForVehicle: mockGetLatestOdometerForVehicle,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

import { DELETE, PUT } from "@/app/api/mobile/vehicles/[vehicleId]/route";

describe("mobile vehicle mutation route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMobileBearerAuthContext.mockResolvedValue({ user: { id: "user-1" }, workspace: { id: "workspace-1" } });
  });

  it("updates a vehicle for the authenticated workspace", async () => {
    mockUpdateVehicle.mockResolvedValue({
      id: "vehicle-1",
      name: "VW Caddy",
      vehicleMode: "DRIVE",
      enableBusinessSplit: true,
      registration: "ABC123",
      fuelType: "Diesel",
      notes: "Daily driver",
      startingOdometer: 83000,
      isDefault: true,
      defaultUse: "BUSINESS",
    });
    mockGetLatestOdometerForVehicle.mockResolvedValue(83811);

    const response = await PUT(
      new Request("http://localhost/api/mobile/vehicles/vehicle-1", {
        method: "PUT",
        headers: { Authorization: "Bearer access-token", "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "VW Caddy",
          vehicleMode: "DRIVE",
          registration: "ABC123",
          fuelType: "Diesel",
          notes: "Daily driver",
          startingOdometer: 83000,
          defaultUse: "BUSINESS",
          isDefault: true,
        }),
      }),
      { params: Promise.resolve({ vehicleId: "vehicle-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      vehicle: {
        id: "vehicle-1",
        name: "VW Caddy",
        vehicleMode: "DRIVE",
        enableBusinessSplit: true,
        registration: "ABC123",
        fuelType: "Diesel",
        notes: "Daily driver",
        startingOdometer: 83000,
        isDefault: true,
        defaultUse: "BUSINESS",
        latestOdometer: 83811,
      },
    });
    expect(mockUpdateVehicle).toHaveBeenCalledWith("vehicle-1", expect.objectContaining({ name: "VW Caddy", vehicleMode: "DRIVE" }), "workspace-1");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/logs/driving");
  });

  it("deletes a vehicle using the web hard-delete behavior", async () => {
    mockDeleteVehicle.mockResolvedValue({ id: "vehicle-1" });

    const response = await DELETE(
      new Request("http://localhost/api/mobile/vehicles/vehicle-1", {
        method: "DELETE",
        headers: { Authorization: "Bearer access-token" },
      }),
      { params: Promise.resolve({ vehicleId: "vehicle-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ vehicleId: "vehicle-1", deleted: true });
    expect(mockDeleteVehicle).toHaveBeenCalledWith("vehicle-1", "workspace-1");
  });

  it("rejects unauthenticated updates", async () => {
    mockGetMobileBearerAuthContext.mockResolvedValue(null);

    const response = await PUT(
      new Request("http://localhost/api/mobile/vehicles/vehicle-1", { method: "PUT", body: "{}" }),
      { params: Promise.resolve({ vehicleId: "vehicle-1" }) },
    );

    expect(response.status).toBe(401);
    expect(mockUpdateVehicle).not.toHaveBeenCalled();
  });
});
