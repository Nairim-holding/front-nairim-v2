'use client';

import { useMemo, Fragment, forwardRef, useImperativeHandle, useRef } from 'react';
import type { ReactNode } from 'react';
import { Repeat } from 'lucide-react';
import type { DashboardResponse, DashboardItem, CategoryDashboard, MonthlyData } from './types';

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined || value === 0) return '---';
  return Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatMonthHeader = (month: number, year: number): string => {
  const date = new Date(year, month - 1);
  const monthName = date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
  return monthName.charAt(0).toUpperCase() + monthName.slice(1).replace('.', '');
};


const getMonthlyValue = (monthlyData: MonthlyData[], month: number, year: number): number | null => {
  const found = monthlyData.find(m => m.month === month && m.year === year);
  return found ? found.realized_amount : null;
};

const getPlannedMonthlyValue = (monthlyValues: Array<{ month: number; amount: number }> | undefined, month: number): number | null => {
  if (!monthlyValues) return null;
  const found = monthlyValues.find(m => m.month === month);
  return found ? found.amount : null;
};

export const FIXED_COL_COUNT = 6;

export interface PlanningTableHandle {
  getTableElement: () => HTMLTableElement | null;
}

interface Props {
  data: DashboardResponse;
  dateRangeFrom?: string;
  viewMonths?: number | null;
  onEditItem?: (item: (DashboardItem | CategoryDashboard) & { parentCategoryId?: string }) => void;
  onSaveInline?: (item: { id: string; parentCategoryId?: string; amount: number }) => Promise<void>;
  balanceMonths?: { month: number; year: number }[];
  balances?: DashboardResponse['balances'];
  filterSlot?: ReactNode;
  statsSlot?: ReactNode;
}

const PlanningTable = forwardRef<PlanningTableHandle, Props>(({ data, dateRangeFrom, viewMonths, onEditItem, balanceMonths, balances, filterSlot, statsSlot }, ref) => {
  const tableRef = useRef<HTMLTableElement>(null);

  useImperativeHandle(ref, () => ({
    getTableElement: () => tableRef.current,
  }), []);

  const months = useMemo(() => {
    const [fromYear, fromMonth] = dateRangeFrom ? dateRangeFrom.split('-').slice(0, 2).map(Number) : [0, 0];
    const allMonths = new Set<string>();
    [...data.incomes, ...data.expenses].forEach(cat => {
      cat.monthly_data.forEach(m => {
        if (!fromYear || m.year > fromYear || (m.year === fromYear && m.month >= fromMonth)) {
          allMonths.add(JSON.stringify({ month: m.month, year: m.year }));
        }
      });
    });
    return Array.from(allMonths)
      .map(m => JSON.parse(m) as { month: number; year: number })
      .sort((a, b) => (a.year === b.year ? a.month - b.month : a.year - b.year));
  }, [data, dateRangeFrom]);

  // Janela do dropdown: últimos N meses do período (ou todos). Só afeta MIN/MÉD/MAX.
  const statsMonths = useMemo(() => {
    if (viewMonths && viewMonths > 0 && months.length > viewMonths) {
      return months.slice(months.length - viewMonths);
    }
    return months;
  }, [months, viewMonths]);

  // Calcula MIN/MÉD/MAX a partir do realizado (dados registrados) na janela statsMonths.
  const computeStats = (monthlyData: MonthlyData[]): { min: number | null; med: number; max: number | null } => {
    const vals = statsMonths
      .map(({ month, year }) => {
        const found = monthlyData.find(m => m.month === month && m.year === year);
        return found ? found.realized_amount : 0;
      })
      .filter(v => v > 0);
    if (vals.length === 0) return { min: null, med: 0, max: null };
    return {
      min: Math.min(...vals),
      med: Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100,
      max: Math.max(...vals),
    };
  };

  const startInlineEdit = (category: DashboardItem | CategoryDashboard, isEditable: boolean, parentId?: string) => {
    if (!isEditable) return;
    const itemToEdit: (DashboardItem | CategoryDashboard) & { parentCategoryId?: string } = { ...category };
    if (parentId) itemToEdit.parentCategoryId = parentId;
    onEditItem?.(itemToEdit);
  };

  const renderCategoryRow = (category: CategoryDashboard | DashboardItem, isSubcategory = false, parentId?: string) => {
    const hasSubcategories = !isSubcategory && 'subcategories' in category && category.subcategories.length > 0;
    const isEditable = !hasSubcategories;
    const stats = computeStats(category.monthly_data);
    // Mostra o ícone se há QUALQUER mês com valor variável, mesmo que o
    // valor do mês atual (coluna Planejamento) seja 0 / "---".
    const hasVariablePlan =
      category.planning_type === 'VARIABLE' &&
      (category.monthly_values?.some(mv => mv.amount > 0) ?? false);

    return (
      <tr
        key={category.id}
        className={`border-b border-ui-border-soft group ${isSubcategory ? 'hover:bg-surface-subtle/50' : 'bg-surface-subtle'}`}
        style={{ height: '32px' }}
      >
        <td className={`px-3 py-2 text-xs text-content font-medium sticky left-0 z-10 ${isSubcategory ? 'bg-surface pl-10' : 'bg-surface-subtle pl-6'}`}>
          {category.name}
        </td>
        <td
          className={`px-3 py-2 text-xs text-right font-medium sticky overflow-hidden ${isEditable ? 'cursor-pointer hover:opacity-80' : 'text-content-muted'} ${isSubcategory ? 'bg-surface' : 'bg-surface-subtle'}`}
          style={{ width: 160, maxWidth: 160, minWidth: 160, left: 240, zIndex: 9 }}
        >
          <div className="relative flex items-center justify-end gap-1">
            {hasVariablePlan && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); startInlineEdit(category, isEditable, parentId); }}
                className="shrink-0 text-brand hover:opacity-70 transition-opacity"
                title="Planejamento variável — clique para editar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 9 6" width="24" height="24" className="size-3"><path fillRule="evenodd" clipRule="evenodd" d="M6.04051 0.146074C5.95473 0.0849024 5.85753 0.0415979 5.75468 0.018734C5.65183 -0.00412991 5.54544 -0.00608681 5.44182 0.0129796C5.3382 0.0320461 5.23947 0.0717469 5.1515 0.129723C5.06352 0.187699 4.9881 0.262767 4.92972 0.350467L2.51002 3.97922L1.34342 2.81261C1.27038 2.73952 1.18366 2.68153 1.08821 2.64195C0.992757 2.60238 0.890447 2.58199 0.787118 2.58195C0.683788 2.58192 0.581464 2.60223 0.485986 2.64174C0.390508 2.68125 0.303747 2.73918 0.230656 2.81222C0.157566 2.88525 0.0995771 2.97197 0.060001 3.06742C0.0204248 3.16287 3.65475e-05 3.26518 4.90903e-08 3.36851C-3.64493e-05 3.47184 0.0202797 3.57417 0.0597884 3.66965C0.0992971 3.76512 0.157224 3.85188 0.230263 3.92497L2.0753 5.76922C2.15752 5.8516 2.25701 5.9147 2.36659 5.95395C2.47616 5.9932 2.59308 6.00763 2.70891 5.9962C2.82474 5.98477 2.93659 5.94776 3.03637 5.88784C3.13616 5.82792 3.2214 5.7466 3.28593 5.64973L5.78659 1.89756L7.70945 3.27092C7.87917 3.39205 8.09005 3.44081 8.29571 3.40646C8.50137 3.37211 8.68496 3.25747 8.8061 3.08775C8.92723 2.91804 8.97599 2.70716 8.94164 2.5015C8.90728 2.29583 8.79264 2.11224 8.62293 1.99111L6.04051 0.146074Z" fill="currentColor"></path></svg>
              </button>
            )}
            <span
              onClick={() => isEditable && startInlineEdit(category, isEditable, parentId)}
              className={`block text-right ${isEditable ? 'text-content hover:opacity-80' : ''}`}
            >
              {formatCurrency(category.planned_amount)}
            </span>
            {isEditable && (
              <button
                onClick={(e) => { e.stopPropagation(); startInlineEdit(category, isEditable, parentId); }}
                className="absolute inset-y-0 right-0 flex items-center px-1.5 rounded text-[10px] font-medium bg-surface-subtle/70 text-content-secondary hover:bg-brand hover:text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                title="Editar planejamento"
              >
                Editar
              </button>
            )}
          </div>
        </td>
        <td className={`px-3 py-2 text-xs text-right text-content-muted sticky z-[8] ${isSubcategory ? 'bg-surface' : 'bg-surface-subtle'} ${category.percentage > 100 && !isSubcategory ? 'text-red-600 font-semibold' : ''}`} style={{ width: 70, minWidth: 70, left: 400 }}>
          {category.percentage > 0 ? `${category.percentage.toFixed(2)}%` : '---'}
        </td>
        <td className={`px-3 py-2 text-xs text-center text-content-muted border-l border-ui-border-soft whitespace-nowrap sticky z-[7] ${isSubcategory ? 'bg-surface' : 'bg-surface-subtle'}`} style={{ width: 90, minWidth: 90, left: 470 }}>{formatCurrency(stats.min)}</td>
        <td className={`px-3 py-2 text-xs text-center text-content-muted whitespace-nowrap sticky z-[6] ${isSubcategory ? 'bg-surface' : 'bg-surface-subtle'}`} style={{ width: 90, minWidth: 90, left: 560 }}>{formatCurrency(stats.med)}</td>
        <td className={`px-3 py-2 text-xs text-center text-content-muted whitespace-nowrap sticky z-[5] ${isSubcategory ? 'bg-surface' : 'bg-surface-subtle'}`} style={{ width: 90, minWidth: 90, left: 650 }}>{formatCurrency(stats.max)}</td>
        {months.map(({ month, year }) => {
          const plannedValue = getPlannedMonthlyValue(category.monthly_values, month);
          const realizedValue = getMonthlyValue(category.monthly_data, month, year);
          const isExpense = 'type' in category && category.type === 'EXPENSE';
          const isOverBudget = isExpense && plannedValue !== null && realizedValue !== null && realizedValue > plannedValue;

          const hasRealized = realizedValue !== null && realizedValue !== 0;
          const hasPlanned = plannedValue !== null && plannedValue !== 0;
          const isVariable = category.planning_type === 'VARIABLE';

          return (
            <td
              key={`${month}-${year}`}
              className={`px-3 py-2 text-xs text-right whitespace-nowrap border-l border-ui-border-soft relative z-0 ${isExpense ? 'text-red-600' : 'text-green-600'} ${isOverBudget ? 'font-semibold text-red-700' : ''}`}
              title={`Planejado: ${plannedValue !== null ? formatCurrency(plannedValue) : '---'} | Realizado: ${realizedValue !== null ? formatCurrency(realizedValue) : '---'}`}
            >
              {hasRealized ? (
                <span className="inline-flex items-center justify-end gap-1">
                  {isVariable && <Repeat size={10} className="shrink-0 opacity-70" />}
                  {(isOverBudget ? '▲ ' : '') + formatCurrency(realizedValue)}
                </span>
              ) : hasPlanned ? (
                <span className="inline-flex items-center justify-end gap-1 text-content-muted/60 italic" title="Valor planejado (sem realizado)">
                  {isVariable && <Repeat size={10} className="shrink-0" />}
                  {formatCurrency(plannedValue)}
                </span>
              ) : (
                '---'
              )}
            </td>
          );
        })}
      </tr>
    );
  };

  const renderGlobalRow = (category: CategoryDashboard | DashboardItem, bgColor: string, isIncome: boolean) => (
    <tr style={{ backgroundColor: bgColor }}>
      <td className="px-3 py-2 text-xs font-bold text-white sticky left-0 z-10 pl-6" style={{ backgroundColor: bgColor }}>{category.name}</td>
      <td className="px-3 py-2 text-xs font-bold text-white text-right sticky z-[9]" style={{ width: 160, minWidth: 160, left: 240, backgroundColor: bgColor }}>{formatCurrency(category.planned_amount)}</td>
      <td className="px-3 py-2 text-xs font-bold text-white text-right sticky z-[8]" style={{ width: 70, minWidth: 70, left: 400, backgroundColor: bgColor }}>{category.percentage > 0 ? `${category.percentage.toFixed(2)}%` : '---'}</td>
      <td className="px-3 py-2 text-xs font-bold text-white text-center border-l border-white/20 sticky z-[7]" style={{ width: 90, minWidth: 90, left: 470, backgroundColor: bgColor }}>Min</td>
      <td className="px-3 py-2 text-xs font-bold text-white text-center sticky z-[6]" style={{ width: 90, minWidth: 90, left: 560, backgroundColor: bgColor }}>Méd</td>
      <td className="px-3 py-2 text-xs font-bold text-white text-center sticky z-[5]" style={{ width: 90, minWidth: 90, left: 650, backgroundColor: bgColor }}>Max</td>
      {months.map(({ month, year }) => {
        const monthVal = getMonthlyValue(category.monthly_data, month, year);
        const plannedVal = getPlannedMonthlyValue(category.monthly_values, month);
        return (
          <td
            key={`${isIncome ? 'income' : 'expense'}-global-${month}-${year}`}
            className="px-3 py-2 text-xs font-bold text-white text-right border-l border-white/20 relative z-0"
            title={`Planejado: ${plannedVal !== null ? formatCurrency(plannedVal) : '---'}`}
          >
            {monthVal === null || monthVal === 0 ? '---' : formatCurrency(monthVal)}
          </td>
        );
      })}
    </tr>
  );

  const thClass = 'px-3 py-2 text-xs font-semibold text-content-secondary whitespace-nowrap text-right';

  const balanceFmt = (v: number | null) =>
    v === null ? '---' : (v < 0 ? '-' : '') + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const balanceColor = (v: number | null) =>
    v === null ? 'text-content-muted' : v >= 0 ? 'text-green-600' : 'text-red-600';

  // Offsets verticais do cabeçalho fixo (sticky). As linhas de saldo têm altura
  // forçada (h-[34px]) e o espaçador h-[25px] para que os tops sejam determinísticos.
  // Cada linha sobrepõe a anterior em 1px para não haver frestas (sub-pixel) por
  // onde o conteúdo colorido rolado apareceria por trás do cabeçalho.
  const hasBalances = !!(balanceMonths && balanceMonths.length > 0 && balances);
  const BALANCE_ROW_H = 34;
  const SPACER_H = 25;
  const row1Top = 0;
  const row2Top = BALANCE_ROW_H - 1;
  const spacerTop = BALANCE_ROW_H * 2 - 2;
  const headerTop = hasBalances ? BALANCE_ROW_H * 2 + SPACER_H - 3 : 0;

  return (
    <div className="rounded-xl">
      <table ref={tableRef} className="w-full border-collapse text-sm">
        <thead>
          {hasBalances && balanceMonths && balances && (
            <>
              <tr className="h-[34px] bg-page">
                <th className="bg-page sticky z-30" style={{ left: 0, top: row1Top, minWidth: 240, width: 240 }} />
                <th className="bg-page sticky z-[29]" style={{ left: 240, top: row1Top, width: 160, minWidth: 160 }} />
                <th className="bg-page sticky z-[28]" style={{ left: 400, top: row1Top, width: 70, minWidth: 70 }} />
                <th className="bg-page sticky z-[27]" style={{ left: 470, top: row1Top, width: 90, minWidth: 90 }} />
                <th className="bg-page sticky z-[26]" style={{ left: 560, top: row1Top, width: 90, minWidth: 90 }} />
                <th className="px-4 py-2 text-xs font-semibold text-content-secondary bg-page whitespace-nowrap text-right sticky z-[25] border-r border-ui-border-soft bg-surface-subtle " style={{ left: 650, top: row1Top, width: 90, minWidth: 90, borderTopLeftRadius: '0.75rem' }}>Saldo Acumulado</th>
                {months.map(({ month, year }) => {
                  const inBal = balanceMonths.some(b => b.month === month && b.year === year);
                  const v = inBal ? (balances.accumulated.find(b => b.month === month && b.year === year)?.realized_amount ?? null) : null;
                  return (
                    <th key={`acc-${month}-${year}`} className={`border px-3 py-2 text-xs text-right font-semibold border-l border-ui-border-soft whitespace-nowrap bg-page sticky z-20 ${balanceColor(v)}`} style={{ top: row1Top }}>
                      {balanceFmt(v)}
                    </th>
                  );
                })}
              </tr>
              <tr className="h-[34px] bg-page">
                <th className="bg-page sticky z-30 px-3 py-1" style={{ left: 0, top: row2Top, minWidth: 240, width: 240 }}>{filterSlot}</th>
                <th className="bg-page sticky z-[29]" style={{ left: 240, top: row2Top, width: 160, minWidth: 160 }} />
                <th className="bg-page sticky z-[28]" style={{ left: 400, top: row2Top, width: 70, minWidth: 70 }} />
                <th className="bg-page sticky z-[27]" style={{ left: 470, top: row2Top, width: 90, minWidth: 90 }} />
                <th className="bg-page sticky z-[26]" style={{ left: 560, top: row2Top, width: 90, minWidth: 90 }} />
                <th className="px-4 py-2 text-xs font-semibold text-content-secondary bg-page whitespace-nowrap text-right sticky z-[25] border-r border-ui-border-soft bg-surface-subtle " style={{ left: 650, top: row2Top, width: 90, minWidth: 90, borderBottomLeftRadius: '0.75rem' }}>Saldo Mensal</th>
                {months.map(({ month, year }) => {
                  const inBal = balanceMonths.some(b => b.month === month && b.year === year);
                  const v = inBal ? (balances.monthly.find(b => b.month === month && b.year === year)?.realized_amount ?? null) : null;
                  return (
                    <th key={`monthly-${month}-${year}`} className={`border px-3 py-2 text-xs text-right font-semibold border-l border-ui-border-soft whitespace-nowrap bg-page sticky z-20 ${balanceColor(v)}`} style={{ top: row2Top }}>
                      {balanceFmt(v)}
                    </th>
                  );
                })}
              </tr>
              <tr className="h-[25px] bg-page">
                <th colSpan={FIXED_COL_COUNT + months.length} className="bg-page sticky z-20" style={{ top: spacerTop }} />
              </tr>
            </>
          )}
          <tr className="bg-surface-subtle border-b border-ui-border-soft">
            <th className="px-3 py-2 text-xs font-semibold text-content-secondary text-left whitespace-nowrap sticky left-0 z-30 bg-surface-subtle min-w-[240px]" style={{ top: headerTop }}>
              Categorias e Subcategorias
            </th>
            <th className={`${thClass} sticky z-[29] bg-surface-subtle`} style={{ width: 160, minWidth: 160, left: 240, top: headerTop }}>Planejamento</th>
            <th className={`${thClass} text-center sticky z-[28] bg-surface-subtle`} style={{ width: 70, minWidth: 70, left: 400, top: headerTop }}>%</th>
            <th className="sticky z-[27] bg-surface-subtle border-l border-ui-border-soft text-center" style={{ width: 270, minWidth: 270, left: 470, top: headerTop }} colSpan={3}>
              <div className="flex items-center justify-center py-1">
                {statsSlot}
              </div>
            </th>
            {months.map(({ month, year }) => (
              <th key={`${month}-${year}`} className={`${thClass} border-l border-ui-border-soft sticky z-20 bg-surface-subtle`} style={{ top: headerTop }}>
                {formatMonthHeader(month, year)}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {data.incomes.length > 0 && (
            <>
              {renderGlobalRow(data.incomes[0], '#0d9488', true)}
              {data.incomes.slice(1).map(category => (
                <Fragment key={`income-${category.id}`}>
                  {renderCategoryRow(category)}
                  {category.subcategories.map(sub => (
                    <Fragment key={`sub-${sub.id}`}>{renderCategoryRow(sub, true, category.id)}</Fragment>
                  ))}
                </Fragment>
              ))}
            </>
          )}
          {data.expenses.length > 0 && (
            <>
              {renderGlobalRow(data.expenses[0], '#ea580c', false)}
              {data.expenses.slice(1).map(category => (
                <Fragment key={`expense-${category.id}`}>
                  {renderCategoryRow(category)}
                  {category.subcategories.map(sub => (
                    <Fragment key={`sub-${sub.id}`}>{renderCategoryRow(sub, true, category.id)}</Fragment>
                  ))}
                </Fragment>
              ))}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
});

PlanningTable.displayName = 'PlanningTable';

export default PlanningTable;
