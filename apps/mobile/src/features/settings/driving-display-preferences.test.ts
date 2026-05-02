import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = new Map<string, string>();

vi.mock("../../lib/storage/mobile-storage", () => ({
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

describe("driving display preferences", () => {
  beforeEach(() => {
    storage.clear();
  });

  it("defaults keep-screen-awake while driving to enabled", async () => {
    const { loadDrivingDisplayPreferences } = await import("./driving-display-preferences");

    await expect(loadDrivingDisplayPreferences()).resolves.toEqual({
      keepScreenOnWhileDriving: true,
    });
  });

  it("persists disabling and re-enabling keep-screen-awake while driving", async () => {
    const { loadDrivingDisplayPreferences, saveDrivingDisplayPreferences } = await import("./driving-display-preferences");

    await saveDrivingDisplayPreferences({ keepScreenOnWhileDriving: false });
    await expect(loadDrivingDisplayPreferences()).resolves.toEqual({ keepScreenOnWhileDriving: false });

    await saveDrivingDisplayPreferences({ keepScreenOnWhileDriving: true });
    await expect(loadDrivingDisplayPreferences()).resolves.toEqual({ keepScreenOnWhileDriving: true });
  });

  it("falls back safely when stored preferences are invalid or partial", async () => {
    const { loadDrivingDisplayPreferences } = await import("./driving-display-preferences");

    storage.set("gigeze.mobile.preferences.driving-display", "{bad json");
    await expect(loadDrivingDisplayPreferences()).resolves.toEqual({ keepScreenOnWhileDriving: true });

    storage.set("gigeze.mobile.preferences.driving-display", JSON.stringify({}));
    await expect(loadDrivingDisplayPreferences()).resolves.toEqual({ keepScreenOnWhileDriving: true });
  });
});
