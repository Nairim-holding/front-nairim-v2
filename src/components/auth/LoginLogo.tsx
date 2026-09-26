'use client';

import Image from 'next/image';
import { useTheme } from '@/contexts/ThemeContext';
import { useBranding } from '@/contexts/BrandingContext';

export const LoginLogo = () => {
  const { isDark } = useTheme();
  const { logoUrl, logoDarkUrl, companyName, primaryColor, secondaryColor } = useBranding();

  const gradient = `linear-gradient(180deg, ${primaryColor} 0%, ${secondaryColor} 84.79%, ${secondaryColor}66 100%)`;
  // Empresa sem logo customizada: não mostra nenhuma logo genérica — só o
  // gradiente de fundo com as cores da marca (ou as cores padrão do sistema).
  const src = (isDark && logoDarkUrl) || logoUrl;

  if (!src) {
    return (
      <>
        <section className="w-full p-10 lg:hidden" style={{ background: gradient }} />
        <section className="hidden lg:flex w-full" style={{ background: gradient }} />
      </>
    );
  }

  return (
    <>
      {/* Mobile Logo */}
      <section
        className="w-full flex flex-col items-center justify-center text-center p-6 lg:hidden"
        style={{ background: gradient }}
      >
        <Image
          src={src}
          alt={companyName}
          width={200}
          height={72}
          className="mb-4"
          unoptimized
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
          alt={companyName}
          width={601}
          height={217}
          className="xl:px-10"
          unoptimized
          priority
          fetchPriority="high"
        />
      </section>
    </>
  );
};
