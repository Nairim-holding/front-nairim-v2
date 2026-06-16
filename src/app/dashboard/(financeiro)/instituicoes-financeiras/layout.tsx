import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Instituições Financeiras' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
