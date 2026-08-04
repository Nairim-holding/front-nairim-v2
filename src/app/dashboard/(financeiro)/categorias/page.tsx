'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Section from '@/components/layout/PageSection';
import { useMessageContext } from '@/contexts/MessageContext';
import { usePopupContext } from '@/contexts/PopupContext';
import MultiColumnManager from '@/components/form/MultiColumnManager';

const DFC_GROUP_OPTIONS = [
  { value: '', label: 'Não classificada' },
  { value: 'TAXES', label: 'Impostos' },
  { value: 'VARIABLE_EXPENSE', label: 'Despesa Variável' },
  { value: 'FIXED_EXPENSE', label: 'Despesa Fixa' },
  { value: 'PAYROLL', label: 'Despesas com Pessoal' },
];

// ─── Constantes ──────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_URL_API ?? '';

type TransactionType = 'EXPENSE' | 'INCOME';

// ─── Componente ──────────────────────────────────────────────────────────────

export default function CategoriasPage() {
  const { showMessage } = useMessageContext();
  const { showPopup } = usePopupContext();

  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [subcategories, setSubcategories] = useState<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [transactionType, setTransactionType] = useState<TransactionType>('EXPENSE');

  // ─── Data fetching ──────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [catRes, subRes] = await Promise.all([
        fetch(`${API_URL}/financial-category?limit=1000`),
        fetch(`${API_URL}/financial-subcategory?limit=1000`),
      ]);
      const [catData, subData] = await Promise.all([catRes.json(), subRes.json()]);
      setCategories(catData?.data ?? catData ?? []);
      setSubcategories(subData?.data ?? subData ?? []);
    } catch {
      showMessage('Erro ao carregar os dados.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showMessage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Computed values ────────────────────────────────────────────────────────

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === transactionType),
    [categories, transactionType],
  );

  // ─── Actions ────────────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSaveParent = useCallback(async (data: any, mode: 'CREATE' | 'EDIT') => {
    const url = mode === 'CREATE'
      ? `${API_URL}/financial-category`
      : `${API_URL}/financial-category/${data.id}`;
    const payload = mode === 'CREATE' ? { ...data, type: transactionType } : data;

    const res = await fetch(url, {
      method: mode === 'CREATE' ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const result = await res.json();
      throw new Error(result.message ?? 'Erro ao salvar Categoria.');
    }

    showMessage('Categoria salva com sucesso!', 'success');
    const newRecord = await res.json();
    await fetchData();
    return newRecord;
  }, [transactionType, showMessage, fetchData]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSaveChild = useCallback(async (data: any, parentId: string, mode: 'CREATE' | 'EDIT') => {
    const url = mode === 'CREATE'
      ? `${API_URL}/financial-subcategory`
      : `${API_URL}/financial-subcategory/${data.id}`;

    const res = await fetch(url, {
      method: mode === 'CREATE' ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, category_id: parentId }),
    });

    if (!res.ok) {
      const result = await res.json();
      throw new Error(result.message ?? 'Erro ao salvar Subcategoria.');
    }

    showMessage('Subcategoria salva com sucesso!', 'success');
    await fetchData();
  }, [showMessage, fetchData]);

  const handleDeleteParent = useCallback(
    (id: string, name: string): Promise<void> =>
      new Promise((resolve, reject) => {
        showPopup(
          'Excluir Categoria',
          `Tem certeza que deseja excluir "${name}"?`,
          async () => {
            try {
              const res = await fetch(`${API_URL}/financial-category/${id}`, { method: 'DELETE' });
              if (!res.ok) {
                const result = await res.json().catch(() => ({}));
                throw new Error(result.message ?? 'Erro ao excluir Categoria.');
              }
              showMessage('Excluída com sucesso!', 'success');
              await fetchData();
              resolve();
            } catch (err) {
              showMessage(err instanceof Error ? err.message : 'Erro ao excluir.', 'error');
              reject(err);
            }
          },
          () => reject(new Error('Cancelado pelo usuário')),
        );
      }),
    [showPopup, showMessage, fetchData],
  );

  const handleDeleteChild = useCallback(
    (id: string, name: string): Promise<void> =>
      new Promise((resolve, reject) => {
        showPopup(
          'Excluir Subcategoria',
          `Tem certeza que deseja excluir "${name}"?`,
          async () => {
            try {
              const res = await fetch(`${API_URL}/financial-subcategory/${id}`, { method: 'DELETE' });
              if (!res.ok) {
                const result = await res.json().catch(() => ({}));
                throw new Error(result.message ?? 'Erro ao excluir Subcategoria.');
              }
              showMessage('Excluída com sucesso!', 'success');
              await fetchData();
              resolve();
            } catch (err) {
              showMessage(err instanceof Error ? err.message : 'Erro ao excluir.', 'error');
              reject(err);
            }
          },
          () => reject(new Error('Cancelado pelo usuário')),
        );
      }),
    [showPopup, showMessage, fetchData],
  );

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <Section title="Gerenciar Categorias" >
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
          key={transactionType}
          titleParent="Categoria"
          titleChild="Subcategoria"
          parentData={filteredCategories}
          childData={subcategories}
          childRelationKey="category_id"
          isLoading={isLoading}
          onSaveParent={handleSaveParent}
          onSaveChild={handleSaveChild}
          onDeleteParent={handleDeleteParent}
          onDeleteChild={handleDeleteChild}
          parentExtraDefaults={(record) => ({ dfc_group: (record as { dfc_group?: string | null } | null)?.dfc_group ?? null })}
          parentExtraFields={
            transactionType === 'EXPENSE'
              ? (formData, setFormData) => (
                  <div className="flex flex-col gap-2">
                    <label className="text-[13px] font-semibold text-content-secondary">Classificação no DFC</label>
                    <select
                      value={(formData.dfc_group as string | null) ?? ''}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, dfc_group: e.target.value || null }))
                      }
                      className="w-full px-3 py-2.5 text-[14px] border border-ui-border rounded-lg outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-all bg-surface"
                    >
                      {DFC_GROUP_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-content-muted">
                      Usada no relatório Demonstrativo (DFC) do Fluxo de Caixa, em Relatórios.
                    </p>
                  </div>
                )
              : undefined
          }
        />

      </div>
    </Section>
  );
}
