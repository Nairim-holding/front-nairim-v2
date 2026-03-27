import type { Metadata } from 'next';
import './globals.css';
import { Poppins } from 'next/font/google';
import { AppProviders } from './providers';
import GlobalNotifications from '@/components/feedback/Notifications';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-poppins',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Nairim Holding',
  description:
    'Empresa especializada na venda de imóveis, oferecendo soluções completas para quem deseja adquirir casas, apartamentos, terrenos e propriedades comerciais. Nosso compromisso é conectar clientes a empreendimentos de alto padrão, garantindo segurança, transparência e excelência em cada negociação.',
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
  manifest: '/manifest.json',
};

/**
 * Script inline executado antes da hidratação para evitar flash de tema.
 * Deve permanecer aqui pois precisa rodar no servidor antes do React hidratar.
 */
const THEME_BOOTSTRAP_SCRIPT = `(function(){try{
  var saved=localStorage.getItem('nairim.theme');
  var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;
  if(saved==='dark'||(!saved&&prefersDark)){document.body.classList.add('dark');}
  else{document.body.classList.remove('dark');}
}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-br">
      <body
        suppressHydrationWarning
        className={`antialiased ${poppins.variable} ${poppins.className}`}
      >
        {/* Injeta o tema antes da hidratação para evitar FOUC */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />

        <AppProviders>
          {children}
          <GlobalNotifications />
        </AppProviders>
      </body>
    </html>
  );
}
