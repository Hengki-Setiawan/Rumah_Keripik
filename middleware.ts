import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export default auth(async (req) => {
  const { pathname } = req.nextUrl;

  const isPublicPage =
    pathname === '/login' ||
    pathname === '/pesan' ||
    pathname.startsWith('/pesan/') ||
    pathname === '/_not-found';

  if (!req.auth && pathname === '/') {
    return NextResponse.redirect(new URL('/pesan', req.nextUrl.origin));
  }

  if (!req.auth && !isPublicPage && !pathname.startsWith('/api/')) {
    const url = new URL('/login', req.nextUrl.origin);
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-request-id', crypto.randomUUID());

  return NextResponse.next({ request: { headers: requestHeaders } });
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
