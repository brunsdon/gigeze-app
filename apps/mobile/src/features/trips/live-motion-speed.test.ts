import { describe, expect, it } from "vitest";
import {
  formatGpsAccuracy,
  formatGpsDiagnosticLine,
  formatGpsSignalSummary,
  getGpsFreshness,
  getGpsSignalQuality,
  getLiveMotionSpeedKmh,
  type LiveSpeedSample,
} from "./live-motion-speed";

function createSample(overrides: Partial<LiveSpeedSample> = {}): LiveSpeedSample {
  return {
    latitude: -37.8136,
    longitude: 144.9631,
    accuracyMeters: 8,
    speedMetersPerSecond: null,
    timestampMs: 1000,
    recordedAt: "2026-04-12T00:00:01.000Z",
    sequence: 1,
    ...overrides,
  };
}

describe("live motion speed", () => {
  it("prefers provider speed when available", () => {
    const speed = getLiveMotionSpeedKmh([
      createSample({ sequence: 1, timestampMs: 0 }),
      createSample({ sequence: 2, timestampMs: 1000, speedMetersPerSecond: 12 }),
    ]);

    expect(speed).toBe(43.2);
  });

  it("ignores provider speed when live GPS accuracy is poor", () => {
    const speed = getLiveMotionSpeedKmh([
      createSample({ sequence: 1, timestampMs: 0, accuracyMeters: 60 }),
      createSample({ sequence: 2, timestampMs: 1000, accuracyMeters: 60, speedMetersPerSecond: 9 }),
    ]);

    expect(speed).toBe(0);
  });

  it("falls back to computed speed when provider speed is absent", () => {
    const speed = getLiveMotionSpeedKmh([
      createSample({ sequence: 1, timestampMs: 0, latitude: -37.8136 }),
      createSample({ sequence: 2, timestampMs: 60_000, latitude: -37.8226 }),
    ]);

    expect(speed).toBeGreaterThan(55);
    expect(speed).toBeLessThan(65);
  });

  it("clamps stationary provider speed to zero", () => {
    const speed = getLiveMotionSpeedKmh([
      createSample({ sequence: 1, timestampMs: 0 }),
      createSample({ sequence: 2, timestampMs: 1000, speedMetersPerSecond: 0.4 }),
    ]);

    expect(speed).toBe(0);
  });

  it("suppresses stationary poor-accuracy live fixes", () => {
    const speed = getLiveMotionSpeedKmh([
      createSample({ sequence: 1, timestampMs: 0, latitude: -37.8136, longitude: 144.9631, accuracyMeters: 60 }),
      createSample({ sequence: 2, timestampMs: 1000, latitude: -37.81365, longitude: 144.96315, accuracyMeters: 60 }),
    ]);

    expect(speed).toBe(0);
  });

  it("falls back safely when no live motion signal is available", () => {
    expect(getLiveMotionSpeedKmh([createSample({ sequence: 1 })])).toBeUndefined();
  });

  it("formats GPS accuracy compactly", () => {
    expect(formatGpsAccuracy(8.4)).toBe("GPS ±8m");
    expect(formatGpsAccuracy(undefined)).toBe("GPS unavailable");
  });

  it("maps GPS accuracy to simple signal quality labels", () => {
    expect(getGpsSignalQuality(4.9)).toBe("Excellent");
    expect(getGpsSignalQuality(8)).toBe("Good");
    expect(getGpsSignalQuality(15)).toBe("Fair");
    expect(getGpsSignalQuality(25)).toBe("Poor");
    expect(getGpsSignalQuality(null)).toBeUndefined();
  });

  it("returns a compact GPS signal dashboard summary with fallback", () => {
    expect(formatGpsSignalSummary(8)).toBe("GPS ±8m · Good");
    expect(formatGpsSignalSummary(null)).toBe("GPS unavailable");
  });

  it("classifies GPS freshness from latest update age", () => {
    const now = new Date("2026-04-12T00:00:20.000Z");

    expect(getGpsFreshness("2026-04-12T00:00:18.000Z", now)).toBe("Live");
    expect(getGpsFreshness("2026-04-12T00:00:12.000Z", now)).toBe("Recent");
    expect(getGpsFreshness("2026-04-12T00:00:09.000Z", now)).toBe("Stale");
    expect(getGpsFreshness(undefined, now)).toBeUndefined();
  });

  it("formats GPS diagnostics with signal quality and freshness", () => {
    const now = new Date("2026-04-12T00:00:20.000Z");

    expect(formatGpsDiagnosticLine(4, "2026-04-12T00:00:19.000Z", now)).toBe("GPS ±4m · Excellent · Live");
    expect(formatGpsDiagnosticLine(14, "2026-04-12T00:00:14.000Z", now)).toBe("GPS ±14m · Fair · Recent");
    expect(formatGpsDiagnosticLine(25, "2026-04-12T00:00:01.000Z", now)).toBe("GPS ±25m · Poor · Stale");
    expect(formatGpsDiagnosticLine(8, undefined, now)).toBe("GPS unavailable");
  });
});
