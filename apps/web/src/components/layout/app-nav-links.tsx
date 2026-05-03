"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Car, Home, Image as ImageIcon, NotebookPen, Route, Settings, Share2, Truck, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Backstage", icon: Home },
  { href: "/dashboard/Tours", label: "Tours", icon: Route },
  { href: "/dashboard/logs/driving", label: "Trip Sync", icon: Truck },
  { href: "/dashboard/vehicles", label: "Vehicles", icon: Car },
  { href: "/dashboard/activity", label: "Activity Notes", icon: Wrench },
  { href: "/dashboard/media", label: "Media", icon: ImageIcon },
  { href: "/dashboard/posts", label: "Stories", icon: NotebookPen },
  { href: "/dashboard/sharing", label: "Backstage Passes", icon: Share2 },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

const mobileQuickLinks = [
  { href: "/dashboard", label: "Backstage", icon: Home },
  { href: "/dashboard/Tours", label: "Tours", icon: Route },
  { href: "/dashboard/logs/driving", label: "Sync", icon: Truck },
  { href: "/dashboard/activity", label: "Notes", icon: Wrench },
  { href: "/dashboard/media", label: "Media", icon: ImageIcon },
];

function isLinkActive(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

type AppNavLinksProps = {
  mobile?: boolean;
};

export function AppNavLinks({ mobile = false }: AppNavLinksProps) {
  const pathname = usePathname();
  const navLinks = mobile ? mobileQuickLinks : links;

  return (
    <nav aria-label={mobile ? "Quick dashboard routes" : "Dashboard routes"} className={mobile ? "grid grid-cols-2 gap-2" : "grid gap-1"}>
      {navLinks.map((link) => {
        const Icon = link.icon;
        const active = isLinkActive(pathname, link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-label={link.label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group/nav relative inline-flex items-center rounded-xl text-sm transition-[background-color,color,transform,box-shadow,border-color] duration-150 focus-visible:ring-3 focus-visible:ring-ring/45 active:translate-y-px",
              mobile
                ? "min-h-11 border px-3 font-semibold"
                : "px-3 py-2.5",
              active
                ? "border-primary/45 bg-primary/14 text-foreground shadow-[0_0_24px_rgba(255,46,99,0.12),inset_3px_0_0_#FF2E63]"
                : "border-transparent text-muted-foreground hover:bg-muted/70 hover:text-foreground hover:shadow-[0_8px_22px_rgba(0,0,0,0.22)]",
            )}
          >
            <Icon className={cn("mr-2 h-4 w-4", active ? "text-[#FFB000]" : "text-muted-foreground group-hover/nav:text-[#00E5A8]")} />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
