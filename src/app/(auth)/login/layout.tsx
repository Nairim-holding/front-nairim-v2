import { Metadata } from 'next';

const name = process.env.NEXT_PUBLIC_COMPANY_NAME ?? 'Sistema';

export const metadata: Metadata = {
  title: `Login | ${name}`,
  description: `Faça login na sua conta para acessar o dashboard`,
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
