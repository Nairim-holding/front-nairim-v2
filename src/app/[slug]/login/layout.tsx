import type { Metadata } from 'next';
import { fetchBranding } from '@/lib/fetchBranding';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const branding = await fetchBranding(slug);
  const name = branding?.company_name ?? slug;
  return {
    title: `Login | ${name}`,
    description: `Faça login na sua conta para acessar o dashboard`,
    robots: { index: false, follow: false },
  };
}

export default function SlugLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
