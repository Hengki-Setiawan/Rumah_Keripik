import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = new Set([
  '/login',
  '/pesan',
  '/_not-found',
]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.has(pathname) || pathname.startsWith('/pesan/')) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    const headers = new Headers(req.headers);
    headers.set('x-request-id', crypto.randomUUID());
    return NextResponse.next({ request: { headers } });
  }

  if (pathname === '/') {
    return NextResponse.redirect(new URL('/pesan', req.nextUrl.origin));
  }

  const url = new URL('/login', req.nextUrl.origin);
  url.searchParams.set('callbackUrl', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
