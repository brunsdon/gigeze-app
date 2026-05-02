import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetMobileBearerAuthContext,
  mockListVehicles,
  mockGetLatestOdometerForVehicle,
  mockCreateVehicle,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockGetMobileBearerAuthContext: vi.fn(),
  mockListVehicles: vi.fn(),
  mockGetLatestOdometerForVehicle: vi.fn(),
  mockCreateVehicle: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

vi.mock("@/app/api/mobile/auth", () => ({
  getMobileBearerAuthContext: mockGetMobileBearerAuthContext,
}));

vi.mock("@/features/vehicles/service", () => ({
  listVehicles: mockListVehicles,
  getLatestOdometerForVehicle: mockGetLatestOdometerForVehicle,
  createVehicle: mockCreateVehicle,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

import { GET, POST } from "@/app/api/mobile/vehicles/route";

describe("mobile vehicle options route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMobileBearerAuthContext.mockResolvedValue({ user: { id: "user-1" }, workspace: { id: "workspace-1" } });
  });

  it("returns authenticated vehicle defaults and latest odometers", async () => {
    mockListVehicles.mockResolvedValue([
      { id: "vehicle-1", name: "Tour Van", vehicleMode: "DRIVE", enableBusinessSplit: true, registration: "ABC123", fuelType: "Diesel", notes: "Main rig", startingOdometer: 12000, isDefault: true, defaultUse: "PERSONAL" },
      { id: "vehicle-2", name: "Work Van", vehicleMode: "DRIVE", enableBusinessSplit: false, registration: null, fuelType: null, notes: null, startingOdometer: 0, isDefault: false, defaultUse: "BUSINESS" },
    ]);
    mockGetLatestOdometerForVehicle
      .mockResolvedValueOnce(12345)
      .mockResolvedValueOnce(null);

    const response = await GET(new Request("http://localhost/api/mobile/vehicles", {
      headers: { Authorization: "Bearer access-token" },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      vehicles: [
        { id: "vehicle-1", name: "Tour Van", vehicleMode: "DRIVE", enableBusinessSplit: true, registration: "ABC123", fuelType: "Diesel", notes: "Main rig", startingOdometer: 12000, isDefault: true, defaultUse: "PERSONAL", latestOdometer: 12345 },
        { id: "vehicle-2", name: "Work Van", vehicleMode: "DRIVE", enableBusinessSplit: false, registration: null, fuelType: null, notes: null, startingOdometer: 0, isDefault: false, defaultUse: "BUSINESS", latestOdometer: null },
      ],
    });
    expect(mockListVehicles).toHaveBeenCalledWith("workspace-1");
    expect(mockGetLatestOdometerForVehicle).toHaveBeenCalledWith("workspace-1", "vehicle-1");
  });

  it("rejects unauthenticated requests", async () => {
    mockGetMobileBearerAuthContext.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/mobile/vehicles"));

    expect(response.status).toBe(401);
  });

  it("creates a vehicle using the web vehicle validation contract", async () => {
    mockCreateVehicle.mockResolvedValue({
      id: "vehicle-3",
      name: "Walking",
      vehicleMode: "RIDE",
      enableBusinessSplit: false,
      registration: null,
      fuelType: null,
      notes: null,
      startingOdometer: 0,
      isDefault: false,
      defaultUse: "PERSONAL",
    });
    mockGetLatestOdometerForVehicle.mockResolvedValue(0);

    const response = await POST(new Request("http://localhost/api/mobile/vehicles", {
      method: "POST",
      headers: { Authorization: "Bearer access-token", "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Walking",
        vehicleMode: "RIDE",
        enableBusinessSplit: false,
        startingOdometer: 0,
        defaultUse: "PERSONAL",
        isDefault: false,
      }),
    }));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      vehicle: {
        id: "vehicle-3",
        name: "Walking",
        vehicleMode: "RIDE",
        enableBusinessSplit: false,
        registration: null,
        fuelType: null,
        notes: null,
        startingOdometer: 0,
        isDefault: false,
        defaultUse: "PERSONAL",
        latestOdometer: 0,
      },
    });
    expect(mockCreateVehicle).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Walking", vehicleMode: "RIDE", enableBusinessSplit: false, startingOdometer: 0, defaultUse: "PERSONAL", isDefault: false }),
      "workspace-1",
      "user-1",
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/vehicles");
  });

  it("rejects invalid vehicle create input", async () => {
    const response = await POST(new Request("http://localhost/api/mobile/vehicles", {
      method: "POST",
      body: JSON.stringify({ name: "", startingOdometer: -1 }),
    }));

    expect(response.status).toBe(400);
    expect(mockCreateVehicle).not.toHaveBeenCalled();
  });
});
