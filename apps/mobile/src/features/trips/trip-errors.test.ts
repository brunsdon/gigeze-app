import { describe, expect, it } from "vitest";
import { getUserFacingTripError, isAbortError } from "./trip-errors";

describe("trip error helpers", () => {
  it("recognizes common abort/cancel messages", () => {
    expect(isAbortError(new Error("Aborted"))).toBe(true);
    expect(isAbortError(new DOMException("The operation was aborted.", "AbortError"))).toBe(true);
    expect(isAbortError("request aborted")).toBe(true);
  });

  it("suppresses aborted errors from user-facing trip UI", () => {
    expect(getUserFacingTripError(new Error("Aborted"), "Fallback")).toBeNull();
  });

  it("keeps real errors visible", () => {
    expect(getUserFacingTripError(new Error("Unable to sync trips."), "Fallback")).toBe("Unable to sync trips.");
    expect(getUserFacingTripError("unexpected", "Fallback")).toBe("Fallback");
  });

  it("turns backend auth failures into a recovery message", () => {
    expect(getUserFacingTripError(new Error("unauthorized"), "Fallback")).toBe(
      "Your sign-in needs refreshing. Sign out and back in, then try Sync again.",
    );
    expect(getUserFacingTripError(new Error("Trip sync failed with HTTP 401."), "Fallback")).toBe(
      "Your sign-in needs refreshing. Sign out and back in, then try Sync again.",
    );
  });

  it("turns local SQLite full errors into a recovery message", () => {
    expect(getUserFacingTripError(new Error("database or disk is full (code 13 SQLITE_FULL[13])"), "Fallback")).toBe(
      "Local trip storage is full. Gig this trip when safe, sync completed trips, then free device storage if the warning continues.",
    );
  });
});
