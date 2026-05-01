/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Section from '@/components/layout/PageSection';
import InlineEditableTable from '@/components/table/InlineEditableTable';
import type { ColumnDef } from '@/types/types';
import { useMessageContext } from '@/contexts/MessageContext';
import { authFetch } from '@/utils/authFetch';
import { isNewSupplierSentinel, extractNewSupplierName } from '@/components/ui/SupplierAutocomplete';

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
  { field: 'event_date', label: 'Data Evento', sortParam: 'event_date', type: 'date' },
  { field: 'effective_date', label: 'Data Efetiva', sortParam: 'effective_date', type: 'date' },
  { field: 'category_id', label: 'Categoria', sortParam: 'category.name', type: 'text' },
  { field: 'subcategory_id', label: 'Subcat.', sortParam: 'subcategory.name', type: 'text' },
  { field: 'institution', label: 'Instituição', sortParam: 'financial_institution.name', type: 'text' },
  { field: 'card_id', label: 'Cartão', sortParam: 'card.name', type: 'text' },
  { field: 'center_id', label: 'Centro', sortParam: 'center.name', type: 'text' },
  { field: 'supplier_id', label: 'Contato', sortParam: 'supplier.name', type: 'text' },
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

  useEffect(() => {
    fetchOptions();
    fetchColumnPreferences();
  }, [fetchOptions, fetchColumnPreferences]);

  // Cria contato (fornecedor) sob demanda quando o usuário usou a opção
  // "+ adicionar novo contato" no autocomplete. Só roda no momento em que
  // o lançamento é salvo, garantindo que digitação cancelada não polui o banco.
  const resolveNewSupplier = useCallback(async (data: Record<string, unknown>) => {
    const supplierField = data.supplier_id;
    if (typeof supplierField !== 'string' || !isNewSupplierSentinel(supplierField)) {
      return data;
    }

    const legalName = extractNewSupplierName(supplierField);
    const response = await authFetch(`${API_URL}/financial-supplier/quick-create`, {
      method: 'POST',
      body: JSON.stringify({ legal_name: legalName }),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.message ?? 'Erro ao criar contato.');
    }

    const result = await response.json();
    const created = result?.data ?? result;
    if (!created?.id) {
      throw new Error('Resposta inválida ao criar contato.');
    }

    // Atualiza a lista local de fornecedores para que o autocomplete reconheça o novo id imediatamente.
    setOptions(prev => ({
      ...prev,
      suppliers: [
        ...prev.suppliers,
        { value: created.id, label: created.legal_name || created.trade_name || legalName },
      ],
    }));

    return { ...data, supplier_id: created.id };
  }, []);

  const handleRowSave = useCallback(async (id: string, data: Record<string, unknown>) => {
    const resolved = await resolveNewSupplier(data);
    const response = await fetch(`${API_URL}/financial-transaction/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resolved),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.message ?? 'Erro ao atualizar lançamento.');
    }
  }, [resolveNewSupplier]);

  const handleRowCreate = useCallback(async (data: Record<string, unknown>) => {
    try {
      const resolved = await resolveNewSupplier(data);
      const response = await fetch(`${API_URL}/financial-transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resolved),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.message ?? 'Erro ao criar lançamento.');
      }
    } catch (error) {
      console.error(error);
      throw error instanceof Error ? error : new Error('Erro ao criar lançamento.');
    }
  }, [resolveNewSupplier]);

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
    <Section title="Gerenciar Lançamentos">
      <InlineEditableTable
        resource="financial-transaction"
        title="Lançamentos"
        columns={columns}
        autoFocusSearch
        enableCreate
        enableDelete
        defaultLimit={150}
        formOptions={options}
        onRowSave={handleRowSave}
        onRowCreate={handleRowCreate}
        onRowDelete={handleRowDelete}
        onColumnsChange={handleColumnsChange}
        onColumnWidthsChange={handleColumnWidthsChange}
        savedColumnWidths={columnWidths}
      />
    </Section>
  );
}