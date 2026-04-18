/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Section from '@/components/layout/PageSection';
import InlineEditableTable from '@/components/table/InlineEditableTable';
import type { ColumnDef } from '@/types/types';
import ColumnCustomizer from '@/components/table/ColumnCustomizer';
import { useMessageContext } from '@/contexts/MessageContext';
import { authFetch } from '@/utils/authFetch';
import { Settings2 } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_URL_API ?? '';

interface SelectOption {
  label: string;
  value: string;
  type?: string
}

interface FormOptions {
  categories: SelectOption[];
  institutions: SelectOption[];
  cards: SelectOption[];
  centers: SelectOption[];
  suppliers: SelectOption[];
  subcategories: { [categoryId: string]: SelectOption[] };
  incomeCategories: SelectOption[];
  expenseCategories: SelectOption[];
}

const mapToOptions = (res: any): SelectOption[] =>
  (res?.data ?? res ?? []).map((i: any) => ({ label: i.name, value: i.id }));

const mapToTypeOptions = (res: any): SelectOption[] =>
  (res?.data ?? res ?? []).map((i: any) => ({
    label: i.name,
    value: i.id,
  }));

const mapCentersWithOptions = (res: any): SelectOption[] =>
  (res?.data ?? res ?? []).map((i: any) => ({
    label: i.name,
    value: i.id,
    type: i.type,  
  }));

const mapSuppliersToOptions = (res: any): SelectOption[] =>
  (res?.data ?? res ?? []).map((i: any) => ({
    label: i.legal_name || i.name || 'Sem nome',
    value: i.id,
  }));

const EMPTY_OPTIONS: FormOptions = {
  categories: [],
  institutions: [],
  cards: [],
  centers: [],
  suppliers: [],
  subcategories: {},
  incomeCategories: [],
  expenseCategories: [],
};

const LANCAMENTOS_COLUMNS: ColumnDef[] = [
  { field: 'event_date', label: 'Data do Evento', sortParam: 'event_date', type: 'date' },
  { field: 'effective_date', label: 'Data de Efetivação', sortParam: 'effective_date', type: 'date' },
  { field: 'category_id', label: 'Categoria', sortParam: 'category.name', type: 'text' },
  { field: 'subcategory_id', label: 'Subcategoria', sortParam: 'subcategory.name', type: 'text' },
  { field: 'institution', label: 'Instituição Financeira', sortParam: 'financial_institution.name', type: 'text' },
  { field: 'card_id', label: 'Cartão de Crédito', sortParam: 'card.name', type: 'text' },
  { field: 'center_id', label: 'Centro', sortParam: 'center.name', type: 'text' },
  { field: 'supplier_id', label: 'Fornecedor', sortParam: 'supplier.name', type: 'text' },
  { field: 'description', label: 'Descrição', sortParam: 'description', type: 'text' },
  { field: 'amount', label: 'Valor', sortParam: 'amount', type: 'currency' },
  { field: 'status', label: 'Status', sortParam: 'status', type: 'text' },
  { field: 'actions', label: 'Ação', type: 'custom' },
];

export default function LancamentosPage() {
  const { showMessage } = useMessageContext();
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [options, setOptions] = useState<FormOptions>(EMPTY_OPTIONS);
  const [columns, setColumns] = useState<ColumnDef[]>(LANCAMENTOS_COLUMNS);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [isLoadingColumns, setIsLoadingColumns] = useState(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchOptions = useCallback(async () => {
    try {
      const [catRes, subRes, instRes, cardRes, centRes, supRes] = await Promise.all([
        fetch(`${API_URL}/financial-category?limit=1000&filter[is_active]=true`),
        fetch(`${API_URL}/financial-subcategory?limit=1000&filter[is_active]=true`),
        fetch(`${API_URL}/financial-institution?limit=1000`),
        fetch(`${API_URL}/financial-card?limit=1000&filter[is_active]=true`),
        fetch(`${API_URL}/financial-center?limit=1000&filter[is_active]=true`),
        fetch(`${API_URL}/financial-supplier?limit=1000`),
      ]);
      const [cats, subs, insts, cards, cents, sups] = await Promise.all([
        catRes.json(), subRes.json(), instRes.json(), cardRes.json(), centRes.json(), supRes.json(),
      ]);
      
      const allCategories = (cats?.data ?? cats ?? []);
      const incomeCategories = allCategories.filter((cat: { type: string }) => cat.type === 'INCOME');
      const expenseCategories = allCategories.filter((cat: { type: string }) => cat.type === 'EXPENSE');
      
      const subcategoriesByCategory: { [categoryId: string]: SelectOption[] } = {};
      (subs?.data ?? subs ?? []).forEach((sub: { id: string; name: string; category_id: string }) => {
        if (!subcategoriesByCategory[sub.category_id]) {
          subcategoriesByCategory[sub.category_id] = [];
        }
        subcategoriesByCategory[sub.category_id].push({
          label: sub.name,
          value: sub.id
        });
      });
      
      setOptions({
        categories: allCategories,
        incomeCategories: mapToTypeOptions({ data: incomeCategories }),
        expenseCategories: mapToTypeOptions({ data: expenseCategories }),
        institutions: mapToOptions(insts),
        cards: mapToOptions(cards),
        centers: mapCentersWithOptions(cents),
        suppliers: mapSuppliersToOptions(sups),
        subcategories: subcategoriesByCategory,
      });
    } catch {
      console.error('[LancamentosPage] Erro ao carregar opções');
    } finally {
      setIsLoadingOptions(false);
    }
  }, []);

  const fetchColumnPreferences = useCallback(async () => {
    try {
      const response = await authFetch(`${API_URL}/user-preferences/column-order?resource=financial-transaction`);
      if (response.ok) {
        const result = await response.json();
        if (result.data) {
          if (result.data.columnOrder && Array.isArray(result.data.columnOrder)) {
            const orderedColumns: ColumnDef[] = [];
            const remainingColumns = [...LANCAMENTOS_COLUMNS];

            result.data.columnOrder.forEach((field: string) => {
              const colIndex = remainingColumns.findIndex(c => c.field === field);
              if (colIndex >= 0) {
                orderedColumns.push(remainingColumns[colIndex]);
                remainingColumns.splice(colIndex, 1);
              }
            });

            setColumns([...orderedColumns, ...remainingColumns]);
          }

          if (result.data.columnWidths && typeof result.data.columnWidths === 'object') {
            setColumnWidths(result.data.columnWidths);
          }
        }
      } else if (response.status === 401) {
        console.warn('[LancamentosPage] Usuário não autenticado ao carregar preferências');
      }
    } catch (error) {
      console.error('[LancamentosPage] Erro ao carregar preferências:', error);
    } finally {
      setIsLoadingColumns(false);
    }
  }, []);

  const saveColumnPreferences = useCallback(async (orderedFields: string[], widths: Record<string, number>) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      const MAX_RETRIES = 3;
      let attempt = 0;

      const attemptSave = async (): Promise<boolean> => {
        try {
          const body = {
            resource: 'financial-transaction',
            columnOrder: orderedFields,
            columnWidths: widths,
          };
          console.log('[LancamentosPage] Enviando preferências:', body);
          const response = await authFetch(`${API_URL}/user-preferences/column-order`, {
            method: 'POST',
            body: JSON.stringify(body),
          });

          console.log('[LancamentosPage] Resposta do servidor:', response.status, response.statusText);

          if (response.status === 401) {
            throw new Error('Usuário não autenticado (401)');
          }

          if (!response.ok) {
            const errorText = await response.text();
            console.error('[LancamentosPage] Erro no corpo da resposta:', errorText);
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const result = await response.json();
          console.log('[LancamentosPage] Resposta JSON:', result);

          showMessage('Preferências de colunas salvas com sucesso', 'success', 2000);
          return true;
        } catch (error) {
          attempt++;
          if (attempt < MAX_RETRIES) {
            const delayMs = Math.pow(2, attempt - 1) * 1000;
            console.warn(`[LancamentosPage] Tentativa ${attempt} falhou. Retentando em ${delayMs}ms...`, error);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            return attemptSave();
          } else {
            console.error('[LancamentosPage] Falha ao salvar após 3 tentativas:', error);
            showMessage('Erro ao salvar preferências de colunas. Tente novamente.', 'error', 5000);
            return false;
          }
        }
      };

      await attemptSave();
    }, 500);
  }, [showMessage]);

  const handleColumnsChange = useCallback((newColumns: ColumnDef[]) => {
    setColumns(newColumns);
    const orderedFields = newColumns.map(c => c.field);
    saveColumnPreferences(orderedFields, columnWidths);
  }, [saveColumnPreferences, columnWidths]);

  const handleColumnWidthsChange = useCallback((widths: Record<string, number>) => {
    console.log('[LancamentosPage] handleColumnWidthsChange - novo widths:', widths);
    setColumnWidths(widths);
    const orderedFields = columns.map(c => c.field);
    saveColumnPreferences(orderedFields, widths);
  }, [columns, saveColumnPreferences]);

  const handleResetColumns = useCallback(() => {
    setColumns(LANCAMENTOS_COLUMNS);
    setColumnWidths({});
    saveColumnPreferences(LANCAMENTOS_COLUMNS.map(c => c.field), {});
  }, [saveColumnPreferences]);

  useEffect(() => {
    fetchOptions();
    fetchColumnPreferences();
  }, [fetchOptions, fetchColumnPreferences]);

  const handleRowSave = useCallback(async (id: string, data: Record<string, unknown>) => {
    const response = await fetch(`${API_URL}/financial-transaction/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.message ?? 'Erro ao atualizar lançamento.');
    }
  }, []);

  const handleRowCreate = useCallback(async (data: Record<string, unknown>) => {
    try {
      const response = await fetch(`${API_URL}/financial-transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.message ?? 'Erro ao criar lançamento.');
      }
    } catch (error) {
      console.error(error);
      throw error instanceof Error ? error : new Error('Erro ao criar lançamento.');
    }
  }, []);

  const handleRowDelete = useCallback(async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/financial-transaction/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.message ?? 'Erro ao excluir lançamento.');
      }
    } catch (error) {
      console.error(error);
      throw error instanceof Error ? error : new Error('Erro ao excluir lançamento.');
    }
  }, []);

  if (isLoadingOptions || isLoadingColumns) {
    return (
      <Section title="Gerenciar Lançamentos">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
        </div>
      </Section>
    );
  }

  return (
    <Section
      title="Gerenciar Lançamentos"
      action={
        <button
          onClick={() => setIsColumnModalOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-surface-subtle hover:bg-ui-border rounded-lg transition-colors text-sm text-content-secondary"
          title="Personalizar colunas"
        >
          <Settings2 size={16} />
          <span className="hidden sm:inline">Colunas</span>
        </button>
      }
    >
      <InlineEditableTable
        resource="financial-transaction"
        title="Lançamentos"
        columns={columns}
        autoFocusSearch
        enableCreate
        enableDelete
        formOptions={options}
        onRowSave={handleRowSave}
        onRowCreate={handleRowCreate}
        onRowDelete={handleRowDelete}
        onColumnsChange={handleColumnsChange}
        onColumnWidthsChange={handleColumnWidthsChange}
        savedColumnWidths={columnWidths}
      />
      <ColumnCustomizer
        isOpen={isColumnModalOpen}
        onClose={() => setIsColumnModalOpen(false)}
        columns={columns}
        onReorder={handleColumnsChange}
        onReset={handleResetColumns}
      />
    </Section>
  );
}