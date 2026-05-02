import { describe, expect, it } from "vitest";
import { useAppVersion } from "@/features/mobile/use-app-version";

describe("useAppVersion", () => {
  it("returns the web app package version", () => {
    expect(useAppVersion()).toEqual({
      versionName: "0.1.0",
      versionCode: 0,
      platform: "web",
    });
  });
});
