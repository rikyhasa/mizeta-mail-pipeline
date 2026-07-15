import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login"];

/**
 * Optimistic, cookie-presence-only check. This is NOT the authoritative auth check —
 * that always happens in requireUser()/requireUserOrRedirect() (src/lib/auth/guard.ts),
 * which validates the session against the database.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname === path)) {
    return NextResponse.next();
  }

  const hasSessionCookie = request.cookies.has(
    process.env.SESSION_COOKIE_NAME || "mizeta_session",
  );

  if (!hasSessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
