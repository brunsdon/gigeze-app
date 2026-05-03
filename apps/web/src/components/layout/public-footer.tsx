import Link from "next/link";
import { Logo } from "@/components/branding/logo";

export function PublicFooter() {
  return (
    <footer className="mt-20 border-t border-white/10 bg-[#08070A]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2.5 px-4 py-11 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex w-fit items-center rounded-md focus-visible:ring-2 focus-visible:ring-ring/60">
          <Logo variant="full" size="sm" className="brand-mark-default" aria-label="GigEze home" />
        </Link>
        <p className="text-sm font-bold tracking-tight text-[#FFF7EA]">GigEze</p>
        <p className="max-w-prose text-sm leading-6 text-[#B8AFC0]">Public portfolio demo for backstage tour records, gigs, venues, media, and field activity.</p>
        <p className="max-w-prose text-sm leading-6 text-[#B8AFC0]">Not a finished SaaS product; built to show product direction and full-stack implementation judgment.</p>
        <Link href="/login?mode=signup" className="pt-1 text-sm font-bold text-[#FFB000] hover:text-[#00E5A8] hover:underline">
          Start your Tour -&gt;
        </Link>
        <p className="pt-2 text-xs text-[#B8AFC0]/70">© {new Date().getFullYear()} GigEze. All rights reserved.</p>
      </div>
    </footer>
  );
}
