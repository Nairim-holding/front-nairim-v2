'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Section from '@/components/layout/PageSection';
import { useMessageContext } from '@/contexts/MessageContext';
import { usePopupContext } from '@/contexts/PopupContext';
import MultiColumnManager from '@/components/form/MultiColumnManager';

// ─── Constantes ──────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_URL_API ?? '';

type TransactionType = 'EXPENSE' | 'INCOME';

// ─── Componente ──────────────────────────────────────────────────────────────

export default function CentrosPage() {
  const { showMessage } = useMessageContext();
  const { showPopup } = usePopupContext();

  const [isLoading, setIsLoading] = useState(true);
  const [centers, setCenters] = useState<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [transactionType, setTransactionType] = useState<TransactionType>('EXPENSE');

  // ─── Data fetching ──────────────────────────────────────────────────────────

  const fetchCenters = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/financial-center?limit=1000`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCenters(data?.data ?? data ?? []);
    } catch {
      showMessage('Erro ao carregar os dados.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showMessage]);

  useEffect(() => {
    fetchCenters();
  }, [fetchCenters]);

  // ─── Computed values ────────────────────────────────────────────────────────

  const filteredCenters = useMemo(
    () => centers.filter((c) => c.type === transactionType),
    [centers, transactionType],
  );

  // ─── Actions ────────────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSaveParent = useCallback(async (data: any, mode: 'CREATE' | 'EDIT') => {
    const url = mode === 'CREATE'
      ? `${API_URL}/financial-center`
      : `${API_URL}/financial-center/${data.id}`;
    const payload = mode === 'CREATE' ? { ...data, type: transactionType } : data;

    const res = await fetch(url, {
      method: mode === 'CREATE' ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const result = await res.json();
      throw new Error(result.message ?? 'Erro ao salvar Centro.');
    }

    showMessage('Centro salvo com sucesso!', 'success');
    const newRecord = await res.json();
    await fetchCenters();
    return newRecord;
  }, [transactionType, showMessage, fetchCenters]);

  const handleDeleteParent = useCallback(
    (id: string, name: string): Promise<void> =>
      new Promise((resolve, reject) => {
        showPopup(
          'Excluir Centro',
          `Tem certeza que deseja excluir "${name}"?`,
          async () => {
            try {
              const res = await fetch(`${API_URL}/financial-center/${id}`, { method: 'DELETE' });
              if (!res.ok) {
                const result = await res.json().catch(() => ({}));
                throw new Error(result.message ?? 'Erro ao excluir Centro.');
              }
              showMessage('Excluído com sucesso!', 'success');
              await fetchCenters();
              resolve();
            } catch (err) {
              showMessage(err instanceof Error ? err.message : 'Erro ao excluir.', 'error');
              reject(err);
            }
          },
          () => reject(new Error('Ação cancelada')),
        );
      }),
    [showPopup, showMessage, fetchCenters],
  );

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <Section title="Centros de Despesas e Receitas">
      {/* w-full sem max-w: padrão de largura das telas do financeiro (igual Instituições) */}
      <div className="bg-surface p-6 rounded-xl shadow-sm border border-ui-border w-full min-h-[92vh] h-full flex flex-col pb-[10px]">

        {/* Seletor Despesa / Receita */}
        <div className="flex mb-6 rounded-lg overflow-hidden w-fit border border-ui-border bg-surface-subtle">
          {(['EXPENSE', 'INCOME'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setTransactionType(type)}
              className={`px-8 py-2.5 text-sm font-bold transition-all ${
                transactionType === type
                  ? 'bg-[var(--color-brand-primary)] text-content-inverse shadow-md'
                  : 'text-content-secondary hover:text-content'
              }`}
            >
              {type === 'EXPENSE' ? 'Despesa' : 'Receita'}
            </button>
          ))}
        </div>

        <MultiColumnManager
          resetTrigger={transactionType}
          titleParent="Centro"
          titleChild=""
          parentData={filteredCenters}
          childData={[]}
          childRelationKey="center_id"
          isLoading={isLoading}
          hasChild={false}
          onSaveParent={handleSaveParent}
          onDeleteParent={handleDeleteParent}
          onSaveChild={async () => {}}
          onDeleteChild={async () => {}}
        />

      </div>
    </Section>
  );
}
