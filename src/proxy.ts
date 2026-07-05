import { auth } from '@/lib/auth';

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isDev = process.env.NODE_ENV !== 'production';

  const isPublic =
    pathname === '/login' ||
    pathname === '/pesan' ||
    pathname.startsWith('/pesan/') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/api/webhook') ||
    pathname.startsWith('/api/public') ||
    pathname === '/api/order/web' ||
    (isDev && pathname.startsWith('/api/debug')) ||
    pathname === '/_not-found';

  if (!req.auth && !isPublic) {
    const newUrl = new URL('/login', req.nextUrl.origin);
    newUrl.searchParams.set('callbackUrl', pathname);
    return Response.redirect(newUrl);
  }
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
