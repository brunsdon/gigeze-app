"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Image as ImageIcon, Route, Settings, Truck } from "lucide-react"
import { cn } from "@/lib/utils"

type MobileTabLink = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const mobileTabLinks: MobileTabLink[] = [
  { href: "/dashboard", label: "Backstage", icon: Home },
  { href: "/dashboard/Tours", label: "Tours", icon: Route },
  { href: "/dashboard/logs/driving", label: "Sync", icon: Truck },
  { href: "/dashboard/media", label: "Media", icon: ImageIcon },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
]

function isLinkActive(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/dashboard"
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

export function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Primary mobile navigation" className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#100C13]/96 shadow-[0_-18px_48px_rgba(0,0,0,0.38)] backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-2xl grid-cols-5">
        {mobileTabLinks.map((link) => {
          const Icon = link.icon
          const active = isLinkActive(pathname, link.href)

          return (
            <Link
              key={link.href}
              href={link.href}
              aria-label={link.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition-[background-color,color,transform,box-shadow] duration-150 focus-visible:ring-3 focus-visible:ring-ring/45 active:translate-y-px",
                active
                  ? "bg-primary/14 text-[#FFF7EA] shadow-[inset_0_2px_0_#FF2E63]"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
              )}
            >
              <Icon className={cn("h-4 w-4", active ? "text-[#FFB000]" : "text-muted-foreground")} />
              {link.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
