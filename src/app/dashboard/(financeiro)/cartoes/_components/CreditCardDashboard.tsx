'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, CreditCard, Plus, Settings, X } from 'lucide-react';
import Section from '@/components/layout/PageSection';
import EchartsSurface from '@/components/dashboard/EchartsSurface';
import { useTheme } from '@/contexts/ThemeContext';
import { usePermissions } from '@/contexts/PermissionsContext';
import { getCreditCardDashboardAction } from '@/server/actions/credit-card-dashboard';
import type { CreditCardDashboard as Dashboard } from '@/core/entities/credit-card-dashboard';
import { buildCustomTooltipHTML, getCustomEchartsTooltipConfig } from '@/utils/echartsTooltip';
import { formatCurrency, getThemeTokens } from '@/utils';
import { describeActionError } from '@/shared/actions/action-result';
import CardManagement from './CardManagement';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const dateBR = (value: string) => value.split('-').reverse().join('/');
const control = 'rounded-lg border border-ui-border bg-surface px-3 py-2 text-sm text-content hover:bg-surface-subtle';

function MaintenanceModal({ initialId, create, onClose }: { initialId?: string; create?: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const focus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const controls = [...(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]') ?? [])].filter(element => element.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (!ref.current?.contains(document.activeElement)) { event.preventDefault(); first?.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); if (focus?.isConnected) focus.focus(); };
  }, [onClose]);
  return createPortal(<div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 p-3" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={ref} role="dialog" aria-modal="true" aria-label="Gerenciar cartões" className="flex max-h-[94vh] w-full max-w-6xl flex-col rounded-xl border border-ui-border bg-surface shadow-xl">
      <div className="flex items-center justify-between border-b border-ui-border p-3"><h2 className="font-semibold text-content">Gerenciar cartões</h2><button type="button" aria-label="Fechar manutenção de cartões" onClick={onClose} className="rounded p-2 text-content hover:bg-surface-subtle"><X size={20}/></button></div>
      <div className="min-h-0 overflow-y-auto"><CardManagement initialId={initialId} create={create}/></div>
    </div>
  </div>, document.body);
}

export default function CreditCardDashboard() {
  useTheme();
  const tokens = getThemeTokens();
  const { can } = usePermissions();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [selected, setSelected] = useState<string[] | undefined>();
  const [refresh, setRefresh] = useState(0);
  const [management, setManagement] = useState<{ initialId?: string; create?: boolean } | null>(null);
  const [response, setResponse] = useState<{ key: string; data?: Dashboard; error?: string } | null>(null);
  const requestKey = JSON.stringify({ year, month, cardIds: selected, refresh });
  const data = response?.key === requestKey ? response.data : undefined;
  const loading = response?.key !== requestKey;
  const closeManagement = useCallback(() => { setManagement(null); setSelected(undefined); setRefresh(value => value + 1); }, []);
  useEffect(() => {
    let active = true;
    getCreditCardDashboardAction(JSON.parse(requestKey)).then(result => {
      if (active) setResponse(result.ok ? { key: requestKey, data: result.data } : { key: requestKey, error: describeActionError(result) });
    }).catch(() => { if (active) setResponse({ key: requestKey, error: 'Não foi possível carregar os cartões.' }); });
    return () => { active = false; };
  }, [requestKey]);
  const annualOption = () => ({
    tooltip: getCustomEchartsTooltipConfig(params => {
      const item = Array.isArray(params) ? params[0] : params;
      return buildCustomTooltipHTML(`${MONTHS[item.dataIndex]}/${year}`, [{ label: 'Gastos', value: data?.monthly[item.dataIndex]?.amount ?? 0, color: tokens.chartSeries[0] }]);
    }),
    grid: { left: 20, right: 20, top: 35, bottom: 15, containLabel: true },
    xAxis: { type: 'category' as const, data: MONTHS.map(name => `${name}/${year}`), axisLabel: { color: tokens.textMuted, rotate: 20 }, axisTick: { show: false } },
    yAxis: { type: 'value' as const, axisLabel: { color: tokens.textMuted, formatter: (value: number) => formatCurrency(value) }, splitLine: { lineStyle: { color: tokens.borderSoft } } },
    series: [{ type: 'bar' as const, data: (data?.monthly ?? []).map(value => ({ value: value.amount, itemStyle: { color: value.month === month ? tokens.brandPrimary : tokens.chartSeries[0], borderRadius: [7, 7, 0, 0] } })), barMaxWidth: 64 }],
  });
  const categoryOption = () => ({
    tooltip: { ...getCustomEchartsTooltipConfig(params => {
      const item = Array.isArray(params) ? params[0] : params;
      const amount = Number(item.value ?? 0);
      const percent = data?.total ? amount / data.total * 100 : 0;
      return buildCustomTooltipHTML(item.name ?? '', [{ label: 'Gastos', value: amount }, { label: 'Participação', value: `${percent.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` }]);
    }), trigger: 'item' as const },
    legend: { bottom: 0, type: 'scroll' as const, textStyle: { color: tokens.textMuted } },
    color: tokens.chartSeries, series: [{ type: 'pie' as const, radius: ['45%', '70%'], center: ['50%', '43%'], label: { color: tokens.textPrimary, formatter: '{d}%' }, data: (data?.categories ?? []).map(category => ({ name: category.name, value: category.amount })) }],
  });
  return <Section title="Cartões de Crédito">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" aria-label="Ano anterior" disabled={year <= 1900} onClick={() => setYear(value => value - 1)} className={control}><ChevronLeft size={16}/></button>
        <label className="text-sm text-content">Ano <input aria-label="Ano das faturas" type="number" min={1900} max={2100} value={year} onChange={event => { const value = Number(event.target.value); if (Number.isInteger(value) && value >= 1900 && value <= 2100) setYear(value); }} className="ml-2 w-20 rounded border border-ui-border bg-surface p-2"/></label>
        <button type="button" aria-label="Próximo ano" disabled={year >= 2100} onClick={() => setYear(value => value + 1)} className={control}><ChevronRight size={16}/></button>
        <label className="text-sm text-content">Fatura <select aria-label="Mês da fatura" value={month} onChange={event => setMonth(Number(event.target.value))} className="ml-2 rounded border border-ui-border bg-surface p-2">{MONTHS.map((name, index) => <option key={name} value={index + 1}>{name}/{year}</option>)}</select></label>
      </div>
      <div className="flex gap-2"><button type="button" onClick={() => setManagement({})} className={`${control} flex items-center gap-2`}><Settings size={16}/>Gerenciar cartões</button>
        {can('financial-cards', 'create') && <button type="button" onClick={() => setManagement({ create: true })} className="flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm text-content-inverse"><Plus size={16}/>Novo cartão</button>}</div>
    </div>
    {loading ? <p role="status" className="py-12 text-center text-content-muted">Carregando cartões...</p>
        : response?.error ? <div role="alert" className="py-8 text-red-600">{response.error}<button type="button" className="ml-3 underline" onClick={() => setRefresh(value => value + 1)}>Tentar novamente</button><button type="button" className="ml-3 underline" onClick={() => { setSelected(undefined); setRefresh(value => value + 1); }}>Redefinir seleção</button></div>
        : data && <>
          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-content-secondary"><span>{data.selectedCardIds.length} cartão(ões) selecionado(s)</span><button type="button" className="underline" onClick={() => setSelected(data.cards.map(card => card.id))}>Selecionar todos</button><button type="button" className="underline" onClick={() => setSelected([])}>Limpar seleção</button></div>
          {data.cards.length === 0 && <p className="rounded-xl border border-ui-border p-8 text-center text-content-muted">Nenhum cartão cadastrado.</p>}
          <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{data.cards.map(card => <div key={card.id} className={`rounded-2xl border bg-surface p-4 shadow-sm ${data.selectedCardIds.includes(card.id) ? 'border-brand ring-1 ring-brand' : 'border-ui-border'}`}>
            <button type="button" aria-label={`Selecionar cartão ${card.name}`} aria-pressed={data.selectedCardIds.includes(card.id)} onClick={() => setSelected(data.selectedCardIds.includes(card.id) ? data.selectedCardIds.filter(id => id !== card.id) : [...data.selectedCardIds, card.id])} className="w-full text-left text-content">
              <span className="flex items-start gap-3"><CreditCard className="shrink-0 text-brand" size={28}/><span className="min-w-0"><strong className="block break-words text-sm">{card.name}</strong><span className="text-xs text-content-muted">Fecha dia {card.closingDay ?? '—'} · Vence dia {card.dueDay ?? '—'}{!card.active && ' · Inativo'}</span></span></span>
              <strong className="mt-3 block text-right">{formatCurrency(card.spent)}</strong>
              <span className="mt-2 block h-2 overflow-hidden rounded-full bg-surface-subtle"><span className="block h-full bg-brand" style={{ width: `${Math.max(0, Math.min(card.usage ?? 0, 100))}%` }}/></span>
              <span className="mt-2 block text-xs text-content-muted">Limite disponível no mês: {card.available === null ? 'Não informado' : formatCurrency(card.available)}</span>
              <span className="mt-1 block text-xs text-content-muted">Pendente: {formatCurrency(card.pending)} · Uso: {card.usage === null ? '—' : `${card.usage.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`}</span>
            </button>
            {can('financial-cards', 'edit') && <button type="button" onClick={() => setManagement({ initialId: card.id })} className="mt-3 text-xs font-medium text-brand hover:underline">Editar {card.name}</button>}
          </div>)}</div>
          <section className="mb-5 rounded-xl border border-ui-border bg-surface p-4"><h2 className="font-semibold text-content">Gastos nos cartões selecionados — {year}</h2><div className="relative h-72 min-w-0"><EchartsSurface isFullscreen={false} buildOption={annualOption}/></div></section>
          <div className="grid min-w-0 gap-5 xl:grid-cols-3">
            <section className="min-w-0 rounded-xl border border-ui-border bg-surface p-4 xl:col-span-2"><div className="mb-3 flex flex-wrap justify-between gap-2"><h2 className="font-semibold text-content">Lançamentos da fatura {MONTHS[month - 1]}/{year}</h2><strong className="text-content">{formatCurrency(data.total)}</strong></div>
              <div className="max-h-[480px] overflow-auto" role="region" aria-label="Lançamentos dos cartões" tabIndex={0}><table className="w-full min-w-[640px] text-left text-sm text-content"><thead className="sticky top-0 bg-surface-subtle"><tr>{['Data do evento', 'Cartão', 'Descrição', 'Categoria', 'Status', 'Valor'].map(label => <th key={label} className="p-2">{label}</th>)}</tr></thead><tbody>{data.transactions.map(entry => <tr key={entry.id} className="border-t border-ui-border-soft"><td className="p-2 whitespace-nowrap">{dateBR(entry.date)}</td><td className="p-2">{entry.cardName}</td><td className="p-2">{entry.description}{entry.installment && <span className="block text-xs text-content-muted">Parcela {entry.installment}</span>}</td><td className="p-2">{entry.categoryName}{entry.subcategory && <span className="block text-xs text-content-muted">{entry.subcategory}</span>}</td><td className="p-2">{entry.status === 'COMPLETED' ? 'Pago' : 'Pendente'}</td><td className="p-2 text-right whitespace-nowrap">{formatCurrency(entry.amount)}</td></tr>)}</tbody><tfoot className="bg-surface-subtle font-semibold"><tr><td colSpan={5} className="p-2">Total</td><td className="p-2 text-right whitespace-nowrap">{formatCurrency(data.total)}</td></tr></tfoot></table></div>
              {data.transactions.length === 0 && <p className="py-6 text-center text-sm text-content-muted">Sem lançamentos para a seleção e fatura informadas.</p>}
            </section>
            <section className="min-w-0 rounded-xl border border-ui-border bg-surface p-4"><h2 className="font-semibold text-content">Composição dos gastos</h2><div className="relative h-80"><EchartsSurface isFullscreen={false} buildOption={categoryOption}/></div><ul className="space-y-1 text-sm text-content-secondary">{data.categories.map(category => <li key={category.id} className="flex justify-between gap-2"><span>{category.name}</span><span className="whitespace-nowrap">{formatCurrency(category.amount)}</span></li>)}</ul></section>
          </div>
          <p className="mt-4 text-xs text-content-muted">Gráficos e lançamentos seguem a seleção. A competência é a da fatura vinculada; sem fatura, usa a data efetiva. Limite disponível considera pendências do mês selecionado.</p>
        </>}
    {management && <MaintenanceModal {...management} onClose={closeManagement}/>}
  </Section>;
}
