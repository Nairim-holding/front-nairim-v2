'use client';

import { useMemo, Fragment } from 'react';
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

interface Props {
  data: DashboardResponse;
  onEditItem?: (item: DashboardItem | CategoryDashboard) => void;
}

export default function PlanningTable({ data, onEditItem }: Props) {
  const months = useMemo(() => {
    const allMonths = new Set<string>();
    [...data.incomes, ...data.expenses].forEach(cat => {
      cat.monthly_data.forEach(m => {
        allMonths.add(JSON.stringify({ month: m.month, year: m.year }));
      });
    });
    return Array.from(allMonths)
      .map(m => JSON.parse(m) as { month: number; year: number })
      .sort((a, b) => (a.year === b.year ? a.month - b.month : a.year - b.year));
  }, [data]);

  const renderCategoryRow = (category: CategoryDashboard | DashboardItem, isSubcategory: boolean = false) => {
    const hasSubcategories = !isSubcategory && 'subcategories' in category && category.subcategories.length > 0;
    const isEditable = !hasSubcategories;

    return (
      <tr
        key={category.id}
        className={`border-b border-ui-border-soft ${isSubcategory ? 'hover:bg-surface-subtle/50' : 'bg-surface-subtle'}`}
      >
        <td
          className={`px-3 py-2 text-xs text-content font-medium sticky left-0 ${isSubcategory ? 'bg-surface pl-10' : 'bg-surface-subtle pl-6'}`}
        >
          {category.name}
        </td>
        <td
          onClick={() => isEditable && onEditItem?.(category)}
          onKeyDown={(e) => {
            if (isEditable && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              onEditItem?.(category);
            }
          }}
          tabIndex={isEditable ? 0 : -1}
          role={isEditable ? 'button' : undefined}
          className={`px-3 py-2 text-xs text-right whitespace-nowrap font-medium transition-opacity focus:outline-none rounded ${
            isEditable
              ? 'cursor-pointer hover:opacity-80 focus:ring-2 focus:ring-brand'
              : 'text-content-muted'
          }`}
          style={isEditable ? { backgroundColor: '#fef9c3' } : {}}
        >
          <span className={isEditable ? 'text-black' : ''}>{formatCurrency(category.planned_amount)}</span>
        </td>
        <td
          className={`px-3 py-2 text-xs text-right text-content-muted ${category.percentage > 100 && !isSubcategory ? 'text-red-600 font-semibold' : ''}`}
        >
          {category.percentage > 0 ? `${category.percentage.toFixed(2)}%` : '---'}
        </td>
        <td className="px-3 py-2 text-xs text-right text-content-muted border-l border-ui-border-soft whitespace-nowrap">
          {formatCurrency(category.min)}
        </td>
        <td className="px-3 py-2 text-xs text-right text-content-muted whitespace-nowrap">
          {formatCurrency(category.med)}
        </td>
        <td className="px-3 py-2 text-xs text-right text-content-muted whitespace-nowrap">
          {formatCurrency(category.max)}
        </td>
        {months.map(({ month, year }) => {
          const value = getMonthlyValue(category.monthly_data, month, year);
          const isExpense = 'type' in category && category.type === 'EXPENSE';
          const isOverBudget =
            isExpense && category.planned_amount > 0 && value !== null && value > category.planned_amount;

          return (
            <td
              key={`${month}-${year}`}
              className={`px-3 py-2 text-xs text-right whitespace-nowrap border-l border-ui-border-soft ${
                isExpense ? 'text-red-600' : 'text-green-600'
              } ${isOverBudget ? 'font-semibold text-red-700' : ''}`}
            >
              {value === null ? '---' : (isOverBudget ? '▲ ' : '') + formatCurrency(value)}
            </td>
          );
        })}
      </tr>
    );
  };

  const thClass = 'px-3 py-2 text-xs font-semibold text-content-secondary whitespace-nowrap text-right';

  return (
    <div className="overflow-auto rounded-xl border border-ui-border-soft">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-surface-subtle border-b border-ui-border-soft">
            <th className="px-3 py-2 text-xs font-semibold text-content-secondary text-left whitespace-nowrap sticky left-0 bg-surface-subtle min-w-[240px]">
              Categorias e Subcategorias
            </th>
            <th className={thClass}>Planejamento</th>
            <th className={`${thClass} text-center`}>%</th>
            <th className={`${thClass} border-l border-ui-border-soft`}>Min</th>
            <th className={thClass}>Méd</th>
            <th className={thClass}>Max</th>
            {months.map(({ month, year }) => (
              <th key={`${month}-${year}`} className={`${thClass} border-l border-ui-border-soft`}>
                {formatMonthHeader(month, year)}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {data.incomes.length > 0 && (
            <>
              <tr style={{ backgroundColor: '#0d9488' }}>
                <td className="px-3 py-2 text-xs font-bold text-white sticky left-0 pl-6" style={{ backgroundColor: '#0d9488' }}>
                  Receitas
                </td>
                <td className="px-3 py-2 text-xs font-bold text-white text-right">
                  {data.incomes.reduce((sum, cat) => sum + cat.planned_amount, 0).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                  })}
                </td>
                <td className="px-3 py-2 text-xs font-bold text-white text-center">100%</td>
                <td className="px-3 py-2 text-xs font-bold text-white text-right border-l border-white/20">---</td>
                <td className="px-3 py-2 text-xs font-bold text-white text-right">---</td>
                <td className="px-3 py-2 text-xs font-bold text-white text-right">---</td>
                {months.map(({ month, year }) => (
                  <td
                    key={`total-${month}-${year}`}
                    className="px-3 py-2 text-xs font-bold text-white text-right border-l border-white/20"
                  >
                    {data.incomes.reduce((sum, cat) => {
                      const monthVal = getMonthlyValue(cat.monthly_data, month, year);
                      return sum + (monthVal ?? 0);
                    }, 0) === 0
                      ? '---'
                      : data.incomes
                          .reduce((sum, cat) => {
                            const monthVal = getMonthlyValue(cat.monthly_data, month, year);
                            return sum + (monthVal ?? 0);
                          }, 0)
                          .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                ))}
              </tr>
              {data.incomes.map(category => (
                <Fragment key={`income-${category.id}`}>
                  {renderCategoryRow(category)}
                  {category.subcategories.map(sub => (
                    <Fragment key={`sub-${sub.id}`}>{renderCategoryRow(sub, true)}</Fragment>
                  ))}
                </Fragment>
              ))}
            </>
          )}

          {data.expenses.length > 0 && (
            <>
              <tr style={{ backgroundColor: '#ea580c' }}>
                <td className="px-3 py-2 text-xs font-bold text-white sticky left-0 pl-6" style={{ backgroundColor: '#ea580c' }}>
                  Despesas Mensais
                </td>
                <td className="px-3 py-2 text-xs font-bold text-white text-right">
                  {data.expenses.reduce((sum, cat) => sum + cat.planned_amount, 0).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                  })}
                </td>
                <td className="px-3 py-2 text-xs font-bold text-white text-center">100%</td>
                <td className="px-3 py-2 text-xs font-bold text-white text-right border-l border-white/20">---</td>
                <td className="px-3 py-2 text-xs font-bold text-white text-right">---</td>
                <td className="px-3 py-2 text-xs font-bold text-white text-right">---</td>
                {months.map(({ month, year }) => (
                  <td
                    key={`total-exp-${month}-${year}`}
                    className="px-3 py-2 text-xs font-bold text-white text-right border-l border-white/20"
                  >
                    {data.expenses.reduce((sum, cat) => {
                      const monthVal = getMonthlyValue(cat.monthly_data, month, year);
                      return sum + (monthVal ?? 0);
                    }, 0) === 0
                      ? '---'
                      : data.expenses
                          .reduce((sum, cat) => {
                            const monthVal = getMonthlyValue(cat.monthly_data, month, year);
                            return sum + (monthVal ?? 0);
                          }, 0)
                          .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                ))}
              </tr>
              {data.expenses.map(category => (
                <Fragment key={`expense-${category.id}`}>
                  {renderCategoryRow(category)}
                  {category.subcategories.map(sub => (
                    <Fragment key={`sub-${sub.id}`}>{renderCategoryRow(sub, true)}</Fragment>
                  ))}
                </Fragment>
              ))}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
