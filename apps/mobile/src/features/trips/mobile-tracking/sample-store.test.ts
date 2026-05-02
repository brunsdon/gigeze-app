import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = new Map<string, string>();

vi.mock("../../../lib/storage/mobile-storage", () => ({
  mobileStorage: {
    async getItem(key: string) {
      return storage.get(key) ?? null;
    },
    async setItem(key: string, value: string) {
      storage.set(key, value);
    },
    async removeItem(key: string) {
      storage.delete(key);
    },
  },
}));

function createSample(index: number) {
  return {
    sessionId: "trip-1",
    latitude: -37.7 + index / 10000,
    longitude: 144.9 + index / 10000,
    accuracyMeters: 8,
    timestampMs: index,
    recordedAt: new Date(index).toISOString(),
    source: "expo-foreground-location" as const,
    originId: `sample-${index}`,
  };
}

describe("trackingSampleStore", () => {
  beforeEach(() => {
    storage.clear();
    vi.resetModules();
  });

  it("imports sample batches with a single bounded stored route", async () => {
    const { trackingSampleStore, maxStoredTrackingSamples } = await import("./sample-store");
    const samples = Array.from({ length: maxStoredTrackingSamples + 200 }, (_, index) => createSample(index + 1));

    const result = await trackingSampleStore.appendSamples(samples);
    const storedSamples = await trackingSampleStore.listSamples("trip-1");

    expect(result.importedCount).toBe(samples.length);
    expect(result.importedSampleCount).toBe(maxStoredTrackingSamples);
    expect(storedSamples).toHaveLength(maxStoredTrackingSamples);
    expect(storedSamples[0]?.originId).toBe("sample-1");
    expect(storedSamples.at(-1)?.originId).toBe(`sample-${samples.length}`);
  });

  it("dedupes repeated native samples without growing storage", async () => {
    const { trackingSampleStore } = await import("./sample-store");
    const sample = createSample(1);

    await trackingSampleStore.appendSamples([sample]);
    const result = await trackingSampleStore.appendSamples([sample]);

    expect(result.importedCount).toBe(0);
    await expect(trackingSampleStore.listSamples("trip-1")).resolves.toHaveLength(1);
  });
});
