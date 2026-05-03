import Link from "next/link";
import { Logo } from "@/components/branding/logo";

export function PublicFooter() {
  return (
    <footer className="relative mt-20 overflow-hidden border-t border-white/10 bg-[#08070A]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FF2E63]/50 to-transparent" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_0%,rgba(255,46,99,0.12),transparent_28%),radial-gradient(circle_at_86%_18%,rgba(255,176,0,0.09),transparent_26%),linear-gradient(180deg,#100C13,#08070A_62%)]" />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="inline-flex w-fit items-center rounded-md focus-visible:ring-2 focus-visible:ring-ring/60">
            <Logo variant="full" size="sm" className="brand-mark-default" aria-label="GigEze home" />
          </Link>
          <Link href="/login?mode=signup" className="text-sm font-black tracking-[0.12em] text-[#FFB000] uppercase hover:text-[#00E5A8] hover:underline">
            Start your Tour -&gt;
          </Link>
        </div>
        <div className="max-w-3xl space-y-2">
          <p className="text-xs font-black tracking-[0.24em] text-[#00E5A8] uppercase">Portfolio demo</p>
          <p className="text-sm leading-6 text-[#FFF7EA]">GigEze presents backstage tour records, gigs, venues, media, and field activity as a focused product direction.</p>
          <p className="text-sm leading-6 text-[#B8AFC0]">Not a finished SaaS product; built to show product direction and full-stack implementation judgment.</p>
        </div>
        <p className="pt-2 text-xs text-[#B8AFC0]/70">© {new Date().getFullYear()} GigEze. All rights reserved.</p>
      </div>
    </footer>
  );
}
