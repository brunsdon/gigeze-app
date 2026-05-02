import type { Metadata } from "next";
import { Suspense } from "react";
import { DebugPanel } from "@/components/layout/debug-panel";
import { RouteFeedbackToaster } from "@/components/layout/route-feedback-toaster";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "GigEze",
  description: "Travel platform for Tour tracking, logs, and public storytelling.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    title: "GigEze",
    description: "Tracking Tours across Australia.",
    images: [{ url: "/og-image.svg", width: 1200, height: 630, alt: "GigEze brand card" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <Suspense fallback={null}>
          <RouteFeedbackToaster />
        </Suspense>
        {children}
        <DebugPanel enabled={process.env.NEXT_PUBLIC_ENABLE_DEBUG_PANEL === "true"} />
        <Toaster richColors position="top-right" closeButton />
      </body>
    </html>
  );
}
