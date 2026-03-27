"use client";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { useState, useEffect, useRef } from "react";

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fechar menu ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fechar menu ao pressionar ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMenuOpen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  // Detectar scroll para efeito de header
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Fechar menu ao clicar em um link
  const handleLinkClick = () => {
    setIsMenuOpen(false);
  };

  return (
    <>
      <header 
        className={`fixed w-full z-50 transition-all duration-300 ${
          isScrolled 
            ? 'bg-surface shadow-lg py-3' 
            : 'bg-surface py-4 md:bg-surface/95 md:backdrop-blur-sm'
        }`}
        ref={menuRef}
      >
        <div className="container mx-auto px-4 md:px-6 lg:px-8">
          <div className="flex items-center justify-between h-12 md:h-16">
            {/* Logo */}
            <Link href="/" className="z-50">
              <Image 
                src="/logo.svg" 
                alt="logo da nairim holding" 
                width={91} 
                height={45} 
                className="h-10 w-auto md:h-13"
                priority
              />
            </Link>

            {/* Menu Desktop */}
            <nav className="hidden md:flex items-center space-x-8">
              <ul className="flex gap-6 lg:gap-8 text-content-secondary items-center">
                <li className="text-sm lg:text-base font-medium hover:text-content transition-colors duration-300 font-roboto">
                  <Link href="/">Início</Link>
                </li>
                <li className="text-sm lg:text-base font-medium hover:text-content transition-colors duration-300 font-roboto">
                  <Link href="/imoveis">Imóveis</Link>
                </li>
                <li className="text-sm lg:text-base font-medium hover:text-content transition-colors duration-300 font-roboto">
                  <Link href="/sobre">Sobre</Link>
                </li>
                <li className="text-sm lg:text-base font-medium hover:text-content transition-colors duration-300 font-roboto">
                  <Link href="/contato">Contato</Link>
                </li>
              </ul>
              
              <Link 
                href="/login" 
                className="bg-brand-hover px-6 py-2.5 rounded-lg text-content-inverse flex items-center justify-center font-medium font-roboto border border-brand-hover transition-all duration-300 hover:text-brand-hover hover:bg-transparent ml-4"
              >
                Login
              </Link>
            </nav>

            {/* Botão Menu Mobile */}
            <button
              className="md:hidden z-50 p-2"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Menu"
              aria-expanded={isMenuOpen}
            >
              <Icon 
                icon={isMenuOpen ? "mingcute:close-line" : "mingcute:menu-line"} 
                className="w-6 h-6 text-content" 
              />
            </button>
          </div>

          {/* Menu Mobile - Dropdown abaixo do header */}
          <div 
            className={`
              md:hidden overflow-hidden transition-all duration-300 ease-in-out
              ${isMenuOpen 
                ? 'max-h-96 opacity-100 visible mt-2' 
                : 'max-h-0 opacity-0 invisible'
              }
            `}
          >
            <div className="bg-surface rounded-lg shadow-lg border border-ui-border-soft py-4">
              <nav>
                <ul className="space-y-3">
                  <li>
                    <Link 
                      href="/" 
                      className="flex items-center px-4 py-3 text-content hover:bg-surface-subtle hover:text-brand-hover transition-colors duration-200 rounded-lg group"
                      onClick={handleLinkClick}
                    >
                      <Icon 
                        icon="mingcute:home-line" 
                        className="w-5 h-5 mr-3 text-content-placeholder group-hover:text-brand" 
                      />
                      <span className="font-medium font-roboto">Início</span>
                    </Link>
                  </li>
                  <li>
                    <Link 
                      href="/imoveis" 
                      className="flex items-center px-4 py-3 text-content hover:bg-surface-subtle hover:text-brand-hover transition-colors duration-200 rounded-lg group"
                      onClick={handleLinkClick}
                    >
                      <Icon 
                        icon="mingcute:building-2-line" 
                        className="w-5 h-5 mr-3 text-content-placeholder group-hover:text-brand" 
                      />
                      <span className="font-medium font-roboto">Imóveis</span>
                    </Link>
                  </li>
                  <li>
                    <Link 
                      href="/sobre" 
                      className="flex items-center px-4 py-3 text-content hover:bg-surface-subtle hover:text-brand-hover transition-colors duration-200 rounded-lg group"
                      onClick={handleLinkClick}
                    >
                      <Icon 
                        icon="mingcute:information-line" 
                        className="w-5 h-5 mr-3 text-content-placeholder group-hover:text-brand" 
                      />
                      <span className="font-medium font-roboto">Sobre</span>
                    </Link>
                  </li>
                  <li>
                    <Link 
                      href="/contato" 
                      className="flex items-center px-4 py-3 text-content hover:bg-surface-subtle hover:text-brand-hover transition-colors duration-200 rounded-lg group"
                      onClick={handleLinkClick}
                    >
                      <Icon 
                        icon="mingcute:phone-line" 
                        className="w-5 h-5 mr-3 text-content-placeholder group-hover:text-brand" 
                      />
                      <span className="font-medium font-roboto">Contato</span>
                    </Link>
                  </li>
                  <li className="border-t border-ui-border-soft pt-3 mt-3">
                    <Link 
                      href="/login" 
                      className="flex justify-center items-center w-full bg-brand-hover text-content-inverse text-center font-medium py-3 rounded-lg border border-brand-hover transition-all duration-300 hover:bg-brand"
                      onClick={handleLinkClick}
                    >
                      Login
                    </Link>
                  </li>
                </ul>
              </nav>
            </div>
          </div>
        </div>
      </header>

      {/* Adiciona padding ao conteúdo para compensar o header fixo */}
      <div className="pt-16 md:pt-20"></div>
    </>
  );
}
