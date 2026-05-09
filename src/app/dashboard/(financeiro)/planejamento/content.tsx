'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { RefreshCw, Calendar } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import Section from '@/components/layout/PageSection';
import CalendarPicker from '@/components/ui/CalendarPicker';
import { useMessageContext } from '@/contexts';
import { authFetch } from '@/utils/authFetch';
import PlanningTable from '@/components/planejamento/PlanningTable';
import PlanningEditModal from '@/components/planejamento/PlanningEditModal';
import type { DashboardResponse, DashboardItem, CategoryDashboard } from '@/components/planejamento/types';

const API_URL = process.env.NEXT_PUBLIC_URL_API ?? '';

const SHORTCUTS = [
  { label: 'Últimos 3 meses', days: 90 },
  { label: 'Últimos 6 meses', days: 180 },
  { label: 'Últimos 12 meses', days: 365 },
];

function formatDateISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDateDisplay(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function getDefaultDates(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 90);
  return { from: formatDateISO(from), to: formatDateISO(to) };
}

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined || value === 0) return '---';
  return Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function PlanningPageContent() {
  const { showMessage } = useMessageContext();
  const searchParams = useSearchParams();
  const popoverRef = useRef<HTMLDivElement>(null);
  const defaults = useMemo(() => getDefaultDates(), []);

  const [dateRange, setDateRange] = useState(() => ({
    from: searchParams.get('from') || defaults.from,
    to: searchParams.get('to') || defaults.to,
  }));
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<DashboardItem | CategoryDashboard | null>(null);

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: dateRange.from,
        endDate: dateRange.to,
      });
      const res = await authFetch(`${API_URL}/plannings/dashboard?${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json.data ?? json);
    } catch (e) {
      console.error('[PlanejamentoPage]', e);
      showMessage('Erro ao carregar planejamento', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, showMessage]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsCalendarOpen(false);
      }
    };

    if (isCalendarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isCalendarOpen]);

  const handleDateRangeChange = useCallback((range: { from: string; to: string }) => {
    setDateRange(range);
    setIsCalendarOpen(false);
  }, []);

  const handleShortcutChange = useCallback((days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    setDateRange({ from: formatDateISO(from), to: formatDateISO(to) });
  }, []);

  const getSelectedShortcut = useCallback(() => {
    const from = new Date(dateRange.from);
    const to = new Date(dateRange.to);
    const daysDiff = Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    return SHORTCUTS.find(s => s.days === daysDiff)?.days ?? null;
  }, [dateRange]);

  const balanceMonths = useMemo(() => {
    if (!data) return [];
    const months = new Set<string>();
    data.balances.monthly.forEach(b => {
      months.add(JSON.stringify({ month: b.month, year: b.year }));
    });
    return Array.from(months)
      .map(m => JSON.parse(m) as { month: number; year: number })
      .sort((a, b) => (a.year === b.year ? a.month - b.month : a.year - b.year));
  }, [data]);

  return (
    <Section title="Planejamento e Controle">
      <div className="flex flex-col gap-4">
        <div className="flex justify-between gap-4 flex-wrap items-center">
          <div className="flex gap-4 items-center">
            <div className="relative" ref={popoverRef}>
              <button
                onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                className="flex items-center gap-2 border border-ui-border rounded-lg px-3 py-2 text-sm text-content bg-surface hover:bg-surface-subtle focus:outline-none focus:border-brand transition-colors"
              >
                <Calendar size={16} className="text-content-secondary" />
                <span className="font-medium">
                  {formatDateDisplay(dateRange.from)} — {formatDateDisplay(dateRange.to)}
                </span>
              </button>

              {isCalendarOpen && (
                <div className="absolute top-full left-0 mt-2 bg-surface border border-ui-border-soft rounded-lg shadow-lg z-50 p-4">
                  <CalendarPicker dateRange={dateRange} onChange={handleDateRangeChange} />
                </div>
              )}
            </div>

            <select
              value={getSelectedShortcut() ?? ''}
              onChange={(e) => {
                if (e.target.value) {
                  handleShortcutChange(Number(e.target.value));
                }
              }}
              className="border border-ui-border rounded-lg px-3 py-2 text-sm text-content bg-surface focus:outline-none focus:border-brand cursor-pointer"
            >
              <option value="">Personalizado</option>
              {SHORTCUTS.map(s => (
                <option key={s.days} value={s.days}>
                  {s.label}
                </option>
              ))}
            </select>

            <button
              onClick={() => fetchDashboard()}
              disabled={isLoading}
              className="p-2 rounded-lg border border-ui-border text-content-muted hover:text-content hover:bg-surface-subtle disabled:opacity-50 transition-colors"
              title="Recarregar"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          {data && balanceMonths.length > 0 && (
            <div className="border border-ui-border-soft rounded-xl overflow-hidden bg-surface text-xs">
              <table className="border-collapse">
                <tbody>
                  <tr className="border-b border-ui-border-soft">
                    <td className="px-4 py-2 font-semibold text-content-secondary bg-surface-subtle whitespace-nowrap">
                      Saldo Acumulado
                    </td>
                    {balanceMonths.map(({ month, year }) => {
                      const v = data.balances.accumulated.find(
                        b => b.month === month && b.year === year,
                      )?.realized_amount ?? null;
                      const positive = v !== null && v >= 0;
                      return (
                        <td
                          key={`acc-${month}-${year}`}
                          className={`px-4 py-2 text-right font-medium border-l border-ui-border-soft whitespace-nowrap ${
                            positive ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {formatCurrency(v)}
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-semibold text-content-secondary bg-surface-subtle whitespace-nowrap">
                      Saldo Mensal
                    </td>
                    {balanceMonths.map(({ month, year }) => {
                      const v = data.balances.monthly.find(
                        b => b.month === month && b.year === year,
                      )?.realized_amount ?? null;
                      const positive = v !== null && v >= 0;
                      return (
                        <td
                          key={`month-${month}-${year}`}
                          className={`px-4 py-2 text-right font-medium border-l border-ui-border-soft whitespace-nowrap ${
                            positive ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {formatCurrency(v)}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {isLoading && (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
          </div>
        )}

        {!isLoading && !data && (
          <div className="flex justify-center items-center h-64 text-content-muted text-sm">
            Nenhum dado encontrado para o período selecionado.
          </div>
        )}

        {!isLoading && data && (
          <PlanningTable
            data={data}
            onEditItem={setEditingItem}
          />
        )}
      </div>

      {editingItem && (
        <PlanningEditModal
          item={editingItem}
          year={new Date(dateRange.from).getFullYear()}
          onClose={() => setEditingItem(null)}
          onSaved={() => {
            setEditingItem(null);
            fetchDashboard();
          }}
        />
      )}
    </Section>
  );
}
