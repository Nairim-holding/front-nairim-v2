import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LoginLogo } from '@/components/auth/LoginLogo';
import { LoginHeader } from '@/components/auth/LoginHeader';
import { LoginFormWrapper } from '@/app/(auth)/login/LoginFormWrapper';
import { BrandingProvider } from '@/contexts/BrandingContext';
import { fetchBranding } from '@/lib/fetchBranding';

interface Props {
  params: Promise<{ slug: string }>;
}

// Segmentos que nunca devem ser tratados como slug de empresa
const RESERVED = new Set(['dashboard', 'api', '_next', 'login', 'forgot-password', 'register', 'static']);

export default async function SlugLoginPage({ params }: Props) {
  const { slug } = await params;

  if (RESERVED.has(slug)) notFound();

  const branding = await fetchBranding(slug);
  if (!branding) notFound();

  return (
    // BrandingProvider local sobrepõe o do root layout para esta página
    <BrandingProvider initialBranding={branding}>
      <section className="font-poppins flex flex-col lg:flex-row h-dvh w-full">
        <LoginLogo />

        <section className="flex flex-col justify-center items-center bg-surface-subtle w-full px-6 sm:px-10 md:px-16 lg:px-32 xl:px-40 2xl:px-60 py-10 sm:rounded-t-3xl lg:rounded-none shadow-lg h-full">
          <LoginHeader />
          <LoginFormWrapper companySlug={slug} />

          <Link
            href="/forgot-password"
            className="text-sm underline text-center text-content-muted hover:text-brand transition-colors duration-200 mt-8"
          >
            Esqueci a senha
          </Link>
        </section>
      </section>
    </BrandingProvider>
  );
}
