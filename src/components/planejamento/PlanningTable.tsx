'use client';

import { useMemo, Fragment, forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Calendar } from 'lucide-react';
import { parseCurrencyFromPTBR } from '@/utils/displayFormatters';
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

const formatCurrencyRealtime = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length === 0) return '';

  const trimmedNumbers = numbers.replace(/^0+/, '') || '0';
  const amount = parseInt(trimmedNumbers) / 100;

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
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
  onEditItem?: (item: (DashboardItem | CategoryDashboard) & { parentCategoryId?: string }) => void;
  onSaveInline?: (item: { id: string; parentCategoryId?: string; amount: number }) => Promise<void>;
  balanceMonths?: { month: number; year: number }[];
  balances?: DashboardResponse['balances'];
}

const PlanningTable = forwardRef<PlanningTableHandle, Props>(({ data, dateRangeFrom, onEditItem, onSaveInline, balanceMonths, balances }, ref) => {
  const tableRef = useRef<HTMLTableElement>(null);
  const [inlineEditing, setInlineEditing] = useState<{ id: string; parentId?: string; value: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const handleInlineSave = async (categoryId: string, parentId: string | undefined) => {
    if (!inlineEditing || !onSaveInline) return;
    if (inlineEditing.id !== categoryId || inlineEditing.parentId !== parentId) return;
    const numValue = parseCurrencyFromPTBR(inlineEditing.value);
    console.log('[PlanningTable] Inline save:', { raw: inlineEditing.value, parsed: numValue });
    if (numValue <= 0) {
      console.warn('[PlanningTable] Value <= 0, aborting');
      return;
    }
    await onSaveInline({ id: categoryId, parentCategoryId: parentId, amount: numValue });
    setInlineEditing(null);
  };

  const handleInlineKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, categoryId: string, parentId: string | undefined) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleInlineSave(categoryId, parentId);
    } else if (e.key === 'Escape') {
      setInlineEditing(null);
    }
  };

  const startInlineEdit = (category: DashboardItem | CategoryDashboard, isEditable: boolean, parentId?: string) => {
    if (!isEditable) return;
    setInlineEditing({
      id: category.id,
      parentId,
      value: category.planned_amount > 0
        ? category.planned_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '',
    });
  };

  const renderCategoryRow = (category: CategoryDashboard | DashboardItem, isSubcategory = false, parentId?: string) => {
    const hasSubcategories = !isSubcategory && 'subcategories' in category && category.subcategories.length > 0;
    const isEditable = !hasSubcategories;

    const handleEdit = (initialPlanType?: 'FIXED' | 'VARIABLE') => {
      const itemToEdit: (DashboardItem | CategoryDashboard) & { parentCategoryId?: string; initialPlanType?: 'FIXED' | 'VARIABLE' } = { ...category };
      if (parentId) itemToEdit.parentCategoryId = parentId;
      if (initialPlanType) itemToEdit.initialPlanType = initialPlanType;
      onEditItem?.(itemToEdit);
    };

    const isEditingInline = inlineEditing?.id === category.id && inlineEditing?.parentId === parentId;

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
          {isEditingInline ? (
            <div className="flex items-center gap-0.5 h-full w-full">
              <button
                onClick={(e) => { e.stopPropagation(); handleEdit('VARIABLE'); }}
                className="shrink-0 p-1 rounded hover:bg-surface-muted text-content-muted hover:text-brand"
                title="Editar por mês (renda variável)"
              >
                <Calendar size={12} />
              </button>
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                value={inlineEditing.value}
                onChange={(e) => setInlineEditing(prev => prev ? { ...prev, value: formatCurrencyRealtime(e.target.value) } : null)}
                onKeyDown={(e) => handleInlineKeyDown(e, category.id, parentId)}
                className="flex-1 min-w-0 px-1 text-xs text-right border border-brand rounded bg-surface focus:outline-none text-content h-full"
                autoFocus
              />
              <button
                onClick={() => handleInlineSave(category.id, parentId)}
                className="shrink-0 p-1 rounded hover:bg-green-100 text-green-600"
                title="Salvar"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
              <button
                onClick={() => setInlineEditing(null)}
                className="shrink-0 p-1 rounded hover:bg-red-100 text-red-500"
                title="Cancelar"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          ) : (
            <div className="relative flex items-center">
              <span
                onClick={() => isEditable && startInlineEdit(category, isEditable, parentId)}
                className={`block w-full text-right ${isEditable ? 'text-content hover:opacity-80' : ''}`}
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
          )}
        </td>
        <td className={`px-3 py-2 text-xs text-right text-content-muted sticky z-[8] ${isSubcategory ? 'bg-surface' : 'bg-surface-subtle'} ${category.percentage > 100 && !isSubcategory ? 'text-red-600 font-semibold' : ''}`} style={{ width: 70, minWidth: 70, left: 400 }}>
          {category.percentage > 0 ? `${category.percentage.toFixed(2)}%` : '---'}
        </td>
        <td className={`px-3 py-2 text-xs text-right text-content-muted border-l border-ui-border-soft whitespace-nowrap sticky z-[7] ${isSubcategory ? 'bg-surface' : 'bg-surface-subtle'}`} style={{ width: 90, minWidth: 90, left: 470 }}>{formatCurrency(category.min)}</td>
        <td className={`px-3 py-2 text-xs text-right text-content-muted whitespace-nowrap sticky z-[6] ${isSubcategory ? 'bg-surface' : 'bg-surface-subtle'}`} style={{ width: 90, minWidth: 90, left: 560 }}>{formatCurrency(category.med)}</td>
        <td className={`px-3 py-2 text-xs text-right text-content-muted whitespace-nowrap sticky z-[5] ${isSubcategory ? 'bg-surface' : 'bg-surface-subtle'}`} style={{ width: 90, minWidth: 90, left: 650 }}>{formatCurrency(category.max)}</td>
        {months.map(({ month, year }) => {
          const plannedValue = getPlannedMonthlyValue(category.monthly_values, month);
          const realizedValue = getMonthlyValue(category.monthly_data, month, year);
          const isExpense = 'type' in category && category.type === 'EXPENSE';
          const isOverBudget = isExpense && plannedValue !== null && realizedValue !== null && realizedValue > plannedValue;

          return (
            <td
              key={`${month}-${year}`}
              className={`px-3 py-2 text-xs text-right whitespace-nowrap border-l border-ui-border-soft relative z-0 ${isExpense ? 'text-red-600' : 'text-green-600'} ${isOverBudget ? 'font-semibold text-red-700' : ''}`}
              title={`Planejado: ${plannedValue !== null ? formatCurrency(plannedValue) : '---'} | Realizado: ${realizedValue !== null ? formatCurrency(realizedValue) : '---'}`}
            >
              {realizedValue === null ? '---' : (isOverBudget ? '▲ ' : '') + formatCurrency(realizedValue)}
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
      <td className="px-3 py-2 text-xs font-bold text-white text-center sticky z-[8]" style={{ width: 70, minWidth: 70, left: 400, backgroundColor: bgColor }}>{category.percentage > 0 ? `${category.percentage.toFixed(2)}%` : '---'}</td>
      <td className="px-3 py-2 text-xs font-bold text-white text-right border-l border-white/20 sticky z-[7]" style={{ width: 90, minWidth: 90, left: 470, backgroundColor: bgColor }}>{formatCurrency(category.min)}</td>
      <td className="px-3 py-2 text-xs font-bold text-white text-right sticky z-[6]" style={{ width: 90, minWidth: 90, left: 560, backgroundColor: bgColor }}>{formatCurrency(category.med)}</td>
      <td className="px-3 py-2 text-xs font-bold text-white text-right sticky z-[5]" style={{ width: 90, minWidth: 90, left: 650, backgroundColor: bgColor }}>{formatCurrency(category.max)}</td>
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

  return (
    <div className="rounded-xl border border-ui-border-soft">
      <table ref={tableRef} className="w-full border-collapse text-sm">
        <thead>
          {balanceMonths && balanceMonths.length > 0 && balances && (
            <>
              <tr>
                <th className="bg-page sticky z-10" style={{ left: 0, minWidth: 240, width: 240 }} />
                <th className="bg-page sticky z-[9]" style={{ left: 240, width: 160, minWidth: 160 }} />
                <th className="bg-page sticky z-[8]" style={{ left: 400, width: 70, minWidth: 70 }} />
                <th className="bg-page sticky z-[7]" style={{ left: 470, width: 90, minWidth: 90 }} />
                <th className="bg-page sticky z-[6]" style={{ left: 560, width: 90, minWidth: 90 }} />
                <th className="px-4 py-2 text-xs font-semibold text-content-secondary bg-page whitespace-nowrap text-right sticky z-[5] border-r border-ui-border-soft bg-surface-subtle " style={{ left: 650, width: 90, minWidth: 90, borderTopLeftRadius: '0.75rem' }}>Saldo Acumulado</th>
                {months.map(({ month, year }) => {
                  const inBal = balanceMonths.some(b => b.month === month && b.year === year);
                  const v = inBal ? (balances.accumulated.find(b => b.month === month && b.year === year)?.realized_amount ?? null) : null;
                  return (
                    <th key={`acc-${month}-${year}`} className={`px-3 py-2 text-xs text-right font-semibold border-l border-ui-border-soft whitespace-nowrap bg-page ${balanceColor(v)}`}>
                      {balanceFmt(v)}
                    </th>
                  );
                })}
              </tr>
              <tr className="border-b-2 border-ui-border-soft">
                <th className="bg-page sticky z-10" style={{ left: 0, minWidth: 240, width: 240 }} />
                <th className="bg-page sticky z-[9]" style={{ left: 240, width: 160, minWidth: 160 }} />
                <th className="bg-page sticky z-[8]" style={{ left: 400, width: 70, minWidth: 70 }} />
                <th className="bg-page sticky z-[7]" style={{ left: 470, width: 90, minWidth: 90 }} />
                <th className="bg-page sticky z-[6]" style={{ left: 560, width: 90, minWidth: 90 }} />
                <th className="px-4 py-2 text-xs font-semibold text-content-secondary bg-page whitespace-nowrap text-right sticky z-[5] border-r border-ui-border-soft bg-surface-subtle " style={{ left: 650, width: 90, minWidth: 90, borderBottomLeftRadius: '0.75rem' }}>Saldo Mensal</th>
                {months.map(({ month, year }) => {
                  const inBal = balanceMonths.some(b => b.month === month && b.year === year);
                  const v = inBal ? (balances.monthly.find(b => b.month === month && b.year === year)?.realized_amount ?? null) : null;
                  return (
                    <th key={`monthly-${month}-${year}`} className={`px-3 py-2 text-xs text-right font-semibold border-l border-ui-border-soft whitespace-nowrap bg-page ${balanceColor(v)}`}>
                      {balanceFmt(v)}
                    </th>
                  );
                })}
              </tr>
            </>
          )}
          <tr className="bg-surface-subtle border-b border-ui-border-soft">
            <th className="px-3 py-2 text-xs font-semibold text-content-secondary text-left whitespace-nowrap sticky left-0 z-10 bg-surface-subtle min-w-[240px]">
              Categorias e Subcategorias
            </th>
            <th className={`${thClass} sticky z-[9] bg-surface-subtle`} style={{ width: 160, minWidth: 160, left: 240 }}>Planejamento</th>
            <th className={`${thClass} text-center sticky z-[8] bg-surface-subtle`} style={{ width: 70, minWidth: 70, left: 400 }}>%</th>
            <th className={`${thClass} border-l border-ui-border-soft sticky z-[7] bg-surface-subtle`} style={{ width: 90, minWidth: 90, left: 470 }}>Min</th>
            <th className={`${thClass} sticky z-[6] bg-surface-subtle`} style={{ width: 90, minWidth: 90, left: 560 }}>Méd</th>
            <th className={`${thClass} sticky z-[5] bg-surface-subtle`} style={{ width: 90, minWidth: 90, left: 650 }}>Max</th>
            {months.map(({ month, year }) => (
              <th key={`${month}-${year}`} className={`${thClass} border-l border-ui-border-soft relative z-0`}>
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
