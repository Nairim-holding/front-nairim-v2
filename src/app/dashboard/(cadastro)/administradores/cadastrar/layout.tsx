import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Novo Administrador' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
