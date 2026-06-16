import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Editar Administrador' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
