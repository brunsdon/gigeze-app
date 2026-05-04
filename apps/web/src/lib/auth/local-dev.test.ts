import { describe, expect, it } from "vitest";
import { hashLocalDevPassword, verifyLocalDevPassword } from "@/lib/auth/local-dev";

describe("local dev auth", () => {
  it("hashes and verifies the seeded local password", async () => {
    const passwordHash = await hashLocalDevPassword("dev-admin-password");

    await expect(verifyLocalDevPassword("dev-admin-password", passwordHash)).resolves.toBe(true);
    await expect(verifyLocalDevPassword("wrong-password", passwordHash)).resolves.toBe(false);
  });

  it("rejects missing or malformed hashes", async () => {
    await expect(verifyLocalDevPassword("dev-admin-password", null)).resolves.toBe(false);
    await expect(verifyLocalDevPassword("dev-admin-password", "not-a-valid-hash")).resolves.toBe(false);
  });
});
