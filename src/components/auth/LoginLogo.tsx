'use client';

import Image from 'next/image';
import { useBranding } from '@/contexts/BrandingContext';

export const LoginLogo = () => {
  const { logoUrl, companyName, primaryColor, secondaryColor } = useBranding();

  const gradient = `linear-gradient(180deg, ${primaryColor} 0%, ${secondaryColor} 84.79%, ${secondaryColor}66 100%)`;
  const src = logoUrl ?? '/logo-login.svg';

  return (
    <>
      {/* Mobile Logo */}
      <section
        className="w-full flex flex-col items-center justify-center text-center p-6 lg:hidden"
        style={{ background: gradient }}
      >
        <Image
          src={src}
          alt={`logo ${companyName}`}
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
          alt={`logo ${companyName}`}
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
