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

  const companySlug = request.cookies.get('company_slug')?.value;

  // /[slug]/login  →  rota pública (login de empresa específica)
  const slugLoginMatch = pathname.match(/^\/([^\/]+)\/login$/);
  if (slugLoginMatch) {
    const segment = slugLoginMatch[1];
    if (!RESERVED_SEGMENTS.has(segment)) {
      // Já autenticado → vai para o dashboard daquela empresa (mantém slug)
      if (token) return NextResponse.redirect(new URL(`/${segment}/dashboard`, request.url));
      return NextResponse.next();
    }
  }

  // /[slug]/dashboard(/*) → rota protegida (rewrite no next.config aponta para /dashboard)
  const slugDashboardMatch = pathname.match(/^\/([^\/]+)\/dashboard(\/.*)?$/);
  if (slugDashboardMatch) {
    const segment = slugDashboardMatch[1];
    if (!RESERVED_SEGMENTS.has(segment)) {
      if (!token) return NextResponse.redirect(new URL('/login', request.url));
      return NextResponse.next();
    }
  }

  // /dashboard(/*) sem slug → redireciona para /{slug}/dashboard(/*) mantendo o slug visível.
  // O rewrite no next.config mapeia de volta para /dashboard internamente (sem duplicar paginas).
  if (token && companySlug && (pathname === '/dashboard' || pathname.startsWith('/dashboard/'))) {
    const target = request.nextUrl.clone();
    target.pathname = `/${companySlug}${pathname}`;
    return NextResponse.redirect(target);
  }

  const isPublicRoute =
    PUBLIC_ROUTES.includes(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (token && isPublicRoute) {
    // Login feito → dashboard com slug se disponível
    const dest = companySlug ? `/${companySlug}/dashboard` : DEFAULT_PRIVATE_ROUTE;
    return NextResponse.redirect(new URL(dest, request.url));
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
