import type { ReactNode } from 'react';
import Aside from '@/components/layout/Sidebar';

/**
 * Layout do Dashboard — Server Component.
 *
 * GlobalNotifications já é montado em src/app/providers.tsx (AppProviders),
 * portanto não precisa ser redeclarado aqui.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Aside />
      <main>{children}</main>
    </>
  );
}
