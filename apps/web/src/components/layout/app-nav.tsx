import Link from "next/link";
import { Car, Home, Image as ImageIcon, LogOut, NotebookPen, Route, Settings, Share2, Truck, Wrench } from "lucide-react";
import { logoutAction } from "@/features/auth/actions";
import { Logo } from "@/components/branding/logo";
import { Button } from "@/components/ui/button";
import { getCurrentUser, getCurrentWorkspaceForUser } from "@/lib/auth/workspace";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";

const links = [
  { href: "/dashboard", label: "Tour Home", icon: Home },
  { href: "/dashboard/Tours", label: "My Tours", icon: Route },
  { href: "/dashboard/logs/driving", label: "Trip Logs", icon: Truck },
  { href: "/dashboard/vehicles", label: "Vehicles", icon: Car },
  { href: "/dashboard/activity", label: "Activity", icon: Wrench },
  { href: "/dashboard/media", label: "Moments", icon: ImageIcon },
  { href: "/dashboard/posts", label: "Stories", icon: NotebookPen },
  { href: "/dashboard/sharing", label: "Tour Circle", icon: Share2 },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

const mobileQuickLinks = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/dashboard/Tours", label: "Tours", icon: Route },
  { href: "/dashboard/logs/driving", label: "Trips", icon: Truck },
  { href: "/dashboard/vehicles", label: "Vehicles", icon: Car },
  { href: "/dashboard/media", label: "Moments", icon: ImageIcon },
];

export async function AppNav() {
  const user = await getCurrentUser();
  const workspace = user ? await getCurrentWorkspaceForUser(user.id) : null;

  return (
    <>
      <aside className="w-full border-b border-border/80 bg-card/92 px-4 py-3 shadow-[0_1px_2px_rgba(43,42,40,0.05)] md:w-64 md:border-r md:border-b-0 md:px-3 md:py-6">
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
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Workspace</p>
              {workspace ? <p className="truncate text-sm font-medium">{workspace.name}</p> : null}
            </div>
            <form action={logoutAction}>
              <Button type="submit" variant="outline" className="h-10 px-3">
                <LogOut className="mr-1.5 h-4 w-4" />
                Sign out
              </Button>
            </form>
          </div>

          <nav aria-label="Quick dashboard routes" className="grid grid-cols-2 gap-2">
            {mobileQuickLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-label={link.label}
                  className="inline-flex min-h-11 items-center rounded-xl border border-border/80 px-3 text-sm font-medium text-foreground/90 transition-[background-color,color,transform,box-shadow] duration-150 hover:bg-muted/65 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/45 active:translate-y-px"
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>
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

          <div className="mb-4 px-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Workspace</p>
            {workspace ? <p className="mt-0.5 truncate text-sm font-medium">{workspace.name}</p> : null}
          </div>

          <nav aria-label="Dashboard routes" className="grid gap-1">
            {links.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-label={link.label}
                  className="inline-flex items-center rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-[background-color,color,transform] duration-150 hover:bg-muted/65 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/45 active:translate-y-px"
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>

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
