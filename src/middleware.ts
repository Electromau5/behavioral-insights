import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isAuthPage = req.nextUrl.pathname.startsWith('/login') || 
                     req.nextUrl.pathname.startsWith('/register');
  const isProtectedRoute = req.nextUrl.pathname.startsWith('/dashboard') || 
                           req.nextUrl.pathname.startsWith('/flows');
  const isApiRoute = req.nextUrl.pathname.startsWith('/api');
  const isPublicApiRoute = req.nextUrl.pathname.startsWith('/api/collect') ||
                           req.nextUrl.pathname.startsWith('/api/auth');

  // Allow public API routes
  if (isApiRoute && isPublicApiRoute) {
    return NextResponse.next();
  }

  // Protect API routes
  if (isApiRoute && !isPublicApiRoute && !isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Redirect logged-in users away from auth pages
  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // Redirect unauthenticated users to login
  if (isProtectedRoute && !isLoggedIn) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|tracker.js|.*\\.png$|.*\\.svg$).*)',
  ],
};
