'use client';

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { Download, Upload, Loader2, X } from 'lucide-react';
import { usePermissions } from '@/contexts/PermissionsContext';
import { useAuth } from '@/contexts/AuthContext';
import { useMessageContext } from '@/contexts/MessageContext';
import { usePopupContext } from '@/contexts/PopupContext';
import { exportTableDataAction, previewTableImportAction, importTableDataAction } from '@/server/actions/table-transfer';
import { TABLE_TRANSFER_MAX_BYTES, transferTablesForPath, type TableTransferImportMode, type TableTransferImportOutcome } from '@/shared/data/table-transfer';
import { describeActionError } from '@/shared/actions/action-result';

const buttonClass = 'inline-flex items-center gap-2 rounded-lg border border-ui-border bg-surface px-3 py-2 text-sm text-content-secondary hover:bg-surface-subtle disabled:opacity-50';
const iconClass = 'flex h-10 w-10 items-center justify-center rounded-lg text-content-muted hover:bg-surface-subtle disabled:opacity-50';
export default function TableTransferActions() {
  const pathname = usePathname();
  const tables = transferTablesForPath(pathname);
  const { can } = usePermissions();
  const { user } = useAuth();
  const { showMessage } = useMessageContext();
  const { showPopup } = usePopupContext();
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState<'export' | 'import' | null>(null);
  const [exportScope, setExportScope] = useState<'current' | 'all'>('current');
  const [importMode, setImportMode] = useState<TableTransferImportMode>('current');
  const [outcomes, setOutcomes] = useState<TableTransferImportOutcome[] | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const table = tables.find(t => t.key === key) ?? tables[0];
  if (!table || (table.global && user?.role !== 'SUPER_ADMIN') || (table.admin && !['ADMIN', 'SUPER_ADMIN'].includes(user?.role ?? ''))) return null;
  const allowAll = user?.role === 'SUPER_ADMIN' && !table.global;
  const selectedExportScope = allowAll ? exportScope : 'current';
  const selectedImportMode = allowAll ? importMode : 'current';
  const canExport = can(table.resource, 'export');
  const canImport = can(table.resource, 'create') && can(table.resource, 'edit');
  if (!canExport && !canImport) return null;
  const exportData = async () => {
    setBusy(true);
    try {
      const result = await exportTableDataAction(table.key, selectedExportScope);
      if (!result.ok) throw new Error(describeActionError(result));
      const url = URL.createObjectURL(new Blob([result.data], { type: 'application/json;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url; link.download = `nairim-${table.key}${selectedExportScope === 'all' ? '-todas-empresas' : ''}-${new Date().toISOString().slice(0, 10)}.json`;
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      showMessage(selectedExportScope === 'all' ? 'JSON exportado com os dados separados por empresa.' : 'JSON exportado com todos os registros do cadastro.', 'success');
    } catch (error) { showMessage(error instanceof Error ? error.message : 'Erro ao exportar dados.', 'error'); }
    finally { setBusy(false); }
  };
  const preview = async (file?: File) => {
    if (!file) return;
    if (file.size > TABLE_TRANSFER_MAX_BYTES) { showMessage('Selecione um JSON de até 40 MB.', 'error'); return; }
    setBusy(true);
    const selectedTable = table;
    const form = new FormData(); form.set('file', file); form.set('mode', selectedImportMode);
    try {
      const result = await previewTableImportAction(selectedTable.key, form);
      if (!result.ok) throw new Error(describeActionError(result));
      const all = 'companyCount' in result.data ? result.data : null;
      const targetMessage = all ? `${all.companyCount} empresa(s): ${all.companies.slice(0, 8).map(company => company.name + ' (' + company.slug + ')').join(', ') + (all.companyCount > 8 ? ` e mais ${all.companyCount - 8}` : '')}. ${selectedImportMode === 'copy-all' ? 'O mesmo cadastro será copiado para cada empresa.' : 'Cada empresa receberá somente os seus dados do arquivo, identificada pelo slug.'} Cada empresa terá sua própria transação; se uma falhar, as demais poderão concluir. O resultado será mostrado por empresa.` : 'Os registros serão adicionados ou atualizados na empresa atual.';
      const message = `${result.data.total} registro(s) de ${result.data.label}. ${targetMessage} Registros ausentes do arquivo serão preservados. Cadastros relacionados devem existir no destino; copie-os primeiro. Deseja importar?`;
      showPopup('Importar JSON', message, async () => {
        setBusy(true);
        try {
          const imported = await importTableDataAction(selectedTable.key, form);
          if (!imported.ok) throw new Error(describeActionError(imported));
          if (imported.data.results) {
            setOutcomes(imported.data.results);
            const failed = imported.data.results.filter(row => !row.ok).length;
            showMessage(`${imported.data.results.length - failed} empresa(s) concluída(s), ${failed} com falha. Veja o resultado por empresa.`, failed ? 'error' : 'success');
            return;
          }
          showMessage(`Importação concluída: ${imported.data.created} adicionado(s), ${imported.data.updated} atualizado(s).`, 'success');
          // All list pages have independent client caches; reload clears them consistently.
          setTimeout(() => window.location.reload(), 1500);
        } catch (error) { showMessage(error instanceof Error ? error.message : 'Erro ao importar dados.', 'error'); }
        finally { setBusy(false); }
      });
    } catch (error) { showMessage(error instanceof Error ? error.message : 'Erro ao ler o JSON.', 'error'); }
    finally { setBusy(false); }
  };
  return <div className="flex flex-wrap items-center gap-2" aria-label="Exportação e importação de dados">
    {tables.length > 1 && <select aria-label="Tabela para exportar ou importar" value={table.key} disabled={busy} onChange={event => setKey(event.target.value)} className="max-w-44 rounded-lg border border-ui-border bg-surface px-2 py-2 text-sm text-content-secondary">{tables.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}</select>}
    {canExport && <button type="button" disabled={busy} className={iconClass} aria-label="Exportar JSON" aria-expanded={allowAll ? menu === 'export' : undefined}
      onClick={() => allowAll ? setMenu(menu === 'export' ? null : 'export') : void exportData()} title={`Exportar ${table.label} em JSON`}>
      {busy ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
    </button>}
    {canImport && <button type="button" disabled={busy} className={iconClass} aria-label="Importar JSON" aria-expanded={allowAll ? menu === 'import' : undefined}
      onClick={() => allowAll ? setMenu(menu === 'import' ? null : 'import') : fileInput.current?.click()} title={`Importar ${table.label} de outro ambiente`}><Upload size={20} /></button>}
    {menu && allowAll && createPortal(<div role="dialog" aria-modal="true" aria-label={menu === 'export' ? 'Opções de exportação' : 'Opções de importação'} className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4" onKeyDown={event => {
        if (event.key === 'Escape') setMenu(null);
        if (event.key === 'Tab') {
          const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled)'));
          const first = controls[0], last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
      <div className="w-full max-w-sm rounded-xl border border-ui-border bg-surface p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold text-content">{menu === 'export' ? 'Exportar cadastro' : 'Importar cadastro'}</h2><button type="button" aria-label="Fechar opções de transferência" onClick={() => setMenu(null)} className={iconClass}><X size={18} /></button></div>
        {menu === 'export' ? <select aria-label="Empresas para exportar" value={selectedExportScope} disabled={busy} onChange={event => setExportScope(event.target.value as 'current' | 'all')} className="mb-4 w-full rounded-lg border border-ui-border bg-surface p-2 text-sm text-content"><option value="current">Empresa atual</option><option value="all">Todas as empresas</option></select>
          : <select aria-label="Destino da importação" value={selectedImportMode} disabled={busy} onChange={event => setImportMode(event.target.value as TableTransferImportMode)} className="mb-4 w-full rounded-lg border border-ui-border bg-surface p-2 text-sm text-content"><option value="current">Empresa atual</option><option value="copy-all">Copiar o cadastro para todas</option><option value="restore-all">Restaurar dados de cada empresa</option></select>}
        <button type="button" autoFocus disabled={busy} className={buttonClass} onClick={() => { setMenu(null); if (menu === 'export') void exportData(); else fileInput.current?.click(); }}>{menu === 'export' ? 'Baixar JSON' : 'Selecionar arquivo JSON'}</button>
      </div>
    </div>, document.body)}
    <input ref={fileInput} type="file" accept=".json,application/json" className="sr-only" aria-label={`Arquivo JSON de ${table.label}`} disabled={busy} onChange={event => { void preview(event.target.files?.[0]); event.target.value = ''; }} />
    {outcomes && createPortal(<div role="dialog" aria-modal="true" aria-labelledby="import-results-title" onKeyDown={event => { if (event.key === 'Escape') { setOutcomes(null); window.location.reload(); } if (event.key === 'Tab') { event.preventDefault(); event.currentTarget.querySelector('button')?.focus(); } }} className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl bg-surface p-5 shadow-xl">
        <h2 id="import-results-title" className="text-lg font-semibold text-content">Resultado da importação por empresa</h2>
        <div className="my-4 overflow-auto"><table className="w-full text-left text-sm text-content"><thead><tr><th className="p-2">Empresa</th><th className="p-2">Adicionados</th><th className="p-2">Atualizados</th><th className="p-2">Resultado</th></tr></thead><tbody>{outcomes.map(row => <tr key={row.slug} className="border-t border-ui-border"><td className="p-2">{row.company} ({row.slug})</td><td className="p-2">{row.created}</td><td className="p-2">{row.updated}</td><td className="p-2">{row.ok ? 'Concluído' : row.error}</td></tr>)}</tbody></table></div>
        <p className="mb-4 text-sm text-content-muted">Empresas com falha não receberam alterações desta importação. É possível corrigir a dependência e repetir o arquivo; os registros já importados serão atualizados.</p>
        <button type="button" autoFocus className={buttonClass} onClick={() => { setOutcomes(null); window.location.reload(); }}>Fechar e atualizar a página</button>
      </div>
    </div>, document.body)}
  </div>;
}
