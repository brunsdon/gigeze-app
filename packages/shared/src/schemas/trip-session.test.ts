import { describe, expect, it } from "vitest";
import { startTripRequestSchema } from "./trip-session";

describe("startTripRequestSchema", () => {
  it("accepts supported trip modes", () => {
    expect(startTripRequestSchema.parse({ tripMode: "WALK" }).tripMode).toBe("WALK");
    expect(startTripRequestSchema.parse({ tripMode: "RIDE" }).tripMode).toBe("RIDE");
    expect(startTripRequestSchema.parse({ tripMode: "DRIVE" }).tripMode).toBe("DRIVE");
  });

  it("rejects unsupported trip modes", () => {
    expect(() => startTripRequestSchema.parse({ tripMode: "FLY" })).toThrow();
  });
});
