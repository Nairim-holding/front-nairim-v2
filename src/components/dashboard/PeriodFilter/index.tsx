'use client';

import { Calendar, X } from 'lucide-react';
import YearMultiSelect from '@/components/dashboard/FinancialDashboardHeader/YearMultiSelect';
import MonthMultiSelect from '@/components/dashboard/FinancialDashboardHeader/MonthMultiSelect';

export interface PeriodFilterProps {
  years: number[];
  selectedMonths: number[];
  onYearsChange: (years: number[]) => void;
  onMonthsChange: (months: number[]) => void;
  /** Tarefa 6.3: quando limpo, a análise considera todo o período disponível. */
  isCleared?: boolean;
  onClear?: () => void;
}

/**
 * O seletor de período do Dashboard: ano(s) + meses (múltipla seleção).
 * Fonte única para TODAS as abas — antes só o Financeiro usava isto e as demais
 * usavam um seletor de datas solto (FilterDate) no cabeçalho global.
 *
 * Controlado: o estado do período vive na seção que o usa, que também alimenta
 * com ele os widgets do grid abaixo.
 */
export function PeriodFilterSelector({ years, selectedMonths, onYearsChange, onMonthsChange, isCleared, onClear }: PeriodFilterProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center justify-center w-9 h-9 rounded-full bg-brand/10 text-brand shrink-0">
        <Calendar size={18} />
      </div>
      <div>
        <div className="text-xs text-content-muted mb-1 flex items-center gap-2">
          <span>{isCleared ? 'Todo o período' : 'Período de análise'}</span>
          {onClear && !isCleared && (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-0.5 text-content-muted hover:text-brand transition-colors cursor-pointer"
              title="Limpar período — considerar todo o histórico disponível"
            >
              <X size={11} />
              Limpar
            </button>
          )}
          {isCleared && (
            <button
              type="button"
              onClick={() => onYearsChange([new Date().getFullYear()])}
              className="text-brand hover:underline cursor-pointer"
              title="Voltar a filtrar por período"
            >
              Definir período
            </button>
          )}
        </div>
        {!isCleared && (
          <div className="flex items-center rounded-xl border border-ui-border bg-surface divide-x divide-ui-border-soft shadow-sm hover:shadow transition-shadow">
            <YearMultiSelect selectedYears={years} onChange={onYearsChange} />
            <MonthMultiSelect selectedMonths={selectedMonths} onChange={onMonthsChange} />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Cabeçalho de período das abas que não têm totais próprios (Imóveis, Clientes,
 * Mapa): a mesma moldura de cartão do FinancialDashboardHeader, com o seletor
 * e sem os tiles de Receitas/Despesas/Resultado — que são números financeiros
 * e não fazem sentido nessas abas.
 */
export default function PeriodFilterHeader(props: PeriodFilterProps) {
  return (
    <div className="bg-surface rounded-xl border border-ui-border-soft shadow-sm p-4 mb-4 flex flex-col lg:flex-row lg:items-center gap-4">
      <PeriodFilterSelector {...props} />
    </div>
  );
}
