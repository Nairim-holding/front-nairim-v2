import type { ReactNode } from 'react';
import Aside from '@/components/layout/Sidebar';
import { Metadata } from 'next';

const name = process.env.NEXT_PUBLIC_COMPANY_NAME ?? 'Sistema';

export const metadata: Metadata = {
  title: `Dashboard | ${name}`,
  description: `Dashboard de gestão — ${name}`,
  robots: {
    index: false,
    follow: false,
  },
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Aside />
      <main>{children}</main>
    </>
  );
}
