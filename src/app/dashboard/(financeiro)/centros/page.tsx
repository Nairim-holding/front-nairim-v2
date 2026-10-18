'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Section from '@/components/layout/PageSection';
import { useMessageContext } from '@/contexts/MessageContext';
import { usePopupContext } from '@/contexts/PopupContext';
import MultiColumnManager, { type ManagerColumn } from '@/components/form/MultiColumnManager';
import CenterExcelImport from '@/components/domain/financial/CenterExcelImport';
import {
  listCentersAction,
  createFinancialCenterAction,
  updateFinancialCenterAction,
  deleteFinancialCenterAction,
} from '@/server/actions/financial-center';
import type { Center } from '@/core/entities/financial-center';

// ─── Constantes ──────────────────────────────────────────────────────────────

type TransactionType = 'EXPENSE' | 'INCOME';

// ─── Componente ──────────────────────────────────────────────────────────────

export default function CentrosPage() {
  const { showMessage } = useMessageContext();
  const { showPopup } = usePopupContext();

  const [isLoading, setIsLoading] = useState(true);
  const [centers, setCenters] = useState<Center[]>([]);
  const [transactionType, setTransactionType] = useState<TransactionType>('EXPENSE');

  // ─── Data fetching ──────────────────────────────────────────────────────────

  const fetchCenters = useCallback(async () => {
    setIsLoading(true);
    try {
      const allCenters: Center[] = [];
      let page = 1;
      let totalPages = 1;
      do {
        const result = await listCentersAction({ limit: 100, page, 'sort[name]': 'asc' });
        if (!result.ok) throw new Error(result.error);
        allCenters.push(...result.data.data);
        totalPages = result.data.totalPages;
        page++;
      } while (page <= totalPages);
      setCenters(allCenters);
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
    () => centers.filter((c) => c.type === transactionType).map((center): ManagerColumn => ({
      ...center,
      created_at: new Date(center.created_at).toISOString(),
      deleted_at: center.deleted_at ? new Date(center.deleted_at).toISOString() : undefined,
    })),
    [centers, transactionType],
  );

  // ─── Actions ────────────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSaveParent = useCallback(async (data: any, mode: 'CREATE' | 'EDIT') => {
    const payload = mode === 'CREATE' ? { ...data, type: transactionType } : data;
    const result =
      mode === 'CREATE'
        ? await createFinancialCenterAction(payload)
        : await updateFinancialCenterAction(data.id, payload);

    if (!result.ok) throw new Error(result.error ?? 'Erro ao salvar Centro.');

    showMessage('Centro salvo com sucesso!', 'success');
    await fetchCenters();
    return result.data;
  }, [transactionType, showMessage, fetchCenters]);

  const handleDeleteParent = useCallback(
    (id: string, name: string): Promise<void> =>
      new Promise((resolve, reject) => {
        showPopup(
          'Excluir Centro',
          `Tem certeza que deseja excluir "${name}"?`,
          async () => {
            try {
              const result = await deleteFinancialCenterAction(id);
              if (!result.ok) {
                throw new Error(result.error ?? 'Erro ao excluir Centro.');
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
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg overflow-hidden w-fit border border-ui-border bg-surface-subtle">
          {(['EXPENSE', 'INCOME'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setTransactionType(type)}
              className={`px-8 py-2.5 text-sm font-bold transition-all ${
                transactionType === type
                  ? (type === 'EXPENSE' ? 'bg-orange-600 text-white shadow-md' : 'bg-green-700 text-white shadow-md')
                  : 'text-content-secondary hover:text-content'
              }`}
            >
              {type === 'EXPENSE' ? 'Despesa' : 'Receita'}
            </button>
          ))}
        </div>
        <CenterExcelImport onImported={fetchCenters} />
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
