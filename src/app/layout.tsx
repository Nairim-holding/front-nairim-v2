import type { Metadata } from 'next';
import './globals.css';
import localFont from 'next/font/local';
import { AppProviders } from './providers';
import GlobalNotifications from '@/components/feedback/Notifications';
import { cookies } from 'next/headers';
import { fetchBranding } from '@/lib/fetchBranding';
import { buildBrandingCss } from '@/lib/brandingCss';

const poppins = localFont({
  src: [
    { path: './fonts/poppins-400.woff2', weight: '400' },
    { path: './fonts/poppins-500.woff2', weight: '500' },
    { path: './fonts/poppins-600.woff2', weight: '600' },
    { path: './fonts/poppins-700.woff2', weight: '700' },
    { path: './fonts/poppins-800.woff2', weight: '800' },
    { path: './fonts/poppins-900.woff2', weight: '900' },
  ],
  variable: '--font-poppins',
  display: 'swap',
});

const COMPANY_SLUG = 'nairim';
const FALLBACK_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME ?? 'Sistema';

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const slugFromCookie = cookieStore.get('company_slug')?.value;
  const branding = await fetchBranding(slugFromCookie ?? COMPANY_SLUG);
  const name = branding?.company_name ?? FALLBACK_NAME;
  const title = branding?.app_title ?? branding?.trade_name ?? name;
  const description = branding?.app_description ?? `Plataforma de gestão imobiliária — ${name}`;
  const customIcon = branding?.favicon_url;
  const ogImage = branding?.og_image_url;

  return {
    title,
    description,
    icons: customIcon
      ? {
          icon: customIcon,
          apple: customIcon,
        }
      : {
          icon: [
            { url: '/favicon-dark.svg', media: '(prefers-color-scheme: light)' },
            { url: '/favicon.svg', media: '(prefers-color-scheme: dark)' },
          ],
          apple: '/favicon-dark.svg',
        },
    manifest: '/manifest.json',
    openGraph: {
      title,
      description,
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
  };
}

const THEME_KEY = 'nairim';
const THEME_BOOTSTRAP_SCRIPT = `(function(){try{
  var saved=localStorage.getItem('${THEME_KEY}.theme');
  var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;
  if(saved==='dark'||(!saved&&prefersDark)){document.body.classList.add('dark');}
  else{document.body.classList.remove('dark');}
}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const slugFromCookie = cookieStore.get('company_slug')?.value;
  const branding = await fetchBranding(slugFromCookie ?? COMPANY_SLUG);
  const brandingCss = buildBrandingCss(branding);

  return (
    <html lang="pt-br">
      <body
        suppressHydrationWarning
        className={`antialiased ${poppins.variable} ${poppins.className}`}
      >
        {/* Tema claro/escuro antes da hidratação */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />

        {/* Overrides de brand colors — <style> dentro de <body> é aceito por browsers
            e evita conflito com o <head> gerenciado pelo Next.js */}
        {brandingCss && <style dangerouslySetInnerHTML={{ __html: brandingCss }} />}

        <AppProviders initialBranding={branding}>
          {children}
          <GlobalNotifications />
        </AppProviders>
      </body>
    </html>
  );
}
