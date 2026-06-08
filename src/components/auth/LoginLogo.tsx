'use client';

import Image from 'next/image';
import { useTheme } from '@/contexts/ThemeContext';

export const LoginLogo = () => {
  const { isDark } = useTheme();

  // Na tela de login, sempre usa a logo padrão e cores padrão
  // O usuário ainda não está logado, então não há branding customizado a considerar
  const primaryColor = '#8b5cf6';
  const secondaryColor = '#6d28d9';
  const gradient = `linear-gradient(180deg, ${primaryColor} 0%, ${secondaryColor} 84.79%, ${secondaryColor}66 100%)`;
  const src = '/logo-login.svg';

  return (
    <>
      {/* Mobile Logo */}
      <section
        className="w-full flex flex-col items-center justify-center text-center p-6 lg:hidden"
        style={{ background: gradient }}
      >
        <Image
          src={src}
          alt="Nairim logo"
          width={200}
          height={72}
          className="mb-4"
          priority
        />
      </section>

      {/* Desktop Logo */}
      <section
        className="hidden lg:flex w-full justify-center items-center"
        style={{ background: gradient }}
      >
        <Image
          src={src}
          alt="Nairim logo"
          width={601}
          height={217}
          className="xl:px-10"
          priority
          fetchPriority="high"
        />
      </section>
    </>
  );
};
