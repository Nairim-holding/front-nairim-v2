import { Metadata } from 'next';
import { getActiveBranding } from '@/lib/fetchBranding';

export async function generateMetadata(): Promise<Metadata> {
  const { name } = await getActiveBranding();
  return {
    title: `Login | ${name}`,
    description: `Faça login na sua conta para acessar o dashboard`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
