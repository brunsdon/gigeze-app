import { describe, expect, it } from "vitest";
import { drivingLogCreateSchema } from "@/lib/validation/driving-log";

describe("drivingLogCreateSchema", () => {
  it("rejects when end odometer is less than start", () => {
    const result = drivingLogCreateSchema.safeParse({
      date: "2026-04-07",
      startOdometer: 100,
      endOdometer: 99,
      businessKm: 0,
      personalKm: 0,
    });

    expect(result.success).toBe(false);
  });

  it("accepts when end odometer equals start", () => {
    const result = drivingLogCreateSchema.safeParse({
      date: "2026-04-07",
      startOdometer: 100,
      endOdometer: 100,
      businessKm: 0,
      personalKm: 0,
    });

    expect(result.success).toBe(true);
  });

  it("rejects when business and personal km do not equal trip distance", () => {
    const result = drivingLogCreateSchema.safeParse({
      date: "2026-04-07",
      startOdometer: 100,
      endOdometer: 130,
      businessKm: 10,
      personalKm: 10,
    });

    expect(result.success).toBe(false);
  });

  it("accepts when business and personal km equal trip distance", () => {
    const result = drivingLogCreateSchema.safeParse({
      date: "2026-04-07",
      startOdometer: 100,
      endOdometer: 130,
      businessKm: 12,
      personalKm: 18,
    });

    expect(result.success).toBe(true);
  });

  it("accepts walk trips without vehicle or odometer values", () => {
    const result = drivingLogCreateSchema.safeParse({
      date: "2026-04-07",
      tripMode: "WALK",
      totalDistanceKm: 6,
      businessKm: 2,
      personalKm: 4,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        tripMode: "WALK",
        vehicleId: undefined,
        startOdometer: 0,
        endOdometer: 6,
      });
    }
  });

  it("defaults missing trip mode to drive behavior", () => {
    const result = drivingLogCreateSchema.safeParse({
      date: "2026-04-07",
      startOdometer: 100,
      endOdometer: 130,
      businessKm: 12,
      personalKm: 18,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tripMode).toBe("DRIVE");
    }
  });

  it("accepts selected geocode fields and stores formatted address as location", () => {
    const result = drivingLogCreateSchema.safeParse({
      date: "2026-04-07",
      startLocation: "Coburg",
      endLocation: "Brunswick",
      startFormattedAddress: "Coburg VIC, Australia",
      endFormattedAddress: "Brunswick VIC, Australia",
      startPlaceId: "start-place",
      endPlaceId: "end-place",
      startLatitude: "-37.743110",
      startLongitude: "144.969830",
      endLatitude: "-37.765000",
      endLongitude: "144.961000",
      startOdometer: 100,
      endOdometer: 130,
      businessKm: 12,
      personalKm: 18,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        startLocation: "Coburg VIC, Australia",
        endLocation: "Brunswick VIC, Australia",
        startLatitude: -37.74311,
        startLongitude: 144.96983,
        endLatitude: -37.765,
        endLongitude: 144.961,
        startPlaceId: "start-place",
        endPlaceId: "end-place",
      });
    }
  });
});
