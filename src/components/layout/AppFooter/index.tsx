'use client'

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { useTheme } from "@/contexts/ThemeContext";

export default function Footer() {
  const [mounted, setMounted] = useState(false);
  const { isDark } = useTheme();
  const currentYear = new Date().getFullYear();

  // Garante que o componente só renderize as classes dinâmicas após a hidratação
  useEffect(() => {
    setMounted(true);
  }, []);

  // Enquanto não estiver montado, renderizamos uma versão "neutra" ou retornamos nulo
  // para evitar que o HTML do servidor divirja do primeiro render do cliente.
  if (!mounted) {
    return <footer className="bg-gray-50 border-t min-h-[400px]" />; 
  }

  return (
    <footer id="rodape" className={`relative border-t overflow-hidden transition-colors duration-300 ${isDark ? "bg-[#0A0A0A] border-purple-900/20" : "bg-gray-50 border-purple-200/40"}`}>

      {/* Glow roxo no canto */}
      <div className="absolute bottom-0 right-0 w-[400px] md:w-[800px] h-[400px] md:h-[800px] bg-purple-900/[0.03] blur-[80px] md:blur-[150px] rounded-full pointer-events-none" />

      {/* Efeito de grid sutil */}
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: `linear-gradient(to right, #8B5CF6 1px, transparent 1px),
                          linear-gradient(to bottom, #8B5CF6 1px, transparent 1px)`,
        backgroundSize: '80px 80px'
      }} />

      <div className="relative max-w-[1800px] mx-auto px-6 md:px-20 pt-16 md:pt-32 pb-12 md:pb-16">
        
        {/* Grid Principal */}
        <div className="grid gap-12 md:gap-16 md:grid-cols-4 xl:grid-cols-12 mb-16 md:mb-32 items-start">

          {/* Logo e Descrição */}
          <div className="md:col-span-6 space-y-6 flex flex-col justify-center items-center lg:justify-start lg:items-start md:space-y-10">
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 1.5 }}
              viewport={{ once: true }}
              className="flex justify-center md:justify-start"
            >
              <div className="relative">
                <div className="text-3xl md:text-4xl font-bold tracking-tight">
                  <Image 
                    src="/logo.svg" 
                    alt="Logo da Nairim Holding" 
                    width={150} 
                    height={50} 
                    className="object-contain md:w-auto md:h-20"
                  />
                </div>
                <div className={`text-[10px] md:text-[15px] tracking-[0.4em] mt-2 text-center md:text-left ${isDark ? "text-purple-700/45" : "text-purple-400/70"}`}>
                  HOLDING COMPANY
                </div>
              </div>
            </motion.div>
            
            <div className={`flex flex-col gap-4 md:gap-6 border-l pl-6 md:pl-8 sm:items-center md:items-start ${isDark ? "border-purple-800/30" : "border-purple-300/40"}`}>
              <p className={`text-[12px] md:text-[14px] font-light leading-relaxed max-w-md text-center md:text-left ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                Grupo familiar com tradição, investindo no futuro através de 
                inovação, desenvolvimento e crescimento sustentável.
              </p>
            </div>
          </div>

          {/* Navegação */}
          <div className="md:col-span-3 space-y-6 md:space-y-10">
            <h4 className="text-[12px] md:text-[15px] text-purple-400 tracking-[0.3em] opacity-80 text-center md:text-left">
              NAVEGAÇÃO
            </h4>
            <nav className="flex flex-col gap-4 md:gap-6">
              {[
                { name: 'Ínicio', href: '/' },
                { name: 'Imóveis', href: '/imoveis' },
                { name: 'Sobre', href: '/sobre' },
                { name: 'Contato', href: '/contato' }
              ].map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center gap-4 text-[13px] md:text-[14px] tracking-[0.1em] transition-all duration-500 font-medium justify-center md:justify-start ${isDark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-900"}`}
                >
                  <span className="w-0 group-hover:w-6 md:group-hover:w-8 h-[1px] bg-purple-500 transition-all duration-500" />
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>

          {/* Localização e Contato */}
          <div className="md:col-span-3 space-y-6 md:space-y-10">
            <h4 className="text-[12px] md:text-[15px] tracking-[0.3em] text-purple-400 opacity-80 text-center md:text-left">
              CONTATO
            </h4>
            <div className="space-y-6 md:space-y-8 text-center md:text-left">
              <div className="flex flex-col gap-2">
                <span className={`text-[10px] md:text-[11px] tracking-[0.2em] uppercase font-semibold ${isDark ? "text-white/40" : "text-gray-400"}`}>E-mail</span>
                <a href="mailto:contato@nairimholding.com.br" className={`text-[13px] md:text-[15px] tracking-[0.05em] font-medium hover:text-purple-400 transition-colors break-all ${isDark ? "text-white" : "text-gray-800"}`}>
                  contato@nairimholding.com.br
                </a>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-[11px] md:text-[12px] tracking-[0.05em] text-purple-400/60 leading-relaxed font-light mt-2">
                  Atuamos há mais de 20 anos na região
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Linha divisória decorativa */}
        <div className="relative py-8 md:py-12">
          <div className={`absolute left-0 right-0 h-px bg-gradient-to-r from-transparent to-transparent ${isDark ? "via-purple-900/50" : "via-purple-400/50"}`} />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className={`w-8 h-8 border rotate-45 ${isDark ? "border-purple-800/30" : "border-purple-400"}`} />
          </div>
        </div>

        {/* Redes Sociais */}
        <div className="flex flex-col items-center gap-8 md:gap-12 mb-12 md:mb-16">
          <div className="text-center space-y-2">
            <h5 className={`text-[11px] md:text-[13px] tracking-[0.3em] uppercase ${isDark ? "text-gray-500" : "text-gray-400"}`}>
              Conecte-se Conosco
            </h5>
            <p className={`text-[12px] md:text-[14px] max-w-lg ${isDark ? "text-gray-400" : "text-gray-500"}`}>
              Siga nossos projetos e iniciativas de desenvolvimento regional
            </p>
          </div>
          
          <div className="flex gap-6 md:gap-8">
            <a
              href="https://instagram.com/nairimholding" 
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 transition-all duration-300 flex items-center justify-center text-white transform hover:scale-110"
              aria-label="Instagram da Nairim Holding"
            >
              <Icon icon="mingcute:instagram-line" className="w-5 h-5 md:w-6 md:h-6" />
            </a>
            <a
              href="https://facebook.com/nairimholding" 
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[#1877F2] hover:bg-[#166FE5] transition-all duration-300 flex items-center justify-center text-white transform hover:scale-110"
              aria-label="Facebook da Nairim Holding"
            >
              <Icon icon="mingcute:facebook-line" className="w-5 h-5 md:w-6 md:h-6" />
            </a>
          </div>
        </div>

        {/* Base Legal */}
        <div className={`pt-8 md:pt-12 border-t flex flex-col md:flex-row items-center justify-between gap-6 md:gap-8 relative ${isDark ? "border-white/[0.03]" : "border-gray-200/60"}`}>
          <div className={`hidden md:block absolute top-0 left-1/2 -translate-x-1/2 w-px h-8 bg-gradient-to-b to-transparent ${isDark ? "from-purple-800/40" : "from-purple-300/50"}`} />

          <div className="order-2 md:order-1">
            <p className={`text-[11px] md:text-[12px] uppercase tracking-[0.2em] font-medium text-center md:text-left ${isDark ? "text-gray-500" : "text-gray-400"}`}>
              © {currentYear} Nairim Holding • Garça/SP
            </p>
          </div>
        </div>

        {/* Selo de qualidade */}
        <div className="mt-10 pt-6 border-t border-white/[0.02] flex justify-center">
          <div className="flex items-center gap-3 text-[10px] md:text-[11px] tracking-[0.1em] text-gray-600">
            <div className="w-2 h-2 rounded-full bg-green-500/60 animate-pulse" />
            <span>EMPRESA FAMILIAR COM TRADIÇÃO E INOVAÇÃO</span>
            <div className="w-2 h-2 rounded-full bg-green-500/60 animate-pulse" />
          </div>
        </div>
      </div>
    </footer>
  );
}