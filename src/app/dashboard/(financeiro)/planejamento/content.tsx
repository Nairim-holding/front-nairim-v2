'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { RefreshCw, Calendar } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import Section from '@/components/layout/PageSection';
import CalendarPicker from '@/components/ui/CalendarPicker';
import { useMessageContext } from '@/contexts';
import { authFetch } from '@/utils/authFetch';
import PlanningTable, { type PlanningTableHandle } from '@/components/planejamento/PlanningTable';
import PlanningEditModal from '@/components/planejamento/PlanningEditModal';
import type { DashboardResponse, DashboardItem, CategoryDashboard, MonthlyData } from '@/components/planejamento/types';

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
  const [editingItem, setEditingItem] = useState<(DashboardItem | CategoryDashboard) & { parentCategoryId?: string } | null>(null);

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
      const params = new URLSearchParams({
        startDate: dateRange.from,
        endDate: dateRange.to,
      });

      const urlFinal = `${API_URL}/planning/dashboard?${params}`;
      console.log(`\n📤 URL: GET ${urlFinal}`);

      const res = await authFetch(urlFinal);

      console.log(`\n📥 Status: ${res.status} ${res.statusText}`);

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`❌ Erro HTTP:`, errorText);
        throw new Error(`API Error ${res.status}: ${errorText || 'Falha ao carregar dados'}`);
      }

      const json = await res.json();
      const responseData = json.data ?? json;

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
  }, [dateRange, showMessage]);

  const handleSaveInline = useCallback(async (item: { id: string; parentCategoryId?: string; amount: number }) => {
    const startTime = new Date().toISOString();
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📝 [INLINE SAVE] INICIANDO');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Horário: ${startTime}`);
    console.log(`Item recebido:`, JSON.stringify(item, null, 2));

    if (!item.amount || item.amount <= 0) {
      console.warn('[INLINE SAVE] ❌ Valor inválido:', item.amount);
      showMessage('Informe um valor maior que zero', 'error');
      return;
    }

    try {
      const categoryId = item.parentCategoryId || item.id;
      const year = new Date(dateRange.from).getFullYear();

      const payload: Record<string, unknown> = {
        category_id: categoryId,
        year: year,
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
      console.log(`URL: POST ${API_URL}/planning`);
      console.log(`Content-Type: application/json`);
      console.log(`Authorization: Bearer [TOKEN]`);

      const res = await authFetch(`${API_URL}/planning`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      console.log('\n📥 [INLINE SAVE] RESPOSTA RECEBIDA:');
      console.log('─────────────────────────────────────────────────────────────');
      console.log(`Status HTTP: ${res.status} ${res.statusText}`);
      console.log(`Headers:`, {
        'content-type': res.headers.get('content-type'),
        'content-length': res.headers.get('content-length'),
      });

      if (!res.ok) {
        const errorBody = await res.text();
        console.log(`❌ Erro na resposta:`, errorBody);
        throw new Error(`Falha ao salvar: HTTP ${res.status} - ${errorBody}`);
      }

      const responseData = await res.json();
      console.log('\n✅ Resposta JSON:');
      console.log(JSON.stringify(responseData, null, 2));
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
    if (range.from && range.to && range.from !== range.to) {
      setDateRange(range);
      setIsCalendarOpen(false);
    }
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
            onChange={(e) => { if (e.target.value) handleShortcutChange(Number(e.target.value)); }}
            className="border border-ui-border rounded-lg px-3 py-2 text-sm text-content bg-surface focus:outline-none focus:border-brand cursor-pointer"
          >
            <option value="">Personalizado</option>
            {SHORTCUTS.map(s => (
              <option key={s.days} value={s.days}>{s.label}</option>
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
          <div className="overflow-x-auto">
            <div className="inline-block align-top min-w-full">
              <PlanningTable
                ref={planningTableRef}
                data={data}
                dateRangeFrom={dateRange.from}
                onEditItem={setEditingItem}
                onSaveInline={handleSaveInline}
                balanceMonths={balanceMonths.length > 0 ? balanceMonths : undefined}
                balances={data.balances}
                statsSlot={
                  <select
                    value={getSelectedShortcut() ?? ''}
                    onChange={(e) => { if (e.target.value) handleShortcutChange(Number(e.target.value)); }}
                    className="hidden md:block border border-ui-border rounded-lg px-2 py-1 text-xs text-content bg-surface focus:outline-none focus:border-brand cursor-pointer"
                  >
                    <option value="">Personalizado</option>
                    {SHORTCUTS.map(s => (
                      <option key={s.days} value={s.days}>{s.label}</option>
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
