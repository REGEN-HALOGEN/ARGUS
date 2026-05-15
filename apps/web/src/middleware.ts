import { type NextRequest, NextResponse } from 'next/server';

// ─── Route Classifications ──────────────────────────────────────

/** Routes that never require authentication */
const PUBLIC_PREFIXES = ['/login', '/register', '/onboarding'];

function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// ─── Middleware ──────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // In a hybrid deployment (Vercel + Railway), the Vercel edge middleware 
  // cannot see the Railway session cookies (SameSite=None). 
  // We let the request through and allow the client-side Auth guards 
  // (which have access to the cookies via the browser) to handle 
  // the session checks and redirects.
  
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Allow protected routes to load; client-side hooks like useSession() 
  // will handle redirection if the user is not authenticated.
  return NextResponse.next();
}

// ─── Matcher ─────────────────────────────────────────────────────
// Run middleware on all routes except API, static assets, and Next.js internals
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
