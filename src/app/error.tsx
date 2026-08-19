'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[App Error Boundary]:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-surface text-content">
      <div className="w-full max-w-md bg-surface border border-ui-border-soft rounded-2xl shadow-xl p-6 text-center flex flex-col items-center gap-4">
        <div className="p-3 bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-full">
          <AlertTriangle size={32} />
        </div>
        <h2 className="text-lg font-bold">Ocorreu um erro no sistema</h2>
        <p className="text-sm text-content-secondary">
          Não foi possível carregar a página solicitada. Tente recarregar a tela ou entre em contato com o suporte se o problema persistir.
        </p>
        {error?.digest && (
          <span className="text-xs font-mono text-content-muted">Código: {error.digest}</span>
        )}
        <button
          onClick={() => reset()}
          className="mt-2 flex items-center gap-2 px-4 py-2 bg-brand text-content-inverse rounded-lg text-sm font-medium hover:bg-brand-hover transition-colors font-poppins"
        >
          <RefreshCw size={16} />
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
