import Link from "next/link";
import { Logo } from "@/components/branding/logo";

export function PublicFooter() {
  return (
    <footer className="mt-20 border-t border-border/60 bg-muted/22">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2.5 px-4 py-11 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex w-fit items-center rounded-md focus-visible:ring-2 focus-visible:ring-ring/60">
          <Logo variant="full" size="sm" className="brand-mark-default" aria-label="GigEze home" />
        </Link>
        <p className="text-sm font-semibold tracking-tight text-foreground">GigEze</p>
        <p className="max-w-prose text-sm leading-6 text-foreground/70">Shared from the road. Tracked with GigEze.</p>
        <p className="max-w-prose text-sm leading-6 text-foreground/70">Your Tour, remembered - without the paperwork.</p>
        <Link href="/login?mode=signup" className="pt-1 text-sm font-medium text-primary hover:text-primary/80 hover:underline">
          Start your Tour -&gt;
        </Link>
        <p className="pt-2 text-xs text-foreground/55">© {new Date().getFullYear()} GigEze. All rights reserved.</p>
      </div>
    </footer>
  );
}