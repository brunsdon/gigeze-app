import { describe, expect, it } from "vitest";
import { formatDistanceKm } from "./distance";

describe("formatDistanceKm", () => {
  it("returns an em dash for missing and invalid values", () => {
    expect(formatDistanceKm(null)).toBe("—");
    expect(formatDistanceKm(undefined)).toBe("—");
    expect(formatDistanceKm(Number.NaN)).toBe("—");
  });

  it("formats zero and short distances safely", () => {
    expect(formatDistanceKm(0)).toBe("0 km");
    expect(formatDistanceKm(0.04)).toBe("0.1 km");
    expect(formatDistanceKm(0.6)).toBe("0.6 km");
  });

  it("formats one to ten kilometers adaptively", () => {
    expect(formatDistanceKm(1)).toBe("1 km");
    expect(formatDistanceKm(1.2)).toBe("1.2 km");
    expect(formatDistanceKm(6)).toBe("6 km");
    expect(formatDistanceKm(6.4)).toBe("6.4 km");
    expect(formatDistanceKm(10)).toBe("10 km");
  });

  it("formats long distances without decimals", () => {
    expect(formatDistanceKm(124.7)).toBe("125 km");
  });

  it("supports walking-friendly formatting under ten kilometers", () => {
    expect(formatDistanceKm(6, { tripType: "walking" })).toBe("6.0 km");
    expect(formatDistanceKm(1, { tripType: "walking" })).toBe("1.0 km");
  });

  it("supports ride-friendly formatting under ten kilometers", () => {
    expect(formatDistanceKm(6, { tripType: "ride" })).toBe("6.0 km");
  });
});
