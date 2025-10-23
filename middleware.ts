import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export default auth((req) => {
  if (!req.auth?.user && req.nextUrl.pathname.startsWith('/admin')) {
    const signInUrl = new URL('/auth/login', req.nextUrl.origin);
    signInUrl.searchParams.set('callbackUrl', req.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/admin/:path*']
};
