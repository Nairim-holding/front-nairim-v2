import type { ReactNode } from 'react';
import Aside from '@/components/layout/Sidebar';
import PermissionGate from '@/components/layout/PermissionGate';
import { Metadata } from 'next';
import { getActiveBranding } from '@/lib/fetchBranding';

// CRÍTICO multi-tenant: todo o dashboard depende do cookie de sessão
// (company_id) para escopar dados por tenant. `/:slug/dashboard` e
// `/:slug/dashboard/*` são reescritos para a MESMA rota interna `/dashboard`
// (ver next.config.ts) — sem forçar dynamic, o Next.js pode servir o RSC
// payload cacheado de uma empresa para a URL de outra. `force-dynamic`
// desliga qualquer cache de rota/dados para toda a árvore do dashboard.
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function generateMetadata(): Promise<Metadata> {
  const { name } = await getActiveBranding();
  return {
    title: {
      template: `%s | ${name}`,
      default: `Dashboard | ${name}`,
    },
    description: `Dashboard de gestão — ${name}`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Aside />
      <main>
        <PermissionGate>{children}</PermissionGate>
      </main>
    </>
  );
}
