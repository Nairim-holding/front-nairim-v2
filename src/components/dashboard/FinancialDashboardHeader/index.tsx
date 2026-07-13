'use client';

import { useMemo } from 'react';
import { Calendar, TrendingUp, TrendingDown, Scale } from 'lucide-react';
import YearSelect from './YearSelect';
import MonthMultiSelect from './MonthMultiSelect';
import { useMonthlySummary } from '@/hooks/useMonthlySummary';
import { formatCurrency } from '@/components/dashboard/MonthlyIncomeExpenseChart';

function TotalTile({
  label,
  value,
  icon,
  colorClass,
  iconBgClass,
  isLoading,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  colorClass: string;
  iconBgClass: string;
  isLoading: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-surface-subtle border border-ui-border-soft px-4 py-2.5 min-w-[170px]">
      <div className={`flex items-center justify-center w-9 h-9 rounded-full shrink-0 ${iconBgClass}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs text-content-muted">{label}</div>
        <div className={`font-bold text-base truncate ${colorClass}`}>
          {isLoading ? '—' : formatCurrency(value)}
        </div>
      </div>
    </div>
  );
}

interface FinancialDashboardHeaderProps {
  year: number;
  selectedMonths: number[];
  onYearChange: (year: number) => void;
  onMonthsChange: (months: number[]) => void;
}

/**
 * Filtro de período único da aba Financeiro: seletor de ano + meses (múltipla
 * seleção) e os totais do período (Receitas/Despesas/Resultado). O estado do
 * período vive no pai (FinancialSection), que também alimenta com ele os
 * gráficos do grid abaixo — este componente é controlado, não dono do estado.
 */
export default function FinancialDashboardHeader({ year, selectedMonths, onYearChange, onMonthsChange }: FinancialDashboardHeaderProps) {
  const { months, isLoading } = useMonthlySummary(year);

  const { totalIncome, totalExpense } = useMemo(() => {
    const selected = months.filter((m) => selectedMonths.includes(m.month));
    return {
      totalIncome: selected.reduce((sum, m) => sum + m.income, 0),
      totalExpense: selected.reduce((sum, m) => sum + m.expense, 0),
    };
  }, [months, selectedMonths]);

  const resultado = totalIncome - totalExpense;

  return (
    <div className="bg-surface rounded-xl border border-ui-border-soft shadow-sm p-4 mb-4 flex flex-col lg:flex-row lg:items-center gap-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-brand/10 text-brand shrink-0">
          <Calendar size={18} />
        </div>
        <div>
          <div className="text-xs text-content-muted mb-1">Período de análise</div>
          <div className="flex items-center rounded-xl border border-ui-border bg-surface divide-x divide-ui-border-soft shadow-sm hover:shadow transition-shadow">
            <YearSelect value={year} onChange={onYearChange} />
            <MonthMultiSelect selectedMonths={selectedMonths} onChange={onMonthsChange} />
          </div>
        </div>
      </div>

      <div className="hidden lg:block w-px self-stretch bg-ui-border-soft" />

      <div className="flex items-center gap-3 flex-wrap lg:ml-auto">
        <TotalTile
          label="Total Receitas"
          value={totalIncome}
          isLoading={isLoading}
          colorClass="text-state-success"
          iconBgClass="bg-state-success/15"
          icon={<TrendingUp size={18} className="text-state-success" />}
        />
        <TotalTile
          label="Total Despesas"
          value={totalExpense}
          isLoading={isLoading}
          colorClass="text-state-warning"
          iconBgClass="bg-state-warning/15"
          icon={<TrendingDown size={18} className="text-state-warning" />}
        />
        <TotalTile
          label="Resultado"
          value={resultado}
          isLoading={isLoading}
          colorClass={resultado >= 0 ? 'text-state-success' : 'text-state-error'}
          iconBgClass={resultado >= 0 ? 'bg-state-success/15' : 'bg-state-error/15'}
          icon={<Scale size={18} className={resultado >= 0 ? 'text-state-success' : 'text-state-error'} />}
        />
      </div>
    </div>
  );
}
