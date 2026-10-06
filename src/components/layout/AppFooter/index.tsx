'use client'

import { useState, useEffect } from "react";
import Link from "next/link";
import { useBranding } from "@/contexts/BrandingContext";

export default function Footer() {
  const [mounted, setMounted] = useState(false);
  const { companyName } = useBranding();
  const currentYear = new Date().getFullYear();

  // Garante que o componente só renderize as classes dinâmicas após a hidratação
  useEffect(() => {
    setMounted(true);
  }, []);

  // Enquanto não estiver montado, renderizamos uma versão "neutra" ou retornamos nulo
  // para evitar que o HTML do servidor divirja do primeiro render do cliente.
  if (!mounted) {
    return <footer className="bg-page border-t min-h-[400px]" />;
  }

  return (
    <footer id="rodape" className="relative border-t border-brand/20 bg-page overflow-hidden transition-colors duration-300">

      {/* Glow no canto, na cor de marca do tenant */}
      <div className="absolute bottom-0 right-0 w-[400px] md:w-[800px] h-[400px] md:h-[800px] bg-brand/[0.03] blur-[80px] md:blur-[150px] rounded-full pointer-events-none" />

      {/* Efeito de grid sutil */}
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: `linear-gradient(to right, var(--color-brand-primary) 1px, transparent 1px),
                          linear-gradient(to bottom, var(--color-brand-primary) 1px, transparent 1px)`,
        backgroundSize: '80px 80px'
      }} />

      <div className="relative max-w-[1800px] mx-auto px-6 md:px-20 pt-16 md:pt-32 pb-12 md:pb-16">
        
        {/* Grid Principal */}
        <div className="flex flex-col items-center text-center gap-10 md:gap-16 mb-16 md:mb-32">


          {/* Navegação */}
          <div className="space-y-6 md:space-y-10">
            <h4 className="text-[12px] md:text-[15px] text-brand-accent tracking-[0.3em] opacity-80 text-center">
              NAVEGAÇÃO
            </h4>
            <nav className="flex flex-row flex-wrap items-center justify-center gap-8 md:gap-12">
              {[
                { name: 'Ínicio', href: '/' },
                { name: 'Imóveis', href: '#imoveis' },
                { name: 'Sobre', href: '#rodape' }
              ].map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="group flex items-center gap-3 text-[13px] md:text-[14px] tracking-[0.1em] transition-all duration-500 font-medium text-content-muted hover:text-content"
                >
                  <span className="w-0 group-hover:w-6 md:group-hover:w-8 h-[1px] bg-brand transition-all duration-500" />
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>

        </div>


        {/* Base Legal */}
        <div className="pt-8 md:pt-12 border-t border-ui-border-soft flex flex-col items-center justify-center gap-6 md:gap-8 relative">
          <div className="hidden md:block absolute top-0 left-1/2 -translate-x-1/2 w-px h-8 bg-gradient-to-b from-brand/40 to-transparent" />

          <div>
            <p className="text-[11px] md:text-[12px] uppercase tracking-[0.2em] font-medium text-center text-content-muted">
              © {currentYear} {companyName}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}