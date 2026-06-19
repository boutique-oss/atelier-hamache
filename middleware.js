import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_NAME = 'atelier_session';

function secret() {
  return new TextEncoder().encode(process.env.SESSION_SECRET || 'fallback-secret-change-me');
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === '/login';
  const isApiAuth   = pathname.startsWith('/api/auth/');
  const isApiRoute  = pathname.startsWith('/api/');

  // Route de maintenance temporaire, protégée par son propre token secret
  if (pathname === '/api/restore-data') return NextResponse.next();

  const token = request.cookies.get(COOKIE_NAME)?.value;
  let authenticated = false;
  if (token) {
    try { await jwtVerify(token, secret()); authenticated = true; } catch {}
  }

  if (!authenticated && !isLoginPage && !isApiAuth) {
    if (isApiRoute) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    return NextResponse.redirect(new URL('/login', request.url));
  }
  if (authenticated && isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
