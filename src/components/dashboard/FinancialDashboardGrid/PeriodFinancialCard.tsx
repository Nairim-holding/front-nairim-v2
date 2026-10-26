'use client';

import { useEffect, useState } from 'react';
import NumericCard from '@/components/charts/MetricCard';
import type { DetailColumn } from '@/components/charts/MetricCard';
import { getFinancialChartDetailsAction } from '@/server/actions/financial-transaction';
import { formatCurrency } from '@/components/dashboard/MonthlyIncomeExpenseChart';
import type { FinancialWidgetProps } from './types';

type CardKind = 'rent' | 'taxes';
interface DetailRow {
  eventDate: string;
  effectiveDate: string;
  description: string;
  category: string;
  subcategory: string;
  status: string;
  amount: number;
}

const COLUMNS: DetailColumn[] = [
  { key: 'eventDate', label: 'Data do evento' },
  { key: 'effectiveDate', label: 'Data efetiva' },
  { key: 'description', label: 'Descrição' },
  { key: 'category', label: 'Categoria' },
  { key: 'subcategory', label: 'Subcategoria' },
  { key: 'status', label: 'Status' },
  { key: 'amount', label: 'Valor', format: value => formatCurrency(Number(value)), summable: true },
];

function normalize(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function periodTitle(from: string, to: string) {
  const monthName = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  if (from.slice(0, 7) === to.slice(0, 7)) return monthName(from);
  return `${new Date(`${from}T12:00:00`).toLocaleDateString('pt-BR')} a ${new Date(`${to}T12:00:00`).toLocaleDateString('pt-BR')}`;
}

/** Card do Resumo Financeiro calculado pelos lançamentos do período e regime selecionados. */
export default function PeriodFinancialCard({ kind, startDate, endDate, filters }: FinancialWidgetProps & { kind: CardKind }) {
  const [amount, setAmount] = useState(0);
  const [details, setDetails] = useState<DetailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const filterKey = JSON.stringify(filters ?? {});
  const label = kind === 'rent' ? 'Valor Total dos Aluguéis' : 'Valor Total dos Impostos';
  const shownLabel = `${label} — ${periodTitle(startDate, endDate)}`;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const query = {
      source: 'transactions' as const,
      startDate,
      endDate,
      regime: (filters?.regime === 'competencia' ? 'competencia' : 'caixa') as 'caixa' | 'competencia',
      type: kind === 'rent' ? 'INCOME' as const : 'EXPENSE' as const,
      status: 'COMPLETED' as const,
    };

    getFinancialChartDetailsAction(query, filters).then(result => {
      if (!result.ok) throw new Error(result.error);
      if (cancelled) return;
      const needle = kind === 'rent' ? /aluguel/ : /imposto|tribut/;
      const rows = result.data.filter(item => needle.test(normalize(`${item.category} ${item.subcategory}`))).map(item => ({
        eventDate: item.eventDate,
        effectiveDate: item.effectiveDate,
        description: item.description,
        category: item.category,
        subcategory: item.subcategory,
        status: item.status === 'COMPLETED' ? 'Concluído' : 'Pendente',
        amount: item.value,
      }));
      setDetails(rows);
      setAmount(rows.reduce((sum, row) => sum + row.amount, 0));
    }).catch(error => {
      console.error(`[PeriodFinancialCard] Falha ao carregar ${kind}:`, error);
      if (!cancelled) { setDetails([]); setAmount(0); }
    }).finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  // filterKey is the stable representation of the selected dashboard filters.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, startDate, endDate, filterKey]);

  return (
    <NumericCard
      value={formatCurrency(amount)}
      label={shownLabel}
      loading={loading}
      detailData={details}
      detailColumns={COLUMNS}
      detailTotalLabel="lançamentos"
      openDetailsOnCardClick
    />
  );
}
