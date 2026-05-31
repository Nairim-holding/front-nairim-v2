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

/**
 * Script inline executado antes da hidratação para evitar flash de tema.
 * Deve permanecer aqui pois precisa rodar no servidor antes do React hidratar.
 * A chave de localStorage usa a variável de ambiente para isolamento por empresa.
 */
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
      <head>
        {/* Injeta overrides de cores ANTES da hidratação para evitar FOUC de brand */}
        {brandingCss && <style dangerouslySetInnerHTML={{ __html: brandingCss }} />}
      </head>
      <body
        suppressHydrationWarning
        className={`antialiased ${poppins.variable} ${poppins.className}`}
      >
        {/* Injeta o tema claro/escuro antes da hidratação para evitar FOUC */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />

        <AppProviders initialBranding={branding}>
          {children}
          <GlobalNotifications />
        </AppProviders>
      </body>
    </html>
  );
}
