/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Section from '@/components/layout/PageSection';
import InlineEditableTable from '@/components/table/InlineEditableTable';
import TransferDestinationModal from '@/components/domain/financial/TransferDestinationModal';
import type { ColumnDef } from '@/types/types';
import { useMessageContext } from '@/contexts/MessageContext';
import { authFetch } from '@/utils/authFetch';
import { isQuickCreateSentinel, extractQuickCreateName } from '@/components/ui/QuickCreateAutocomplete';

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
  { field: 'category_id', label: 'Categoria', sortParam: 'category_id', type: 'select', optionsKey: 'categories' },
  { field: 'subcategory_id', label: 'Subcat.', sortParam: 'subcategory_id', type: 'select', optionsKey: 'subcategories' },
  { field: 'financial_institution_id', label: 'Instituição', sortParam: 'financial_institution_id', type: 'select', optionsKey: 'institutions' },
  { field: 'card_id', label: 'Cartão', sortParam: 'card_id', type: 'select', optionsKey: 'cards' },
  { field: 'center_id', label: 'Centro', sortParam: 'center_id', type: 'select', optionsKey: 'centers' },
  { field: 'supplier_id', label: 'Contato', sortParam: 'supplier_id', type: 'select', optionsKey: 'suppliers' },
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
  const [visibleColumns, setVisibleColumns] = useState<string[]>(LANCAMENTOS_COLUMNS.map(c => c.field));
  const [isLoadingColumns, setIsLoadingColumns] = useState(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Categorias internas de transferência (is_system + nome). Quando o lançamento
  // usa uma delas, ao salvar abrimos o modal pedindo a conta de destino.
  const transferCategoryIds = useMemo(() => {
    const ids = new Set<string>();
    (options.categories as any[]).forEach(c => {
      const name = typeof c?.name === 'string' ? c.name.toLowerCase() : '';
      if (c?.is_system && name.includes('transferência entre contas')) {
        ids.add(String(c.id));
      }
    });
    return ids;
  }, [options.categories]);

  // Filtros aplicados na grid (espelhados do InlineEditableTable) — usados só
  // para compor o título com as instituições selecionadas.
  const [appliedFilters, setAppliedFilters] = useState<Record<string, any>>({});
  const handleAppliedFiltersChange = useCallback((filters: Record<string, any>) => {
    setAppliedFilters(filters);
  }, []);

  const pageTitle = useMemo(() => {
    const raw = appliedFilters.financial_institution_id;
    const ids: string[] = raw == null ? [] : Array.isArray(raw) ? raw : [raw];
    const names = ids
      .map(id => options.institutions.find(i => String(i.value) === String(id))?.label)
      .filter((name): name is string => Boolean(name));
    return names.length > 0 ? `Gerenciar Lançamentos – ${names.join(', ')}` : 'Gerenciar Lançamentos';
  }, [appliedFilters, options.institutions]);

  const [transferModal, setTransferModal] = useState<
    null | { originId: string; amount: number; description: string; originType: 'INCOME' | 'EXPENSE' }
  >(null);
  const transferResolverRef = useRef<
    ((result: { destinationId: string; destinationCenterId: string } | null) => void) | null
  >(null);

  const askTransferDestination = useCallback(
    (originId: string, amount: number, description: string, originType: 'INCOME' | 'EXPENSE') =>
      new Promise<{ destinationId: string; destinationCenterId: string } | null>(resolve => {
        transferResolverRef.current = resolve;
        setTransferModal({ originId, amount, description, originType });
      }),
    [],
  );

  const resolveTransferModal = useCallback(
    (result: { destinationId: string; destinationCenterId: string } | null) => {
      transferResolverRef.current?.(result);
      transferResolverRef.current = null;
      setTransferModal(null);
    },
    [],
  );

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

          if (result.data.visibleColumns && Array.isArray(result.data.visibleColumns) && result.data.visibleColumns.length > 0) {
            setVisibleColumns(result.data.visibleColumns);
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

  const saveColumnPreferences = useCallback(async (orderedFields: string[], widths: Record<string, number>, visible?: string[]) => {
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
            ...(visible && { visibleColumns: visible }),
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
    saveColumnPreferences(orderedFields, columnWidths, visibleColumns);
  }, [saveColumnPreferences, columnWidths, visibleColumns]);

  const handleColumnWidthsChange = useCallback((widths: Record<string, number>) => {
    console.log('[LancamentosPage] handleColumnWidthsChange - novo widths:', widths);
    setColumnWidths(widths);
    const orderedFields = columns.map(c => c.field);
    saveColumnPreferences(orderedFields, widths, visibleColumns);
  }, [columns, saveColumnPreferences, visibleColumns]);

  const handleVisibilityChange = useCallback((visibleFields: string[]) => {
    setVisibleColumns(visibleFields);
    const orderedFields = columns.map(c => c.field);
    saveColumnPreferences(orderedFields, columnWidths, visibleFields);
  }, [columns, columnWidths, saveColumnPreferences]);

  useEffect(() => {
    fetchOptions();
    fetchColumnPreferences();
  }, [fetchOptions, fetchColumnPreferences]);

  // Cria contato (fornecedor) sob demanda quando o usuário usou a opção
  // "+ adicionar novo contato" no autocomplete. Só roda no momento em que
  // o lançamento é salvo, garantindo que digitação cancelada não polui o banco.
  // Cria entidades financeiras sob demanda (Categoria, Subcategoria, Instituição, Cartão, Centro, Contato)
  const resolveQuickCreates = useCallback(async (data: Record<string, any>) => {
    const resolved = { ...data };
    
    // 1. Resolve Category
    if (isQuickCreateSentinel(resolved.category_id)) {
      const name = extractQuickCreateName(resolved.category_id);
      // O tipo depende do valor (AMOUNT > 0 ? INCOME : EXPENSE) ou do contexto. 
      // Como o InlineEditableTable gerencia INCOME/EXPENSE via tabs, podemos tentar detectar.
      // Simplificação: vamos assumir que se o valor for positivo é INCOME, negativo é EXPENSE.
      // Mas o usuário informou que o Centro deve seguir a categoria informada.
      const amount = typeof resolved.amount === 'number' ? resolved.amount : 0;
      const type = amount >= 0 ? 'INCOME' : 'EXPENSE';
      
      const res = await authFetch(`${API_URL}/financial-category/quick-create`, {
        method: 'POST',
        body: JSON.stringify({ name, type }),
      });
      if (res.ok) {
        const result = await res.json();
        resolved.category_id = result.data.id;
        // Atualiza opções locais
        setOptions(prev => ({
          ...prev,
          categories: [...prev.categories, result.data],
          [type === 'INCOME' ? 'incomeCategories' : 'expenseCategories']: [...(type === 'INCOME' ? prev.incomeCategories : prev.expenseCategories), { label: name, value: result.data.id }]
        }));
      }
    }

    // 2. Resolve Subcategory
    if (isQuickCreateSentinel(resolved.subcategory_id)) {
      const name = extractQuickCreateName(resolved.subcategory_id);
      if (resolved.category_id && !isQuickCreateSentinel(resolved.category_id)) {
        const res = await authFetch(`${API_URL}/financial-subcategory/quick-create`, {
          method: 'POST',
          body: JSON.stringify({ name, category_id: resolved.category_id }),
        });
        if (res.ok) {
          const result = await res.json();
          resolved.subcategory_id = result.data.id;
          setOptions(prev => {
            const subs = { ...prev.subcategories };
            if (!subs[resolved.category_id]) subs[resolved.category_id] = [];
            subs[resolved.category_id].push({ label: name, value: result.data.id });
            return { ...prev, subcategories: subs };
          });
        }
      }
    }

    // 3. Resolve Institution
    if (isQuickCreateSentinel(resolved.financial_institution_id)) {
      const name = extractQuickCreateName(resolved.financial_institution_id);
      const res = await authFetch(`${API_URL}/financial-institution/quick-create`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const result = await res.json();
        resolved.financial_institution_id = result.data.id;
        setOptions(prev => ({
          ...prev,
          institutions: [...prev.institutions, { label: name, value: result.data.id }]
        }));
      }
    }

    // 4. Resolve Card
    if (isQuickCreateSentinel(resolved.card_id)) {
      const name = extractQuickCreateName(resolved.card_id);
      const res = await authFetch(`${API_URL}/financial-card/quick-create`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const result = await res.json();
        resolved.card_id = result.data.id;
        setOptions(prev => ({
          ...prev,
          cards: [...prev.cards, { label: name, value: result.data.id }]
        }));
      }
    }

    // 5. Resolve Center
    if (isQuickCreateSentinel(resolved.center_id)) {
      const name = extractQuickCreateName(resolved.center_id);
      
      let type = 'EXPENSE';
      if (resolved.category_id && !isQuickCreateSentinel(resolved.category_id)) {
        const isIncomeCat = options.incomeCategories?.some(c => String(c.value) === String(resolved.category_id));
        if (isIncomeCat) type = 'INCOME';
      } else {
        const amount = typeof resolved.amount === 'number' ? resolved.amount : 0;
        if (amount >= 0) type = 'INCOME';
      }
      
      const res = await authFetch(`${API_URL}/financial-center/quick-create`, {
        method: 'POST',
        body: JSON.stringify({ name, type }),
      });
      if (res.ok) {
        const result = await res.json();
        resolved.center_id = result.data.id;
        setOptions(prev => ({
          ...prev,
          centers: [...prev.centers, { label: name, value: result.data.id, type }]
        }));
      }
    }

    // 6. Resolve Supplier
    if (isQuickCreateSentinel(resolved.supplier_id)) {
      const name = extractQuickCreateName(resolved.supplier_id);
      const res = await authFetch(`${API_URL}/financial-supplier/quick-create`, {
        method: 'POST',
        body: JSON.stringify({ legal_name: name }),
      });
      if (res.ok) {
        const result = await res.json();
        resolved.supplier_id = result.data.id;
        setOptions(prev => ({
          ...prev,
          suppliers: [...prev.suppliers, { label: name, value: result.data.id }]
        }));
      } else {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Erro ao criar fornecedor');
      }
    }

    return resolved;
  }, [options]);

  const handleRowSave = useCallback(async (id: string, data: Record<string, unknown>) => {
    const resolved = await resolveQuickCreates(data);
    const response = await fetch(`${API_URL}/financial-transaction/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resolved),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.message ?? 'Erro ao atualizar lançamento.');
    }
  }, [resolveQuickCreates]);

  const handleRowCreate = useCallback(async (data: Record<string, unknown>) => {
    try {
      const resolved = await resolveQuickCreates(data);

      // Fluxo de transferência: categoria interna exige conta de destino.
      if (transferCategoryIds.has(String(resolved.category_id))) {
        const originId = String(resolved.financial_institution_id ?? '');
        if (!originId) {
          throw new Error('Selecione a instituição financeira de origem.');
        }

        // Direção da perna de origem (Saída = EXPENSE, Entrada = INCOME) — define
        // se o centro pedido no modal deve ser de Crédito (INCOME) ou Débito (EXPENSE).
        const originCategory = (options.categories as any[]).find(
          c => String(c.id) === String(resolved.category_id),
        );
        const originType: 'INCOME' | 'EXPENSE' = originCategory?.type === 'INCOME' ? 'INCOME' : 'EXPENSE';

        const transferChoice = await askTransferDestination(
          originId,
          Number(resolved.amount) || 0,
          String(resolved.description ?? ''),
          originType,
        );
        if (!transferChoice) {
          throw new Error('Transferência cancelada.');
        }

        const response = await fetch(`${API_URL}/financial-transaction/transfer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...resolved,
            destination_institution_id: transferChoice.destinationId,
            destination_center_id: transferChoice.destinationCenterId,
          }),
        });
        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          throw new Error(result.message ?? 'Erro ao criar transferência.');
        }
        return;
      }

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
  }, [resolveQuickCreates, transferCategoryIds, askTransferDestination, options.categories]);

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
    <Section title={pageTitle}>
      <InlineEditableTable
        resource="financial-transaction"
        title="Lançamentos"
        columns={columns}
        autoFocusSearch
        enableCreate
        enableDelete
        summaryPanel
        defaultLimit={150}
        formOptions={options}
        onRowSave={handleRowSave}
        onRowCreate={handleRowCreate}
        onRowDelete={handleRowDelete}
        resolveQuickCreates={resolveQuickCreates}
        onColumnsChange={handleColumnsChange}
        onColumnWidthsChange={handleColumnWidthsChange}
        savedColumnWidths={columnWidths}
        visibleColumns={visibleColumns}
        onVisibilityChange={handleVisibilityChange}
        onAppliedFiltersChange={handleAppliedFiltersChange}
      />

      {transferModal && (
        <TransferDestinationModal
          originId={transferModal.originId}
          originType={transferModal.originType}
          institutions={options.institutions}
          centers={options.centers}
          amount={transferModal.amount}
          description={transferModal.description}
          onConfirm={(destinationId, destinationCenterId) =>
            resolveTransferModal({ destinationId, destinationCenterId })
          }
          onCancel={() => resolveTransferModal(null)}
        />
      )}
    </Section>
  );
}