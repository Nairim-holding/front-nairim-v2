import type { ReactNode } from 'react';
import Aside from '@/components/layout/Sidebar';
import PermissionGate from '@/components/layout/PermissionGate';
import { Metadata } from 'next';
import { getActiveBranding } from '@/lib/fetchBranding';

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
