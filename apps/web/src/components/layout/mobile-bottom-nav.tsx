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
  { href: "/dashboard", label: "Tour", icon: Home },
  { href: "/dashboard/Tours", label: "Tours", icon: Route },
  { href: "/dashboard/logs/driving", label: "Trips", icon: Truck },
  { href: "/dashboard/media", label: "Moments", icon: ImageIcon },
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
    <nav aria-label="Primary mobile navigation" className="fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-card/96 shadow-[0_-1px_2px_rgba(43,42,40,0.06)] backdrop-blur md:hidden">
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
                  ? "bg-primary/12 text-primary"
                  : "text-muted-foreground hover:bg-muted/55 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
