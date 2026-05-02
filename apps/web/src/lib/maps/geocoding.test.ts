import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatGoogleGeocodeDisplayLocation,
  getFirstAndLastValidGpsSamples,
  pickGoogleGeocodeDisplayLocation,
  reverseGeocodeDisplayLocation,
} from "@/lib/maps/geocoding";

describe("maps geocoding", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = originalEnv;
  });

  it("selects the first and last valid GPS sample", () => {
    const endpoints = getFirstAndLastValidGpsSamples([
      { latitude: Number.NaN, longitude: 144.9 },
      { latitude: -37.74311, longitude: 144.96983 },
      { latitude: 91, longitude: 144.9 },
      { latitude: -37.7451, longitude: 144.9676 },
    ]);

    expect(endpoints).toEqual({
      start: { latitude: -37.74311, longitude: 144.96983 },
      end: { latitude: -37.7451, longitude: 144.9676 },
    });
  });

  it("formats Google geocoding results as suburb/state display text", () => {
    expect(
      formatGoogleGeocodeDisplayLocation({
        formatted_address: "Coburg VIC 3058, Australia",
        address_components: [
          { long_name: "Coburg", short_name: "Coburg", types: ["locality", "political"] },
          { long_name: "Victoria", short_name: "VIC", types: ["administrative_area_level_1", "political"] },
        ],
      }),
    ).toBe("Coburg VIC");
  });

  it("prefers locality-style results from broader Google responses", () => {
    expect(
      pickGoogleGeocodeDisplayLocation([
        {
          formatted_address: "10 Sydney Road, Coburg VIC 3058, Australia",
          address_components: [
            { long_name: "10", short_name: "10", types: ["street_number"] },
            { long_name: "Sydney Road", short_name: "Sydney Rd", types: ["route"] },
            { long_name: "Victoria", short_name: "VIC", types: ["administrative_area_level_1", "political"] },
          ],
        },
        {
          formatted_address: "Coburg VIC 3058, Australia",
          address_components: [
            { long_name: "Coburg", short_name: "Coburg", types: ["locality", "political"] },
            { long_name: "Victoria", short_name: "VIC", types: ["administrative_area_level_1", "political"] },
          ],
        },
      ]),
    ).toBe("Coburg VIC");
  });

  it("falls back to the first formatted address when no locality result exists", () => {
    expect(
      pickGoogleGeocodeDisplayLocation([
        {
          formatted_address: "10 Sydney Road, Coburg VIC 3058, Australia",
          address_components: [
            { long_name: "10", short_name: "10", types: ["street_number"] },
            { long_name: "Sydney Road", short_name: "Sydney Rd", types: ["route"] },
          ],
        },
      ]),
    ).toBe("10 Sydney Road, Coburg VIC 3058, Australia");
  });

  it("reverse geocodes through Google when a maps key is configured", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "server-key";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        status: "OK",
        results: [
          {
            formatted_address: "Coburg VIC 3058, Australia",
            address_components: [
              { long_name: "Coburg", short_name: "Coburg", types: ["locality", "political"] },
              { long_name: "Victoria", short_name: "VIC", types: ["administrative_area_level_1", "political"] },
            ],
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(reverseGeocodeDisplayLocation({ latitude: -37.74311, longitude: 144.96983 })).resolves.toBe("Coburg VIC");
    const calledUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(calledUrl).toContain("maps.googleapis.com/maps/api/geocode/json");
    expect(calledUrl).not.toContain("result_type=");
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("maps.googleapis.com/maps/api/geocode/json"), {
      headers: { Accept: "application/json" },
    });
  });

  it("returns null when geocoding fails", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "server-key";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("provider down")));

    await expect(reverseGeocodeDisplayLocation({ latitude: -37.74311, longitude: 144.96983 })).resolves.toBeNull();
  });

  it("returns null without calling Google when no maps key is configured", async () => {
    delete process.env.GOOGLE_MAPS_GEOCODING_API_KEY;
    delete process.env.GOOGLE_MAPS_SERVER_API_KEY;
    delete process.env.GOOGLE_MAPS_API_KEY;
    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(reverseGeocodeDisplayLocation({ latitude: -37.74311, longitude: 144.96983 })).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
