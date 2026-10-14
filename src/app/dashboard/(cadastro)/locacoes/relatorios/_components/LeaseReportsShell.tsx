'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ComponentType, type ReactNode } from 'react';
import { AlarmClock, ChevronsLeft, ChevronsRight, FileBarChart2 } from 'lucide-react';

const BASE_PATH = '/dashboard/locacoes/relatorios';

interface LeaseReportItem {
  /** Sufixo da rota a partir de `/dashboard/locacoes/relatorios`. */
  path: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
}

/**
 * Relatórios do hub de Locações. Um relatório novo entra com uma sub-rota em
 * `locacoes/relatorios/<path>` e uma linha aqui.
 */
const LEASE_REPORTS: LeaseReportItem[] = [
  { path: '', label: 'Relatório de locações', icon: FileBarChart2 },
  { path: '/atrasadas', label: 'Relatório de atrasos', icon: AlarmClock },
];

/**
 * Casca do hub de relatórios de Locações: menu lateral próprio + relatório
 * ativo, no mesmo desenho de Financeiro > Relatórios. Fica dentro do `Section`
 * de cada relatório para preservar o cabeçalho padrão das páginas.
 */
export default function LeaseReportsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const [collapsed, setCollapsed] = useState(false);

  // O pathname pode vir prefixado pelo slug da empresa (`/:slug/dashboard/...`).
  const current = pathname.replace(/\/$/, '');

  return (
    <div className="flex flex-1 min-h-0 -mx-3 sm:-mx-4 border-t border-ui-border-soft">
      <aside className={`shrink-0 border-r border-ui-border-soft bg-surface flex flex-col transition-[width] duration-200 ${collapsed ? 'w-14' : 'w-64'}`}>
        <div className="flex items-center justify-between px-2 py-2 border-b border-ui-border-soft shrink-0">
          {!collapsed && <span className="text-xs font-semibold text-content-muted pl-1">Relatórios</span>}
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            title={collapsed ? 'Expandir menu' : 'Encolher menu'}
            className={`p-1.5 rounded-md text-content-muted hover:bg-surface-subtle hover:text-content-secondary transition-colors ${collapsed ? 'mx-auto' : ''}`}
          >
            {collapsed ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
          </button>
        </div>

        <nav aria-label="Relatórios de locações" className="py-3 px-2">
          <ul className="space-y-0.5">
            {LEASE_REPORTS.map((item) => {
              const href = `${BASE_PATH}${item.path}`;
              const isActive = current.endsWith(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={isActive ? 'page' : undefined}
                    title={collapsed ? item.label : undefined}
                    className={`flex items-center w-full gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-brand/10 text-brand font-medium'
                        : 'text-content-secondary hover:bg-surface-subtle hover:text-content'
                    } ${collapsed ? 'justify-center' : ''}`}
                  >
                    <item.icon size={17} className="shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      <div className="flex flex-col flex-1 min-w-0 px-3 sm:px-4 pt-3">{children}</div>
    </div>
  );
}
