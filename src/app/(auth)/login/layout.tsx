import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Login - Nairim',
  description: 'Faça login na sua conta Nairim para acessar o dashboard',
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
