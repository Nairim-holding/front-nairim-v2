import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Visualizar Inquilino' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
