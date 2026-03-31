import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_ROUTES = ['/', '/login', '/forgot-password', '/register'];
const DEFAULT_PRIVATE_ROUTE = '/dashboard';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get('authToken')?.value;
  const isPublicRoute =
    PUBLIC_ROUTES.includes(pathname) ||
    pathname.startsWith('/backend') ||
    pathname.startsWith('/backend-test');

  if (token && isPublicRoute) {
    return NextResponse.redirect(
      new URL(DEFAULT_PRIVATE_ROUTE, request.url)
    );
  }

  if (!token && !isPublicRoute) {
    return NextResponse.redirect(
      new URL('/login', request.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next|.*\\..*).*)',
  ],
};