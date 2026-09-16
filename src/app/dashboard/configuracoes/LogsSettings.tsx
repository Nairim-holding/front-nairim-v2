'use client';

import { useEffect, useState } from 'react';
import { Activity, Database, Download, RefreshCw, Trash2 } from 'lucide-react';
import { DateRangeFilter } from '@/components/filters/DynamicFilterModal';
import { useMessageContext } from '@/contexts/MessageContext';
import { logStorageStatusAction, previewLogPurgeAction, purgeLogsAction } from '@/server/actions/log-management';
import { logSelectionSchema } from '@/shared/validators/log-management';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes.toLocaleString('pt-BR')} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} MB`;
  return `${(bytes / 1024 ** 3).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} GB`;
}

export default function LogsSettings() {
  const { showMessage } = useMessageContext();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ token: string; count: number } | null>(null);
  const [databaseSizeBytes, setDatabaseSizeBytes] = useState<number | null>(null);
  const [statusError, setStatusError] = useState(false);

  async function refreshStorageSize() {
    const result = await logStorageStatusAction();
    if (result.ok) {
      setDatabaseSizeBytes(result.data.databaseSizeBytes);
      setStatusError(false);
    } else {
      setStatusError(true);
    }
  }

  useEffect(() => {
    void refreshStorageSize();
  }, []);

  function selection() {
    return logSelectionSchema.parse({
      mode: 'range',
      from: from || undefined,
      to: to || undefined,
    });
  }

  async function execute(operation: 'export' | 'preview' | 'purge') {
    setBusy(true);
    try {
      if (operation === 'export') {
        const params = new URLSearchParams(
          Object.entries(selection())
            .filter(([, value]) => value !== undefined)
            .map(([key, value]) => [key, String(value)]),
        );
        const response = await fetch(`/api/logs/export?${params}`);
        if (!response.ok) throw new Error((await response.json()).error);

        const url = URL.createObjectURL(await response.blob());
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `logs-${from}-a-${to}.json`;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        showMessage('Logs exportados.', 'success');
        return;
      }

      if (operation === 'preview') {
        const result = await previewLogPurgeAction(selection());
        if (!result.ok) throw new Error(result.error);
        setPreview(result.data);
        return;
      }

      if (preview) {
        const result = await purgeLogsAction({ token: preview.token, confirmation: 'EXCLUIR LOGS' });
        if (!result.ok) throw new Error(result.error);
        showMessage(`${result.data.deleted} logs excluídos.`, 'success');
        setPreview(null);
        await refreshStorageSize();
      }
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Não foi possível concluir a operação.', 'error');
    } finally {
      setBusy(false);
    }
  }

  const periodValid = Boolean(from && to && from <= to);
  const button = 'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <>
      <section className="w-full min-w-0 overflow-hidden rounded-2xl border border-ui-border bg-surface shadow-sm">
      <div className="flex items-start gap-3 border-b border-ui-border-soft p-5 sm:p-6">
        <div className="rounded-xl bg-brand/10 p-3 text-brand"><Activity size={22} /></div>
        <div>
          <h2 className="text-lg font-semibold text-content">Logs de auditoria</h2>
          <p className="mt-1 text-sm text-content-secondary">Exporte ou expurgue os logs de um período específico.</p>
        </div>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-ui-border-soft bg-surface-subtle p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-surface p-2 text-brand"><Database size={20} /></div>
            <div>
              <p className="text-sm text-content-secondary">Tamanho do banco de dados de Logs</p>
              <div aria-live="polite" className="mt-0.5">
                {statusError ? (
                  <p className="text-sm text-red-600">Não foi possível consultar o tamanho.</p>
                ) : databaseSizeBytes === null ? (
                  <p className="text-sm text-content-muted">Consultando…</p>
                ) : (
                  <p className="text-2xl font-semibold tracking-tight text-content">{formatBytes(databaseSizeBytes)}</p>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            aria-label="Atualizar tamanho do banco de logs"
            title="Atualizar tamanho"
            disabled={busy}
            onClick={() => void refreshStorageSize()}
            className="rounded-lg p-2 text-content-muted transition-colors hover:bg-surface disabled:opacity-50"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        <fieldset disabled={busy} className="max-w-md min-w-0">
          <p className="mb-2 text-sm font-medium text-content-secondary">Data de início e Data de fim</p>
          <DateRangeFilter
            filter={{
              field: 'created_at',
              type: 'date',
              label: 'Período dos Logs',
              description: 'Data de início e Data de fim',
              dateRange: true,
            }}
            filterValue={{ value: from, value2: to }}
            onChange={(start, end) => {
              if (busy) return;
              setFrom(start);
              setTo(end);
              setPreview(null);
            }}
            onClear={() => {
              if (busy) return;
              setFrom('');
              setTo('');
              setPreview(null);
            }}
          />
        </fieldset>

        <p className="text-xs leading-relaxed text-content-muted">
          O período informado será usado para exportar ou expurgar os logs. As duas datas são obrigatórias.
        </p>

        <div className="flex flex-wrap gap-3 border-t border-ui-border-soft pt-5">
          <button
            type="button"
            disabled={busy || !periodValid}
            className={`${button} bg-brand text-white hover:bg-brand-hover`}
            onClick={() => void execute('export')}
          >
            <Download size={16} /> Exportar Logs
          </button>
          <button
            type="button"
            disabled={busy || !periodValid}
            className={`${button} border border-ui-border text-content-secondary hover:bg-surface-subtle`}
            onClick={() => void execute('preview')}
          >
            <Trash2 size={16} /> Conferir Expurgo
          </button>
          {busy && <span role="status" className="self-center text-sm text-content-muted">Processando…</span>}
        </div>
      </div>
      </section>

      {preview && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
          onClick={() => {
            if (!busy) setPreview(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="log-purge-title"
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-ui-border bg-surface shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-ui-border-soft px-5 py-4 sm:px-6">
              <div className="rounded-lg bg-red-50 p-2 text-red-600 dark:bg-red-950/30"><Trash2 size={20} /></div>
              <h3 id="log-purge-title" className="text-lg font-semibold text-content">Conferência do expurgo</h3>
            </div>
            <div className="space-y-4 px-5 py-5 sm:px-6">
              <p className="text-sm leading-relaxed text-content-secondary">
                <strong className="text-content">{preview.count.toLocaleString('pt-BR')} logs</strong> serão excluídos permanentemente. Exporte antes se precisar guardar uma cópia. A confirmação expira em 10 minutos.
              </p>
            </div>
            <div className="flex flex-col-reverse gap-3 border-t border-ui-border-soft bg-surface-subtle px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <button
                type="button"
                className={`${button} bg-red-600 text-white hover:bg-red-700`}
                disabled={busy}
                onClick={() => setPreview(null)}
              >
                Cancelar
              </button>
              {preview.count > 0 && (
                <button
                  type="button"
                  disabled={busy}
                  className={`${button} border border-ui-border bg-surface text-content-secondary hover:bg-surface-subtle`}
                  onClick={() => void execute('purge')}
                >
                  Excluir {preview.count.toLocaleString('pt-BR')} logs
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
