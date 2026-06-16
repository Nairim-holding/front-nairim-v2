import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Visualizar Imobiliária' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
