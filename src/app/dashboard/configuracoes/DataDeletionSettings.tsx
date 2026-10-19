'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/PermissionsContext';
import { useMessageContext } from '@/contexts/MessageContext';
import { DELETION_GROUPS, type CompanyDeletionPreview, type DeletionGroupKey } from '@/shared/data/company-data-deletion';
import { previewCompanyDataDeletionAction, deleteCompanyDataAction } from '@/server/actions/company-data-deletion';
import { describeActionError } from '@/shared/actions/action-result';

const button = 'rounded-lg border border-ui-border px-4 py-2 text-sm font-medium disabled:opacity-50';
export default function DataDeletionSettings() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const { showMessage } = useMessageContext();
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<DeletionGroupKey[]>([]);
  const [preview, setPreview] = useState<CompanyDeletionPreview | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState<number | null>(null);
  const modal = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const admin = ['ADMIN', 'SUPER_ADMIN', 'administrador'].includes(user?.role ?? '');
  const available = DELETION_GROUPS.filter(group => can(group.resource, 'delete'));
  const allowed = admin && can('settings', 'delete');
  const close = () => { if (!busy) { setOpen(false); trigger.current?.focus(); } };
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    modal.current?.focus();
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  // A company switch must discard the review and the typed confirmation.
  useEffect(() => {
    setOpen(false); setPreview(null); setConfirmation(''); setGroups([]);
  }, [user?.company_id]);
  if (!allowed) return null;
  const change = (next: DeletionGroupKey[]) => { setGroups(next); setPreview(null); setConfirmation(''); setCompleted(null); };
  const review = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const result = await previewCompanyDataDeletionAction({ companyId: user.company_id, groups });
      if (!result.ok) throw new Error(describeActionError(result));
      setPreview(result.data); setConfirmation('');
    } catch (error) { showMessage(error instanceof Error ? error.message : 'Não foi possível revisar a exclusão.', 'error'); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!preview || confirmation !== 'CONFIRMAR') return;
    setBusy(true);
    try {
      const result = await deleteCompanyDataAction({ companyId: preview.company.id, groups, confirmation });
      if (!result.ok) throw new Error(describeActionError(result));
      setCompleted(result.data.total); setPreview(null); setGroups([]); setConfirmation('');
      showMessage('Exclusão de dados concluída na empresa selecionada.', 'success');
    } catch (error) { setPreview(null); setConfirmation(''); showMessage(error instanceof Error ? error.message : 'Não foi possível excluir os dados.', 'error'); }
    finally { setBusy(false); }
  };
  return <section className="rounded-2xl border border-red-200 bg-surface p-6 dark:border-red-900">
    <h2 className="flex items-center gap-2 text-lg font-semibold text-red-700 dark:text-red-300"><Trash2 size={22} />Exclusão de dados</h2>
    <p className="mt-2 text-sm text-content-secondary">Exclua todos os dados operacionais ou selecione os cadastros da empresa atual. Faça um backup antes de continuar.</p>
    <button ref={trigger} type="button" onClick={() => { change([]); setOpen(true); }} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"><Trash2 size={16} />Abrir exclusão de dados</button>
    {open && createPortal(<div className="fixed inset-0 z-[10060] flex items-center justify-center bg-black/60 p-3 sm:p-6">
      <div ref={modal} role="dialog" aria-modal="true" aria-labelledby="delete-data-title" tabIndex={-1} onKeyDown={event => {
        if (event.key === 'Escape') close();
        if (event.key === 'Tab') {
          const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)'));
          const first = items[0], last = items.at(-1);
          if (event.shiftKey && (document.activeElement === first || document.activeElement === modal.current)) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }} className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-surface text-content shadow-xl">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-ui-border p-4 sm:p-6">
          <div><h2 id="delete-data-title" className="flex items-center gap-2 text-lg font-semibold"><AlertTriangle className="text-red-600" size={22} />Confirmar exclusão de dados</h2><p className="mt-1 text-sm text-content-secondary">Empresa: <strong>{preview?.company.name ?? user?.company_slug ?? 'Atual'}</strong></p></div>
          <button type="button" disabled={busy} onClick={close} aria-label="Fechar exclusão de dados" className="rounded-lg p-1 hover:bg-surface-subtle disabled:opacity-50"><X size={20} /></button>
        </header>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          <p className="text-sm text-content-secondary">A exclusão é permanente e inclui os detalhes e documentos associados aos itens escolhidos, inclusive registros já inativos. Empresa, usuários, permissões, personalização e auditoria são preservados. Os arquivos armazenados dos anexos permanecem.</p>
          {completed !== null ? <p role="status" className="rounded-lg bg-emerald-50 p-4 text-emerald-800">Exclusão concluída: {completed.toLocaleString('pt-BR')} registros removidos.</p> : <>
            <label className="flex items-center gap-2 rounded-lg border border-ui-border bg-surface-subtle p-3 font-semibold"><input type="checkbox" disabled={busy} checked={available.length > 0 && groups.length === available.length} onChange={event => change(event.target.checked ? available.map(group => group.key) : [])} />Selecionar todos os dados operacionais permitidos</label>
            <fieldset disabled={busy} className="grid gap-2 sm:grid-cols-2"><legend className="mb-2 text-sm font-medium">O que deseja excluir?</legend>{available.map(group => <label key={group.key} className="flex items-start gap-2 rounded-lg border border-ui-border-soft p-3 text-sm"><input type="checkbox" className="mt-0.5" checked={groups.includes(group.key)} onChange={event => change(event.target.checked ? [...groups, group.key] : groups.filter(key => key !== group.key))} />{group.label}</label>)}</fieldset>
            {preview && <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
              <p className="font-semibold">{preview.total.toLocaleString('pt-BR')} registros serão excluídos de {preview.company.name} ({preview.company.slug}).</p>
              <p className="text-sm">Grupos: {DELETION_GROUPS.filter(group => groups.includes(group.key)).map(group => group.label).join('; ')}.</p>
              {preview.blockers.map(message => <p role="alert" key={message} className="text-sm">{message}</p>)}
            </div>}
            {preview && preview.blockers.length === 0 && preview.total > 0 && <label className="block text-sm font-semibold">Digite CONFIRMAR para liberar a exclusão<input aria-label="Confirmação da exclusão" autoComplete="off" spellCheck={false} value={confirmation} disabled={busy} onChange={event => setConfirmation(event.target.value)} placeholder="CONFIRMAR" className="mt-2 w-full rounded-lg border border-ui-border bg-surface px-3 py-2 text-content" /></label>}
          </>}
        </div>
        <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-ui-border p-4">
          <button type="button" onClick={close} disabled={busy} className={button}>{completed !== null ? 'Concluir' : 'Cancelar'}</button>
          {completed === null && (!preview ? <button type="button" onClick={() => void review()} disabled={busy || groups.length === 0} className={button + ' bg-brand text-white'}>{busy ? 'Revisando...' : 'Revisar exclusão'}</button> : <button type="button" onClick={() => void remove()} disabled={busy || confirmation !== 'CONFIRMAR' || preview.total === 0 || preview.blockers.length > 0} className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}{busy ? 'Excluindo...' : 'Excluir permanentemente'}</button>)}
        </footer>
      </div>
    </div>, document.body)}
  </section>;
}
