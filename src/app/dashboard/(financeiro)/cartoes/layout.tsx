import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Cartões' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
