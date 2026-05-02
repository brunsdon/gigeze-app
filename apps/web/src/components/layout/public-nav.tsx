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
  { href: "/Tours", label: "Tours" },
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
    <header className="sticky top-0 z-30 border-b border-border bg-background/88 shadow-[0_4px_16px_rgba(36,48,40,0.04)] backdrop-blur-md supports-backdrop-filter:bg-background/80">
      <div className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3 font-semibold tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background">
          <Logo variant="full" size="md" className="brand-mark-muted h-[2.35rem] transition-[opacity,transform] duration-200 hover:opacity-92 hover:translate-y-[-1px] sm:h-[2.65rem]" aria-label="GigEze home" />
          <span className="hidden rounded-full border border-border/70 bg-muted/40 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground lg:inline-flex">
            public community
          </span>
        </Link>
        <nav aria-label="Primary public navigation" className="hidden items-center gap-2.5 text-sm text-muted-foreground md:flex">
          {links.map((link) => {
            const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3.5 py-2 transition-[background-color,color,box-shadow,border-color,opacity,transform] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  isActive
                    ? "border border-border bg-card text-foreground shadow-[0_6px_14px_rgba(36,48,40,0.04)]"
                    : "hover:-translate-y-[1px] hover:bg-muted hover:text-foreground",
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
                    className="inline-flex h-10 max-w-40 cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground transition-[background-color,box-shadow] duration-200 hover:bg-muted hover:shadow-[0_6px_14px_rgba(36,48,40,0.05)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    aria-label="Open user menu"
                  />
                }
              >
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary/14 px-1 text-[11px] font-semibold text-primary">
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
            <span className="hidden sm:inline">Continue your Tour</span>
          </Link>
        )}
      </div>
    </header>
  );
}

