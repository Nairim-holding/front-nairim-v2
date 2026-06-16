import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Editar Imóvel' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
