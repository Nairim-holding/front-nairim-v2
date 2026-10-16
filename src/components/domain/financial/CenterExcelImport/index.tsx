'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Upload, X } from 'lucide-react';
import { usePermissions } from '@/contexts/PermissionsContext';
import { useMessageContext } from '@/contexts/MessageContext';
import { previewFinancialCentersImportAction, importFinancialCentersAction } from '@/server/actions/financial-center-import';
import { CENTER_IMPORT_MAX_BYTES, type CenterImportMode, type CenterImportPreview } from '@/shared/data/financial-center-import';
import { describeActionError } from '@/shared/actions/action-result';

const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-lg border border-ui-border bg-surface px-4 py-2 text-sm font-medium text-content hover:bg-surface-subtle disabled:opacity-50';
const inputClass = 'w-full min-w-0 rounded-lg border border-ui-border bg-surface p-2 text-sm text-content disabled:opacity-50';
const statusLabels = { new: 'Adicionar', existing: 'Já cadastrado', duplicate: 'Repetido no arquivo' };

export default function CenterExcelImport({ onImported }: { onImported: () => Promise<void> }) {
  const { can } = usePermissions();
  const { showMessage } = useMessageContext();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<CenterImportMode>('BOTH');
  const [sheets, setSheets] = useState<string[]>([]);
  const [selectedSheets, setSelectedSheets] = useState<string[]>([]);
  const [preview, setPreview] = useState<CenterImportPreview | null>(null);
  const [error, setError] = useState('');
  const reviewedForm = useRef<FormData | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const returnFocus = trigger.current;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    return () => { document.body.style.overflow = previousOverflow; returnFocus?.focus(); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        setOpen(false); setFile(null); setSheets([]); setSelectedSheets([]); setPreview(null); setError(''); reviewedForm.current = null;
      }
      if (event.key === 'Tab' && dialog.current) {
        const controls = Array.from(dialog.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]'));
        const first = controls[0], last = controls.at(-1);
        if (!dialog.current.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first)?.focus(); }
        else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, busy]);

  if (!can('financial-centers', 'create')) return null;
  const invalidate = () => { setPreview(null); reviewedForm.current = null; setError(''); };
  const close = () => {
    if (busy) return;
    setOpen(false); setFile(null); setSheets([]); setSelectedSheets([]); invalidate();
  };

  const generatePreview = async () => {
    if (!file) { setError('Selecione uma planilha Excel.'); return; }
    if (sheets.length && !selectedSheets.length) { setError('Selecione pelo menos uma aba.'); return; }
    const form = new FormData();
    form.set('file', file); form.set('mode', mode);
    if (sheets.length) form.set('sheets', JSON.stringify(selectedSheets));
    setBusy(true); invalidate();
    try {
      const result = await previewFinancialCentersImportAction(form);
      if (!result.ok) throw new Error(describeActionError(result));
      setSheets(result.data.sheets); setSelectedSheets(result.data.selectedSheets);
      setPreview(result.data); reviewedForm.current = form;
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível ler a planilha.'); }
    finally { setBusy(false); }
  };

  const importCenters = async () => {
    if (!preview || !reviewedForm.current || preview.issues.length || !preview.newCount) return;
    const form = reviewedForm.current;
    form.set('companyId', preview.companyId); form.set('fingerprint', preview.fingerprint);
    setBusy(true); setError('');
    try {
      const result = await importFinancialCentersAction(form);
      if (!result.ok) throw new Error(describeActionError(result));
      showMessage(`Importação concluída: ${result.data.created} centro(s) adicionado(s), ${result.data.ignored} já cadastrado(s) ou repetido(s) ignorado(s).`, 'success');
      setOpen(false); setPreview(null); reviewedForm.current = null; setFile(null); setSheets([]); setSelectedSheets([]);
      await onImported();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível importar os centros.'); }
    finally { setBusy(false); }
  };

  return <>
    <button ref={trigger} type="button" className={buttonClass} onClick={() => setOpen(true)}><Upload size={17} />Importar Excel</button>
    {open && createPortal(<div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="center-import-title" className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-3 sm:p-6">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl border border-ui-border bg-surface p-4 shadow-xl sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="center-import-title" className="text-lg font-semibold text-content">Importar centros por Excel</h2>
          <button ref={closeButton} type="button" disabled={busy} onClick={close} aria-label="Fechar importação de centros" className="rounded-lg p-2 text-content-muted hover:bg-surface-subtle disabled:opacity-50"><X size={20} /></button>
        </div>
        <div className="min-h-0 overflow-y-auto">
          <p className="mb-4 text-sm text-content-secondary">Use uma coluna <strong>Nome</strong> ou <strong>Endereço</strong>. São aceitas várias abas e a coluna Tipo é opcional (Receita/CR ou Despesa/DB). Os nomes recebem (CR) para receita e (DB) para despesa.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm text-content">Planilha Excel (até 2 MB)
              <input type="file" accept=".xlsx,.xls" disabled={busy} className={`${inputClass} mt-1`} onChange={event => {
                const nextFile = event.target.files?.[0] ?? null;
                invalidate(); setSheets([]); setSelectedSheets([]);
                if (nextFile && (nextFile.size > CENTER_IMPORT_MAX_BYTES || !/\.(xlsx|xls)$/i.test(nextFile.name))) { setFile(null); setError('Selecione um Excel (.xlsx ou .xls) de até 2 MB.'); return; }
                setFile(nextFile);
              }} />
            </label>
            <label className="block text-sm text-content">Quando a coluna Tipo não estiver preenchida
              <select value={mode} disabled={busy} className={`${inputClass} mt-1`} onChange={event => { setMode(event.target.value as CenterImportMode); invalidate(); }}>
                <option value="BOTH">Criar Receita (CR) e Despesa (DB)</option>
                <option value="INCOME">Criar somente Receita (CR)</option>
                <option value="EXPENSE">Criar somente Despesa (DB)</option>
              </select>
            </label>
          </div>
          {!!sheets.length && <fieldset className="mt-4 rounded-lg border border-ui-border p-3">
            <legend className="px-1 text-sm font-medium text-content">Abas para importar</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2">{sheets.map(sheet => <label key={sheet} className="flex items-center gap-2 text-sm text-content"><input type="checkbox" disabled={busy} checked={selectedSheets.includes(sheet)} onChange={event => { setSelectedSheets(current => event.target.checked ? [...current, sheet] : current.filter(name => name !== sheet)); invalidate(); }} />{sheet}</label>)}</div>
            <p className="mt-2 text-xs text-content-muted">Selecione as abas pertencentes à empresa atual. O nome de uma aba serve apenas para identificar a origem.</p>
          </fieldset>}
          <div className="my-4"><button type="button" disabled={busy || !file || (!!sheets.length && !selectedSheets.length)} className={buttonClass} onClick={() => void generatePreview()}>{busy && <Loader2 size={16} className="animate-spin" />}Gerar prévia</button></div>
          {error && <p role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          {preview && <div aria-live="polite">
            <p className="mb-2 text-sm font-medium text-content">Destino: {preview.companyName}. Todos os centros selecionados serão inseridos nesta empresa.</p>
            <p className="mb-3 text-sm text-content-secondary">{preview.sourceRows} linha(s) · {preview.newCount} centro(s) para adicionar · {preview.existingCount} já cadastrado(s) · {preview.duplicateCount} repetido(s) no arquivo.</p>
            {!!preview.issues.length && <div role="alert" className="mb-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
              <p className="font-semibold">Corrija {preview.issues.length} erro(s) antes de importar.</p>
              <ul className="mt-1 list-disc pl-5">{preview.issues.slice(0, 20).map((issue, index) => <li key={index}>{issue.sheet}, linha {issue.line}: {issue.message}</li>)}</ul>
              {preview.issues.length > 20 && <p className="mt-1">Exibindo os primeiros 20 erros.</p>}
            </div>}
            <div tabIndex={0} role="region" aria-label="Prévia dos centros" className="max-h-72 overflow-auto rounded-lg border border-ui-border">
              <table className="w-full text-left text-sm text-content"><thead className="sticky top-0 bg-surface-subtle"><tr><th className="p-2">Origem</th><th className="p-2">Centro</th><th className="p-2">Tipo</th><th className="p-2">Ação</th></tr></thead>
                <tbody>{preview.rows.slice(0, 200).map((row, index) => <tr key={index} className="border-t border-ui-border"><td className="p-2">{row.sheet} · {row.line}</td><td className="p-2">{row.name}</td><td className="p-2">{row.type === 'INCOME' ? 'Receita' : 'Despesa'}</td><td className="p-2">{statusLabels[row.status]}</td></tr>)}</tbody>
              </table>
            </div>
            {preview.rows.length > 200 && <p className="mt-1 text-xs text-content-muted">Exibindo os primeiros 200 centros de {preview.rows.length}. Os totais abrangem todas as linhas selecionadas.</p>}
            <p className="mt-3 text-xs text-content-muted">Centros existentes e repetições serão ignorados. Cadastros existentes serão preservados. Limite de 5.000 linhas por arquivo.</p>
          </div>}
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-ui-border pt-4">
          <button type="button" disabled={busy} className={buttonClass} onClick={close}>Cancelar</button>
          <button type="button" disabled={busy || !preview || !!preview.issues.length || !preview.newCount} onClick={() => void importCenters()} className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-brand-primary)] px-4 py-2 text-sm font-semibold text-content-inverse disabled:opacity-50">{busy && <Loader2 size={16} className="animate-spin" />}Importar {preview?.newCount ?? 0} centro(s)</button>
        </div>
      </div>
    </div>, document.body)}
  </>;
}
