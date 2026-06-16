import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Centros de Custo' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
