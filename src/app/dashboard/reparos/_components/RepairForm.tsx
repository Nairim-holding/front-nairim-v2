'use client';

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import Image from 'next/image';
import { Building2, CalendarDays, CheckCircle2, CreditCard, FileText, Hammer, ImagePlus, Save, Trash2, Upload, UserRound, Wrench, X } from 'lucide-react';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import TextArea from '@/components/ui/TextArea';
import Label from '@/components/ui/Label';
import QuickCreateAutocomplete, { extractQuickCreateName, isQuickCreateSentinel } from '@/components/ui/QuickCreateAutocomplete';
import { usePermissions } from '@/contexts/PermissionsContext';
import { useMessageContext } from '@/contexts/MessageContext';
import { usePopupContext } from '@/contexts/PopupContext';
import { formatCurrency, parseCurrencyFromPTBR } from '@/utils/formatters';
import { describeActionError } from '@/shared/actions/action-result';
import { repairDetailsSchema } from '@/shared/validators/repair';
import { quickCreateFinancialSupplierAction } from '@/server/actions/financial-supplier';
import { REPAIR_EVENT_LABELS, REPAIR_PROBLEM_LABELS, REPAIR_STATUS_LABELS, type Repair } from '@/core/entities/repair';
import { saveRepairAction, uploadRepairMediaAction, deleteRepairMediaAction } from '@/server/actions/repair';

export type PropertyOption = { id: string; title: string };
export type ResponsibleOption = { id: string; legal_name: string };
export const repairOptions = (labels: Record<string, string>) => Object.entries(labels).map(([value, label]) => ({ value, label }));
const problemHints = {
  STRUCTURAL: 'Rachaduras e trincas, portas e janelas emperradas', ELECTRICAL: 'Curto-circuito, fugas de corrente, instalação antiga',
  HYDRAULIC: 'Infiltrações e umidade, entupimentos', FINISHING: 'Pintura, pisos manchados ou soltos',
};
const secondaryButton = 'inline-flex items-center justify-center gap-2 rounded-lg border border-ui-border px-4 py-2 text-sm text-content-secondary hover:bg-surface-subtle transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

function FormGroup({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return <section className="space-y-5">
    <h3 className="flex items-center gap-2 border-b border-ui-border-soft pb-3 text-sm font-semibold text-content">{icon}{title}</h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-5">{children}</div>
  </section>;
}

export default function RepairForm({ repair, properties, suppliers, suppliersLoading, onSupplierCreated, readOnly, onClose, onSaved, onBusyChange }: {
  repair: Repair | null; properties: PropertyOption[]; readOnly: boolean; onClose: () => void;
  suppliers: ResponsibleOption[]; suppliersLoading: boolean; onSupplierCreated: (supplier: ResponsibleOption) => void;
  onSaved: (repair: Repair) => void; onBusyChange: (busy: boolean) => void;
}) {
  const { can } = usePermissions();
  const { showMessage } = useMessageContext();
  const { showPopup } = usePopupContext();
  const [saved, setSaved] = useState(repair);
  const [busy, setBusy] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const editable = !readOnly && can('repairs', saved ? 'edit' : 'create');
  const disabled = !editable || busy || mediaBusy;
  const [form, setForm] = useState(() => ({
    property_id: repair?.property_id ?? '', event_date: repair?.event_date ?? new Date().toLocaleDateString('en-CA'),
    event_type: repair?.event_type ?? 'REPAIR', problem_type: repair?.problem_type ?? 'STRUCTURAL',
    description: repair?.description ?? '', supplier_id: repair?.supplier_id ?? '',
    service_amount: formatCurrency(repair?.service_amount ?? 0), materials_amount: formatCurrency(repair?.materials_amount ?? 0),
    payment_method: repair?.payment_method ?? '', payment_conditions: repair?.payment_conditions ?? '',
    status: repair?.status ?? 'PLANNED', start_date: repair?.start_date ?? '', completion_date: repair?.completion_date ?? '', notes: repair?.notes ?? '',
  }));
  useEffect(() => { onBusyChange(busy || mediaBusy); }, [busy, mediaBusy, onBusyChange]);
  const propertyOptions = useMemo(() => {
    const options = properties.map(p => ({ value: p.id, label: p.title }));
    if (saved && !properties.some(p => p.id === saved.property_id)) options.push({ value: saved.property_id, label: `${saved.property.title} (excluído)` });
    return options;
  }, [properties, saved]);
  const change = (name: keyof typeof form, value: string) => setForm(v => ({ ...v, [name]: value }));
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (disabled) return;
    if (!form.property_id) { showMessage('Selecione o imóvel.', 'error'); return; }
    if (!form.supplier_id) { showMessage('Selecione um contato ou escolha Adicionar novo para cadastrar o responsável.', 'error'); return; }
    const newName = isQuickCreateSentinel(form.supplier_id) ? extractQuickCreateName(form.supplier_id).trim() : null;
    if (newName !== null && (newName.length < 2 || newName.length > 150)) { showMessage('O nome do novo contato deve ter entre 2 e 150 caracteres.', 'error'); return; }
    const parsed = repairDetailsSchema.safeParse({ ...form, service_amount: parseCurrencyFromPTBR(form.service_amount), materials_amount: parseCurrencyFromPTBR(form.materials_amount) });
    if (!parsed.success) { showMessage(parsed.error.issues[0].message, 'error'); return; }
    setBusy(true);
    try {
      let supplierId = form.supplier_id;
      if (newName !== null) {
        const created = await quickCreateFinancialSupplierAction({ legal_name: newName });
        if (!created.ok) throw new Error(describeActionError(created));
        if (created.data.deleted_at || created.data.is_active === false) throw new Error('Já existe um contato inativo com esse nome. Escolha um contato ativo do Financeiro.');
        supplierId = created.data.id;
        onSupplierCreated({ id: supplierId, legal_name: created.data.legal_name });
        change('supplier_id', supplierId);
      }
      const result = await saveRepairAction(saved?.id ?? null, { ...parsed.data, supplier_id: supplierId });
      if (!result.ok) throw new Error(describeActionError(result));
      setSaved(result.data); onSaved(result.data); showMessage('Reparo salvo. Você pode adicionar as mídias antes e depois.', 'success');
    } catch (error) { showMessage(error instanceof Error ? error.message : 'Erro ao salvar reparo', 'error'); }
    finally { setBusy(false); }
  };
  const upload = async (file: File | undefined, stage: 'BEFORE' | 'AFTER') => {
    if (!file || !saved || busy || mediaBusy) return;
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
  const removeMedia = (mediaId: string) => {
    if (!saved || busy || mediaBusy) return;
    showPopup('Excluir mídia', 'Deseja excluir esta imagem ou vídeo do reparo?', async () => {
      setMediaBusy(true);
      try {
        const result = await deleteRepairMediaAction(saved.id, mediaId);
        if (!result.ok) throw new Error(describeActionError(result));
        const next = { ...saved, media: saved.media.filter(m => m.id !== mediaId) };
        setSaved(next); onSaved(next); showMessage('Mídia excluída', 'success');
      } catch (error) { showMessage(error instanceof Error ? error.message : 'Erro ao excluir mídia', 'error'); }
      finally { setMediaBusy(false); }
    });
  };

  return <section aria-labelledby="repair-title" className="min-w-0 bg-surface">
    <div className="flex items-start justify-between gap-3 border-b border-ui-border-soft px-5 py-4">
      <div>
        <h2 id="repair-title" className="text-base font-semibold text-content">{readOnly ? 'Detalhes do reparo' : saved ? 'Editar reparo' : 'Novo reparo ou reforma'}</h2>
        <p className="mt-1 text-xs text-content-muted">{saved ? saved.property.title : 'Preencha os dados do serviço e acompanhe sua execução.'}</p>
      </div>
      <button type="button" aria-label="Fechar formulário" disabled={busy || mediaBusy} onClick={onClose} className="rounded-full bg-surface-subtle p-1.5 text-content-muted hover:text-content disabled:opacity-50"><X size={18} /></button>
    </div>
    <div className="space-y-7 p-4 sm:p-6">
      <form aria-label="Cadastro de reparo" onSubmit={save} className="space-y-7">
        <FormGroup title="Dados do serviço" icon={<Wrench size={18} className="text-brand" />}>
          <div className="md:col-span-2" data-testid="repair-property"><Select id="repair-property" label="Imóvel" required options={propertyOptions} value={form.property_id} onChange={v => change('property_id', String(v))} placeholder="Selecione o imóvel" searchable disabled={disabled} svg={<Building2 size={18} />} full /></div>
          <Input id="repair-event-date" label="Data do evento" type="date" required value={form.event_date} onChange={e => change('event_date', e.target.value)} disabled={disabled} svg={<CalendarDays size={18} />} full />
          <Select id="repair-event-type" label="Tipo do evento" required options={repairOptions(REPAIR_EVENT_LABELS)} value={form.event_type} onChange={v => change('event_type', String(v))} disabled={disabled} svg={<Hammer size={18} />} full />
          <div><Select id="repair-problem-type" label="Tipo de problema" required options={repairOptions(REPAIR_PROBLEM_LABELS)} value={form.problem_type} onChange={v => change('problem_type', String(v))} disabled={disabled} svg={<Wrench size={18} />} full /><p className="mt-2 text-xs text-content-muted">{problemHints[form.problem_type]}</p></div>
          <Select id="repair-status" label="Situação" options={repairOptions(REPAIR_STATUS_LABELS)} value={form.status} onChange={v => change('status', String(v))} disabled={disabled} svg={<CheckCircle2 size={18} />} full />
          <div className="md:col-span-2">
            <Label label="Profissional ou empresa responsável" required svg={<UserRound size={18} />} />
            <QuickCreateAutocomplete ariaLabel="Profissional ou empresa responsável" size="md" className="h-[40px] text-content-secondary disabled:!bg-surface-muted disabled:!text-content-muted" value={form.supplier_id} onChange={v => change('supplier_id', v)} options={suppliers.map(s => ({ value: s.id, label: s.legal_name }))} currentLabel={saved?.supplier?.legal_name ?? saved?.professional} placeholder={suppliersLoading ? 'Carregando contatos…' : readOnly && !saved?.supplier_id ? saved?.professional : 'Buscar contato ou digitar um novo nome...'} allowCreate={editable && can('financial-suppliers', 'create')} disabled={disabled || suppliersLoading} />
            <p className="mt-2 text-xs text-content-muted">{isQuickCreateSentinel(form.supplier_id) ? 'O novo contato será cadastrado no Financeiro ao salvar o reparo.' : saved && !saved.supplier_id ? 'Responsável do histórico: ' + saved.professional + '. Selecione o contato correspondente para atualizar o reparo.' : 'Selecione um Contato do Financeiro.' + (editable && can('financial-suppliers', 'create') ? ' Para cadastrar sem sair da tela, digite o nome e escolha Adicionar novo.' : '')}</p>
          </div>
          <div className="md:col-span-2"><TextArea id="repair-description" label="Detalhamento do problema" required maxLength={10000} rows={3} value={form.description} onChange={e => change('description', e.target.value)} placeholder="Descreva o problema identificado e o serviço necessário" disabled={disabled} svg={<FileText size={18} />} /></div>
        </FormGroup>
        <FormGroup title="Custos e pagamento" icon={<CreditCard size={18} className="text-brand" />}>
          <Input id="repair-service-amount" label="Valor do serviço (R$)" required mask="money" value={form.service_amount} onChange={e => change('service_amount', e.target.value)} disabled={disabled} full />
          <Input id="repair-materials-amount" label="Valor dos materiais (R$)" required mask="money" value={form.materials_amount} onChange={e => change('materials_amount', e.target.value)} disabled={disabled} full />
          <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand/20 bg-brand/5 px-4 py-3" aria-live="polite"><span className="text-sm text-content-secondary">Custo total</span><strong className="text-lg text-brand">{formatCurrency(parseCurrencyFromPTBR(form.service_amount) + parseCurrencyFromPTBR(form.materials_amount))}</strong></div>
          <Input id="repair-payment-method" label="Forma de pagamento" required maxLength={100} value={form.payment_method} onChange={e => change('payment_method', e.target.value)} placeholder="Ex.: Pix, boleto ou transferência" disabled={disabled} svg={<CreditCard size={18} />} full />
          <Input id="repair-payment-conditions" label="Condições de pagamento" required maxLength={1000} value={form.payment_conditions} onChange={e => change('payment_conditions', e.target.value)} placeholder="Ex.: entrada de 30% + 2 parcelas" disabled={disabled} full />
        </FormGroup>
        <FormGroup title="Datas e observações" icon={<CalendarDays size={18} className="text-brand" />}>
          <Input id="repair-start-date" label="Data de início" type="date" value={form.start_date} onChange={e => change('start_date', e.target.value)} disabled={disabled} full />
          <Input id="repair-completion-date" label="Data de conclusão" type="date" required={form.status === 'COMPLETED'} value={form.completion_date} onChange={e => change('completion_date', e.target.value)} disabled={disabled} full />
          <div className="md:col-span-2"><TextArea id="repair-notes" label="Observações do serviço" maxLength={10000} rows={3} value={form.notes} onChange={e => change('notes', e.target.value)} placeholder="Observações sobre a execução do serviço" disabled={disabled} /></div>
        </FormGroup>
        <div className="flex flex-wrap justify-end gap-3 border-t border-ui-border-soft pt-4">
          <button type="button" className={secondaryButton} disabled={busy || mediaBusy} onClick={onClose}>{readOnly ? 'Fechar' : 'Cancelar'}</button>
          {editable && <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={busy || mediaBusy}><Save size={16} />{busy ? 'Salvando…' : 'Salvar reparo'}</button>}
        </div>
      </form>
      <section className="space-y-4 border-t border-ui-border-soft pt-5" aria-labelledby="repair-media-title">
        <h3 id="repair-media-title" className="flex items-center gap-2 text-sm font-semibold text-content"><ImagePlus size={18} className="text-brand" />Mídias do serviço</h3>
        {!saved ? <p className="rounded-lg border border-dashed border-ui-border bg-surface-subtle p-4 text-sm text-content-muted">Salve o reparo para adicionar imagens e vídeos antes e depois.</p> : <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">{(['BEFORE', 'AFTER'] as const).map(stage => {
          const media = saved.media.filter(m => m.stage === stage);
          return <div key={stage} className="rounded-xl border border-ui-border bg-surface-subtle p-4 space-y-3">
            <h4 className="text-sm font-medium text-content">{stage === 'BEFORE' ? 'Antes — problemas identificados' : 'Depois — serviço realizado'}</h4>
            {media.length === 0 && <p className="text-xs text-content-muted">Nenhuma mídia adicionada.</p>}
            <div className="grid grid-cols-2 gap-2">{media.map(item => <div key={item.id} className="relative min-w-0 rounded-lg border border-ui-border-soft bg-surface p-2">
              {item.content_type.startsWith('video/') ? <video controls preload="metadata" src={item.url} className="h-28 w-full object-contain" /> : <a href={item.url} target="_blank" rel="noopener noreferrer"><Image src={item.url} alt={item.filename} width={320} height={224} unoptimized className="h-28 w-full rounded object-cover" /></a>}
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-1 block truncate text-xs text-content-secondary">{item.filename}</a>
              {!readOnly && can('repairs', 'delete') && <button type="button" aria-label={`Excluir ${item.filename}`} disabled={mediaBusy || busy} onClick={() => removeMedia(item.id)} className="absolute right-1 top-1 rounded bg-surface p-1 text-state-error hover:bg-state-error/10"><Trash2 size={14} /></button>}
            </div>)}</div>
            {!readOnly && can('repairs', 'edit') && <label className={`${secondaryButton} ${mediaBusy || busy || media.length >= 10 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}><Upload size={14} />{mediaBusy ? 'Enviando…' : 'Adicionar mídia'}<input type="file" className="sr-only" aria-label={`Adicionar mídia ${stage === 'BEFORE' ? 'antes' : 'depois'}`} accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm" disabled={mediaBusy || busy || media.length >= 10} onChange={e => { void upload(e.target.files?.[0], stage); e.target.value = ''; }} /></label>}
            <p className="text-xs text-content-muted">Até 10 arquivos por etapa, de até 20 MB cada.</p>
          </div>;
        })}</div>}
      </section>
    </div>
  </section>;
}
