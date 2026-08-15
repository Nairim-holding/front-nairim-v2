'use client';

import { useEffect, useState, type ComponentType } from 'react';
import {
  ChevronsLeft,
  ChevronsRight,
  Pin,
  PinOff,
  PenLine,
  Calendar,
  List,
  Tag,
  User,
  CreditCard,
  FileText,
  PieChart,
  ClipboardList,
} from 'lucide-react';
import type { ReportGroupBy, ReportSection, SelectedReport, FluxoItemKey } from '../_lib/types';

const COLLAPSED_KEY = 'nairim.relatorios.sidebar.collapsed';
const PINNED_KEY = 'nairim.relatorios.sidebar.pinned';

interface SidebarItem {
  key: ReportGroupBy | FluxoItemKey;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
}

const DESPESAS_ITEMS: SidebarItem[] = [
  { key: 'description', label: 'Por Descrição', icon: PenLine },
  { key: 'day', label: 'Por Dia', icon: Calendar },
  { key: 'category', label: 'Por Tipo', icon: List },
  { key: 'subcategory', label: 'Por Categoria', icon: Tag },
  { key: 'contact', label: 'Pago a...', icon: User },
  { key: 'center', label: 'Por Centro de Despesa', icon: CreditCard },
];

const RECEITAS_ITEMS: SidebarItem[] = [
  { key: 'description', label: 'Por Descrição', icon: PenLine },
  { key: 'day', label: 'Por Dia', icon: Calendar },
  { key: 'category', label: 'Por Tipo', icon: List },
  { key: 'subcategory', label: 'Por Categoria', icon: Tag },
  { key: 'contact', label: 'Recebido de...', icon: User },
  { key: 'center', label: 'Por Centro de Receita', icon: CreditCard },
];

const FLUXO_ITEMS: SidebarItem[] = [
  { key: 'extrato', label: 'Extrato', icon: FileText },
  { key: 'income-expense', label: 'Despesas / Receitas', icon: PieChart },
  { key: 'demonstrativo', label: 'Demonstrativo', icon: ClipboardList },
];

interface ReportsSidebarProps {
  selected: SelectedReport;
  onSelect: (report: SelectedReport) => void;
}

export default function ReportsSidebar({ selected, onSelect }: ReportsSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSED_KEY) === '1');
    setPinned(localStorage.getItem(PINNED_KEY) === '1');
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
  }, [collapsed, hydrated]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(PINNED_KEY, pinned ? '1' : '0');
  }, [pinned, hydrated]);

  const expanded = pinned || !collapsed;

  const renderSection = (title: string, items: SidebarItem[], section: ReportSection, accentClass: string) => (
    <div className="mb-4">
      {expanded && (
        <h3 className={`text-xs font-bold tracking-wide uppercase px-3 pb-1.5 border-b mb-1.5 ${accentClass}`}>
          {title}
        </h3>
      )}
      <ul className="space-y-0.5">
        {items.map((item) => {
          const isActive = selected.section === section && selected.item === item.key;
          return (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => onSelect({ section, item: item.key })}
                title={!expanded ? item.label : undefined}
                className={`flex items-center w-full gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-brand/10 text-brand font-medium'
                    : 'text-content-secondary hover:bg-surface-subtle hover:text-content'
                } ${!expanded ? 'justify-center' : ''}`}
              >
                <item.icon size={17} className="shrink-0" />
                {expanded && <span className="truncate">{item.label}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <aside
      className={`shrink-0 border-r border-ui-border-soft bg-surface flex flex-col h-full transition-[width] duration-200 ${
        expanded ? 'w-64' : 'w-14'
      }`}
    >
      <div className="flex items-center justify-between px-2 py-2 border-b border-ui-border-soft shrink-0">
        {expanded && <span className="text-xs font-semibold text-content-muted pl-1">Relatórios</span>}
        <div className={`flex items-center gap-1 ${expanded ? '' : 'mx-auto'}`}>
          <button
            type="button"
            onClick={() => setPinned((p) => !p)}
            title={pinned ? 'Desafixar menu' : 'Fixar menu'}
            className={`p-1.5 rounded-md transition-colors ${
              pinned ? 'text-brand bg-brand/10' : 'text-content-muted hover:bg-surface-subtle hover:text-content-secondary'
            }`}
          >
            {pinned ? <Pin size={14} /> : <PinOff size={14} />}
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            disabled={pinned}
            title={pinned ? 'Desafixe o menu para encolher' : collapsed ? 'Expandir menu' : 'Encolher menu'}
            className="p-1.5 rounded-md text-content-muted hover:bg-surface-subtle hover:text-content-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {collapsed ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
          </button>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 custom-scrollbar">
        {renderSection('Despesas', DESPESAS_ITEMS, 'despesas', 'text-orange-500 border-orange-400/40')}
        {renderSection('Receitas', RECEITAS_ITEMS, 'receitas', 'text-emerald-500 border-emerald-400/40')}
        {renderSection('Fluxo de Caixa', FLUXO_ITEMS, 'fluxo', 'text-brand border-brand/30')}
      </nav>
    </aside>
  );
}
