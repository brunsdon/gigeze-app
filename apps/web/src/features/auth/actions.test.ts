import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCreateLocalDevSession,
  mockCreateSupabaseServerClient,
  mockFindUnique,
  mockIsLocalDevAuthEnabled,
  mockRedirect,
  mockVerifyLocalDevPassword,
} = vi.hoisted(() => ({
  mockCreateLocalDevSession: vi.fn(),
  mockCreateSupabaseServerClient: vi.fn(),
  mockFindUnique: vi.fn(),
  mockIsLocalDevAuthEnabled: vi.fn(),
  mockRedirect: vi.fn(),
  mockVerifyLocalDevPassword: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mockCreateSupabaseServerClient,
}));

vi.mock("@/lib/env", () => ({
  hasPublicSupabaseEnv: vi.fn(() => false),
  isEnvConfigError: vi.fn(() => false),
}));

vi.mock("@/lib/auth/local-dev", () => ({
  clearLocalDevSession: vi.fn(),
  createLocalDevSession: mockCreateLocalDevSession,
  isLocalDevAuthEnabled: mockIsLocalDevAuthEnabled,
  verifyLocalDevPassword: mockVerifyLocalDevPassword,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findUnique: mockFindUnique,
    },
  },
}));

import { loginAction } from "@/features/auth/actions";

describe("auth actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
  });

  it("uses local dev auth before Supabase when the seeded credentials match", async () => {
    const localUser = {
      id: "user-1",
      email: "admin@gigeze.app",
      fullName: "GigEze Admin",
      localPasswordHash: "scrypt:salt:key",
    };
    const formData = new FormData();
    formData.set("email", "ADMIN@gigeze.app");
    formData.set("password", "dev-admin-password");
    formData.set("next", "/dashboard");

    mockIsLocalDevAuthEnabled.mockReturnValue(true);
    mockFindUnique.mockResolvedValue(localUser);
    mockVerifyLocalDevPassword.mockResolvedValue(true);

    await expect(loginAction(formData)).rejects.toThrow("NEXT_REDIRECT");

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { email: "admin@gigeze.app" },
      select: {
        id: true,
        email: true,
        fullName: true,
        localPasswordHash: true,
      },
    });
    expect(mockVerifyLocalDevPassword).toHaveBeenCalledWith("dev-admin-password", "scrypt:salt:key");
    expect(mockCreateLocalDevSession).toHaveBeenCalledWith(localUser);
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
    expect(mockCreateSupabaseServerClient).not.toHaveBeenCalled();
  });
});
