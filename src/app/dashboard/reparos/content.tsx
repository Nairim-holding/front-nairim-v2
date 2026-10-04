'use client';
import { useCallback, useEffect, useState } from 'react';
import { Plus, Wrench, Pencil, Trash2, X, Eye, Upload } from 'lucide-react';
import Section from '@/components/layout/PageSection';
import { usePermissions } from '@/contexts/PermissionsContext';
import { useMessageContext } from '@/contexts/MessageContext';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { describeActionError } from '@/shared/actions/action-result';
import { REPAIR_EVENT_LABELS, REPAIR_PROBLEM_LABELS, REPAIR_STATUS_LABELS, type Repair } from '@/core/entities/repair';
import { listRepairsAction, getRepairPropertiesAction, saveRepairAction, deleteRepairAction, uploadRepairMediaAction, deleteRepairMediaAction } from '@/server/actions/repair';

const inputClass = 'w-full rounded-lg border border-ui-border bg-surface px-3 py-2 text-sm text-content disabled:opacity-70';
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-lg border border-ui-border px-3 py-2 text-sm hover:bg-surface-subtle disabled:opacity-50';
type PropertyOption = { id: string; title: string };
const problemHints = {
  STRUCTURAL: 'Rachaduras e trincas, portas e janelas emperradas', ELECTRICAL: 'Curto-circuito, fugas de corrente, instalação antiga',
  HYDRAULIC: 'Infiltrações e umidade, entupimentos', FINISHING: 'Pintura, pisos manchados ou soltos',
};
function Options({ labels }: { labels: Record<string, string> }) {
  return Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>);
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1.5 text-xs font-medium text-content-secondary">{label}{children}</label>;
}

function RepairForm({ repair, properties, readOnly, onClose, onSaved }: {
  repair: Repair | null; properties: PropertyOption[]; readOnly: boolean; onClose: () => void; onSaved: (repair: Repair) => void;
}) {
  const { can } = usePermissions();
  const { showMessage } = useMessageContext();
  const [saved, setSaved] = useState(repair);
  const [busy, setBusy] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const editable = !readOnly && can('repairs', saved ? 'edit' : 'create');
  const [form, setForm] = useState(() => ({
    property_id: repair?.property_id ?? '', event_date: repair?.event_date ?? new Date().toLocaleDateString('en-CA'),
    event_type: repair?.event_type ?? 'REPAIR', problem_type: repair?.problem_type ?? 'STRUCTURAL',
    description: repair?.description ?? '', professional: repair?.professional ?? '',
    service_amount: String(repair?.service_amount ?? 0), materials_amount: String(repair?.materials_amount ?? 0),
    payment_method: repair?.payment_method ?? '', payment_conditions: repair?.payment_conditions ?? '',
    status: repair?.status ?? 'PLANNED', start_date: repair?.start_date ?? '', completion_date: repair?.completion_date ?? '', notes: repair?.notes ?? '',
  }));
  const change = (name: keyof typeof form, value: string) => setForm(v => ({ ...v, [name]: value }));
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true);
    try {
      const result = await saveRepairAction(saved?.id ?? null, form);
      if (!result.ok) throw new Error(describeActionError(result));
      setSaved(result.data); onSaved(result.data); showMessage('Reparo salvo. Você pode adicionar as mídias antes e depois.', 'success');
    } catch (error) { showMessage(error instanceof Error ? error.message : 'Erro ao salvar reparo', 'error'); }
    finally { setBusy(false); }
  };
  const upload = async (file: File | undefined, stage: 'BEFORE' | 'AFTER') => {
    if (!file || !saved) return;
    setMediaBusy(true);
    try {
      const data = new FormData(); data.set('file', file); data.set('stage', stage);
      const result = await uploadRepairMediaAction(saved.id, data);
      if (!result.ok) throw new Error(describeActionError(result));
      const next = { ...saved, media: [...saved.media, result.data as Repair['media'][number]] };
      setSaved(next); onSaved(next); showMessage('Mídia adicionada', 'success');
    } catch (error) { showMessage(error instanceof Error ? error.message : 'Erro ao enviar mídia', 'error'); }
    finally { setMediaBusy(false); }
  };
  const removeMedia = async (mediaId: string) => {
    if (!saved || !window.confirm('Excluir esta mídia?')) return;
    setMediaBusy(true);
    try {
      const result = await deleteRepairMediaAction(saved.id, mediaId);
      if (!result.ok) throw new Error(describeActionError(result));
      const next = { ...saved, media: saved.media.filter(m => m.id !== mediaId) }; setSaved(next); onSaved(next);
    } catch (error) { showMessage(error instanceof Error ? error.message : 'Erro ao excluir mídia', 'error'); }
    finally { setMediaBusy(false); }
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3" onClick={event => { if (event.target === event.currentTarget && !busy && !mediaBusy) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-labelledby="repair-title" className="flex max-h-[95vh] w-full max-w-4xl flex-col rounded-xl bg-surface shadow-xl">
      <div className="flex items-center justify-between border-b border-ui-border-soft p-4">
        <h2 id="repair-title" className="font-semibold text-content">{saved ? 'Reparo do imóvel' : 'Novo reparo ou reforma'}</h2>
        <button type="button" aria-label="Fechar" disabled={busy || mediaBusy} onClick={onClose}><X size={20} /></button>
      </div>
      <div className="overflow-y-auto p-4 space-y-5">
        <form onSubmit={save} className="space-y-4">
          <fieldset disabled={!editable || busy} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Imóvel *"><select className={inputClass} required value={form.property_id} onChange={e => change('property_id', e.target.value)}>
              <option value="">Selecione o imóvel</option><Options labels={Object.fromEntries(properties.map(p => [p.id, p.title]))} />
              {saved && !properties.some(p => p.id === saved.property_id) && <option value={saved.property_id}>{saved.property.title} (excluído)</option>}
            </select></Field>
            <Field label="Data do evento *"><input className={inputClass} type="date" required value={form.event_date} onChange={e => change('event_date', e.target.value)} /></Field>
            <Field label="Tipo do evento *"><select className={inputClass} value={form.event_type} onChange={e => change('event_type', e.target.value)}><Options labels={REPAIR_EVENT_LABELS} /></select></Field>
            <Field label="Tipo de problema *"><select className={inputClass} value={form.problem_type} onChange={e => change('problem_type', e.target.value)}><Options labels={REPAIR_PROBLEM_LABELS} /></select><span className="text-content-muted font-normal">{problemHints[form.problem_type]}</span></Field>
            <Field label="Profissional ou empresa responsável *"><input className={inputClass} required maxLength={300} value={form.professional} onChange={e => change('professional', e.target.value)} /></Field>
            <Field label="Situação"><select className={inputClass} value={form.status} onChange={e => change('status', e.target.value)}><Options labels={REPAIR_STATUS_LABELS} /></select></Field>
            <div className="sm:col-span-2 lg:col-span-3"><Field label="Detalhamento do problema *"><textarea className={inputClass} required maxLength={10000} rows={3} value={form.description} onChange={e => change('description', e.target.value)} /></Field></div>
            <Field label="Valor do serviço (R$) *"><input className={inputClass} type="number" min="0" step="0.01" required value={form.service_amount} onChange={e => change('service_amount', e.target.value)} /></Field>
            <Field label="Valor dos materiais (R$) *"><input className={inputClass} type="number" min="0" step="0.01" required value={form.materials_amount} onChange={e => change('materials_amount', e.target.value)} /></Field>
            <div className="rounded-lg bg-surface-subtle p-3 text-sm"><span className="text-content-secondary">Custo total</span><strong className="block text-lg text-content">{formatCurrency(Number(form.service_amount) + Number(form.materials_amount))}</strong></div>
            <Field label="Forma de pagamento *"><input className={inputClass} list="repair-payment-methods" required maxLength={100} value={form.payment_method} onChange={e => change('payment_method', e.target.value)} /><datalist id="repair-payment-methods">{['Pix','Transferência','Boleto','Cartão de crédito','Cartão de débito','Dinheiro'].map(v => <option key={v} value={v} />)}</datalist></Field>
            <Field label="Condições de pagamento *"><input className={inputClass} required maxLength={1000} placeholder="Ex.: entrada de 30% + 2 parcelas" value={form.payment_conditions} onChange={e => change('payment_conditions', e.target.value)} /></Field>
            <Field label="Data de início"><input className={inputClass} type="date" value={form.start_date} onChange={e => change('start_date', e.target.value)} /></Field>
            <Field label="Data de conclusão"><input className={inputClass} type="date" required={form.status === 'COMPLETED'} min={form.start_date || undefined} value={form.completion_date} onChange={e => change('completion_date', e.target.value)} /></Field>
            <div className="sm:col-span-2"><Field label="Observações do serviço"><textarea className={inputClass} maxLength={10000} rows={2} value={form.notes} onChange={e => change('notes', e.target.value)} /></Field></div>
          </fieldset>
          {editable && <div className="flex justify-end"><button className={`${buttonClass} bg-brand text-content-inverse`} disabled={busy || mediaBusy}>{busy ? 'Salvando…' : 'Salvar reparo'}</button></div>}
        </form>
        <div className="border-t border-ui-border-soft pt-4">
          <h3 className="text-sm font-semibold text-content mb-3">Mídias do serviço</h3>
          {!saved && <p className="text-sm text-content-muted">Salve o reparo para adicionar imagens e vídeos antes e depois.</p>}
          {saved && <div className="grid sm:grid-cols-2 gap-4">{(['BEFORE', 'AFTER'] as const).map(stage => <div key={stage} className="rounded-lg border border-ui-border-soft p-3 space-y-3">
            <h4 className="text-sm font-medium text-content">{stage === 'BEFORE' ? 'Antes — problemas identificados' : 'Depois — serviço realizado'}</h4>
            {saved.media.filter(m => m.stage === stage).length === 0 && <p className="text-xs text-content-muted">Nenhuma mídia adicionada.</p>}
            <div className="grid grid-cols-2 gap-2">{saved.media.filter(m => m.stage === stage).map(media => <div key={media.id} className="relative min-w-0 rounded border border-ui-border-soft p-1">
              {media.content_type.startsWith('video/') ? <video controls preload="metadata" src={media.url} className="h-28 w-full object-contain" /> : <a href={media.url} target="_blank" rel="noopener noreferrer"><img src={media.url} alt={media.filename} className="h-28 w-full object-cover" /></a>}
              <a href={media.url} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-content-secondary mt-1">{media.filename}</a>
              {!readOnly && can('repairs', 'delete') && <button type="button" aria-label={`Excluir ${media.filename}`} disabled={mediaBusy || busy} onClick={() => removeMedia(media.id)} className="absolute right-1 top-1 rounded bg-surface p-1 text-red-600"><Trash2 size={14} /></button>}
            </div>)}</div>
            {!readOnly && can('repairs', 'edit') && <label className={`${buttonClass} cursor-pointer ${mediaBusy ? 'opacity-50' : ''}`}><Upload size={14} />{mediaBusy ? 'Enviando…' : 'Adicionar mídia'}<input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm" disabled={mediaBusy || busy || saved.media.filter(m => m.stage === stage).length >= 10} onChange={e => { upload(e.target.files?.[0], stage); e.target.value = ''; }} /></label>}
            <p className="text-xs text-content-muted">Até 10 arquivos por etapa, de até 20 MB cada.</p>
          </div>)}</div>}
        </div>
      </div>
    </div>
  </div>;
}

export default function RepairsPage() {
  const { can } = usePermissions(); const { showMessage } = useMessageContext();
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [rows, setRows] = useState<Repair[]>([]); const [count, setCount] = useState(0); const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [deleting, setDeleting] = useState(false);
  const [filters, setFilters] = useState({ search: '', property_id: '', status: '', from: '', to: '', page: 1 });
  const [editor, setEditor] = useState<{ repair: Repair | null; readOnly: boolean } | null>(null); const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(v => v + 1), []);
  useEffect(() => { let cancelled = false; getRepairPropertiesAction().then(result => { if (cancelled) return; if (result.ok) setProperties(result.data); else showMessage(describeActionError(result), 'error'); }); return () => { cancelled = true; }; }, [showMessage]);
  useEffect(() => {
    let cancelled = false; setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const result = await listRepairsAction(Object.fromEntries(Object.entries(filters).filter(([,v]) => v !== '')));
        if (cancelled) return;
        if (!result.ok) { setError(describeActionError(result)); setRows([]); setCount(0); setPages(0); }
        else { setRows(result.data.data); setCount(result.data.count); setPages(result.data.totalPages); setError(''); }
      } catch { if (!cancelled) setError('Não foi possível carregar os reparos. Tente novamente.'); }
      finally { if (!cancelled) setLoading(false); }
    }, 200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [filters, revision]);
  const filter = (name: keyof typeof filters, value: string) => setFilters(v => ({ ...v, [name]: value, page: 1 }));
  const remove = async (repair: Repair) => {
    if (!window.confirm(`Excluir o ${REPAIR_EVENT_LABELS[repair.event_type].toLowerCase()} de ${repair.property.title}?`)) return;
    setDeleting(true);
    try { const result = await deleteRepairAction(repair.id); if (!result.ok) throw new Error(describeActionError(result)); showMessage('Reparo excluído', 'success'); refresh(); }
    catch (error) { showMessage(error instanceof Error ? error.message : 'Erro ao excluir reparo', 'error'); }
    finally { setDeleting(false); }
  };
  return <Section title="Reparos">
    <div className="flex flex-col gap-4 text-content">
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-content-secondary">Controle os reparos e reformas dos imóveis, os custos e as mídias do serviço.</p>{can('repairs','create') && <button type="button" className={`${buttonClass} bg-brand text-content-inverse`} onClick={() => setEditor({ repair: null, readOnly: false })}><Plus size={16} />Novo reparo</button>}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <Field label="Pesquisar"><input className={inputClass} placeholder="Imóvel, problema ou profissional" value={filters.search} onChange={e => filter('search',e.target.value)} /></Field>
        <Field label="Imóvel"><select className={inputClass} value={filters.property_id} onChange={e => filter('property_id',e.target.value)}><option value="">Todos</option><Options labels={Object.fromEntries(properties.map(p => [p.id,p.title]))} /></select></Field>
        <Field label="Situação"><select className={inputClass} value={filters.status} onChange={e => filter('status',e.target.value)}><option value="">Todas</option><Options labels={REPAIR_STATUS_LABELS} /></select></Field>
        <Field label="Evento de"><input className={inputClass} type="date" value={filters.from} onChange={e => filter('from',e.target.value)} /></Field>
        <Field label="Evento até"><input className={inputClass} type="date" value={filters.to} onChange={e => filter('to',e.target.value)} /></Field>
      </div>
      {error && <div role="alert" className="text-sm text-red-600">{error}<button className={`${buttonClass} ml-2`} onClick={refresh}>Tentar novamente</button></div>}
      <div className="overflow-x-auto rounded-lg border border-ui-border-soft"><table className="w-full text-sm"><thead className="bg-surface-subtle text-left text-content-secondary"><tr>{['Data','Imóvel / problema','Evento','Profissional','Situação','Serviço','Materiais','Total','Ações'].map(label => <th key={label} className="p-3 whitespace-nowrap">{label}</th>)}</tr></thead><tbody>
        {loading ? <tr><td colSpan={9} className="p-8 text-center text-content-muted">Carregando reparos…</td></tr> : rows.length === 0 ? <tr><td colSpan={9} className="p-10 text-center text-content-muted"><Wrench size={28} className="mx-auto mb-2" />Nenhum reparo encontrado.</td></tr> : rows.map(row => <tr key={row.id} className="border-t border-ui-border-soft hover:bg-surface-subtle">
          <td className="p-3 whitespace-nowrap">{formatDate(row.event_date)}</td><td className="p-3"><strong>{row.property.title}</strong><p className="text-xs text-content-muted">{REPAIR_PROBLEM_LABELS[row.problem_type]}</p><p className="max-w-64 truncate text-xs text-content-secondary">{row.description}</p></td>
          <td className="p-3">{REPAIR_EVENT_LABELS[row.event_type]}</td><td className="p-3">{row.professional}</td><td className="p-3 whitespace-nowrap">{REPAIR_STATUS_LABELS[row.status]}</td>
          <td className="p-3 whitespace-nowrap text-right">{formatCurrency(row.service_amount)}</td><td className="p-3 whitespace-nowrap text-right">{formatCurrency(row.materials_amount)}</td><td className="p-3 whitespace-nowrap text-right font-semibold">{formatCurrency(row.service_amount + row.materials_amount)}</td>
          <td className="p-3"><div className="flex gap-2"><button type="button" title="Visualizar reparo e mídias" aria-label="Visualizar reparo e mídias" onClick={() => setEditor({ repair: row, readOnly: true })}><Eye size={16} /></button>{can('repairs','edit') && <button type="button" title="Editar reparo" aria-label="Editar reparo" onClick={() => setEditor({ repair: row, readOnly: false })}><Pencil size={16} /></button>}{can('repairs','delete') && <button type="button" disabled={deleting} title="Excluir reparo" aria-label="Excluir reparo" onClick={() => remove(row)} className="text-red-600"><Trash2 size={16} /></button>}</div></td>
        </tr>)}
      </tbody></table></div>
      <div className="flex items-center justify-between text-xs text-content-secondary"><span>{count} reparo(s)</span><div className="flex items-center gap-3"><button className={buttonClass} disabled={loading || filters.page <= 1} onClick={() => setFilters(v => ({ ...v, page: v.page - 1 }))}>Anterior</button><span>Página {filters.page} de {Math.max(1,pages)}</span><button className={buttonClass} disabled={loading || filters.page >= pages} onClick={() => setFilters(v => ({ ...v, page: v.page + 1 }))}>Próxima</button></div></div>
    </div>
    {editor && <RepairForm key={editor.repair?.id ?? 'new'} repair={editor.repair} properties={properties} readOnly={editor.readOnly} onClose={() => setEditor(null)} onSaved={refresh} />}
  </Section>;
}
