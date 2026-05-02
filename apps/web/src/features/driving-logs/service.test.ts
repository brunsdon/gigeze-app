import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockReverseGeocodeTripEndpoints } = vi.hoisted(() => ({
  mockPrisma: {
    tour: {
      findFirst: vi.fn(),
    },
    vehicle: {
      findFirst: vi.fn(),
    },
    drivingLog: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    drivingLogGpsSample: {
      createMany: vi.fn(),
    },
    externalMediaLink: {
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  mockReverseGeocodeTripEndpoints: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/maps/geocoding", () => ({
  reverseGeocodeTripEndpoints: mockReverseGeocodeTripEndpoints,
}));

import {
  appendDrivingLogGpsSamples,
  createDrivingLog,
  createDrivingLogWithGpsSamples,
  deleteDrivingLog,
  getDrivingLogById,
  getDrivingLogComputedDistanceKm,
  refreshDrivingLogGpsEndpointLocations,
  updateDrivingLog,
} from "@/features/driving-logs/service";

const validInput = {
  journeyId: undefined,
  tripMode: "DRIVE" as const,
  vehicleId: undefined,
  date: new Date("2026-04-01"),
  startTime: undefined,
  endTime: undefined,
  startLocation: "A",
  endLocation: "B",
  startOdometer: 100,
  endOdometer: 180,
  businessKm: 40,
  personalKm: 40,
  purpose: undefined,
  notes: undefined,
};

describe("driving logs service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => unknown) => callback(mockPrisma));
    mockPrisma.vehicle.findFirst.mockResolvedValue({ id: "vehicle-1", vehicleMode: "DRIVE", startingOdometer: 0 });
    mockReverseGeocodeTripEndpoints.mockResolvedValue({ startLocation: null, endLocation: null });
  });

  it("throws when updating a missing driving log", async () => {
    mockPrisma.drivingLog.findFirst.mockResolvedValue(null);

    await expect(updateDrivingLog("missing", validInput, "workspace-1")).rejects.toEqual(
      expect.objectContaining({ message: "driving-log-not-found", code: "DRIVING_LOG_NOT_FOUND" }),
    );

    expect(mockPrisma.drivingLog.update).not.toHaveBeenCalled();
  });

  it("throws when deleting a missing driving log", async () => {
    mockPrisma.drivingLog.findFirst.mockResolvedValue(null);

    await expect(deleteDrivingLog("missing", "workspace-1")).rejects.toEqual(
      expect.objectContaining({ message: "driving-log-not-found", code: "DRIVING_LOG_NOT_FOUND" }),
    );

    expect(mockPrisma.drivingLog.delete).not.toHaveBeenCalled();
  });

  it("soft deletes a driving log idempotently", async () => {
    mockPrisma.drivingLog.findFirst.mockResolvedValue({ id: "log-1", deletedAt: null });
    mockPrisma.externalMediaLink.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.drivingLog.update.mockResolvedValue({ id: "log-1", deletedAt: new Date("2026-04-20T01:00:00.000Z") });

    await expect(deleteDrivingLog("log-1", "workspace-1")).resolves.toMatchObject({
      id: "log-1",
      deletedAt: new Date("2026-04-20T01:00:00.000Z"),
    });
    expect(mockPrisma.drivingLog.delete).not.toHaveBeenCalled();
    expect(mockPrisma.drivingLog.update).toHaveBeenCalledWith({
      where: { id: "log-1" },
      data: { deletedAt: expect.any(Date) },
    });
    expect(mockPrisma.externalMediaLink.updateMany).toHaveBeenCalledWith({
      where: {
        workspaceId: "workspace-1",
        entityType: "TRIP",
        entityId: "log-1",
        deletedAt: null,
      },
      data: {
        deletedAt: expect.any(Date),
      },
    });
  });

  it("ignores update attempts after a driving log is deleted", async () => {
    mockPrisma.drivingLog.findFirst.mockResolvedValue({ id: "log-1", deletedAt: new Date("2026-04-20T01:00:00.000Z") });

    await expect(updateDrivingLog("log-1", validInput, "workspace-1")).resolves.toMatchObject({
      id: "log-1",
      deletedAt: new Date("2026-04-20T01:00:00.000Z"),
    });
    expect(mockPrisma.drivingLog.update).not.toHaveBeenCalled();
  });

  it("creates driving log GPS samples with stable indexes", async () => {
    mockPrisma.drivingLog.create.mockResolvedValue({ id: "log-1" });

    await createDrivingLogWithGpsSamples(
      validInput,
      [
        { latitude: -42.8821, longitude: 147.3272, accuracyMeters: 8, recordedAt: new Date("2026-04-09T08:05:00.000Z") },
        { latitude: -42.9, longitude: 147.35, accuracyMeters: 10, recordedAt: new Date("2026-04-09T09:10:00.000Z") },
      ],
      { workspaceId: "workspace-1", userId: "user-1" },
    );

    expect(mockPrisma.drivingLogGpsSample.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ drivingLogId: "log-1", sampleIndex: 0, latitude: -42.8821 }),
        expect.objectContaining({ drivingLogId: "log-1", sampleIndex: 1, latitude: -42.9 }),
      ],
    });
    expect(mockPrisma.drivingLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ hasRouteSamples: true }),
      }),
    );
  });

  it("persists selected geocode fields when creating a driving log", async () => {
    mockPrisma.drivingLog.create.mockResolvedValue({ id: "log-1" });

    await createDrivingLog(
      {
        ...validInput,
        startLocation: "Coburg VIC, Australia",
        endLocation: "Brunswick VIC, Australia",
        startLatitude: -37.74311,
        startLongitude: 144.96983,
        endLatitude: -37.765,
        endLongitude: 144.961,
        startPlaceId: "start-place",
        endPlaceId: "end-place",
        startFormattedAddress: "Coburg VIC, Australia",
        endFormattedAddress: "Brunswick VIC, Australia",
      },
      { workspaceId: "workspace-1", userId: "user-1" },
    );

    expect(mockPrisma.drivingLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          startLocation: "Coburg VIC, Australia",
          endLocation: "Brunswick VIC, Australia",
          startLatitude: -37.74311,
          startLongitude: 144.96983,
          endLatitude: -37.765,
          endLongitude: 144.961,
          startPlaceId: "start-place",
          endPlaceId: "end-place",
          startFormattedAddress: "Coburg VIC, Australia",
          endFormattedAddress: "Brunswick VIC, Australia",
        }),
      }),
    );
  });

  it("clears stale geocode fields when updating with manual location text", async () => {
    mockPrisma.drivingLog.findFirst.mockResolvedValue({ id: "log-1", deletedAt: null });
    mockPrisma.drivingLog.update.mockResolvedValue({ id: "log-1" });

    await updateDrivingLog("log-1", { ...validInput, startLocation: "Manual start", endLocation: "Manual end" }, "workspace-1");

    expect(mockPrisma.drivingLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          startLocation: "Manual start",
          endLocation: "Manual end",
          startLatitude: null,
          startLongitude: null,
          endLatitude: null,
          endLongitude: null,
          startPlaceId: null,
          endPlaceId: null,
          startFormattedAddress: null,
          endFormattedAddress: null,
        }),
      }),
    );
  });

  it("appends existing draft GPS samples idempotently for mobile retries", async () => {
    mockPrisma.drivingLog.findFirst.mockResolvedValue({ id: "log-1" });
    mockPrisma.drivingLogGpsSample.createMany.mockResolvedValue({ count: 1 });

    await appendDrivingLogGpsSamples(
      "log-1",
      [
        { latitude: -42.8821, longitude: 147.3272, accuracyMeters: 8, recordedAt: new Date("2026-04-09T08:05:00.000Z") },
        { latitude: -42.9, longitude: 147.35, accuracyMeters: 10, recordedAt: new Date("2026-04-09T09:10:00.000Z") },
      ],
      { workspaceId: "workspace-1", userId: "user-1" },
    );

    expect(mockPrisma.drivingLog.findFirst).toHaveBeenCalledWith({
      where: {
        id: "log-1",
        workspaceId: "workspace-1",
        createdByUserId: "user-1",
        deletedAt: null,
      },
      select: { id: true },
    });
    expect(mockPrisma.drivingLogGpsSample.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ drivingLogId: "log-1", sampleIndex: 0, latitude: -42.8821 }),
        expect.objectContaining({ drivingLogId: "log-1", sampleIndex: 1, latitude: -42.9 }),
      ],
      skipDuplicates: true,
    });
    expect(mockPrisma.drivingLog.update).toHaveBeenCalledWith({
      where: { id: "log-1" },
      data: { hasRouteSamples: true },
    });
  });

  it("does not write GPS samples for empty retry payloads", async () => {
    await expect(appendDrivingLogGpsSamples("log-1", [], { workspaceId: "workspace-1", userId: "user-1" })).resolves.toEqual({ count: 0 });

    expect(mockPrisma.drivingLog.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.drivingLogGpsSample.createMany).not.toHaveBeenCalled();
  });

  it("rejects vehicles that do not match the trip mode", async () => {
    mockPrisma.vehicle.findFirst.mockResolvedValue({ id: "vehicle-1", vehicleMode: "DRIVE" });

    await expect(createDrivingLogWithGpsSamples(
      {
        ...validInput,
        tripMode: "RIDE",
        vehicleId: "vehicle-1",
      },
      [],
      { workspaceId: "workspace-1", userId: "user-1" },
    )).rejects.toEqual(expect.objectContaining({
      message: "driving-log-vehicle-mode-mismatch",
      code: "DRIVING_LOG_VEHICLE_MODE_MISMATCH",
    }));
  });

  it("falls back to GPS samples when stored trip distance fields are zero", async () => {
    const computedDistance = getDrivingLogComputedDistanceKm({
      startOdometer: 0,
      endOdometer: 0,
      businessKm: 0,
      personalKm: 0,
      gpsSamples: [
        { latitude: -37.74311, longitude: 144.96983, recordedAt: new Date("2026-04-25T01:12:00.000Z") },
        { latitude: -37.7434, longitude: 144.9684, recordedAt: new Date("2026-04-25T01:20:00.000Z") },
        { latitude: -37.7451, longitude: 144.9676, recordedAt: new Date("2026-04-25T01:32:00.000Z") },
      ],
    });

    expect(computedDistance).toBeGreaterThan(0);
  });

  it("returns computed distance for GPS-backed logs with zeroed odometers", async () => {
    mockPrisma.drivingLog.findFirst.mockResolvedValue({
      id: "log-1",
      Tour: { id: "Tour-1", title: "Coburg Testing", slug: "coburg-testing" },
      vehicle: null,
      gpsSamples: [
        { latitude: -37.74311, longitude: 144.96983, recordedAt: new Date("2026-04-25T01:12:00.000Z") },
        { latitude: -37.7434, longitude: 144.9684, recordedAt: new Date("2026-04-25T01:20:00.000Z") },
        { latitude: -37.7451, longitude: 144.9676, recordedAt: new Date("2026-04-25T01:32:00.000Z") },
      ],
      date: new Date("2026-04-25T00:00:00.000Z"),
      startTime: new Date("2026-04-25T01:12:00.000Z"),
      endTime: new Date("2026-04-25T01:52:00.000Z"),
      startLocation: "GPS trip start",
      endLocation: "GPS trip end",
      startOdometer: 0,
      endOdometer: 0,
      businessKm: 0,
      personalKm: 0,
      notes: "[Trip draft] Passive GPS session captured.",
    });

    const log = await getDrivingLogById("log-1", "workspace-1");

    expect(log?.computedDistanceKm).toBeGreaterThan(0);
  });

  it("refreshes weak GPS fallback locations from stored samples", async () => {
    mockPrisma.drivingLog.findFirst.mockResolvedValue({
      id: "log-1",
      startLocation: "GPS route recorded",
      endLocation: "GPS route recorded",
      startFormattedAddress: null,
      endFormattedAddress: null,
      gpsSamples: [
        { latitude: -37.74311, longitude: 144.96983 },
        { latitude: -37.74862, longitude: 144.9653 },
      ],
    });
    mockReverseGeocodeTripEndpoints.mockResolvedValue({
      startLocation: "Coburg VIC",
      endLocation: "Brunswick VIC",
    });

    await expect(refreshDrivingLogGpsEndpointLocations("log-1", "workspace-1")).resolves.toBe(true);

    expect(mockReverseGeocodeTripEndpoints).toHaveBeenCalledWith([
      { latitude: -37.74311, longitude: 144.96983 },
      { latitude: -37.74862, longitude: 144.9653 },
    ]);
    expect(mockPrisma.drivingLog.update).toHaveBeenCalledWith({
      where: { id: "log-1" },
      data: {
        startLocation: "Coburg VIC",
        startFormattedAddress: "Coburg VIC",
        endLocation: "Brunswick VIC",
        endFormattedAddress: "Brunswick VIC",
      },
    });
  });

  it("does not overwrite meaningful manual locations during GPS refresh", async () => {
    mockPrisma.drivingLog.findFirst.mockResolvedValue({
      id: "log-1",
      startLocation: "Coburg VIC",
      endLocation: "Brunswick VIC",
      startFormattedAddress: null,
      endFormattedAddress: null,
      gpsSamples: [
        { latitude: -37.74311, longitude: 144.96983 },
        { latitude: -37.74862, longitude: 144.9653 },
      ],
    });

    await expect(refreshDrivingLogGpsEndpointLocations("log-1", "workspace-1")).resolves.toBe(false);

    expect(mockReverseGeocodeTripEndpoints).not.toHaveBeenCalled();
    expect(mockPrisma.drivingLog.update).not.toHaveBeenCalled();
  });

  it("keeps fallback labels when GPS refresh has no geocoded result", async () => {
    mockPrisma.drivingLog.findFirst.mockResolvedValue({
      id: "log-1",
      startLocation: "GPS route recorded",
      endLocation: "GPS route recorded",
      startFormattedAddress: null,
      endFormattedAddress: null,
      gpsSamples: [
        { latitude: -37.74311, longitude: 144.96983 },
        { latitude: -37.74862, longitude: 144.9653 },
      ],
    });
    mockReverseGeocodeTripEndpoints.mockResolvedValue({ startLocation: null, endLocation: null });

    await expect(refreshDrivingLogGpsEndpointLocations("log-1", "workspace-1")).resolves.toBe(false);

    expect(mockPrisma.drivingLog.update).not.toHaveBeenCalled();
  });
});
