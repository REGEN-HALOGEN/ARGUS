import { type NextRequest, NextResponse } from 'next/server';

// ─── Better Auth Session Cookie ─────────────────────────────────
// Better Auth stores sessions in a cookie with this name.
const SESSION_COOKIE = 'better-auth.session_token';

// ─── Route Classifications ──────────────────────────────────────

/** Routes that never require authentication */
const PUBLIC_PREFIXES = ['/login', '/register', '/onboarding'];

/** Routes that need a valid session */
const PROTECTED_PREFIXES = ['/dashboard', '/admin', '/graph', '/analyst', '/cve', '/threats', '/settings'];

/** Routes restricted to super_admin (checked via API call) */
const ADMIN_PREFIXES = ['/admin'];

function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isAdminPath(pathname: string): boolean {
  return ADMIN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// ─── Helper: Verify Session via API ─────────────────────────────

type MeResponse = {
  success: boolean;
  data?: {
    user: { id: string; role?: string };
    platformRole: string | null;
    activeOrganizationId: string | null;
  };
};

async function verifySession(request: NextRequest): Promise<MeResponse['data'] | null> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

  try {
    // Forward the cookies from the incoming request to the API
    const cookieHeader = request.headers.get('cookie') ?? '';

    const res = await fetch(`${apiBase}/me`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
      signal: AbortSignal.timeout(3000), // 3 second timeout
    });

    if (!res.ok) return null;

    const json: MeResponse = await res.json();
    return json.success ? (json.data ?? null) : null;
  } catch {
    // If the API is down or times out, fall back to cookie-only check
    return null;
  }
}

// ─── Middleware ──────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = !!request.cookies.get(SESSION_COOKIE)?.value;

  // ── Public routes ──────────────────────────────────────────────
  // If already authenticated and trying to access login/register, redirect to dashboard
  if (hasSessionCookie && (pathname === '/login' || pathname === '/register')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Public routes don't need any further checks
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // ── Protected routes ───────────────────────────────────────────
  // No session cookie → immediately redirect to login
  if (!hasSessionCookie && isProtectedPath(pathname)) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Admin routes ───────────────────────────────────────────────
  // For admin routes, verify the session AND check the platform role via API.
  // If verification fails (API timeout/error), let client-side guards handle it
  // to avoid redirect loops. Only redirect when we positively know user isn't admin.
  if (isAdminPath(pathname) && hasSessionCookie) {
    const session = await verifySession(request);

    if (session && session.platformRole !== 'super_admin') {
      // Positively confirmed: user is authenticated but NOT an admin
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // If session is null (API unreachable/timeout), let the request through.
    // The client-side admin page guard will handle the role check.
  }

  return NextResponse.next();
}

// ─── Matcher ─────────────────────────────────────────────────────
// Run middleware on all routes except API, static assets, and Next.js internals
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
