import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { Poppins } from 'next/font/google';
import { PopupProvider } from "@/contexts/PopupContext";
import { MessageProvider } from "@/contexts/MessageContext";
import GlobalNotifications from "@/components/GlobalNotifications";
import { FilterProvider } from "./context";
import { ThemeProvider } from "@/contexts/ThemeContext";

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'], 
  variable: '--font-poppins',
  display: 'swap',
});


export const metadata: Metadata = {
  title: "Nairim Holding",
  description: "Empresa especializada na venda de imóveis, oferecendo soluções completas para quem deseja adquirir casas, apartamentos, terrenos e propriedades comerciais. Nosso compromisso é conectar clientes a empreendimentos de alto padrão, garantindo segurança, transparência e excelência em cada negociação.",
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
  },
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeBootstrapScript = `(function(){try{var saved=localStorage.getItem('nairim.theme');var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var dark=saved==='dark'||(!saved&&prefersDark);if(dark){document.body.classList.add('dark');}else{document.body.classList.remove('dark');}}catch(e){}})();`;

  return (
    <html lang="pt-br">
      <body
        suppressHydrationWarning
        className={`antialiased ${poppins.variable}  ${poppins.className}`}
      >
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        <ThemeProvider>
          <AuthProvider>
            <PopupProvider>
              <MessageProvider>
                <FilterProvider>
                {children}
                </FilterProvider>
                <GlobalNotifications />
              </MessageProvider>
            </PopupProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
