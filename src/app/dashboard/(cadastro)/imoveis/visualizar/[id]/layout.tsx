import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Visualizar Imóvel' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
