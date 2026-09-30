'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { acknowledgeLeaseExpiryAction, getLeaseExpiryAlertsAction } from '@/server/actions/lease-expiry';
import type { LeaseExpiryAlert } from '@/core/entities/lease-expiry';
import { useMessageContext } from '@/contexts/MessageContext';

export function useLeaseExpiryAlerts(displayed: boolean) {
  const [items, setItems] = useState<LeaseExpiryAlert[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const { showMessage } = useMessageContext();
  const refresh = useCallback(async () => {
    const result = await getLeaseExpiryAlertsAction();
    if (result.ok) setItems(result.data);
    else setItems([]);
  }, []);
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    window.addEventListener('focus', refresh);
    window.addEventListener('lease-expiry:changed', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('lease-expiry:changed', refresh); };
  }, [refresh]);
  const key = items.map(item => `${item.leaseId}:${item.endDate}:${item.daysRemaining}`).join('|');
  useEffect(() => {
    if (!displayed || !key) return;
    let canceled = false;
    const ids = key.split('|').map(item => item.split(':')[0]);
    void getLeaseExpiryAlertsAction(ids).then(result => { if (!canceled && result.ok) setItems(result.data); });
    return () => { canceled = true; };
  }, [displayed, key]);
  const acknowledge = async (item: LeaseExpiryAlert, dismiss: boolean) => {
    setBusy(item.leaseId);
    try {
      const result = await acknowledgeLeaseExpiryAction(item.leaseId, item.endDate, dismiss);
      if (!result.ok) { showMessage(result.error, 'error'); return; }
      setItems(current => current.filter(row => row.leaseId !== item.leaseId));
      window.dispatchEvent(new Event('lease-expiry:changed'));
    } finally { setBusy(null); }
  };
  return { items, busy, acknowledge };
}

export function LeaseExpiryList({ items, busy, acknowledge }: ReturnType<typeof useLeaseExpiryAlerts>) {
  return <div className="divide-y divide-ui-border-soft">{items.map(item => <div key={`${item.leaseId}:${item.endDate}`} className="p-4 space-y-2">
    <Link className="font-semibold text-content hover:text-brand" href={`/dashboard/locacoes/visualizar/${encodeURIComponent(item.leaseId)}`}>{item.propertyTitle}</Link>
    <p className="text-xs text-content-secondary">{item.tenantName} · término em {item.endDate.split('-').reverse().join('/')}</p>
    <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">{item.daysRemaining === 0 ? 'A locação vence hoje' : `A locação vence em ${item.daysRemaining} ${item.daysRemaining === 1 ? 'dia' : 'dias'}`}</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy !== null} onClick={() => void acknowledge(item, false)} className="rounded-lg border border-ui-border px-3 py-1.5 text-xs hover:bg-surface-subtle disabled:opacity-50">Ciente</button>
      {item.canDismiss && <button type="button" disabled={busy !== null} onClick={() => void acknowledge(item, true)} className="rounded-lg border border-ui-border px-3 py-1.5 text-xs hover:bg-surface-subtle disabled:opacity-50">Não exibir mais este alerta</button>}
    </div>
  </div>)}</div>;
}

export default function LeaseExpiryAlerts() {
  const alerts = useLeaseExpiryAlerts(true);
  return <section className="rounded-xl border border-ui-border-soft bg-surface mb-6">
    <h2 className="p-4 font-semibold border-b border-ui-border-soft">Locações a vencer em até 30 dias ({alerts.items.length})</h2>
    {alerts.items.length ? <LeaseExpiryList {...alerts} /> : <p className="p-4 text-sm text-content-muted">Nenhum aviso de vencimento pendente.</p>}
  </section>;
}
