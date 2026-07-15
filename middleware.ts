import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isDev = process.env.NODE_ENV !== 'production';

  // Tracing: Generate or pass request Correlation ID
  const requestId = req.headers.get('x-request-id') || crypto.randomUUID();

  // Structured Logging for API endpoints
  if (pathname.startsWith('/api/')) {
    console.log(JSON.stringify({
      level: 'info',
      message: `Incoming API Request: ${req.method} ${pathname}`,
      requestId,
      method: req.method,
      pathname,
      timestamp: new Date().toISOString(),
    }));
  }

  const isPublic =
    pathname === '/login' ||
    pathname === '/pesan' ||
    pathname.startsWith('/pesan/') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/api/webhook') ||
    pathname.startsWith('/api/payment/webhook') ||
    pathname.startsWith('/api/public') ||
    pathname === '/api/customer/session' ||
    pathname === '/api/chat' ||
    pathname.startsWith('/api/chat/') ||
    pathname === '/api/order/web' ||
    pathname === '/api/order/track' ||
    (isDev && pathname.startsWith('/api/debug')) ||
    pathname === '/_not-found';

  if (!req.auth && pathname === '/') {
    const response = NextResponse.redirect(new URL('/pesan', req.nextUrl.origin));
    response.headers.set('x-request-id', requestId);
    return response;
  }

  if (!req.auth && !isPublic) {
    const newUrl = new URL('/login', req.nextUrl.origin);
    newUrl.searchParams.set('callbackUrl', pathname);
    const response = NextResponse.redirect(newUrl);
    response.headers.set('x-request-id', requestId);
    return response;
  }

  // Clone headers and attach x-request-id
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-request-id', requestId);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Set response header for client correlation
  response.headers.set('x-request-id', requestId);
  return response;
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
