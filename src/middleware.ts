import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_ROUTES = ['/', '/login', '/forgot-password', '/register'];
const PUBLIC_PREFIXES = ['/casas/', '/apartamentos/', '/comerciais/', '/imoveis/', '/backend', '/backend-test'];
const DEFAULT_PRIVATE_ROUTE = '/dashboard';

// Segmentos reservados que nunca são slugs de empresa
const RESERVED_SEGMENTS = new Set(['dashboard', 'api', '_next', 'login', 'forgot-password', 'register', 'static', 'casas', 'apartamentos', 'comerciais', 'imoveis']);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get('authToken')?.value;

  // /[slug]/login  →  rota pública (login de empresa específica)
  const slugLoginMatch = pathname.match(/^\/([^\/]+)\/login$/);
  if (slugLoginMatch) {
    const segment = slugLoginMatch[1];
    if (!RESERVED_SEGMENTS.has(segment)) {
      // Se já autenticado, vai para o dashboard
      if (token) return NextResponse.redirect(new URL(DEFAULT_PRIVATE_ROUTE, request.url));
      return NextResponse.next();
    }
  }

  const isPublicRoute =
    PUBLIC_ROUTES.includes(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (token && isPublicRoute) {
    return NextResponse.redirect(new URL(DEFAULT_PRIVATE_ROUTE, request.url));
  }

  if (!token && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next|.*\\..*).*)',
  ],
};
