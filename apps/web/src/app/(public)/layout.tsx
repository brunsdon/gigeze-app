import { PublicNav } from "@/components/layout/public-nav";
import { PublicFooter } from "@/components/layout/public-footer";
import { getCurrentUser } from "@/lib/auth/workspace";

export const dynamic = "force-dynamic";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#public-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-md"
      >
        Skip to main content
      </a>
      <PublicNav user={user ? { fullName: user.fullName, email: user.email } : null} />
      <div className="border-b border-border/55 bg-card/45">
        <p className="mx-auto w-full max-w-6xl px-4 py-2 text-xs text-foreground/60 sm:px-6 lg:px-8">
          Shared from the road. Tracked with GigEze.
        </p>
      </div>
      <main id="public-main-content" className="animate-page-enter mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
