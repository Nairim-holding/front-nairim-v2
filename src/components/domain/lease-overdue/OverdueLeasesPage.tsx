'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  RefreshCw,
  Search,
  UserRound,
} from 'lucide-react';
import type { LeaseOverdueStatus, OverdueLease } from '@/core/entities/lease-overdue';
import { severityOf } from '@/core/entities/lease-overdue';
import type { LeaseOverdueSummary } from '@/server/queries/lease-overdue';
import {
  getOverdueLeaseAlertsAction,
  updateLeaseOverdueStatusAction,
} from '@/server/actions/lease-overdue';
import { describeActionError } from '@/shared/actions/action-result';
import { formatCurrency, formatDate } from '@/utils';
import { useMessageContext } from '@/contexts';
import { useAuth } from '@/contexts/AuthContext';
import WhatsAppConnectionPanel from '@/components/domain/whatsapp/WhatsAppConnectionPanel';
import LeaseNotificationActions from './LeaseNotificationActions';

type Filter = 'ALL' | 'UNNOTIFIED' | 'NEGOTIATING' | 'CRITICAL';

const statusLabels: Record<string, string> = {
  '': 'Pendente de ação',
  NOTIFIED: 'Imobiliária notificada',
  NEGOTIATING: 'Em negociação',
};

function overdueLabel(days: number) {
  return `${days} ${days === 1 ? 'dia' : 'dias'} em atraso`;
}

function severityClasses(days: number) {
  const severity = severityOf(days);
  if (severity === 'critical') return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900';
  if (severity === 'attention') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900';
  return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900';
}

export default function OverdueLeasesPage({ initialSummary }: { initialSummary: LeaseOverdueSummary }) {
  const [summary, setSummary] = useState(initialSummary);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const { showMessage } = useMessageContext();
  const { user } = useAuth();

  const refresh = async () => {
    setIsRefreshing(true);
    const result = await getOverdueLeaseAlertsAction();
    setIsRefreshing(false);
    if (!result.ok) {
      showMessage(describeActionError(result, 'Não foi possível atualizar os alertas.'), 'error');
      return;
    }
    setSummary(result.data);
  };

  const updateStatus = async (item: OverdueLease, rawStatus: string) => {
    const status = (rawStatus || null) as LeaseOverdueStatus | null;
    setUpdatingId(item.transaction_id);
    const result = await updateLeaseOverdueStatusAction(item.transaction_id, status);
    setUpdatingId(null);
    if (!result.ok) {
      showMessage(describeActionError(result, 'Não foi possível atualizar a situação.'), 'error');
      return;
    }
    setSummary((current) => ({
      ...current,
      items: current.items.map((row) => row.lease_id === item.lease_id ? { ...row, overdue_status: status } : row),
    }));
    showMessage('Situação do alerta atualizada.', 'success', 2000);
  };

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('pt-BR');
    return summary.items.filter((item) => {
      const matchesQuery = !needle || [
        item.property_title,
        item.tenant_name,
        item.agency_name,
        item.contract_number,
      ].some((value) => value.toLocaleLowerCase('pt-BR').includes(needle));
      const matchesFilter = filter === 'ALL'
        || (filter === 'UNNOTIFIED' && item.notification_count === 0)
        || (filter === 'NEGOTIATING' && item.overdue_status === 'NEGOTIATING')
        || (filter === 'CRITICAL' && item.days_overdue > 30);
      return matchesQuery && matchesFilter;
    });
  }, [filter, query, summary.items]);

  return (
    <div className="space-y-4">
      {user?.role === 'SUPER_ADMIN' && <WhatsAppConnectionPanel />}

      {summary.total === 0 ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-6 dark:bg-green-950/20 dark:border-green-900">
          <div className="flex items-center gap-3 text-green-700 dark:text-green-300">
            <CheckCircle2 size={28} />
            <div>
              <h2 className="font-semibold">Todos os repasses estão em dia</h2>
              <p className="text-sm opacity-80">Não há lançamentos mensais de aluguel vencidos e pendentes.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 to-orange-50 p-4 sm:p-5 dark:from-red-950/30 dark:to-orange-950/20 dark:border-red-900">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-red-100 p-2.5 text-red-600 dark:bg-red-950 dark:text-red-300"><AlertCircle size={24} /></span>
              <div>
                <h2 className="font-semibold text-red-800 dark:text-red-200">Há repasses que precisam de atenção</h2>
                <p className="text-sm text-red-700/80 dark:text-red-300/80">Priorize os mais antigos e registre cada contato com a imobiliária.</p>
              </div>
            </div>
            <Link href="/dashboard/lancamentos" className="text-sm font-semibold text-red-700 hover:underline dark:text-red-300 whitespace-nowrap">
              Ir para lançamentos →
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard icon={CalendarClock} label="Repasses atrasados" value={String(summary.total)} tone="red" />
        <SummaryCard icon={AlertCircle} label="Acima de 30 dias" value={String(summary.critical)} tone="amber" />
        <SummaryCard icon={CircleDollarSign} label="Valor pendente" value={formatCurrency(summary.amount)} tone="brand" />
      </div>

      <div className="rounded-2xl border border-ui-border-soft bg-surface shadow-sm overflow-hidden">
        <div className="border-b border-green-100 bg-green-50 px-4 py-2.5 text-xs text-green-700 dark:border-green-900 dark:bg-green-950/25 dark:text-green-300">
          A primeira cobrança por WhatsApp é enviada automaticamente após um dia útil, respeitando fins de semana e feriados. Use o botão para reenviar quando necessário.
        </div>
        <div className="p-3 sm:p-4 border-b border-ui-border-soft flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="relative flex-1 max-w-xl">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar imóvel, inquilino, imobiliária ou contrato"
              className="w-full rounded-xl border border-ui-border-soft bg-page py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
            {([
              ['ALL', 'Todos'],
              ['UNNOTIFIED', 'Sem aviso'],
              ['NEGOTIATING', 'Em negociação'],
              ['CRITICAL', 'Críticos'],
            ] as Array<[Filter, string]>).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap border transition-colors ${filter === value ? 'bg-brand text-content-inverse border-brand' : 'bg-surface text-content-secondary border-ui-border-soft hover:bg-surface-subtle'}`}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={isRefreshing}
              className="p-2 rounded-lg border border-ui-border-soft text-content-muted hover:text-content hover:bg-surface-subtle disabled:opacity-50"
              title="Atualizar alertas"
              aria-label="Atualizar alertas"
            >
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="p-10 text-center text-content-muted text-sm">Nenhum alerta corresponde aos filtros informados.</div>
        ) : (
          <div className="divide-y divide-ui-border-soft">
            {visible.map((item) => (
              <article key={item.transaction_id} className="p-4 hover:bg-surface-subtle/40 transition-colors">
                <div className="flex flex-col xl:flex-row xl:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${severityClasses(item.days_overdue)}`}>
                        <Clock3 size={13} /> {overdueLabel(item.days_overdue)}
                      </span>
                      <span className="text-xs text-content-muted">Contrato {item.contract_number}</span>
                      {item.notification_count > 0 && (
                        <span className="text-xs text-content-muted">
                          {item.notification_count} aviso{item.notification_count === 1 ? '' : 's'} · último em {formatDate(item.last_notified_at)}
                        </span>
                      )}
                    </div>
                    <Link
                      href={`/dashboard/locacoes/visualizar/${encodeURIComponent(item.lease_id)}`}
                      className="inline-block max-w-full truncate font-semibold text-content hover:text-brand hover:underline"
                    >
                      {item.property_title}
                    </Link>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-2 text-sm text-content-secondary">
                      <span className="flex items-center gap-2"><UserRound size={15} className="text-content-muted" />{item.tenant_name}</span>
                      <span className="flex items-center gap-2"><Building2 size={15} className="text-content-muted" />{item.agency_name}</span>
                      <span className="flex items-center gap-2"><CalendarClock size={15} className="text-content-muted" />Venceu em {formatDate(item.due_date)}</span>
                      <span className="font-semibold text-content">{formatCurrency(item.amount)}</span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row xl:flex-col 2xl:flex-row gap-2 sm:items-center xl:items-stretch 2xl:items-center shrink-0">
                    <select
                      value={item.overdue_status ?? ''}
                      onChange={(event) => void updateStatus(item, event.target.value)}
                      disabled={updatingId === item.transaction_id}
                      aria-label={`Situação do alerta de ${item.property_title}`}
                      className="rounded-lg border border-ui-border-soft bg-surface px-3 py-2 text-xs text-content outline-none focus:border-brand disabled:opacity-50"
                    >
                      {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <LeaseNotificationActions item={item} onUpdated={refresh} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof CalendarClock;
  label: string;
  value: string;
  tone: 'red' | 'amber' | 'brand';
}) {
  const tones = {
    red: 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-300',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-300',
    brand: 'bg-brand/10 text-brand',
  };
  return (
    <div className="rounded-2xl border border-ui-border-soft bg-surface p-4 flex items-center gap-3 shadow-sm">
      <span className={`rounded-xl p-2.5 ${tones[tone]}`}><Icon size={21} /></span>
      <div>
        <p className="text-xs text-content-muted">{label}</p>
        <p className="text-xl font-semibold text-content">{value}</p>
      </div>
    </div>
  );
}
