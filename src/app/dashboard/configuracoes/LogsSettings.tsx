'use client';

import { useEffect, useState } from 'react';
import { logStorageStatusAction, previewLogPurgeAction, purgeLogsAction } from '@/server/actions/log-management';
import { logSelectionSchema } from '@/shared/validators/log-management';
import { useMessageContext } from '@/contexts/MessageContext';
import Select from '@/components/ui/Select';
import Input from '@/components/ui/Input';
import { DateRangeFilter } from '@/components/filters/DynamicFilterModal';
import { Activity, Database, Download, RefreshCw, ShieldCheck, SlidersHorizontal, Trash2 } from 'lucide-react';
import { MODEL_LABELS } from '@/shared/utils/audit-models';

export default function LogsSettings() {
  const { showMessage } = useMessageContext();
  const [mode, setMode] = useState('older');
  const [days, setDays] = useState('90');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [action, setAction] = useState('');
  const [email, setEmail] = useState('');
  const [table, setTable] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ token: string; count: number } | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [status, setStatus] = useState<{ stored: number; pending: number } | null>(null);
  const [statusError, setStatusError] = useState(false);
  async function refresh() {
    const result = await logStorageStatusAction();
    if (result.ok) { setStatus(result.data); setStatusError(false); }
    else setStatusError(true);
  }
  useEffect(() => { void refresh(); }, []);
  function selection() {
    return logSelectionSchema.parse({ mode, days, from: from || undefined, to: to || undefined,
      action: action || undefined, user_email: email || undefined, table_name: table || undefined });
  }
  async function execute(operation: 'export' | 'preview' | 'purge') {
    setBusy(true);
    try {
      if (operation === 'export') {
        const params = new URLSearchParams(Object.entries(selection()).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]));
        const response = await fetch('/api/logs/export?' + params);
        if (!response.ok) throw new Error((await response.json()).error);
        const url = URL.createObjectURL(await response.blob());
        const a = document.createElement('a');
        a.href = url; a.download = `logs-${new Date().toISOString().slice(0, 10)}.json`;
        a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
        showMessage('Logs exportados.', 'success');
      } else if (operation === 'preview') {
        const result = await previewLogPurgeAction(selection());
        if (!result.ok) throw new Error(result.error);
        setPreview(result.data); setConfirmation('');
      } else if (preview) {
        const result = await purgeLogsAction({ token: preview.token, confirmation });
        if (!result.ok) throw new Error(result.error);
        showMessage(`${result.data.deleted} logs excluídos.`, 'success');
        setPreview(null); setConfirmation(''); await refresh();
      }
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Não foi possível concluir a operação.', 'error');
    } finally { setBusy(false); }
  }

  function change(setter: (value: string) => void, value: string | number) {
    if (busy) return;
    setter(String(value)); setPreview(null); setConfirmation('');
  }
  const button = 'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50';
  return <section className="w-full min-w-0 overflow-hidden rounded-2xl border border-ui-border bg-surface shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ui-border-soft p-5 sm:p-6">
      <div className="flex items-start gap-3"><div className="rounded-xl bg-brand/10 p-3 text-brand"><Activity size={22} /></div>
        <div><h2 className="text-lg font-semibold text-content">Logs de auditoria</h2><p className="mt-1 text-sm text-content-secondary">Consulte o armazenamento, exporte o histórico e gerencie a retenção.</p></div>
      </div>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-xs font-medium text-brand"><ShieldCheck size={14} /> Armazenamento separado</span>
    </div>
    <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-5 p-5 sm:p-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-content"><SlidersHorizontal size={16} className="text-brand" /> Selecione os logs</div>
        <fieldset disabled={busy} className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Select full id="log-selection" label="Selecionar histórico" value={mode} disabled={busy} onChange={v => change(setMode, v)} options={[
            {value:'older',label:'Por tempo de retenção'}, {value:'range',label:'Período específico'}, {value:'all',label:'Todo o histórico'},
          ]} />
          {mode === 'older' && <Input full id="log-days" label="Preservar os últimos (dias)" type="number" min={1} max={36500} value={days} disabled={busy} onChange={e => change(setDays, e.target.value)} />}
          {mode === 'range' && <div className="min-w-0"><p className="mb-2 pl-2 text-sm text-content-secondary">Período dos registros</p>
            <DateRangeFilter filter={{field:'created_at',type:'date',label:'Período',description:'Data dos registros',dateRange:true}} filterValue={{value:from,value2:to}}
              onChange={(start,end) => { if (!busy) { change(setFrom,start); setTo(end); } }} onClear={() => { if (!busy) { change(setFrom,''); setTo(''); } }} />
          </div>}
          <Select full id="log-action" label="Tipo de ação" placeholder="Todas as ações" value={action} disabled={busy} onChange={v => change(setAction,v)} options={[
            {value:'',label:'Todas as ações'}, {value:'LOGIN',label:'Login'}, {value:'LOGIN_FAILED',label:'Login falho'}, {value:'CREATE',label:'Inclusão'}, {value:'UPDATE',label:'Alteração'}, {value:'DELETE',label:'Exclusão'},
          ]} />
          <Input full id="log-author" label="E-mail do autor" type="email" value={email} disabled={busy} onChange={e => change(setEmail,e.target.value)} placeholder="Todos os autores" />
          <Select full id="log-resource" label="Recurso" placeholder="Todos os recursos" value={table} disabled={busy} searchable onChange={v => change(setTable,v)} options={[
            {value:'',label:'Todos os recursos'}, ...Object.entries(MODEL_LABELS).sort((a,b) => a[1].localeCompare(b[1],'pt-BR')).map(([value,label]) => ({value,label})),
          ]} />
        </fieldset>
        <p className="text-xs leading-relaxed text-content-muted">Os filtros são combinados e afetam apenas os logs da sua empresa. Datas no horário de Brasília.</p>
        <div className="flex flex-wrap gap-3 border-t border-ui-border-soft pt-5">
          <button disabled={busy} className={button + ' bg-brand text-white hover:bg-brand-hover'} onClick={() => void execute('export')}><Download size={16} /> Exportar logs selecionados (JSON)</button>
          <button disabled={busy} className={button + ' border border-ui-border text-content-secondary hover:bg-surface-subtle'} onClick={() => void execute('preview')}><Trash2 size={16} /> Conferir expurgo</button>
          {busy && <span role="status" className="self-center text-sm text-content-muted">Processando…</span>}
        </div>
      </div>
      <aside className="space-y-5 border-t border-ui-border-soft bg-surface-subtle p-5 sm:p-6 xl:border-l xl:border-t-0" aria-label="Armazenamento de logs">
        <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-sm font-medium text-content"><Database size={16} /> Armazenamento</span><button aria-label="Atualizar armazenamento" title="Atualizar armazenamento" onClick={() => void refresh()} className="rounded-lg p-2 text-content-muted hover:bg-surface"><RefreshCw size={15} /></button></div>
        <div aria-live="polite">{statusError ? <p className="text-sm text-red-600">Não foi possível consultar o armazenamento. Verifique sua conexão e permissões.</p> : status ? <>
          <p className="text-3xl font-semibold tracking-tight text-content">{status.stored.toLocaleString('pt-BR')}</p><p className="mt-1 text-sm text-content-secondary">logs armazenados</p>
          <p className="mt-4 flex items-center gap-2 text-xs text-content-secondary"><span className={'h-2 w-2 rounded-full ' + (status.pending ? 'bg-amber-500' : 'bg-emerald-500')} />{status.pending ? status.pending.toLocaleString('pt-BR') + ' aguardando transferência' : 'Todos os logs sincronizados'}</p>
        </> : <p className="text-sm text-content-muted">Consultando armazenamento…</p>}</div>
        <p className="border-t border-ui-border-soft pt-4 text-xs leading-relaxed text-content-muted">A exportação dos logs é independente do backup principal. Logs excluídos não são recuperados ao restaurar esse backup.</p>
      </aside>
    </div>
    {preview && <div className="m-5 mt-0 space-y-4 rounded-xl border border-red-200 bg-red-50/40 p-5 sm:m-6 sm:mt-0" aria-live="polite">
      <div className="flex items-center gap-2 font-medium text-red-600"><Trash2 size={18} /> Conferência do expurgo</div>
      <p className="text-sm text-content"><strong>{preview.count.toLocaleString('pt-BR')} logs</strong> serão excluídos permanentemente. Exporte antes se precisar guardar uma cópia. A confirmação expira em 10 minutos.</p>
      {preview.count > 0 && <div className="max-w-lg"><Input full id="log-confirmation" label="Digite EXCLUIR LOGS para confirmar" value={confirmation} onChange={e => setConfirmation(e.target.value)} disabled={busy} /></div>}
      <div className="flex flex-wrap gap-3">{preview.count > 0 && <button disabled={busy || confirmation !== 'EXCLUIR LOGS'} className={button + ' bg-red-600 text-white hover:bg-red-700'} onClick={() => void execute('purge')}>Excluir {preview.count.toLocaleString('pt-BR')} logs</button>}
        <button className={button + ' border border-ui-border text-content-secondary'} disabled={busy} onClick={() => setPreview(null)}>Cancelar</button></div>
    </div>}
  </section>;
}
