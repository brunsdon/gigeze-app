import Link from "next/link";
import { CheckCircle2, Compass, Route } from "lucide-react";
import { Logo } from "@/components/branding/logo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ActionSubmitButton } from "@/components/forms/action-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction, signupAction } from "@/features/auth/actions";

function formatAuthError(errorParam?: string) {
  if (!errorParam) {
    return null;
  }

  if (errorParam === "auth-config-missing") {
    return {
      title: "Authentication is not configured",
      description: "Supabase auth keys are missing. Add the required environment variables and refresh this page.",
    };
  }

  return {
    title: "Sign-in failed",
    description: decodeURIComponent(errorParam),
  };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; mode?: string; error?: string }>;
}) {
  const { next, mode, error } = await searchParams;
  const nextPath = next?.startsWith("/") ? next : "/dashboard";
  const authError = formatAuthError(error);
  const isSignupMode = mode === "signup";

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-card/20">
      {/* Navigation Header */}
      <nav aria-label="Login page navigation" className="border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex cursor-pointer items-center rounded-lg px-2 py-1 transition-opacity duration-150 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <Logo variant="full" size="sm" className="brand-mark-muted h-6 sm:h-7" aria-label="GigEze home" />
          </Link>

          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-border/70 bg-card/60 px-3 py-2 text-xs font-medium text-foreground/80 transition-colors duration-150 hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 sm:text-sm"
          >
            <span aria-hidden="true">←</span>
            <span>Back to home</span>
          </Link>
        </div>
      </nav>

      {/* Main Content */}
        <main className="mx-auto flex min-h-[calc(100vh-69px)] max-w-4xl flex-col justify-center px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
          <div className="mb-16 flex flex-col gap-8 lg:gap-10">
            {/* Page Intro */}
            <div className="max-w-2xl">
              <h1 className="mb-2 text-4xl font-light tracking-tight text-foreground sm:text-5xl">
            Continue your Tour
          </h1>
              <p className="text-base leading-6 text-foreground/68 sm:text-lg sm:leading-7">
            Pick up where you left off and keep your routes, stories, and travel records connected.
          </p>
            </div>

        {/* Two-Column Layout: Sign In (Primary) + Create Account (Secondary) */}
          <div className="grid gap-7 lg:gap-8 lg:grid-cols-[1.2fr_1fr]">
          {/* Sign In Column - Primary */}
          <section className="flex flex-col">
              <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_8px_20px_rgba(36,48,40,0.06)] transition-all duration-300 sm:p-7">
                <div className="mb-5">
                  <h2 className="mb-1 text-3xl font-light tracking-tight text-foreground">Welcome back</h2>
                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-foreground/50">Sign in to your account</p>
                  <p className="text-sm leading-6 text-foreground/65">
                  Sign in to your account to resume tracking your Tour.
                </p>
                </div>

              {/* Sign In Form */}
                <form action={loginAction} className="space-y-4">
                <input type="hidden" name="next" value={nextPath} />

                {authError && !isSignupMode ? (
                    <Alert variant="destructive" className="border-destructive/25 bg-destructive/8 mb-4 text-sm">
                    <Route className="size-4" />
                    <AlertTitle>{authError.title}</AlertTitle>
                    <AlertDescription>{authError.description}</AlertDescription>
                  </Alert>
                ) : null}

                  <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">
                    Email address
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    required
                      className="h-11 rounded-lg border-border bg-background transition-all duration-150 focus-visible:ring-4 focus-visible:ring-primary/25"
                  />
                  </div>

                  <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">
                    Password
                  </Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    required
                      className="h-11 rounded-lg border-border bg-background transition-all duration-150 focus-visible:ring-4 focus-visible:ring-primary/25"
                  />
                  </div>

                  <ActionSubmitButton
                  label="Sign in"
                  pendingLabel="Signing in..."
                  className="h-11 w-full rounded-lg text-base font-medium"
                />
                </form>

              {/* Trust Indicators */}
                <div className="mt-5 space-y-2 rounded-lg border border-border/40 bg-muted/25 p-3">
                <p className="inline-flex items-center gap-2 text-sm text-foreground/80">
                  <CheckCircle2 className="size-4 text-primary flex-shrink-0" />
                  <span>Track Tours and driving logs</span>
                </p>
                <p className="inline-flex items-center gap-2 text-sm text-foreground/80">
                  <CheckCircle2 className="size-4 text-primary flex-shrink-0" />
                  <span>Document media and photos</span>
                </p>
                <p className="inline-flex items-center gap-2 text-sm text-foreground/80">
                  <CheckCircle2 className="size-4 text-primary flex-shrink-0" />
                  <span>Share stories with the community</span>
                </p>
                </div>

                <p className="mt-3 text-center text-xs text-foreground/55">
                Your data is private and encrypted.
              </p>
              </div>
            </section>

          {/* Create Account Column - Secondary */}
          <section className="flex flex-col">
              <div className="rounded-2xl border border-border/60 bg-card/55 p-5 backdrop-blur-sm transition-all duration-300 sm:p-7">
                <div className="mb-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground/45">New here?</p>
                  <h2 className="mb-1 text-2xl font-light text-foreground">Create account</h2>
                  <p className="text-sm leading-6 text-foreground/65">
                  Account creation is temporarily disabled while we prepare for public launch.
                </p>
                </div>

              {/* Create Account Form */}
                <form action={signupAction} className="space-y-3">
                <input type="hidden" name="next" value={nextPath} />

                {authError && isSignupMode ? (
                    <Alert variant="destructive" className="border-destructive/25 bg-destructive/8 mb-4 text-sm">
                    <Compass className="size-4" />
                    <AlertTitle>{authError.title}</AlertTitle>
                    <AlertDescription>{authError.description}</AlertDescription>
                  </Alert>
                ) : null}

                <Alert className="border-primary/25 bg-primary/8 mb-4 text-sm">
                  <Compass className="size-4" />
                  <AlertTitle>Create account is unavailable</AlertTitle>
                  <AlertDescription>This site will be launched to the public soon.</AlertDescription>
                </Alert>

                  <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-sm font-medium">
                    Full name
                  </Label>
                  <Input
                    id="fullName"
                    name="fullName"
                    type="text"
                    placeholder="Your name"
                    disabled
                      className="h-11 rounded-lg border-border bg-background transition-all duration-150 focus-visible:ring-4 focus-visible:ring-primary/25"
                  />
                  </div>

                  <div className="space-y-2">
                  <Label htmlFor="signupEmail" className="text-sm font-medium">
                    Email address
                  </Label>
                  <Input
                    id="signupEmail"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    disabled
                      className="h-11 rounded-lg border-border bg-background transition-all duration-150 focus-visible:ring-4 focus-visible:ring-primary/25"
                  />
                  </div>

                  <div className="space-y-2">
                  <Label htmlFor="signupPassword" className="text-sm font-medium">
                    Password
                  </Label>
                  <Input
                    id="signupPassword"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    required
                    disabled
                      className="h-11 rounded-lg border-border bg-background transition-all duration-150 focus-visible:ring-4 focus-visible:ring-primary/25"
                  />
                  </div>

                  <ActionSubmitButton
                  label="Create account"
                  pendingLabel="Creating..."
                  variant={isSignupMode ? "default" : "outline"}
                    disabled
                  className="h-11 w-full rounded-lg text-base font-medium"
                />
                </form>

                <p className="mt-3 text-center text-xs text-foreground/55">
                Free account • No credit card required
              </p>
              </div>
            </section>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="mt-12 flex flex-col items-center gap-4 border-t border-border/40 pt-8 lg:mt-16">
          <p className="text-center text-sm text-foreground/68">
            First time here?{" "}
            <Link
              href="/Tours"
              className="font-medium text-primary transition-colors duration-200 hover:text-primary/85"
            >
              Explore public Tours
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
