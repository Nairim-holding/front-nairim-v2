'use client';
import { useState } from 'react';
import Image from 'next/image';
import { useBranding } from '@/contexts/BrandingContext';
import { useTheme } from '@/contexts/ThemeContext';

export type LogoVariant = 'default' | 'sidebar' | 'dark';

interface LogoProps {
  className?: string;
  variant?: LogoVariant;
}

export default function Logo({ className = '', variant = 'default' }: LogoProps) {
  const { logoUrl, logoSidebarUrl, logoDarkUrl, companyName } = useBranding();
  const { isDark } = useTheme();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  // Cascata de fallback: variante específica → dark (se tema escuro ativo) → logo padrão
  const wantsDark = isDark || variant === 'dark';
  const resolvedUrl = wantsDark && logoDarkUrl ? logoDarkUrl :
    variant === 'sidebar' ? (logoSidebarUrl ?? logoUrl) : logoUrl;
  const imageClassName = `${className}${wantsDark && !logoDarkUrl ? ' invert' : ''}`;

  // Se houver URL customizada, válida e a imagem não falhou, renderiza a imagem
  if (resolvedUrl && failedUrl !== resolvedUrl) {
    return (
      <Image
        src={resolvedUrl}
        alt={companyName}
        width={131}
        height={46}
        className={imageClassName}
        unoptimized
        onError={() => setFailedUrl(resolvedUrl)}
      />
    );
  }
  // Empresa sem logo customizada (ou a imagem falhou ao carregar): fica vazio
  // — sem um SVG genérico no lugar. Reserva o mesmo espaço (131×46) para não
  // saltar o layout do sidebar/header.
  return <span className={className} style={{ display: 'inline-block', width: 131, height: 46 }} aria-hidden="true" />;
}
