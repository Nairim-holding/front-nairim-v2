'use client';

import { useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Download, Upload, Loader2 } from 'lucide-react';
import { usePermissions } from '@/contexts/PermissionsContext';
import { useAuth } from '@/contexts/AuthContext';
import { useMessageContext } from '@/contexts/MessageContext';
import { usePopupContext } from '@/contexts/PopupContext';
import { exportTableDataAction, previewTableImportAction, importTableDataAction } from '@/server/actions/table-transfer';
import { TABLE_TRANSFER_MAX_BYTES, transferTablesForPath } from '@/shared/data/table-transfer';
import { describeActionError } from '@/shared/actions/action-result';

const buttonClass = 'inline-flex items-center gap-2 rounded-lg border border-ui-border bg-surface px-3 py-2 text-sm text-content-secondary hover:bg-surface-subtle disabled:opacity-50';
export default function TableTransferActions() {
  const pathname = usePathname();
  const tables = transferTablesForPath(pathname);
  const { can } = usePermissions();
  const { user } = useAuth();
  const { showMessage } = useMessageContext();
  const { showPopup } = usePopupContext();
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const table = tables.find(t => t.key === key) ?? tables[0];
  if (!table || (table.global && user?.role !== 'SUPER_ADMIN') || (table.admin && !['ADMIN', 'SUPER_ADMIN'].includes(user?.role ?? ''))) return null;
  const canExport = can(table.resource, 'export');
  const canImport = can(table.resource, 'create') && can(table.resource, 'edit');
  if (!canExport && !canImport) return null;
  const exportData = async () => {
    setBusy(true);
    try {
      const result = await exportTableDataAction(table.key);
      if (!result.ok) throw new Error(describeActionError(result));
      const url = URL.createObjectURL(new Blob([result.data], { type: 'application/json;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url; link.download = `nairim-${table.key}-${new Date().toISOString().slice(0, 10)}.json`;
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      showMessage('JSON exportado com todos os registros do cadastro.', 'success');
    } catch (error) { showMessage(error instanceof Error ? error.message : 'Erro ao exportar dados.', 'error'); }
    finally { setBusy(false); }
  };
  const preview = async (file?: File) => {
    if (!file) return;
    if (file.size > TABLE_TRANSFER_MAX_BYTES) { showMessage('Selecione um JSON de até 40 MB.', 'error'); return; }
    setBusy(true);
    const selectedTable = table;
    const form = new FormData(); form.set('file', file);
    try {
      const result = await previewTableImportAction(selectedTable.key, form);
      if (!result.ok) throw new Error(describeActionError(result));
      const message = `${result.data.total} registro(s) no arquivo de ${result.data.label}. Os registros serão copiados para a empresa selecionada. Repetir o mesmo arquivo nessa empresa atualiza os registros já importados. Registros ausentes do arquivo serão preservados. Importe primeiro os cadastros relacionados. Deseja importar?`;
      showPopup('Importar JSON', message, async () => {
        setBusy(true);
        try {
          const imported = await importTableDataAction(selectedTable.key, form);
          if (!imported.ok) throw new Error(describeActionError(imported));
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
    {canExport && <button type="button" disabled={busy} className={buttonClass} onClick={() => void exportData()} title={`Exportar ${table.label} em JSON`}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}Exportar JSON</button>}
    {canImport && <button type="button" disabled={busy} className={buttonClass} onClick={() => fileInput.current?.click()} title={`Importar ${table.label} de outro ambiente`}><Upload size={16} />Importar JSON</button>}
    <input ref={fileInput} type="file" accept=".json,application/json" className="sr-only" aria-label={`Arquivo JSON de ${table.label}`} disabled={busy} onChange={event => { void preview(event.target.files?.[0]); event.target.value = ''; }} />
  </div>;
}
