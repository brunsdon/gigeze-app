import { describe, expect, it } from "vitest";
import { manageDataNavigationItems } from "./manage-data-navigation";

describe("manage data navigation", () => {
  it("exposes vehicles and Tours as Settings management entries", () => {
    expect(manageDataNavigationItems).toEqual([
      expect.objectContaining({ label: "Vehicles", routeName: "vehicles" }),
      expect.objectContaining({ label: "Tours", routeName: "Tours" }),
    ]);
  });

  it("keeps each entry touch-target copy user-facing", () => {
    for (const item of manageDataNavigationItems) {
      expect(item.description.length).toBeGreaterThan(20);
      expect(item.description).not.toContain("debug");
    }
  });
});
