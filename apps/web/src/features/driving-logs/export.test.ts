import { describe, expect, it } from "vitest";
import {
  cleanDrivingLogExportNotes,
  buildDrivingLogExportSummaryRows,
  drivingLogExportHeader,
  getDrivingLogExportEndLocation,
  getDrivingLogExportPurpose,
  getDrivingLogExportStartLocation,
  getDrivingLogExportSummary,
  getDrivingLogUseType,
  hasMissingDrivingLogLocation,
} from "@/features/driving-logs/export";

describe("driving log export helpers", () => {
  it("includes accountant-friendly CSV columns", () => {
    expect(drivingLogExportHeader).toEqual([
      "Date",
      "Start Time",
      "End Time",
      "Vehicle",
      "Registration",
      "Tour",
      "Start Location",
      "End Location",
      "Start Odometer",
      "End Odometer",
      "Distance Travelled",
      "Business KM",
      "Personal KM",
      "Use Type",
      "Purpose",
      "Notes",
    ]);
  });

  it("calculates business, personal, and mixed use types", () => {
    expect(getDrivingLogUseType({ businessKm: 42, personalKm: 0 })).toBe("Business");
    expect(getDrivingLogUseType({ businessKm: 0, personalKm: 42 })).toBe("Personal");
    expect(getDrivingLogUseType({ businessKm: 20, personalKm: 22 })).toBe("Mixed");
    expect(getDrivingLogUseType({ businessKm: 0, personalKm: 0 })).toBe("");
  });

  it("strips trip draft debug notes while preserving user notes", () => {
    expect(
      cleanDrivingLogExportNotes({
        notes: "Client meeting\n[Trip draft] Passive GPS session captured. Mode: DRIVE. Estimated distance 12 km. Route samples: 6.",
        gpsSamples: [],
      }),
    ).toBe("Client meeting; GPS route evidence captured");
  });

  it("adds GPS evidence note only when route evidence exists", () => {
    expect(cleanDrivingLogExportNotes({ notes: "Airport run", gpsSamples: [] })).toBe("Airport run");
    expect(cleanDrivingLogExportNotes({ notes: "Airport run", gpsSamples: [{ id: "sample-1" }] })).toBe(
      "Airport run; GPS route evidence captured",
    );
    expect(cleanDrivingLogExportNotes({ notes: "Airport run", gpsSamples: [], hasRouteSamples: true })).toBe(
      "Airport run; GPS route evidence captured",
    );
  });

  it("exports explicit purpose before weak Tour fallback", () => {
    expect(
      getDrivingLogExportPurpose({
        date: new Date("2026-04-01T00:00:00.000Z"),
        purpose: "Client meeting",
        Tour: { title: "Coburg Testing" },
      }),
    ).toBe("Client meeting");
  });

  it("uses Tour fallback but still counts missing explicit purpose", () => {
    const log = {
      date: new Date("2026-04-01T00:00:00.000Z"),
      purpose: null,
      Tour: { title: "Coburg Testing" },
    };

    expect(getDrivingLogExportPurpose(log)).toBe("Coburg Testing");
    expect(getDrivingLogExportSummary([log]).missingPurposeCount).toBe(1);
  });

  it("treats generic GPS locations as weak and keeps them as safe display fallback", () => {
    const log = {
      date: new Date("2026-04-01T00:00:00.000Z"),
      startLocation: "GPS route recorded",
      endLocation: "GPS route recorded",
      gpsSamples: [{ id: "sample-1" }, { id: "sample-2" }],
    };

    expect(getDrivingLogExportStartLocation(log)).toBe("GPS route recorded");
    expect(getDrivingLogExportEndLocation(log)).toBe("GPS route recorded");
    expect(hasMissingDrivingLogLocation(log)).toBe(true);
  });

  it("uses reverse-geocoded sample addresses when generic locations are the only stored labels", () => {
    const log = {
      date: new Date("2026-04-01T00:00:00.000Z"),
      startLocation: "GPS trip start",
      endLocation: "GPS trip end",
      gpsSamples: [
        { displayAddress: "Coburg VIC" },
        { reverseGeocodedAddress: "Brunswick VIC" },
      ],
    };

    expect(getDrivingLogExportStartLocation(log)).toBe("Coburg VIC");
    expect(getDrivingLogExportEndLocation(log)).toBe("Brunswick VIC");
  });

  it("does not count meaningful manual locations as missing", () => {
    expect(
      hasMissingDrivingLogLocation({
        date: new Date("2026-04-01T00:00:00.000Z"),
        startLocation: "Coburg VIC",
        endLocation: "Brunswick VIC",
      }),
    ).toBe(false);
  });

  it("uses formatted address for export locations when available", () => {
    const log = {
      date: new Date("2026-04-01T00:00:00.000Z"),
      startLocation: "Coburg",
      endLocation: "Brunswick",
      startFormattedAddress: "Coburg VIC, Australia",
      endFormattedAddress: "Brunswick VIC, Australia",
    };

    expect(getDrivingLogExportStartLocation(log)).toBe("Coburg VIC, Australia");
    expect(getDrivingLogExportEndLocation(log)).toBe("Brunswick VIC, Australia");
  });

  it("treats selected geocoded addresses as valid locations", () => {
    expect(
      hasMissingDrivingLogLocation({
        date: new Date("2026-04-01T00:00:00.000Z"),
        startLocation: "GPS trip start",
        endLocation: "GPS trip end",
        startFormattedAddress: "Coburg VIC, Australia",
        endFormattedAddress: "Brunswick VIC, Australia",
      }),
    ).toBe(false);
  });

  it("calculates missing-field summary counts", () => {
    const summary = getDrivingLogExportSummary([
      {
        date: new Date("2026-04-01T00:00:00.000Z"),
        startLocation: "Hobart",
        endLocation: "Launceston",
        startOdometer: 100,
        endOdometer: 160,
        businessKm: 60,
        personalKm: 0,
        purpose: "Client visit",
        notes: "Client visit",
      },
      {
        date: new Date("2026-04-02T00:00:00.000Z"),
        startLocation: "",
        endLocation: null,
        startOdometer: 0,
        endOdometer: 0,
        businessKm: 0,
        personalKm: 0,
        notes: null,
        Tour: null,
      },
    ]);

    expect(summary).toMatchObject({
      periodStart: "2026-04-01",
      periodEnd: "2026-04-02",
      totalDays: 2,
      tripsInRange: 2,
      totalDistance: 60,
      businessKm: 60,
      personalKm: 0,
      businessUsePercentage: 100,
      missingLocationsCount: 1,
      missingPurposeCount: 1,
      missingOdometerCount: 1,
      missingSplitCount: 1,
    });
  });

  it("calculates business use percentage and GPS evidence count for a selected period", () => {
    const summary = getDrivingLogExportSummary(
      [
        {
          date: new Date("2026-04-01T00:00:00.000Z"),
          startOdometer: 100,
          endOdometer: 160,
          businessKm: 45,
          personalKm: 15,
          hasRouteSamples: true,
          vehicle: { name: "Business Van", registration: "ABC-123" },
        },
        {
          date: new Date("2026-04-08T00:00:00.000Z"),
          startOdometer: 160,
          endOdometer: 200,
          businessKm: 15,
          personalKm: 25,
          gpsSamples: [{ id: "sample-1" }],
          vehicle: { name: "Business Van", registration: "ABC-123" },
        },
      ],
      {
        periodStart: new Date("2026-04-01T00:00:00.000Z"),
        periodEnd: new Date("2026-04-30T00:00:00.000Z"),
      },
    );

    expect(summary).toMatchObject({
      totalDays: 30,
      totalDistance: 100,
      businessKm: 60,
      personalKm: 40,
      businessUsePercentage: 60,
      gpsEvidenceCount: 2,
      vehiclesIncluded: ["Business Van (ABC-123)"],
      isUnderTwelveWeeks: true,
    });
  });

  it("does not show the 12-week warning for periods of at least 84 days", () => {
    expect(
      getDrivingLogExportSummary([], {
        periodStart: new Date("2026-01-01T00:00:00.000Z"),
        periodEnd: new Date("2026-03-25T00:00:00.000Z"),
      }).isUnderTwelveWeeks,
    ).toBe(false);
  });

  it("builds summary CSV rows before unchanged detail rows", () => {
    const log = {
      date: new Date("2026-04-08T05:00:00.000Z"),
      startOdometer: 1000,
      endOdometer: 1125,
      businessKm: 100,
      personalKm: 25,
      startLocation: "Hobart",
      endLocation: "Launceston",
      purpose: "Client meeting",
      hasRouteSamples: true,
      vehicle: { name: "Tassie Cruiser", registration: "TAS-123" },
    };

    const summaryRows = buildDrivingLogExportSummaryRows([log], {
      periodStart: new Date("2026-04-01T00:00:00.000Z"),
      periodEnd: new Date("2026-04-30T00:00:00.000Z"),
      generatedAt: new Date("2026-04-30T00:15:00.000Z"),
      workspaceName: "Matts tour workspace",
    });

    expect(summaryRows).toContainEqual(["Workspace", "Matts tour workspace"]);
    expect(summaryRows).toContainEqual(["Total days", 30]);
    expect(summaryRows).toContainEqual(["GPS evidence count", 1]);
    expect(summaryRows.at(-1)).toEqual(["Driving log detail rows"]);
  });
});
