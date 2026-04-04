import type { ReactNode } from 'react';
import Aside from '@/components/layout/Sidebar';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard | Nairim Holding',
  description: 'dashboard da Nairim Holding',
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
