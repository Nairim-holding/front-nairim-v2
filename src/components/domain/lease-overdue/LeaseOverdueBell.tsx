'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Bell, BellRing, Building2, ChevronRight, X } from 'lucide-react';
import type { LeaseOverdueSummary } from '@/server/queries/lease-overdue';
import { getOverdueLeaseAlertsAction } from '@/server/actions/lease-overdue';
import { formatCurrency, formatDate } from '@/utils';
import LeaseNotificationActions from './LeaseNotificationActions';

const EMPTY: LeaseOverdueSummary = { items: [], total: 0, critical: 0, amount: 0 };

export default function LeaseOverdueBell({ placement = 'floating' }: { placement?: 'floating' | 'sidebar' }) {
  const [summary, setSummary] = useState<LeaseOverdueSummary>(EMPTY);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const result = await getOverdueLeaseAlertsAction();
    if (result.ok) setSummary(result.data);
    setLoaded(true);
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), 120_000);
    const refreshOnFocus = () => void refresh();
    window.addEventListener('focus', refreshOnFocus);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', closeOutside);
    window.addEventListener('keydown', closeEscape);
    return () => {
      document.removeEventListener('mousedown', closeOutside);
      window.removeEventListener('keydown', closeEscape);
    };
  }, [open]);

  return (
    <div
      ref={panelRef}
      className={placement === 'sidebar' ? 'relative z-[1010] w-full' : 'fixed right-3 top-3 z-[950] sm:right-4'}
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={summary.total > 0 ? `${summary.total} repasses atrasados` : 'Notificações'}
        aria-expanded={open}
        className={`group flex items-center gap-2 rounded-xl border backdrop-blur-md transition-all ${placement === 'sidebar' ? 'w-full justify-start px-3 py-2.5 shadow-none text-sm font-medium' : 'h-11 px-3 shadow-md'} ${summary.total > 0 ? 'border-red-200 bg-red-50/95 text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/90 dark:text-red-200' : 'border-ui-border-soft bg-surface/95 text-content-secondary hover:bg-surface-subtle'}`}
      >
        <span className="relative">
          {summary.total > 0 ? <BellRing size={20} className="animate-[pulse_2s_ease-in-out_infinite]" /> : <Bell size={20} />}
          {placement === 'floating' && summary.total > 0 && (
            <span className="absolute -right-2 -top-2 min-w-4 h-4 rounded-full bg-red-600 px-1 text-[10px] font-bold leading-4 text-white text-center">
              {summary.total > 99 ? '99+' : summary.total}
            </span>
          )}
        </span>
        {placement === 'sidebar' && (
          <>
            <span className="flex-1 text-left">Alertas de locações</span>
            <span className={`min-w-6 rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold ${summary.total > 0 ? 'bg-red-600 text-white' : 'bg-surface-subtle text-content-muted'}`}>
              {summary.total > 99 ? '99+' : summary.total}
            </span>
          </>
        )}
        {placement === 'floating' && loaded && summary.total > 0 && <span className="hidden md:inline text-xs font-semibold">{summary.total} repasses atrasados</span>}
      </button>

      {open && (
        <div className={placement === 'sidebar'
          ? 'fixed left-3 top-[76px] w-[calc(100vw-1.5rem)] max-w-[390px] overflow-hidden rounded-2xl border border-ui-border-soft bg-surface shadow-2xl sm:absolute sm:left-full sm:top-0 sm:ml-3 sm:w-[390px]'
          : 'absolute right-0 mt-2 w-[min(92vw,390px)] overflow-hidden rounded-2xl border border-ui-border-soft bg-surface shadow-2xl'}>
          <div className="flex items-start justify-between gap-3 border-b border-ui-border-soft p-4">
            <div>
              <h2 className="font-semibold text-content">Alertas de locações</h2>
              <p className="mt-0.5 text-xs text-content-muted">
                {summary.total === 0 ? 'Nenhuma pendência no momento' : `${formatCurrency(summary.amount)} aguardando repasse`}
              </p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 text-content-muted hover:bg-surface-subtle" aria-label="Fechar notificações"><X size={17} /></button>
          </div>

          {summary.total === 0 ? (
            <div className="p-8 text-center">
              <Bell size={28} className="mx-auto mb-2 text-content-muted" />
              <p className="text-sm font-medium text-content">Tudo em dia</p>
              <p className="mt-1 text-xs text-content-muted">Os novos atrasos aparecerão aqui automaticamente.</p>
            </div>
          ) : (
            <div className="max-h-[min(62vh,470px)] overflow-y-auto divide-y divide-ui-border-soft">
              {summary.critical > 0 && (
                <div className="flex items-center gap-2 bg-red-50 px-4 py-2 text-xs font-medium text-red-700 dark:bg-red-950/30 dark:text-red-300">
                  <AlertTriangle size={14} /> {summary.critical} {summary.critical === 1 ? 'repasse está' : 'repasses estão'} há mais de 30 dias em atraso
                </div>
              )}
              {summary.items.slice(0, 5).map((item) => (
                <div key={item.transaction_id} className="p-3.5 hover:bg-surface-subtle/50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/dashboard/locacoes/visualizar/${encodeURIComponent(item.lease_id)}`}
                        onClick={() => setOpen(false)}
                        className="block truncate text-sm font-semibold text-content hover:text-brand hover:underline"
                      >
                        {item.property_title}
                      </Link>
                      <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-content-secondary"><Building2 size={13} />{item.agency_name}</p>
                      <p className="mt-1 text-xs text-content-muted">Venceu em {formatDate(item.due_date)} · <span className="font-semibold text-red-600 dark:text-red-300">{item.days_overdue} dias</span></p>
                    </div>
                    <LeaseNotificationActions item={item} compact onUpdated={refresh} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <Link
            href="/dashboard/locacoes/atrasadas"
            onClick={() => setOpen(false)}
            className="flex items-center justify-between border-t border-ui-border-soft bg-surface-subtle/50 px-4 py-3 text-sm font-semibold text-brand hover:bg-surface-subtle"
          >
            Ver central de alertas
            <ChevronRight size={17} />
          </Link>
        </div>
      )}
    </div>
  );
}
