import { describe, expect, it } from "vitest";
import {
  buildTripHistoryCardModel,
  buildTripHistoryGroups,
  filterTripHistoryTrips,
  filterTripsByVehicle,
  formatTripHistoryDistance,
  formatTripDateTime,
  formatTripDurationSummary,
  hasActiveTripHistoryFilters,
  hasTripRoutePreview,
} from "./trip-history-display";
import type { MobileTripSession } from "./trip-workflow";

function createTrip(overrides: Partial<MobileTripSession> = {}): MobileTripSession {
  return {
    id: "trip-1",
    userId: "user-1",
    status: "completed",
    startedAt: "2026-02-15T08:18:00.000Z",
    endedAt: "2026-02-15T09:08:00.000Z",
    distanceMeters: 18000,
    title: "Trip",
    sampleCount: 2,
    captureMode: "tracking",
    syncState: "synced",
    createdAt: "2026-02-15T08:18:00.000Z",
    updatedAt: "2026-02-15T09:08:00.000Z",
    ...overrides,
  };
}

describe("trip history display helpers", () => {
  it("groups trips by month and day with totals", () => {
    const groups = buildTripHistoryGroups([
      createTrip({ id: "trip-1", startedAt: "2026-02-15T08:18:00.000Z", distanceMeters: 18600 }),
      createTrip({
        id: "trip-2",
        startedAt: "2026-02-15T01:31:00.000Z",
        endedAt: "2026-02-15T02:21:00.000Z",
        distanceMeters: 24000,
      }),
      createTrip({ id: "trip-3", startedAt: "2026-03-02T09:00:00.000Z", distanceMeters: 10000 }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      heading: "March 2026",
      tripCount: 1,
      totalDistanceKm: 10,
    });
    expect(groups[1]).toMatchObject({
      heading: "February 2026",
      tripCount: 2,
      totalDistanceKm: 42.6,
      totalDurationMinutes: 100,
      days: [
        {
          heading: "Sunday 15 Feb",
          tripCount: 2,
          totalDistanceKm: 42.6,
          totalDurationMinutes: 100,
        },
      ],
    });
    expect(formatTripDurationSummary(72)).toBe("1h 12m");
  });

  it("groups trips by local calendar day instead of UTC day", () => {
    const groups = buildTripHistoryGroups([
      createTrip({ id: "trip-1", startedAt: "2026-04-21T07:05:00.000Z", distanceMeters: 3000 }),
      createTrip({ id: "trip-2", startedAt: "2026-04-20T08:43:00.000Z", distanceMeters: 1000 }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].heading).toBe("April 2026");
    expect(groups[0].days).toHaveLength(2);
    expect(groups[0].days.map((day) => day.heading)).toEqual(["Tuesday 21 Apr", "Monday 20 Apr"]);
    expect(groups[0].days.map((day) => day.tripCount)).toEqual([1, 1]);
  });

  it("filters trips by selected vehicle before grouping", () => {
    const trips = [
      createTrip({ id: "trip-1", vehicleId: "vehicle-1", vehicleName: "VW Caddy", distanceMeters: 1000 }),
      createTrip({ id: "trip-2", vehicleId: "vehicle-2", vehicleName: "Walking", distanceMeters: 2000 }),
      createTrip({ id: "trip-3", vehicleId: "vehicle-1", vehicleName: "VW Caddy", distanceMeters: 3000 }),
    ];

    expect(filterTripsByVehicle(trips, undefined).map((trip) => trip.id)).toEqual(["trip-1", "trip-2", "trip-3"]);
    expect(filterTripsByVehicle(trips, "vehicle-1").map((trip) => trip.id)).toEqual(["trip-1", "trip-3"]);
  });

  it("filters trips by vehicle, purpose, search text, and short-trip visibility", () => {
    const trips = [
      createTrip({
        id: "trip-1",
        tripMode: "WALK",
        vehicleId: "vehicle-1",
        vehicleName: "VW Caddy",
        tripPurpose: "PRIVATE",
        distanceMeters: 0,
      }),
      createTrip({
        id: "trip-2",
        tripMode: "RIDE",
        vehicleId: "vehicle-1",
        vehicleName: "VW Caddy",
        tripPurpose: "BUSINESS",
        distanceMeters: 3500,
      }),
      createTrip({
        id: "trip-3",
        tripMode: "DRIVE",
        vehicleId: "vehicle-2",
        vehicleName: "Walking",
        tripPurpose: "PRIVATE",
        distanceMeters: 1200,
      }),
    ];

    expect(filterTripHistoryTrips(trips).map((trip) => trip.id)).toEqual([
      "trip-1",
      "trip-2",
      "trip-3",
    ]);
    expect(filterTripHistoryTrips(trips, {}, {
      tripMode: "RIDE",
      purpose: "BUSINESS",
      searchQuery: "caddy",
      vehicleId: "vehicle-1",
    }).map((trip) => trip.id)).toEqual(["trip-2"]);
  });

  it("filters trips by trip mode", () => {
    const trips = [
      createTrip({ id: "walk-trip", tripMode: "WALK" }),
      createTrip({ id: "ride-trip", tripMode: "RIDE" }),
      createTrip({ id: "drive-trip", tripMode: "DRIVE" }),
    ];

    expect(filterTripHistoryTrips(trips, {}, { tripMode: "ALL" }).map((trip) => trip.id)).toEqual([
      "walk-trip",
      "ride-trip",
      "drive-trip",
    ]);
    expect(filterTripHistoryTrips(trips, {}, { tripMode: "WALK" }).map((trip) => trip.id)).toEqual(["walk-trip"]);
    expect(filterTripHistoryTrips(trips, {}, { tripMode: "RIDE" }).map((trip) => trip.id)).toEqual(["ride-trip"]);
    expect(filterTripHistoryTrips(trips, {}, { tripMode: "DRIVE" }).map((trip) => trip.id)).toEqual(["drive-trip"]);
  });

  it("updates grouped totals after trip mode filtering", () => {
    const trips = [
      createTrip({ id: "walk-trip", tripMode: "WALK", backendDistanceKm: 0.6, distanceMeters: 0 }),
      createTrip({ id: "ride-trip", tripMode: "RIDE", backendDistanceKm: 3.4, distanceMeters: 0, startedAt: "2026-02-15T10:18:00.000Z", endedAt: "2026-02-15T10:48:00.000Z" }),
      createTrip({ id: "drive-trip", tripMode: "DRIVE", backendDistanceKm: 12, distanceMeters: 0, startedAt: "2026-02-16T08:18:00.000Z", endedAt: "2026-02-16T09:08:00.000Z" }),
    ];

    const filteredTrips = filterTripHistoryTrips(trips, {}, { tripMode: "RIDE" });
    const groups = buildTripHistoryGroups(filteredTrips);

    expect(filteredTrips.map((trip) => trip.id)).toEqual(["ride-trip"]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      tripCount: 1,
      totalDistanceKm: 3.4,
      tripMode: "RIDE",
    });
    expect(groups[0]?.days[0]).toMatchObject({
      tripCount: 1,
      totalDistanceKm: 3.4,
      tripMode: "RIDE",
    });
  });

  it("detects when any trip history filters are active", () => {
    expect(hasActiveTripHistoryFilters()).toBe(false);
    expect(hasActiveTripHistoryFilters({ tripMode: "ALL", purpose: "ALL", searchQuery: "   " })).toBe(false);
    expect(hasActiveTripHistoryFilters({ vehicleId: "vehicle-1" })).toBe(true);
    expect(hasActiveTripHistoryFilters({ tripMode: "WALK" })).toBe(true);
    expect(hasActiveTripHistoryFilters({ purpose: "BUSINESS" })).toBe(true);
    expect(hasActiveTripHistoryFilters({ searchQuery: "walk" })).toBe(true);
  });

  it("builds cards with purpose, distance, start finish labels, and vehicle", () => {
    const card = buildTripHistoryCardModel(createTrip({
      tripPurpose: "PRIVATE",
      vehicleName: "VW Caddy",
      backendDistanceKm: 18.6,
    }), {
      distanceKm: 17,
      coordinates: {
        start: { latitude: -37.742, longitude: 144.966 },
        finish: { latitude: -37.713, longitude: 145.148 },
      },
    });

    expect(card).toMatchObject({
      purposeText: "Personal",
      distanceText: "19 km",
      vehicleText: "VW Caddy",
      startTitle: "Start",
      finishTitle: "Finish",
    });
    expect(card.startSecondary).toBe("-37.74200, 144.96600");
  });

  it("uses backend start and end locations when local route samples are unavailable", () => {
    const card = buildTripHistoryCardModel(createTrip({
      startLocation: "Coburg VIC, Australia",
      endLocation: "Brunswick VIC, Australia",
      sampleCount: 0,
    }));

    expect(card).toMatchObject({
      startTitle: "Start",
      finishTitle: "Finish",
      startSecondary: "Coburg VIC, Australia",
      finishSecondary: "Brunswick VIC, Australia",
    });
  });

  it("formats walking trip distances with decimal precision when needed", () => {
    const card = buildTripHistoryCardModel(createTrip({
      tripMode: "WALK",
      backendDistanceKm: 0.6,
      distanceMeters: 0,
    }));

    expect(card.distanceText).toBe("0.6 km");
    expect(formatTripHistoryDistance(6, "WALK")).toBe("6.0 km");
  });

  it("keeps day and month groups mode-aware when every trip uses the same mode", () => {
    const groups = buildTripHistoryGroups([
      createTrip({ id: "walk-1", tripMode: "WALK", backendDistanceKm: 0.6, distanceMeters: 0 }),
      createTrip({ id: "walk-2", tripMode: "WALK", backendDistanceKm: 0.4, distanceMeters: 0, startedAt: "2026-02-15T10:18:00.000Z", endedAt: "2026-02-15T10:28:00.000Z" }),
    ]);

    expect(groups[0]?.tripMode).toBe("WALK");
    expect(groups[0]?.days[0]?.tripMode).toBe("WALK");
    expect(formatTripHistoryDistance(groups[0]?.totalDistanceKm, groups[0]?.tripMode)).toBe("1.0 km");
  });

  it("degrades safely for older trips with missing data", () => {
    const card = buildTripHistoryCardModel(createTrip({
      tripPurpose: undefined,
      vehicleName: undefined,
      vehicleId: undefined,
      startedAt: "bad-date",
      endedAt: undefined,
      distanceMeters: 0,
    }));

    expect(card).toMatchObject({
      purposeText: "Trip",
      distanceText: "0 km",
      vehicleText: "Unassigned",
      startTimeText: "--:--",
      finishTimeText: "--:--",
      startTitle: "Start not available",
      finishTitle: "Finish not available",
    });
    expect(formatTripDateTime(undefined)).toBe("Not available");
  });

  it("detects when the detail screen can show a route preview", () => {
    expect(hasTripRoutePreview(2, {
      distanceKm: 1,
      coordinates: {
        start: { latitude: -37.742, longitude: 144.966 },
        finish: { latitude: -37.713, longitude: 145.148 },
      },
    })).toBe(true);
    expect(hasTripRoutePreview(0, { distanceKm: 0, coordinates: {} })).toBe(false);
  });
});
