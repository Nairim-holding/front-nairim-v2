import type { Metadata } from 'next';
import './globals.css';
import { Poppins } from 'next/font/google';
import { AppProviders } from './providers';
import GlobalNotifications from '@/components/feedback/Notifications';
import { fetchBranding } from '@/lib/fetchBranding';
import { buildBrandingCss } from '@/lib/brandingCss';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-poppins',
  display: 'swap',
});

const COMPANY_SLUG = process.env.NEXT_PUBLIC_COMPANY_SLUG;
const FALLBACK_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME ?? 'Sistema';

export async function generateMetadata(): Promise<Metadata> {
  const branding = await fetchBranding(COMPANY_SLUG);
  const name = branding?.company_name ?? FALLBACK_NAME;
  return {
    title: name,
    description: `Plataforma de gestão imobiliária — ${name}`,
    icons: {
      icon: branding?.favicon_url ?? '/favicon.svg',
      apple: branding?.favicon_url ?? '/favicon.svg',
    },
    manifest: '/manifest.json',
  };
}

const THEME_KEY = process.env.NEXT_PUBLIC_COMPANY_SLUG ?? 'app';
const THEME_BOOTSTRAP_SCRIPT = `(function(){try{
  var saved=localStorage.getItem('${THEME_KEY}.theme');
  var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;
  if(saved==='dark'||(!saved&&prefersDark)){document.body.classList.add('dark');}
  else{document.body.classList.remove('dark');}
}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const branding = await fetchBranding(COMPANY_SLUG);
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
