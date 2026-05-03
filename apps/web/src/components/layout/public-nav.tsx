"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LogOut, Route, Settings } from "lucide-react";
import { Logo } from "@/components/branding/logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buttonVariants } from "@/components/ui/button-variants";
import { logoutAction } from "@/features/auth/actions";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Discover" },
  { href: "/tours", label: "Tours" },
  { href: "/map", label: "Map" },
  { href: "/gallery", label: "Gallery" },
  { href: "/posts", label: "Posts" },
];

type PublicNavUser = {
  fullName: string | null;
  email: string;
};

type PublicNavProps = {
  user: PublicNavUser | null;
};

function getDisplayName(user: PublicNavUser) {
  return user.fullName?.trim() || user.email;
}

function getInitials(value: string) {
  const parts = value
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) {
    return "U";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export function PublicNav({ user }: PublicNavProps) {
  const pathname = usePathname();
  const displayName = user ? getDisplayName(user) : null;
  const initials = displayName ? getInitials(displayName) : null;

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#08070A]/92 shadow-[0_10px_28px_rgba(0,0,0,0.42)] backdrop-blur-md supports-backdrop-filter:bg-[#08070A]/85">
      <div className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3 font-semibold tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background">
          <Logo variant="full" size="md" className="brand-mark-muted h-[2.35rem] transition-[opacity,transform] duration-200 hover:opacity-92 hover:translate-y-[-1px] sm:h-[2.65rem]" aria-label="GigEze home" />
          <span className="hidden rounded-full border border-[#FF2E63]/45 bg-[#FF2E63]/12 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#FF2E63] lg:inline-flex">
            BACKSTAGE PASS
          </span>
        </Link>
        <nav aria-label="Primary public navigation" className="hidden items-center gap-2.5 text-sm text-[#B8AFC0] md:flex">
          {links.map((link) => {
            const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3.5 py-2 font-semibold transition-[background-color,color,box-shadow,border-color,opacity,transform] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  isActive
                    ? "border border-[#FF2E63]/45 bg-[#FF2E63]/12 text-[#FFF7EA] shadow-[0_8px_22px_rgba(255,46,99,0.18)]"
                    : "hover:-translate-y-[1px] hover:bg-white/[0.06] hover:text-[#FFF7EA]",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        {user ? (
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className={buttonVariants({ size: "sm" })} aria-label="Open dashboard">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Dashboard
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className="inline-flex h-10 max-w-40 cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground transition-[background-color,box-shadow] duration-200 hover:bg-muted hover:shadow-[0_10px_24px_rgba(0,0,0,0.32)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    aria-label="Open user menu"
                  />
                }
              >
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary/18 px-1 text-[11px] font-semibold text-primary">
                  {initials}
                </span>
                <span className="truncate">{displayName}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="truncate">{displayName}</DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem render={<Link href="/dashboard" />}>
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link href="/dashboard/settings" />}>
                  <Settings className="h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <form action={logoutAction}>
                  <DropdownMenuItem nativeButton render={<button type="submit" className="w-full" />} variant="destructive">
                    <LogOut className="h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <Link href="/login" className={buttonVariants({ size: "sm" })} aria-label="Login to admin dashboard">
            <Route className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Open Backstage</span>
          </Link>
        )}
      </div>
    </header>
  );
}

