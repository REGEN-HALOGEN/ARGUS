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

  // In a hybrid deployment (Vercel + Railway), the Vercel edge middleware 
  // cannot see the Railway session cookies. 
  // We let the request through and allow the client-side Auth guards 
  // to handle the session check and redirects.
  
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

// ─── Matcher ─────────────────────────────────────────────────────
// Run middleware on all routes except API, static assets, and Next.js internals
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
