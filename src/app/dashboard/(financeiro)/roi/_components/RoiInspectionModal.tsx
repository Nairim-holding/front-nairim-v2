'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Loader2, X } from 'lucide-react';
import { ROI_LINE_DEFINITIONS, ROI_WARNING_LABELS, type RoiPropertyRow } from '@/core/entities/property-roi';
import {
  ROI_METRIC_DEFINITIONS, ROI_METRIC_KEYS,
  type RoiMetricKey, type RoiOrigin, type RoiOriginSource, type RoiOriginUnit,
} from '@/core/entities/property-roi-origin';
import { getRoiOriginAction } from '@/server/actions/property-roi';
import { describeActionError } from '@/shared/actions/action-result';
import { formatCurrency } from '@/utils';
import { formatIsoDate, formatRate } from '../_lib/format';
import RoiDetail from './RoiDetail';

interface Props {
  row: RoiPropertyRow | null;
  propertyIds: string[];
  metric: RoiMetricKey | null;
  period: { from: string; to: string };
  onClose: () => void;
}

function originValue(value: number | null, unit: RoiOriginUnit, precise = false): string {
  if (value === null) return 'Não calculável';
  if (unit === 'currency') return precise
    ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 8 })
    : formatCurrency(value);
  if (unit === 'percent') return formatRate(value);
  const number = value.toLocaleString('pt-BR', { maximumFractionDigits: precise ? 8 : 2 });
  return unit === 'years' ? `${number} anos` : unit === 'months' ? `${number} meses` : number;
}

function SourceRecords({ sources }: { sources: RoiOriginSource[] }) {
  const transactions = sources.filter(source => source.kind === 'transaction');
  const properties = sources.filter(source => source.kind === 'property');
  const leases = sources.filter(source => source.kind === 'lease');
  return <div className="mt-4 space-y-4">
    {properties.map(source => <div key={`property-${source.id}`}>
      <h4 className="mb-2 text-sm font-semibold text-content">Cadastro do imóvel</h4>
      <dl className="grid gap-2 sm:grid-cols-2">{source.fields.map(field => <div key={field.key} className="rounded-lg bg-surface-subtle p-3">
        <dt className="text-xs text-content-muted">{field.label}</dt>
        <dd className="mt-1 text-sm font-medium text-content">{field.value === null ? 'Não informado'
          : field.unit === 'date' ? formatIsoDate(String(field.value))
            : typeof field.value === 'number' ? originValue(field.value, field.unit) : field.value}</dd>
      </div>)}</dl>
    </div>)}
    {transactions.length > 0 && <div>
      <h4 className="mb-2 text-sm font-semibold text-content">Lançamentos financeiros ({transactions.length})</h4>
      <p className="mb-2 text-xs text-content-muted">Realizados, pela data de efetivação, sem transferências. As categorias e os centros seguem a configuração do ROI.</p>
      <div className="max-h-96 overflow-auto rounded-lg border border-ui-border-soft" role="region" aria-label="Lançamentos de origem" tabIndex={0}>
        <table className="w-full min-w-[900px] text-left text-xs text-content">
          <thead className="sticky top-0 bg-surface-subtle text-content-secondary"><tr>
            {['Data evento', 'Data efetiva', 'Descrição', 'Categoria / subcategoria', 'Centro', 'Conta', 'Valor'].map(label => <th key={label} className="p-2">{label}</th>)}
          </tr></thead>
          <tbody>{transactions.map(source => <tr key={source.id} className="border-t border-ui-border-soft">
            <td className="p-2 whitespace-nowrap">{formatIsoDate(source.eventDate)}</td>
            <td className="p-2 whitespace-nowrap">{formatIsoDate(source.date)}</td>
            <td className="p-2 min-w-48"><p>{source.description}</p><p className="mt-1 text-[11px] text-content-muted">{source.lineKeys.map(key => ROI_LINE_DEFINITIONS.find(line => line.key === key)?.label ?? key).join(' · ')}</p></td>
            <td className="p-2">{source.category.name}{source.subcategory && <span className="block text-content-muted">{source.subcategory.name}</span>}</td>
            <td className="p-2">{source.center?.name ?? 'Sem centro'}</td>
            <td className="p-2">{source.institution?.name ?? 'Não informada'}</td>
            <td className="p-2 text-right whitespace-nowrap">{formatCurrency(source.amount)}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>}
    {leases.length > 0 && <div>
      <h4 className="mb-2 text-sm font-semibold text-content">Contratos usados no tempo locado ({leases.length})</h4>
      <p className="mb-2 text-xs text-content-muted">Conta meses completos até o encerramento, o cancelamento ou hoje. Períodos sobrepostos contam uma única vez.</p>
      <div className="overflow-x-auto rounded-lg border border-ui-border-soft" role="region" aria-label="Contratos de origem" tabIndex={0}>
        <table className="w-full min-w-[520px] text-left text-xs text-content">
          <thead className="bg-surface-subtle text-content-secondary"><tr>{['Contrato', 'Início', 'Fim', 'Cancelamento', 'Considerado até'].map(label => <th key={label} className="p-2">{label}</th>)}</tr></thead>
          <tbody>{leases.map(source => <tr key={source.id} className="border-t border-ui-border-soft">
            <td className="p-2">{source.contractNumber}</td><td className="p-2">{formatIsoDate(source.start)}</td><td className="p-2">{formatIsoDate(source.end)}</td>
            <td className="p-2">{formatIsoDate(source.canceledAt)}</td><td className="p-2">{formatIsoDate(source.consideredEnd)}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>}
    {sources.length === 0 && <p className="text-sm text-content-muted">Nenhum registro de origem participou deste valor. Confira os avisos e a configuração do ROI.</p>}
  </div>;
}

type InspectOrigin = (metric: RoiMetricKey, propertyIds?: string[], propertyTitle?: string) => void;

function OriginContents({ origin, onInspect }: { origin: RoiOrigin; onInspect: InspectOrigin }) {
  return <div className="space-y-4">
    <div className="rounded-xl border border-ui-border-soft bg-surface-subtle p-4">
      <p className="text-xs text-content-muted">Valor calculado na consulta</p>
      <p className="mt-1 text-2xl font-semibold text-content">{originValue(origin.value, origin.unit)}</p>
      <p className="mt-2 text-sm text-content-secondary">{origin.formula}</p>
    </div>
    {origin.warnings.length > 0 && <ul role="status" className="space-y-1 text-sm text-amber-800 dark:text-amber-200">{origin.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
    {origin.properties.map(property => <details key={property.propertyId} open={origin.properties.length <= 3} className="rounded-xl border border-ui-border-soft bg-surface p-3 sm:p-4">
      <summary className="cursor-pointer text-sm font-semibold text-content">{property.propertyTitle}<span className="ml-2 font-medium text-content-secondary">{originValue(property.value, origin.unit)}</span></summary>
      <p className="mt-3 text-sm text-content-secondary">{property.formula}</p>
      {property.warnings.length > 0 && <ul className="mt-2 space-y-1 text-xs text-amber-800 dark:text-amber-200">{property.warnings.map(warning => <li key={warning}>{ROI_WARNING_LABELS[warning]}</li>)}</ul>}
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">{property.components.map(component => <div key={component.key} className="rounded-lg bg-surface-subtle p-3">
        <dt className="text-xs text-content-muted">{component.label}</dt>
        <dd className="mt-1 text-sm font-medium text-content">{component.key !== origin.metric && ROI_METRIC_KEYS.includes(component.key as RoiMetricKey)
          ? <button type="button" aria-label={`Ver origem de ${component.label}`} onClick={() => onInspect(component.key as RoiMetricKey, [property.propertyId], property.propertyTitle)} className="rounded-sm text-left underline decoration-dotted underline-offset-4 hover:text-brand focus-visible:outline-2 focus-visible:outline-brand">{originValue(component.value, component.unit, true)}</button>
          : originValue(component.value, component.unit, true)}</dd>
      </div>)}</dl>
      <SourceRecords sources={property.sources} />
    </details>)}
    <p className="text-xs text-content-muted">A composição mantém casas decimais adicionais quando necessárias para conferir o cálculo. As despesas são convertidas para 12 meses; os aluguéis e o investimento inicial consideram todo o histórico.</p>
  </div>;
}

function OriginPanel({ propertyIds, metric, period, onInspect }: Omit<Props, 'row' | 'onClose' | 'metric'> & { metric: RoiMetricKey; onInspect: InspectOrigin }) {
  const [result, setResult] = useState<{ data: RoiOrigin } | { error: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const idsKey = JSON.stringify(propertyIds);
  useEffect(() => {
    let active = true;
    getRoiOriginAction({ from: period.from, to: period.to, propertyIds: JSON.parse(idsKey), metric }).then(response => {
      if (active) setResult(response.ok ? { data: response.data } : { error: describeActionError(response) });
    }).catch(() => { if (active) setResult({ error: 'Não foi possível consultar a origem deste valor. Tente novamente.' }); });
    return () => { active = false; };
  }, [period.from, period.to, idsKey, metric, attempt]);
  if (!result) return <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-content-muted"><Loader2 className="animate-spin" size={18} />Consultando a origem do valor...</div>;
  if ('error' in result) return <div className="py-6"><p role="alert" className="text-sm text-red-600">{result.error}</p><button type="button" className="mt-3 rounded-lg border border-ui-border px-4 py-2 text-sm text-content hover:bg-surface-subtle" onClick={() => { setResult(null); setAttempt(current => current + 1); }}>Tentar novamente</button></div>;
  return <OriginContents origin={result.data} onInspect={onInspect} />;
}

export default function RoiInspectionModal({ row, propertyIds, metric: initialMetric, period, onClose }: Props) {
  const [views, setViews] = useState<Array<{ metric: RoiMetricKey; propertyIds: string[]; propertyTitle?: string }>>(
    initialMetric ? [{ metric: initialMetric, propertyIds, propertyTitle: row?.propertyTitle }] : [],
  );
  const view = views.at(-1);
  const metric = view?.metric ?? null;
  const headingId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inspect: InspectOrigin = (nextMetric, nextPropertyIds = propertyIds, propertyTitle = row?.propertyTitle) => {
    setViews(current => [...current, { metric: nextMetric, propertyIds: nextPropertyIds, propertyTitle }]);
    bodyRef.current?.scrollTo({ top: 0 });
    closeRef.current?.focus();
  };
  useEffect(() => {
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const controls = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], summary, [tabindex="0"]')].filter(element => element.getClientRects().length > 0);
      const first = controls[0], last = controls.at(-1);
      if (!dialogRef.current.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first)?.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); document.body.style.overflow = previousOverflow; if (returnFocus?.isConnected) returnFocus.focus(); };
  }, [onClose]);
  const title = metric ? `Origem de ${ROI_METRIC_DEFINITIONS[metric].label}` : 'Detalhamento do ROI';
  if (typeof document === 'undefined') return null;
  return createPortal(<div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 p-3 sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={headingId} className="flex max-h-[92vh] w-full min-w-0 max-w-6xl flex-col rounded-2xl border border-ui-border-soft bg-surface shadow-xl">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-ui-border-soft p-4 sm:px-6">
        <div className="min-w-0"><h2 id={headingId} className="text-base font-semibold text-content">{title}</h2><p className="mt-1 text-xs text-content-muted">{view?.propertyTitle ?? row?.propertyTitle ?? `Carteira de ${(view?.propertyIds ?? propertyIds).length} imóveis`} · Despesas de {formatIsoDate(period.from)} a {formatIsoDate(period.to)}</p></div>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Fechar detalhamento do ROI" className="shrink-0 rounded-lg p-1 text-content-muted hover:bg-surface-subtle hover:text-content"><X size={20} /></button>
      </div>
      <div ref={bodyRef} className="min-h-0 overflow-y-auto p-3 sm:p-5">
        {metric && (row || views.length > 1) && <button type="button" onClick={() => { setViews(current => current.slice(0, -1)); bodyRef.current?.scrollTo({ top: 0 }); closeRef.current?.focus(); }} className="mb-4 flex items-center gap-2 rounded-sm text-sm text-brand hover:underline focus-visible:outline-2 focus-visible:outline-brand"><ArrowLeft size={16} />{views.length > 1 ? 'Voltar à origem anterior' : 'Voltar ao detalhamento'}</button>}
        {metric && view ? <OriginPanel key={`${metric}:${JSON.stringify(view.propertyIds)}:${views.length}`} propertyIds={view.propertyIds} metric={metric} period={period} onInspect={inspect} />
          : row && <RoiDetail row={row} periodLabel={`${formatIsoDate(period.from)} a ${formatIsoDate(period.to)}`} onInspect={inspect} />}
      </div>
    </div>
  </div>, document.body);
}
