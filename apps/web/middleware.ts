import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/Tours" || pathname.startsWith("/Tours/")) {
    const url = request.nextUrl.clone();
    url.pathname = `/tours${pathname.slice("/Tours".length)}`;
    return NextResponse.redirect(url, 308);
  }

  if (pathname === "/dashboard/Tours" || pathname.startsWith("/dashboard/Tours/")) {
    const url = request.nextUrl.clone();
    url.pathname = `/dashboard/tours${pathname.slice("/dashboard/Tours".length)}`;
    return NextResponse.redirect(url, 308);
  }

  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
