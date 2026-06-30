export { auth as default } from '@/lib/auth';

export const config = {
  matcher: [
    '/((?!api/webhook|_next/static|_next/image|favicon.ico|login).*)',
  ],
};
