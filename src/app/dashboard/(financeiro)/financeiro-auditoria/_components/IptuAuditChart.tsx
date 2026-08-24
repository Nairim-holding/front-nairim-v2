'use client';

import { useMemo } from 'react';
import ChartCard from '@/components/dashboard/ChartCard';
import RowHoverTooltip from '@/components/dashboard/RowHoverTooltip';
import type { IptuAuditRow } from './IptuAuditTable';

interface IptuAuditChartProps {
  rows: IptuAuditRow[];
  isLoading: boolean;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getPropertyInitials(title: string): string {
  if (!title) return 'IM';
  const clean = title.replace(/^(Imóvel|Casa|Apartamento|Sala|Terreno|Galpão|Prédio|Área)\s+/i, '').trim();
  const target = clean || title;
  const parts = target.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return target.slice(0, 2).toUpperCase();
}

/**
 * Gráfico de barras horizontais duplas por imóvel — estilo CardUsageChart:
 * - Barra mais clara: Receitas de Restituição do IPTU do imóvel (CR)
 * - Barra mais escura: Despesas de Pagamento do IPTU do imóvel (DB)
 * - Tooltip ao passar o mouse: Valor Restituição do IPTU (CR), Valor pago do IPTU (DB) e Saldo.
 */
export default function IptuAuditChart({ rows, isLoading }: IptuAuditChartProps) {
  // Apenas imóveis com movimento
  const sortedRows = useMemo(
    () =>
      rows
        .filter((r) => r.income !== 0 || r.expense !== 0)
        .sort((a, b) => Math.max(b.expense, b.income) - Math.max(a.expense, a.income)),
    [rows],
  );

  // Maior valor global para normalizar a escala das barras horizontais
  const maxOverall = useMemo(
    () => Math.max(...sortedRows.map((r) => Math.max(r.income, r.expense)), 1),
    [sortedRows],
  );

  const totalDespesas = useMemo(
    () => sortedRows.reduce((sum, r) => sum + r.expense, 0),
    [sortedRows],
  );

  const totalReceitas = useMemo(
    () => sortedRows.reduce((sum, r) => sum + r.income, 0),
    [sortedRows],
  );

  const detailData = useMemo(
    () =>
      sortedRows.map((r) => ({
        property: r.propertyTitle,
        income: r.income,
        expense: r.expense,
        balance: r.balance,
      })),
    [sortedRows],
  );

  const detailColumns = useMemo(
    () => [
      { key: 'property', label: 'Imóvel' },
      { key: 'income', label: 'Restituição (CR)', format: (v: number) => formatCurrency(v), summable: true },
      { key: 'expense', label: 'IPTU Pago (DB)', format: (v: number) => formatCurrency(v), summable: true },
      { key: 'balance', label: 'Saldo', format: (v: number) => formatCurrency(v), summable: true },
    ],
    [],
  );

  return (
    <div className="h-[340px] flex flex-col bg-surface border border-ui-border-soft rounded-xl shadow-sm overflow-hidden">
      <ChartCard
        title="RECEITA X DESPESA DE IPTU POR IMÓVEL"
        isDraggable={false}
        detailData={detailData}
        detailColumns={detailColumns}
      >
        {() => (
          <div className="w-full h-full flex flex-col p-3">
            {/* Header com Legenda e Totais */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-ui-border-soft shrink-0">
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5 font-medium text-content-secondary">
                  <span className="w-3 h-3 rounded-sm bg-orange-300 dark:bg-orange-400/50 border border-orange-400/40 shrink-0" />
                  <span>Receita (Restituição)</span>
                </div>
                <div className="flex items-center gap-1.5 font-medium text-content-secondary">
                  <span className="w-3 h-3 rounded-sm bg-orange-600 dark:bg-orange-500 shrink-0" />
                  <span>Despesa (IPTU Pago)</span>
                </div>
              </div>

              <div className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate hidden sm:block">
                TOTAL PAGO:{' '}
                <span className="text-orange-600 dark:text-orange-400 font-extrabold">
                  {formatCurrency(totalDespesas)}
                </span>
              </div>
            </div>

            {isLoading ? (
              <div className="flex-1 flex items-center justify-center text-content-muted text-sm">
                Carregando...
              </div>
            ) : sortedRows.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-content-muted text-sm text-center px-4">
                Nenhum lançamento de IPTU no período selecionado.
              </div>
            ) : (
              <div className="flex-1 flex flex-col gap-2.5 overflow-y-auto min-h-0 pr-1">
                {sortedRows.map((row) => {
                  const incomeWidth = Math.min((row.income / maxOverall) * 100, 100);
                  const expenseWidth = Math.min((row.expense / maxOverall) * 100, 100);

                  return (
                    <RowHoverTooltip
                      key={row.propertyId}
                      className="flex items-center gap-3 text-xs py-0.5 hover:bg-surface-subtle/60 rounded-lg px-1 transition-colors"
                      title={row.propertyTitle}
                      rows={[
                        { label: 'Valor Restituição do IPTU (CR)', value: formatCurrency(row.income) },
                        { label: 'Valor pago do IPTU (DB)', value: formatCurrency(row.expense) },
                        { label: 'Saldo', value: formatCurrency(row.balance) },
                      ]}
                    >
                      {/* Ícone do Imóvel + Nome */}
                      <div className="flex items-center gap-2 w-36 sm:w-44 shrink-0 min-w-0">
                        <div className="w-6 h-6 rounded bg-orange-500/15 text-orange-600 dark:text-orange-400 dark:bg-orange-500/25 flex items-center justify-center font-extrabold text-[10px] border border-orange-500/20 shrink-0">
                          {getPropertyInitials(row.propertyTitle)}
                        </div>
                        <span className="font-bold text-slate-700 dark:text-slate-200 truncate" title={row.propertyTitle}>
                          {row.propertyTitle}
                        </span>
                      </div>

                      {/* Trilha das Barras Horizontais Duplas */}
                      <div className="flex-1 flex flex-col justify-center gap-1 min-w-[80px]">
                        {/* Barra Clara: Receitas de Restituição do IPTU */}
                        <div className="w-full h-3 rounded bg-orange-50 dark:bg-slate-800/80 relative overflow-hidden">
                          <div
                            className="absolute left-0 top-0 bottom-0 rounded bg-orange-300 dark:bg-orange-400/60 transition-all duration-500"
                            style={{ width: `${Math.max(incomeWidth, 1)}%` }}
                          />
                        </div>

                        {/* Barra Escura: Despesas de Pagamento do IPTU */}
                        <div className="w-full h-3 rounded bg-orange-50 dark:bg-slate-800/80 relative overflow-hidden">
                          <div
                            className="absolute left-0 top-0 bottom-0 rounded bg-orange-600 dark:bg-orange-500 transition-all duration-500"
                            style={{ width: `${Math.max(expenseWidth, 1)}%` }}
                          />
                        </div>
                      </div>

                      {/* Saldo à Direita */}
                      <div className="w-24 sm:w-28 text-right shrink-0">
                        <span
                          className={`font-extrabold text-xs tracking-tight ${
                            row.balance < 0 ? 'text-state-error' : row.balance > 0 ? 'text-state-success' : 'text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {formatCurrency(row.balance)}
                        </span>
                      </div>
                    </RowHoverTooltip>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </ChartCard>
    </div>
  );
}
