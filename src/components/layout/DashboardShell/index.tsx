'use client';

import { useState, useEffect, type ReactNode } from 'react';
import Aside from '@/components/layout/Sidebar';
import { Menu } from 'lucide-react';

interface DashboardShellProps {
  children: ReactNode;
}

export default function DashboardShell({ children }: DashboardShellProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isPinned, setIsPinned] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // A preferência do menu vive no localStorage, que não existe no SSR: o
  // estado só pode ser sincronizado depois da montagem, senão o HTML do
  // servidor e o do cliente divergem.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
    const savedPinned = localStorage.getItem('nairim.sidebar_pinned');
    const savedOpen = localStorage.getItem('nairim.sidebar_open');

    if (savedPinned === 'true') {
      setIsPinned(true);
      setIsOpen(true);
    } else if (savedOpen !== null) {
      setIsOpen(savedOpen === 'true');
    } else {
      setIsOpen(window.innerWidth >= 768);
    }
  }, []);

  const handleToggle = () => {
    setIsOpen((prev) => {
      const next = !prev;
      localStorage.setItem('nairim.sidebar_open', String(next));
      if (!next && isPinned) {
        setIsPinned(false);
        localStorage.setItem('nairim.sidebar_pinned', 'false');
      }
      return next;
    });
  };

  const handleTogglePin = () => {
    setIsPinned((prev) => {
      const next = !prev;
      localStorage.setItem('nairim.sidebar_pinned', String(next));
      if (next) {
        setIsOpen(true);
        localStorage.setItem('nairim.sidebar_open', 'true');
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-page text-content relative flex">
      {/* Menu encolhido: sobra apenas o seletor de acionamento. */}
      {isMounted && !isOpen && (
        <div className="fixed top-3 left-4 z-[900] flex items-center animate-fade-in">
          <button
            onClick={handleToggle}
            className="p-2.5 rounded-xl bg-surface/90 backdrop-blur-md border border-ui-border-soft shadow-md text-content-secondary hover:text-content hover:bg-surface-subtle transition-all duration-300 focus:outline-none"
            title="Expandir menu"
          >
            <Menu size={22} />
          </button>
        </div>
      )}

      {/* Sidebar vertical refatorado com suporte a Alfinete (Pin) */}
      <Aside
        isOpen={isOpen}
        onToggle={handleToggle}
        isPinned={isPinned}
        onTogglePin={handleTogglePin}
      />

      {/* Conteúdo principal empurrado suavemente ao abrir/encolher.
          `--page-header-offset` reserva, no título das telas, o espaço do
          seletor que fica sobreposto quando o menu está encolhido. */}
      <main
        style={{ ['--page-header-offset' as string]: isMounted && !isOpen ? '4rem' : '2.75rem' }}
        className={`flex-1 w-full min-h-screen transition-all duration-300 ease-in-out ${
          isOpen ? 'md:ml-[280px]' : 'ml-0'
        }`}
      >
        {children}
      </main>
    </div>
  );
}
