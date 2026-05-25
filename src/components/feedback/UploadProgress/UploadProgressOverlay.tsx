'use client';

import type { UploadState } from '@/hooks/useUploadSSE';

interface Props {
  state: UploadState;
  /** Texto exibido durante upload (ex: "Enviando imóvel..."). */
  label?: string;
}

/**
 * Overlay de tela cheia que mostra o progresso de upload.
 * Bloqueia interação enquanto o upload/processamento ocorre.
 *
 * Uso:
 *   const { state, uploadAndTrack } = useUploadSSE();
 *   <UploadProgressOverlay state={state} label="Salvando imóvel..." />
 */
export default function UploadProgressOverlay({ state, label = 'Enviando arquivos...' }: Props) {
  if (state.status === 'idle' || state.status === 'completed') return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
        <div className="mb-4 flex items-center gap-3">
          {state.status !== 'error' && (
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
          )}
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {state.status === 'error' ? 'Erro no envio' : label}
          </h2>
        </div>

        <Body state={state} />
      </div>
    </div>
  );
}

function Body({ state }: { state: UploadState }) {
  if (state.status === 'uploading') {
    const pct = state.totalBytes && state.bytesSent
      ? Math.min(100, Math.round((state.bytesSent / state.totalBytes) * 100))
      : null;
    return (
      <div>
        <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
          Enviando arquivos para o servidor{pct !== null ? ` — ${pct}%` : '...'}
        </p>
        <ProgressBar value={pct ?? undefined} indeterminate={pct === null} />
        {state.totalBytes && state.bytesSent ? (
          <p className="mt-2 text-xs text-gray-500">
            {formatBytes(state.bytesSent)} de {formatBytes(state.totalBytes)}
          </p>
        ) : null}
      </div>
    );
  }

  if (state.status === 'processing') {
    const pct = state.total > 0 ? Math.round((state.done / state.total) * 100) : null;
    return (
      <div>
        <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
          Processando arquivos no servidor{pct !== null ? ` — ${state.done}/${state.total}` : '...'}
        </p>
        <ProgressBar value={pct ?? undefined} indeterminate={pct === null} />
        {state.filename ? (
          <p className="mt-2 truncate text-xs text-gray-500" title={state.filename}>
            {state.filename}
          </p>
        ) : null}
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        {state.reason}
      </p>
    );
  }

  return null;
}

function ProgressBar({ value, indeterminate }: { value?: number; indeterminate?: boolean }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
      <div
        className={
          indeterminate
            ? 'h-full w-full animate-pulse rounded-full bg-blue-600'
            : 'h-full rounded-full bg-blue-600 transition-all duration-300'
        }
        style={!indeterminate && value !== undefined ? { width: `${value}%` } : undefined}
      />
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
