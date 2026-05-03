import Link from "next/link";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/features/auth/actions";
import { Logo } from "@/components/branding/logo";
import { Button } from "@/components/ui/button";
import { getCurrentUser, getCurrentWorkspaceForUser } from "@/lib/auth/workspace";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { AppNavLinks } from "@/components/layout/app-nav-links";

export async function AppNav() {
  const user = await getCurrentUser();
  const workspace = user ? await getCurrentWorkspaceForUser(user.id) : null;

  return (
    <>
      <aside className="relative w-full border-b border-white/10 bg-[#100C13]/96 px-4 py-3 shadow-[0_18px_54px_rgba(0,0,0,0.32)] backdrop-blur md:sticky md:top-0 md:h-screen md:w-68 md:border-r md:border-b-0 md:px-3 md:py-6">
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 hidden w-px bg-gradient-to-b from-transparent via-[#FF2E63]/45 to-transparent md:block" />
        <div className="md:hidden">
          <Link
            href="/"
            className="brand-mark-muted mb-3 inline-flex items-center gap-2 rounded-xl px-1 py-1 transition-opacity hover:opacity-88 focus-visible:ring-2 focus-visible:ring-ring/65"
            aria-label="Go to public home"
          >
            <Logo variant="icon" size="sm" className="h-7.5 w-7.5" aria-label="GigEze" />
            <span className="text-[0.92rem] font-semibold tracking-tight">GigEze</span>
          </Link>

          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#FFB000]">Backstage pass</p>
              {workspace ? <p className="truncate text-sm font-semibold text-foreground">{workspace.name}</p> : null}
            </div>
            <form action={logoutAction}>
              <Button type="submit" variant="outline" className="h-10 px-3">
                <LogOut className="mr-1.5 h-4 w-4" />
                Sign out
              </Button>
            </form>
          </div>

          <AppNavLinks mobile />
        </div>

        <div className="hidden md:block">
          <Link
            href="/"
            className="brand-mark-muted mb-5 inline-flex items-center gap-2 rounded-xl px-2 py-1 transition-opacity hover:opacity-88 focus-visible:ring-2 focus-visible:ring-ring/65"
            aria-label="Go to public home"
          >
            <Logo variant="icon" size="sm" className="h-8 w-8" aria-label="GigEze" />
            <span className="text-sm font-semibold tracking-tight">GigEze</span>
          </Link>

          <div className="mb-5 rounded-xl border border-white/10 bg-[#1E1724]/70 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <p className="text-[0.68rem] font-black uppercase tracking-[0.24em] text-[#FFB000]">Backstage pass</p>
            {workspace ? <p className="mt-1 truncate text-sm font-semibold text-foreground">{workspace.name}</p> : null}
            <p className="mt-1 text-xs text-muted-foreground">Tour operations command centre</p>
          </div>

          <AppNavLinks />

          <form action={logoutAction} className="mt-6 px-2">
            <Button type="submit" variant="outline" className="w-full justify-start">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </form>
        </div>
      </aside>

      <MobileBottomNav />
    </>
  );
}
