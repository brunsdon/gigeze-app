import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const { mockLoginAction, mockSignupAction } = vi.hoisted(() => ({
  mockLoginAction: vi.fn(),
  mockSignupAction: vi.fn(),
}));

vi.mock("@/features/auth/actions", () => ({
  loginAction: mockLoginAction,
  signupAction: mockSignupAction,
}));

import LoginPage from "@/app/login/page";

describe("Login page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders branded layout and both auth forms", async () => {
    const element = await LoginPage({
      searchParams: Promise.resolve({}),
    });

    const html = renderToStaticMarkup(element);

    expect(html).toContain("Continue your Tour");
    expect(html).toContain("Back to home");
    expect(html).toContain("Login page navigation");
    expect(html).toContain('href="/"');
    expect(html).toContain("Welcome back");
    expect(html).toContain("Sign in to your account to resume tracking your Tour");
    expect(html).toContain("New here?");
    expect(html).toContain("Your data is private and encrypted.");
    expect(html).toContain("Create account");
    expect(html).toContain("Create account is unavailable");
    expect(html).toContain("This site will be launched to the public soon.");
    expect(html).toContain('name="email"');
    expect(html).toContain('name="password"');
    expect(html).toContain('name="fullName"');
    expect(html).toMatch(/<input[^>]*id="fullName"[^>]*disabled/);
    expect(html).toMatch(/<input[^>]*id="signupEmail"[^>]*disabled/);
    expect(html).toMatch(/<input[^>]*id="signupPassword"[^>]*disabled/);
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Create account<\/button>/);
    expect(html).toContain('value="/dashboard"');
  });

  it("includes core accessibility-facing text and labels", async () => {
    const element = await LoginPage({
      searchParams: Promise.resolve({}),
    });

    const html = renderToStaticMarkup(element);

    expect(html).toContain("Continue your Tour");
    expect(html).toContain('for="email"');
    expect(html).toContain('for="password"');
    expect(html).toContain('for="fullName"');
    expect(html).toContain('for="signupEmail"');
    expect(html).toContain('for="signupPassword"');
    expect(html).toContain('role="alert"');
    expect(html).toContain("Create account is unavailable");
  });

  it("renders sign-in error state by default", async () => {
    const element = await LoginPage({
      searchParams: Promise.resolve({
        error: encodeURIComponent("Invalid login credentials"),
      }),
    });

    const html = renderToStaticMarkup(element);

    expect(html).toContain("Sign-in failed");
    expect(html).toContain("Invalid login credentials");
    expect(html).toContain('role="alert"');
  });

  it("renders auth config error messaging", async () => {
    const element = await LoginPage({
      searchParams: Promise.resolve({
        error: "auth-config-missing",
      }),
    });

    const html = renderToStaticMarkup(element);

    expect(html).toContain("Authentication is not configured");
    expect(html).toContain("Supabase auth keys are missing.");
  });

  it("shows error in signup card when mode=signup", async () => {
    const element = await LoginPage({
      searchParams: Promise.resolve({
        mode: "signup",
        error: encodeURIComponent("Email address already in use"),
      }),
    });

    const html = renderToStaticMarkup(element);

    expect(html).toContain("Email address already in use");
    expect(html).toContain("Create account");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Create account<\/button>/);
  });

  it("uses safe next path fallback for external values", async () => {
    const element = await LoginPage({
      searchParams: Promise.resolve({
        next: "https://example.com/not-allowed",
      }),
    });

    const html = renderToStaticMarkup(element);

    expect(html).toContain('value="/dashboard"');
  });

  it("uses provided internal next path", async () => {
    const element = await LoginPage({
      searchParams: Promise.resolve({
        next: "/Tours",
      }),
    });

    const html = renderToStaticMarkup(element);

    expect(html).toContain('value="/Tours"');
  });
});
