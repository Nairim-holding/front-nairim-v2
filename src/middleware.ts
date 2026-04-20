import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_ROUTES = ['/', '/login', '/forgot-password', '/register'];
const PUBLIC_PREFIXES = ['/casas/', '/apartamentos/', '/comerciais/', '/imoveis/', '/backend'];
const DEFAULT_PRIVATE_ROUTE = '/dashboard';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get('authToken')?.value;
  const isPublicRoute =
    PUBLIC_ROUTES.includes(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));

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