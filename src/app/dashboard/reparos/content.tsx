'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Eye, Filter, Loader2, Pencil, Plus, RotateCcw, Trash2, Wrench } from 'lucide-react';
import Section from '@/components/layout/PageSection';
import SearchInput from '@/components/filters/SearchInput';
import Pagination from '@/components/filters/Pagination';
import Select from '@/components/ui/Select';
import Input from '@/components/ui/Input';
import { usePermissions } from '@/contexts/PermissionsContext';
import { useMessageContext } from '@/contexts/MessageContext';
import { usePopupContext } from '@/contexts/PopupContext';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { describeActionError } from '@/shared/actions/action-result';
import { REPAIR_EVENT_LABELS, REPAIR_PROBLEM_LABELS, REPAIR_STATUS_LABELS, type Repair } from '@/core/entities/repair';
import { listRepairsAction, getRepairPropertiesAction, deleteRepairAction } from '@/server/actions/repair';
import { listSuppliersAction } from '@/server/actions/financial-supplier';
import RepairForm, { repairOptions, type PropertyOption, type ResponsibleOption } from './_components/RepairForm';

const emptyFilters = { search: '', property_id: '', status: '', from: '', to: '', page: 1 };
const statusColors = {
  PLANNED: 'bg-surface-muted text-content-secondary', IN_PROGRESS: 'bg-state-warning/10 text-state-warning',
  COMPLETED: 'bg-state-success/10 text-state-success', CANCELLED: 'bg-state-error/10 text-state-error',
};

export default function RepairsPage() {
  const { can } = usePermissions();
  const { showMessage } = useMessageContext();
  const { showPopup } = usePopupContext();
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [suppliers, setSuppliers] = useState<ResponsibleOption[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(true);
  const [rows, setRows] = useState<Repair[]>([]);
  const [count, setCount] = useState(0);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const [filters, setFilters] = useState(emptyFilters);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [editor, setEditor] = useState<{ repair: Repair | null; readOnly: boolean } | null>(null);
  const [revision, setRevision] = useState(0);
  const editorRef = useRef<HTMLDivElement>(null);
  const refresh = useCallback(() => setRevision(v => v + 1), []);
  useEffect(() => {
    let cancelled = false;
    async function loadSuppliers() {
      try {
        const contacts: ResponsibleOption[] = [];
        let page = 1;
        let totalPages = 1;
        do {
          const result = await listSuppliersAction({ limit: 150, page });
          if (cancelled) return;
          if (!result.ok) throw new Error(describeActionError(result));
          contacts.push(...result.data.data.filter(s => !s.deleted_at && s.is_active !== false).map(s => ({ id: s.id, legal_name: s.legal_name })));
          totalPages = result.data.totalPages;
          page++;
        } while (page <= totalPages);
        setSuppliers(contacts);
      } catch (error) { if (!cancelled) showMessage(error instanceof Error ? error.message : 'Erro ao carregar os contatos', 'error'); }
      finally { if (!cancelled) setSuppliersLoading(false); }
    }
    void loadSuppliers();
    return () => { cancelled = true; };
  }, [showMessage]);
  useEffect(() => {
    let cancelled = false;
    getRepairPropertiesAction().then(result => {
      if (cancelled) return;
      if (result.ok) setProperties(result.data);
      else showMessage(describeActionError(result), 'error');
    });
    return () => { cancelled = true; };
  }, [showMessage]);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
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
  const openEditor = (repair: Repair | null, readOnly: boolean) => {
    if (formBusy) return;
    setEditor({ repair, readOnly });
    if (window.matchMedia('(max-width: 1023px)').matches) requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const remove = (repair: Repair) => {
    showPopup('Excluir reparo', `Deseja excluir o ${REPAIR_EVENT_LABELS[repair.event_type].toLowerCase()} de ${repair.property.title}?`, async () => {
      setDeleting(true);
      try {
        const result = await deleteRepairAction(repair.id);
        if (!result.ok) throw new Error(describeActionError(result));
        if (editor?.repair?.id === repair.id) setEditor(null);
        showMessage('Reparo excluído', 'success'); refresh();
      } catch (error) { showMessage(error instanceof Error ? error.message : 'Erro ao excluir reparo', 'error'); }
      finally { setDeleting(false); }
    });
  };
  const activeFilters = Boolean(filters.property_id || filters.status || filters.from || filters.to);

  return <Section title="Reparos">
    <div className="w-full rounded-xl border border-ui-border bg-surface p-3 shadow-sm sm:p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
        <aside aria-label="Lista de reparos" className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-ui-border bg-surface-subtle">
          <div className="space-y-3 border-b border-ui-border bg-surface p-3">
            <div className="flex items-center justify-between gap-2 px-1">
              <h2 className="text-[15px] font-bold text-content">Reparos e reformas</h2>
              <div className="flex items-center gap-1">
                <button type="button" aria-label="Filtrar reparos" aria-expanded={filtersVisible} onClick={() => setFiltersVisible(v => !v)} className={`rounded-md p-1.5 transition-colors hover:bg-brand/10 ${activeFilters ? 'text-brand bg-brand/10' : 'text-content-muted'}`}><Filter size={18} /></button>
                {can('repairs', 'create') && <button type="button" title="Novo reparo" aria-label="Novo reparo" disabled={formBusy} onClick={() => openEditor(null, false)} className="rounded-md p-1.5 text-brand transition-colors hover:bg-brand/10 disabled:opacity-50"><Plus size={20} /></button>}
              </div>
            </div>
            <SearchInput initialValue={filters.search} onSearch={value => filter('search', value)} placeholder="Buscar imóvel, problema ou profissional..." />
            {filtersVisible && <div className="space-y-4 border-t border-ui-border-soft pt-3">
              <Select id="repair-filter-property" label="Imóvel" options={[{ value: '', label: 'Todos os imóveis' }, ...properties.map(p => ({ value: p.id, label: p.title }))]} value={filters.property_id} onChange={v => filter('property_id', String(v))} placeholder="Todos os imóveis" searchable full />
              <Select id="repair-filter-status" label="Situação" options={[{ value: '', label: 'Todas as situações' }, ...repairOptions(REPAIR_STATUS_LABELS)]} value={filters.status} onChange={v => filter('status', String(v))} placeholder="Todas as situações" full />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
                <Input id="repair-filter-from" label="Evento de" type="date" value={filters.from} onChange={e => filter('from', e.target.value)} full />
                <Input id="repair-filter-to" label="Evento até" type="date" value={filters.to} onChange={e => filter('to', e.target.value)} full />
              </div>
              {activeFilters && <button type="button" onClick={() => setFilters(v => ({ ...emptyFilters, search: v.search }))} className="inline-flex items-center gap-2 text-xs text-brand hover:underline"><RotateCcw size={14} />Limpar filtros</button>}
            </div>}
          </div>
          <div className="max-h-[420px] min-h-[220px] flex-1 overflow-y-auto p-2 lg:max-h-[calc(100vh-300px)] lg:min-h-[440px]" aria-busy={loading}>
            {loading ? <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-content-muted"><Loader2 size={20} className="animate-spin text-brand" />Carregando reparos…</div> : error ? <div role="alert" className="m-2 rounded-lg border border-state-error/20 bg-state-error/5 p-4 text-sm text-content-secondary"><AlertCircle size={22} className="mb-2 text-state-error" /><p>Não foi possível carregar os reparos.</p><p className="mt-1 text-xs text-content-muted">{error}</p><button type="button" onClick={refresh} className="mt-3 text-sm font-medium text-brand hover:underline">Tentar novamente</button></div> : rows.length === 0 ? <div className="flex min-h-40 flex-col items-center justify-center gap-2 p-4 text-center text-sm text-content-muted"><Wrench size={26} /><p>{activeFilters || filters.search ? 'Nenhum reparo encontrado para os filtros selecionados.' : 'Nenhum reparo cadastrado.'}</p></div> : rows.map(row => <div key={row.id} className={`mb-2 rounded-lg border transition-colors ${editor?.repair?.id === row.id ? 'border-brand/20 bg-brand/10' : 'border-transparent hover:bg-ui-border-soft'}`}>
              <button type="button" disabled={formBusy} onClick={() => openEditor(row, !can('repairs', 'edit'))} className="w-full px-3 pt-3 text-left disabled:opacity-50">
                <span className="block truncate text-sm font-medium text-content">{row.property.title}</span>
                <span className="mt-1 block text-xs text-content-muted">{REPAIR_EVENT_LABELS[row.event_type]} · {REPAIR_PROBLEM_LABELS[row.problem_type]} · {formatDate(row.event_date)}</span>
                <span className="mt-2 block truncate text-xs text-content-secondary">{row.description}</span>
                <span className="mt-1 block truncate text-xs text-content-muted">{row.professional}</span>
                <span className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusColors[row.status]}`}>{REPAIR_STATUS_LABELS[row.status]}</span><strong className="whitespace-nowrap text-sm text-content">{formatCurrency(row.service_amount + row.materials_amount)}</strong></span>
              </button>
              <div className="flex justify-end gap-1 px-2 py-2">
                <button type="button" aria-label="Visualizar reparo e mídias" title="Visualizar reparo e mídias" disabled={formBusy} onClick={() => openEditor(row, true)} className="rounded-md p-1.5 text-content-muted hover:bg-surface hover:text-brand disabled:opacity-50"><Eye size={15} /></button>
                {can('repairs', 'edit') && <button type="button" aria-label="Editar reparo" title="Editar reparo" disabled={formBusy} onClick={() => openEditor(row, false)} className="rounded-md p-1.5 text-content-muted hover:bg-surface hover:text-brand disabled:opacity-50"><Pencil size={15} /></button>}
                {can('repairs', 'delete') && <button type="button" aria-label="Excluir reparo" title="Excluir reparo" disabled={deleting || formBusy} onClick={() => remove(row)} className="rounded-md p-1.5 text-state-error hover:bg-state-error/10 disabled:opacity-50"><Trash2 size={15} /></button>}
              </div>
            </div>)}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-1 border-t border-ui-border bg-surface p-2">
            <span className="pl-1 text-xs text-content-muted">{count} reparo(s)</span>
            <div className={loading ? 'pointer-events-none opacity-50' : ''}><Pagination currentPage={filters.page} totalPage={Math.max(1, pages)} onPageChange={page => setFilters(v => ({ ...v, page }))} /></div>
          </div>
        </aside>
        <div ref={editorRef} className="min-w-0 scroll-mt-4 overflow-hidden rounded-xl border border-ui-border bg-surface lg:col-span-2">
          {editor ? <RepairForm key={`${editor.repair?.id ?? 'new'}-${editor.readOnly}`} repair={editor.repair} properties={properties} suppliers={suppliers} suppliersLoading={suppliersLoading} onSupplierCreated={supplier => setSuppliers(current => [...current.filter(s => s.id !== supplier.id), supplier])} readOnly={editor.readOnly} onClose={() => setEditor(null)} onSaved={saved => { setEditor(current => current ? { ...current, repair: saved } : current); refresh(); }} onBusyChange={setFormBusy} /> : <div className="m-4 flex min-h-[340px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-ui-border bg-surface-subtle p-6 text-center lg:min-h-[540px]">
            <Wrench size={36} className="text-content-muted" />
            <h2 className="text-base font-medium text-content">Controle dos serviços do imóvel</h2>
            <p className="max-w-sm text-sm text-content-muted">Selecione um reparo na lista para consultar os dados e as mídias do serviço.{can('repairs', 'create') && ' Para cadastrar um novo reparo ou reforma, clique em +.'}</p>
          </div>}
        </div>
      </div>
    </div>
  </Section>;
}
