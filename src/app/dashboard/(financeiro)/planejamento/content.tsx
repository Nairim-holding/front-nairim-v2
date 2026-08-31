'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { RefreshCw, Calendar, FileSpreadsheet, FileText, Filter } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useSearchParams } from 'next/navigation';
import Section from '@/components/layout/PageSection';
import CalendarPicker from '@/components/ui/CalendarPicker';
import DynamicFilterModal from '@/components/filters/DynamicFilterModal';
import { useDynamicFilters } from '@/hooks/useDynamicFilters';
import { useMessageContext } from '@/contexts';
import { getPlanningDashboardAction,
  upsertPlanningAction,
} from '@/server/actions/planning';
import { listFinancialTransactionsAction, getTransactionFiltersAction } from '@/server/actions/financial-transaction';
import PlanningTable, { type PlanningTableHandle, type RealizedDetailParams } from '@/components/planejamento/PlanningTable';
import PlanningEditModal from '@/components/planejamento/PlanningEditModal';
import DataModal from '@/components/charts/DataModal';
import type { DashboardResponse, DashboardItem, CategoryDashboard, MonthlyData } from '@/components/planejamento/types';

const MONTH_NAMES_FULL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const formatMoneyBRL = (value: number): string =>
  `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDateBR = (value: string): string => {
  if (!value) return '-';
  const iso = value.slice(0, 10);
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : value;
};

interface RealizedTransactionRow {
  id: string;
  effective_date: string;
  description: string;
  amount: number;
  financial_institution?: { name?: string } | null;
  supplier?: { legal_name?: string } | null;
  status: string;
}

const SHORTCUTS = [
  { label: 'Últimos 3 meses', months: 3 },
  { label: 'Últimos 6 meses', months: 6 },
  { label: 'Últimos 12 meses', months: 12 },
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
  // Limita a exibição aos últimos N meses DENTRO do período do calendário.
  // null = mostra todos os meses do período filtrado.
  const [viewMonths, setViewMonths] = useState<number | null>(null);
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<(DashboardItem | CategoryDashboard) & { parentCategoryId?: string } | null>(null);

  // Tarefa 13 (29/07/26): botão Filtro, mesmo componente/endpoint de Lançamentos.
  const [appliedFilters, setAppliedFilters] = useState<Record<string, unknown>>({});
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const filtersFetcher = useCallback(async (applied?: Record<string, unknown>) => {
    const result = await getTransactionFiltersAction(applied ?? {});
    if (!result.ok) throw new Error(result.error ?? 'Erro ao carregar filtros.');
    return {
      ...result.data,
      filters: (result.data.filters ?? []).map((f) => ({ ...f, description: f.description ?? '' })),
    };
  }, []);
  const { filters: dynamicFilters } = useDynamicFilters('/financial-transaction/filters', appliedFilters, filtersFetcher);
  const activeFilterCount = Object.keys(appliedFilters).length;

  const handleApplyFilters = useCallback((f: Record<string, unknown>) => {
    setAppliedFilters(f);
    setIsFilterVisible(false);
  }, []);

  const handleClearFilters = useCallback(() => {
    setAppliedFilters({});
    setIsFilterVisible(false);
  }, []);

  // Tarefa 11 (29/07/26): modal com os lançamentos por trás de um Realizado de subcategoria.
  const [realizedDetail, setRealizedDetail] = useState<RealizedDetailParams | null>(null);
  const [realizedTransactions, setRealizedTransactions] = useState<RealizedTransactionRow[]>([]);
  const [isRealizedDetailLoading, setIsRealizedDetailLoading] = useState(false);

  const handleViewRealizedDetail = useCallback(async (params: RealizedDetailParams) => {
    setRealizedDetail(params);
    setRealizedTransactions([]);
    setIsRealizedDetailLoading(true);
    try {
      const monthStr = String(params.month).padStart(2, '0');
      const lastDay = new Date(params.year, params.month, 0).getDate();
      const from = `${params.year}-${monthStr}-01`;
      const to = `${params.year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

      const qs: Record<string, unknown> = {
        subcategory_id: params.subcategoryId,
        status: 'COMPLETED',
        effective_date: JSON.stringify({ from, to }),
        limit: '150',
      };
      const result = await listFinancialTransactionsAction(qs);
      if (!result.ok) throw new Error(result.error ?? 'Falha ao carregar os lançamentos');
      const rows = result.data?.data ?? [];
      setRealizedTransactions(
        rows.map((tx) => ({
          id: tx.id,
          effective_date:
            tx.effective_date instanceof Date
              ? tx.effective_date.toISOString().slice(0, 10)
              : String(tx.effective_date),
          description: tx.description,
          amount: Number(tx.amount),
          financial_institution: (tx.financial_institution as RealizedTransactionRow['financial_institution']) ?? null,
          supplier: (tx.supplier as RealizedTransactionRow['supplier']) ?? null,
          status: tx.status,
        })),
      );
    } catch (e) {
      showMessage(e instanceof Error ? e.message : 'Erro ao carregar os lançamentos', 'error');
    } finally {
      setIsRealizedDetailLoading(false);
    }
  }, [showMessage]);

  const realizedDetailColumns = useMemo(
    () => [
      { key: 'effective_date', label: 'Data', format: (v: string) => formatDateBR(v) },
      { key: 'description', label: 'Descrição' },
      { key: 'financial_institution', label: 'Instituição', format: (v: RealizedTransactionRow['financial_institution']) => v?.name ?? '-' },
      { key: 'supplier', label: 'Contato', format: (v: RealizedTransactionRow['supplier']) => v?.legal_name ?? '-' },
      { key: 'amount', label: 'Valor', format: (v: number) => formatMoneyBRL(Number(v)), summable: true },
    ],
    []
  );

  const planningTableRef = useRef<PlanningTableHandle>(null);

  const fetchDashboard = useCallback(async () => {
    const fetchStartTime = new Date().toISOString();
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📊 [FETCH DASHBOARD] INICIANDO');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Horário: ${fetchStartTime}`);
    console.log(`Período: ${dateRange.from} até ${dateRange.to}`);

    setIsLoading(true);
    try {
      const params: Record<string, unknown> = {
        startDate: dateRange.from,
        endDate: dateRange.to,
        ...appliedFilters,
      };

      const result = await getPlanningDashboardAction(params);
      if (!result.ok) {
        throw new Error(result.error ?? 'Falha ao carregar dados');
      }

      const responseData = result.data;

      console.log('\n📊 DADOS RECEBIDOS:');
      console.log('─────────────────────────────────────────────────────────────');
      console.log(`Data de início: ${responseData.start_date}`);
      console.log(`Data de fim: ${responseData.end_date}`);
      console.log(`Categorias de Receita: ${responseData.incomes?.length || 0}`);
      console.log(`Categorias de Despesa: ${responseData.expenses?.length || 0}`);

      if (responseData.incomes?.length > 0) {
        console.log('\n💰 RECEITAS:');
        responseData.incomes.forEach((income: CategoryDashboard, idx: number) => {
          console.log(`  [${idx}] ${income.name}`);
          console.log(`      ID: ${income.id}`);
          console.log(`      Planejado: ${income.planned_amount}`);
          console.log(`      Realizado: ${income.realized_amount}`);
          console.log(`      Percentual: ${income.percentage}%`);
          console.log(`      Min/Med/Max: ${income.min}/${income.med}/${income.max}`);
          console.log(`      Dados Mensais: ${income.monthly_data?.length || 0} meses`);
          if (income.monthly_data?.length > 0) {
            income.monthly_data.forEach(m => {
              console.log(`        → ${m.year}-${String(m.month).padStart(2, '0')}: ${m.realized_amount}`);
            });
          }
          console.log(`      Subcategorias: ${income.subcategories?.length || 0}`);

          if (income.subcategories?.length > 0) {
            income.subcategories.forEach((sub: DashboardItem, subIdx: number) => {
              console.log(`        └─ [${subIdx}] ${sub.name}`);
              console.log(`            ID: ${sub.id}`);
              console.log(`            Planejado: ${sub.planned_amount}`);
              console.log(`            Realizado: ${sub.realized_amount}`);
              if (sub.monthly_data?.length > 0) {
                console.log(`            Dados Mensais:`);
                sub.monthly_data.forEach(m => {
                  console.log(`              → ${m.year}-${String(m.month).padStart(2, '0')}: ${m.realized_amount}`);
                });
              }
            });
          }
        });
      }

      if (responseData.expenses?.length > 0) {
        console.log('\n💸 DESPESAS:');
        responseData.expenses.forEach((expense: CategoryDashboard, idx: number) => {
          console.log(`  [${idx}] ${expense.name}`);
          console.log(`      ID: ${expense.id}`);
          console.log(`      Planejado: ${expense.planned_amount}`);
          console.log(`      Realizado: ${expense.realized_amount}`);
          console.log(`      Percentual: ${expense.percentage}%`);
          console.log(`      Dados Mensais: ${expense.monthly_data?.length || 0} meses`);
          if (expense.monthly_data?.length > 0) {
            expense.monthly_data.forEach(m => {
              console.log(`        → ${m.year}-${String(m.month).padStart(2, '0')}: ${m.realized_amount}`);
            });
          }
          if (expense.subcategories?.length > 0) {
            console.log(`      Subcategorias: ${expense.subcategories?.length || 0}`);
            expense.subcategories.forEach((sub: DashboardItem, subIdx: number) => {
              console.log(`        └─ [${subIdx}] ${sub.name}`);
              console.log(`            Planejado: ${sub.planned_amount}`);
              if (sub.monthly_data?.length > 0) {
                console.log(`            Dados Mensais:`);
                sub.monthly_data.forEach(m => {
                  console.log(`              → ${m.year}-${String(m.month).padStart(2, '0')}: ${m.realized_amount}`);
                });
              }
            });
          }
        });
      }

      if (responseData.balances?.monthly?.length > 0) {
        console.log('\n📅 SALDOS MENSAIS:');
        responseData.balances.monthly.forEach((balance: MonthlyData) => {
          console.log(`  ${balance.year}-${String(balance.month).padStart(2, '0')}: ${balance.realized_amount}`);
        });
      }

      console.log('─────────────────────────────────────────────────────────────');
      console.log('✅ Dashboard carregado com sucesso');

      setData(responseData);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erro ao carregar planejamento';
      console.error(`\n❌ [FETCH DASHBOARD] ERRO:`, message);
      showMessage(message, 'error');
    } finally {
      setIsLoading(false);
      console.log('═══════════════════════════════════════════════════════════════\n');
    }
  }, [dateRange, appliedFilters, showMessage]);

  const handleSaveInline = useCallback(async (item: { id: string; parentCategoryId?: string; amount: number }) => {
    const startTime = new Date().toISOString();
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📝 [INLINE SAVE] INICIANDO');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Horário: ${startTime}`);
    console.log(`Item recebido:`, JSON.stringify(item, null, 2));

    try {
      const categoryId = item.parentCategoryId || item.id;

      const payload: Record<string, unknown> = {
        category_id: categoryId,
        type: 'FIXED',
        default_amount: item.amount,
      };

      if (item.parentCategoryId) {
        payload.subcategory_id = item.id;
      }

      console.log('\n📤 [INLINE SAVE] PAYLOAD A ENVIAR:');
      console.log('─────────────────────────────────────────────────────────────');
      console.log(JSON.stringify(payload, null, 2));
      console.log('─────────────────────────────────────────────────────────────');

      const res = await upsertPlanningAction(payload);

      console.log('\n📥 [INLINE SAVE] RESPOSTA RECEBIDA:');
      console.log('─────────────────────────────────────────────────────────────');

      if (!res.ok) {
        console.log(`❌ Erro na resposta:`, res.error);
        throw new Error(`Falha ao salvar: ${res.error}`);
      }

      const responseData = res;
      console.log('\n✅ Resposta OK:');
      console.log(JSON.stringify(responseData.data, null, 2));
      console.log('─────────────────────────────────────────────────────────────');

      if (responseData.data) {
        console.log('\n📊 Dados retornados:');
        console.log(`  ID do Planning: ${responseData.data.id}`);
        console.log(`  Category ID: ${responseData.data.category_id}`);
        console.log(`  Subcategory ID: ${responseData.data.subcategory_id || 'null'}`);
        console.log(`  Year: ${responseData.data.year}`);
        console.log(`  Type: ${responseData.data.type}`);
        console.log(`  Default Amount: ${responseData.data.default_amount}`);
        console.log(`  Min Recommended: ${responseData.data.min_recommended}`);
        console.log(`  Max Recommended: ${responseData.data.max_recommended}`);
        console.log(`  Created At: ${responseData.data.created_at}`);
        console.log(`  Updated At: ${responseData.data.updated_at}`);
        console.log(`  Monthly Values Count: ${responseData.data.monthly_values?.length || 0}`);
      }

      showMessage('Planejamento salvo com sucesso', 'success');

      console.log('\n🔄 [INLINE SAVE] UPDATE OTIMISTA:');
      console.log('─────────────────────────────────────────────────────────────');
      setData(prev => {
        if (!prev) {
          console.log('❌ Data anterior é null');
          return prev;
        }

        const updateArray = (items: (DashboardItem | CategoryDashboard)[]) => {
          return items.map(cat => {
            if ('subcategories' in cat) {
              const isCategoryMatch = cat.id === categoryId;

              if (isCategoryMatch && !item.parentCategoryId) {
                console.log(`✅ Categoria principal atualizada: ${cat.id}`);
                console.log(`   Valor anterior: ${cat.planned_amount} → Novo: ${item.amount}`);
                return { ...cat, planned_amount: item.amount };
              }

              if (isCategoryMatch && item.parentCategoryId) {
                const newSubs = cat.subcategories.map(sub =>
                  sub.id === item.id ? { ...sub, planned_amount: item.amount } : sub
                );
                if (newSubs.some((s, i) => s !== cat.subcategories[i])) {
                  console.log(`✅ Subcategoria atualizada: ${item.id}`);
                  console.log(`   Em categoria: ${categoryId}`);
                  return { ...cat, subcategories: newSubs };
                }
              }
              return cat;
            } else {
              const isMatch = cat.id === categoryId;
              if (isMatch) {
                console.log(`✅ Item atualizado: ${cat.id}`);
                console.log(`   Valor anterior: ${cat.planned_amount} → Novo: ${item.amount}`);
                return { ...cat, planned_amount: item.amount };
              }
              return cat;
            }
          });
        };

        const updated = {
          ...prev,
          incomes: updateArray(prev.incomes) as CategoryDashboard[],
          expenses: updateArray(prev.expenses) as CategoryDashboard[],
        } as DashboardResponse;

        console.log('✅ Estado atualizado localmente');
        return updated;
      });

      console.log('\n🔁 [INLINE SAVE] REFETCH DASHBOARD:');
      console.log('─────────────────────────────────────────────────────────────');
      fetchDashboard();
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Erro desconhecido ao salvar planejamento';
      console.error('\n❌ [INLINE SAVE] ERRO:', errorMessage);
      console.log('═══════════════════════════════════════════════════════════════\n');
      showMessage(errorMessage, 'error');
    }
  }, [dateRange.from, showMessage, fetchDashboard]);

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
    // from === to é válido: período de um único dia
    if (range.from && range.to) {
      setDateRange(range);
      setIsCalendarOpen(false);
    }
  }, []);

  // O dropdown só limita a quantidade de meses exibidos dentro do período
  // do calendário — NÃO altera as datas De–Até do filtro selecionado.
  const handleShortcutChange = useCallback((months: number | null) => {
    setViewMonths(months);
  }, []);

  const getSelectedShortcut = useCallback(() => viewMonths, [viewMonths]);

  // Exporta exatamente o que está renderizado na grid (mesmas linhas/colunas do
  // período selecionado) — lê o <table> já montado em vez de recalcular os dados.
  const handleExportExcel = useCallback(() => {
    const tableEl = planningTableRef.current?.getTableElement();
    if (!tableEl) {
      showMessage('Não há dados para exportar', 'error');
      return;
    }

    const worksheet = XLSX.utils.table_to_sheet(tableEl);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Planejamento');
    XLSX.writeFile(workbook, `planejamento_${dateRange.from}_a_${dateRange.to}.xlsx`);
  }, [dateRange, showMessage]);

  // Mesma fonte que o Excel (o <table> renderizado) — usa o modo "html" do
  // autoTable, que lê a tabela do DOM em vez de recalcular linhas/colunas.
  const handleExportPDF = useCallback(() => {
    const tableEl = planningTableRef.current?.getTableElement();
    if (!tableEl) {
      showMessage('Não há dados para exportar', 'error');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    autoTable(doc, {
      html: tableEl,
      horizontalPageBreak: true,
      styles: { fontSize: 6, cellPadding: 2 },
      margin: { left: 20, right: 20 },
    });
    doc.save(`planejamento_${dateRange.from}_a_${dateRange.to}.pdf`);
  }, [dateRange, showMessage]);

  const balanceMonths = useMemo(() => {
    if (!data) return [];
    const [fromYear, fromMonth] = dateRange.from.split('-').slice(0, 2).map(Number);
    const months = new Set<string>();
    [...data.incomes, ...data.expenses].forEach(cat => {
      cat.monthly_data.forEach(m => {
        if (m.year > fromYear || (m.year === fromYear && m.month >= fromMonth)) {
          months.add(JSON.stringify({ month: m.month, year: m.year }));
        }
      });
    });
    return Array.from(months)
      .map(m => JSON.parse(m) as { month: number; year: number })
      .sort((a, b) => (a.year === b.year ? a.month - b.month : a.year - b.year));
  }, [data, dateRange.from]);

  return (
    <Section title="Planejamento e Controle">
      <div className="flex flex-col gap-4 relative">
        {/* Mobile: todos os controles acima da tabela */}
        <div className="flex md:hidden gap-3 items-center flex-wrap">
          <div className="relative" ref={popoverRef}>
            <button
              onClick={() => setIsCalendarOpen(!isCalendarOpen)}
              className="flex items-center gap-2 border border-ui-border rounded-lg px-3 py-2 text-sm text-content bg-surface hover:bg-surface-subtle focus:outline-none focus:border-brand transition-colors"
            >
              <Calendar size={16} className="text-content-secondary" />
              <span className="font-medium whitespace-nowrap">
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
            onChange={(e) => handleShortcutChange(e.target.value ? Number(e.target.value) : null)}
            className="border border-ui-border rounded-lg px-3 py-2 text-sm text-content bg-surface focus:outline-none focus:border-brand cursor-pointer"
          >
            <option value="">Todos os meses</option>
            {SHORTCUTS.map(s => (
              <option key={s.months} value={s.months}>{s.label}</option>
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
          <button
            onClick={() => setIsFilterVisible(true)}
            className="relative p-2 rounded-lg border border-ui-border text-content-muted hover:text-content hover:bg-surface-subtle transition-colors"
            title="Filtro"
          >
            <Filter size={16} color={activeFilterCount > 0 ? 'var(--color-brand-primary)' : undefined} />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-brand text-content-inverse text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            onClick={handleExportExcel}
            disabled={isLoading || !data}
            className="p-2 rounded-lg border border-ui-border text-content-muted hover:text-content hover:bg-surface-subtle disabled:opacity-50 transition-colors"
            title="Exportar Excel"
          >
            <FileSpreadsheet size={16} />
          </button>
          <button
            onClick={handleExportPDF}
            disabled={isLoading || !data}
            className="p-2 rounded-lg border border-ui-border text-content-muted hover:text-content hover:bg-surface-subtle disabled:opacity-50 transition-colors"
            title="Exportar PDF"
          >
            <FileText size={16} />
          </button>
        </div>

        {/* Desktop: calendário + refresh flutuam sobre o lado esquerdo da tabela */}
        <div className="hidden md:flex gap-3 items-center absolute top-3 z-[100]" ref={popoverRef}>
          <button
            onClick={() => setIsCalendarOpen(!isCalendarOpen)}
            className="flex items-center gap-2 border border-ui-border rounded-lg px-3 py-2 text-sm text-content bg-surface hover:bg-surface-subtle focus:outline-none focus:border-brand transition-colors"
          >
            <Calendar size={16} className="text-content-secondary" />
            <span className="font-medium whitespace-nowrap">
              {formatDateDisplay(dateRange.from)} — {formatDateDisplay(dateRange.to)}
            </span>
          </button>
          {isCalendarOpen && (
            <div className="absolute top-full left-0 mt-2 bg-surface border border-ui-border-soft rounded-lg shadow-lg z-[200] p-4">
              <CalendarPicker dateRange={dateRange} onChange={handleDateRangeChange} />
            </div>
          )}
          <button
            onClick={() => fetchDashboard()}
            disabled={isLoading}
            className="p-2 rounded-lg border border-ui-border text-content-muted hover:text-content hover:bg-surface-subtle disabled:opacity-50 transition-colors"
            title="Recarregar"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setIsFilterVisible(true)}
            className="relative p-2 rounded-lg border border-ui-border text-content-muted hover:text-content hover:bg-surface-subtle transition-colors"
            title="Filtro"
          >
            <Filter size={16} color={activeFilterCount > 0 ? 'var(--color-brand-primary)' : undefined} />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-brand text-content-inverse text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            onClick={handleExportExcel}
            disabled={isLoading || !data}
            className="p-2 rounded-lg border border-ui-border text-content-muted hover:text-content hover:bg-surface-subtle disabled:opacity-50 transition-colors"
            title="Exportar Excel"
          >
            <FileSpreadsheet size={16} />
          </button>
          <button
            onClick={handleExportPDF}
            disabled={isLoading || !data}
            className="p-2 rounded-lg border border-ui-border text-content-muted hover:text-content hover:bg-surface-subtle disabled:opacity-50 transition-colors"
            title="Exportar PDF"
          >
            <FileText size={16} />
          </button>
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
          <div className="overflow-auto max-h-[calc(100vh-150px)] md:max-h-[calc(100vh-90px)]">
            <div className="inline-block align-top min-w-full">
              <PlanningTable
                ref={planningTableRef}
                data={data}
                dateRangeFrom={dateRange.from}
                viewMonths={viewMonths}
                onEditItem={setEditingItem}
                onSaveInline={handleSaveInline}
                onViewRealizedDetail={handleViewRealizedDetail}
                balanceMonths={balanceMonths.length > 0 ? balanceMonths : undefined}
                balances={data.balances}
                statsSlot={
                  <select
                    value={getSelectedShortcut() ?? ''}
                    onChange={(e) => handleShortcutChange(e.target.value ? Number(e.target.value) : null)}
                    className="hidden md:block border border-ui-border rounded-lg px-2 py-1 text-xs text-content bg-surface focus:outline-none focus:border-brand cursor-pointer"
                  >
                    <option value="">Todos os meses</option>
                    {SHORTCUTS.map(s => (
                      <option key={s.months} value={s.months}>{s.label}</option>
                    ))}
                  </select>
                }
              />
            </div>
          </div>
        )}
      </div>

      {editingItem && (
        <PlanningEditModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={() => {
            setEditingItem(null);
            fetchDashboard();
          }}
        />
      )}

      <DataModal
        isOpen={!!realizedDetail}
        onClose={() => setRealizedDetail(null)}
        title={
          realizedDetail
            ? `${realizedDetail.subcategoryName} — ${MONTH_NAMES_FULL[realizedDetail.month - 1]} de ${realizedDetail.year}`
            : ''
        }
        data={isRealizedDetailLoading ? [] : realizedTransactions}
        columns={realizedDetailColumns}
        totalLabel="lançamentos"
      />

      {isFilterVisible && (
        <DynamicFilterModal
          visible={isFilterVisible}
          setVisible={setIsFilterVisible}
          onApply={handleApplyFilters}
          onClear={handleClearFilters}
          title="Planejamento e Controle"
          filters={dynamicFilters}
          initialValues={appliedFilters}
          columns={3}
        />
      )}
    </Section>
  );
}
