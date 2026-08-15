/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Section from '@/components/layout/PageSection';
import InlineEditableTable from '@/components/table/InlineEditableTable';
import TransferDestinationModal from '@/components/domain/financial/TransferDestinationModal';
import type { ColumnDef } from '@/types/types';
import { useMessageContext } from '@/contexts/MessageContext';
import { isQuickCreateSentinel, extractQuickCreateName } from '@/components/ui/QuickCreateAutocomplete';

import {
  listFinancialTransactionsAction,
  createFinancialTransactionAction,
  updateFinancialTransactionAction,
  deleteFinancialTransactionAction,
  createTransferAction,
  getTransactionFiltersAction,
  createInstallmentsAction,
  createRecurrenceAction,
} from '@/server/actions/financial-transaction';
import {
  listCategoriesAction,
  quickCreateFinancialCategoryAction,
} from '@/server/actions/financial-category';
import {
  listSubcategoriesAction,
  quickCreateFinancialSubcategoryAction,
} from '@/server/actions/financial-subcategory';
import {
  listFinancialInstitutionsAction,
  quickCreateFinancialInstitutionAction,
} from '@/server/actions/financial-institution';
import {
  listCardsAction,
  quickCreateFinancialCardAction,
} from '@/server/actions/financial-card';
import {
  listCentersAction,
  quickCreateFinancialCenterAction,
} from '@/server/actions/financial-center';
import {
  listSuppliersAction,
  quickCreateFinancialSupplierAction,
} from '@/server/actions/financial-supplier';
import {
  getInvoiceAction,
  updateInvoiceStatusAction,
} from '@/server/actions/financial-invoice';
import { getColumnPreferencesAction, saveColumnPreferencesAction } from '@/server/actions/user-preferences';
import { describeActionError } from '@/shared/actions/action-result';

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
        listCategoriesAction({ limit: 100 }),
        listSubcategoriesAction({ limit: 100 }),
        listFinancialInstitutionsAction({ limit: 100 }),
        listCardsAction({ limit: 100 }),
        listCentersAction({ limit: 100 }),
        listSuppliersAction({ limit: 100 }),
      ]);
      const unwrap = (res: any) => {
        if (!res?.ok) throw new Error(res?.error ?? 'Erro ao carregar opções');
        return res.data?.data ?? res.data ?? [];
      };
      const cats = unwrap(catRes);
      const subs = unwrap(subRes);
      const insts = unwrap(instRes);
      const cards = unwrap(cardRes);
      const cents = unwrap(centRes);
      const sups = unwrap(supRes);

      const allCategories = cats;
      const incomeCategories = allCategories.filter((cat: { type: string }) => cat.type === 'INCOME');
      const expenseCategories = allCategories.filter((cat: { type: string }) => cat.type === 'EXPENSE');
      
      const subcategoriesByCategory: { [categoryId: string]: SelectOption[] } = {};
      (subs).forEach((sub: { id: string; name: string; category_id: string }) => {
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
      const result = await getColumnPreferencesAction('financial-transaction');
      if (result.ok && result.data) {
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
          const result = await saveColumnPreferencesAction(body);

          if (!result.ok) {
            if (result.status === 401) {
              throw new Error('Usuário não autenticado (401)');
            }
            throw new Error(result.error || `Erro ${result.status}`);
          }

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
      
      const res = await quickCreateFinancialCategoryAction({ name, type });
      if (res.ok) {
        const result = res.data;
        resolved.category_id = result.id;
        // Atualiza opções locais
        setOptions(prev => ({
          ...prev,
          categories: [...prev.categories, result as any],
          [type === 'INCOME' ? 'incomeCategories' : 'expenseCategories']: [...(type === 'INCOME' ? prev.incomeCategories : prev.expenseCategories), { label: name, value: result.id }]
        }));
      }
    }

    // 2. Resolve Subcategory
    if (isQuickCreateSentinel(resolved.subcategory_id)) {
      const name = extractQuickCreateName(resolved.subcategory_id);
      if (resolved.category_id && !isQuickCreateSentinel(resolved.category_id)) {
        const res = await quickCreateFinancialSubcategoryAction({ name, category_id: resolved.category_id });
        if (res.ok) {
          const result = res.data;
          resolved.subcategory_id = result.id;
          setOptions(prev => {
            const subs = { ...prev.subcategories };
            if (!subs[resolved.category_id]) subs[resolved.category_id] = [];
            subs[resolved.category_id].push({ label: name, value: result.id });
            return { ...prev, subcategories: subs };
          });
        }
      }
    }

    // 3. Resolve Institution
    if (isQuickCreateSentinel(resolved.financial_institution_id)) {
      const name = extractQuickCreateName(resolved.financial_institution_id);
      const res = await quickCreateFinancialInstitutionAction({ name });
      if (res.ok) {
        const result = res.data;
        resolved.financial_institution_id = result.id;
        setOptions(prev => ({
          ...prev,
          institutions: [...prev.institutions, { label: name, value: result.id }]
        }));
      }
    }

    // 4. Resolve Card
    if (isQuickCreateSentinel(resolved.card_id)) {
      const name = extractQuickCreateName(resolved.card_id);
      const res = await quickCreateFinancialCardAction({ name });
      if (res.ok) {
        const result = res.data;
        resolved.card_id = result.id;
        setOptions(prev => ({
          ...prev,
          cards: [...prev.cards, { label: name, value: result.id }]
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
      
      const res = await quickCreateFinancialCenterAction({ name, type });
      if (res.ok) {
        const result = res.data;
        resolved.center_id = result.id;
        setOptions(prev => ({
          ...prev,
          centers: [...prev.centers, { label: name, value: result.id, type }]
        }));
      }
    }

    // 6. Resolve Supplier
    if (isQuickCreateSentinel(resolved.supplier_id)) {
      const name = extractQuickCreateName(resolved.supplier_id);
      const res = await quickCreateFinancialSupplierAction({ legal_name: name });
      if (res.ok) {
        const result = res.data;
        resolved.supplier_id = result.id;
        setOptions(prev => ({
          ...prev,
          suppliers: [...prev.suppliers, { label: name, value: result.id }]
        }));
      } else {
        throw new Error(res.error || 'Erro ao criar fornecedor');
      }
    }

    return resolved;
  }, [options]);

  const handleRowSave = useCallback(async (id: string, data: Record<string, unknown>) => {
    const resolved = await resolveQuickCreates(data);
    const result = await updateFinancialTransactionAction(id, resolved);
    if (!result.ok) throw new Error(result.error ?? 'Erro ao atualizar lançamento.');
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

        const transferCreated = await createTransferAction({
          ...resolved,
          destination_institution_id: transferChoice.destinationId,
          destination_center_id: transferChoice.destinationCenterId,
        });
        if (!transferCreated.ok) {
          throw new Error(transferCreated.error ?? 'Erro ao criar transferência.');
        }
        return;
      }

      const created = await createFinancialTransactionAction(resolved);
      if (!created.ok) {
        throw new Error(created.error ?? 'Erro ao criar lançamento.');
      }
    } catch (error) {
      console.error(error);
      throw error instanceof Error ? error : new Error('Erro ao criar lançamento.');
    }
  }, [resolveQuickCreates, transferCategoryIds, askTransferDestination, options.categories]);

  const handleRowDelete = useCallback(async (id: string) => {
    try {
      const result = await deleteFinancialTransactionAction(id);
      if (!result.ok) {
        throw new Error(result.error ?? 'Erro ao excluir lançamento.');
      }
    } catch (error) {
      console.error(error);
      throw error instanceof Error ? error : new Error('Erro ao excluir lançamento.');
    }
  }, []);

  // Duplica um lançamento criando uma cópia idêntica (mesma data, valor, status,
  // categoria, etc.). Os IDs relacionados já são reais, então cria direto via
  // POST sem passar por resolveQuickCreates. Itens de transferência entre contas
  // são ignorados (exigem fluxo com modal de conta-destino).
  // Sufixa a descrição do clone com "(cópia)" para distinguir do original.
  // Clone de clone não empilha sufixo ("X (cópia)" continua "X (cópia)").
  const buildCloneDescription = (description: unknown): string => {
    const base = String(description ?? '').trim();
    if (!base) return '(cópia)';
    if (/\(cópia\)$/i.test(base)) return base;
    return `${base} (cópia)`;
  };

  const handleRowDuplicate = useCallback(async (item: any) => {
    if (transferCategoryIds.has(String(item.category_id))) {
      return { skipped: true };
    }

    const payload = {
      event_date: item.event_date ?? null,
      effective_date: item.effective_date ?? null,
      category_id: item.category_id ?? null,
      subcategory_id: item.subcategory_id ?? null,
      financial_institution_id: item.financial_institution_id ?? null,
      card_id: item.card_id ?? null,
      center_id: item.center_id ?? null,
      supplier_id: item.supplier_id ?? null,
      description: buildCloneDescription(item.description),
      amount: item.amount,
      status: item.status,
    };

    const result = await createFinancialTransactionAction(payload);
    if (!result.ok) {
      throw new Error(result.error ?? 'Erro ao duplicar lançamento.');
    }

    return result.data;
  }, [transferCategoryIds]);

  // Converte o estado da tabela (`{page, limit, search, sort, filters}`) para o
// formato de query-string aceito pelas actions/query de listagem.
const stateToRawListParams = (state: any): Record<string, unknown> => {
    const raw: Record<string, unknown> = {
      page: state.page,
      limit: state.limit,
    };
    if (state.search) raw.search = state.search;
    Object.entries(state.sort || {}).forEach(([key, value]) => {
      if (value === 'asc' || value === 'desc') raw[`sort[${key}]`] = value;
    });
    Object.entries(state.filters || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      raw[key] = value;
    });
    return raw;
  };

  // Fonte de dados da grid via Server Action (substitui o endpoint HTTP). O
  // fetcher recebe o estado da tabela e devolve o mesmo shape `PaginatedTransactions`
  // que o backend retornava.
  const dataFetcher = useCallback(async (state: any) => {
    const result = await listFinancialTransactionsAction(stateToRawListParams(state));
    if (!result.ok) {
      throw new Error(describeActionError(result, 'Erro ao carregar lançamentos.'));
    }
    return result.data;
  }, []);

  const filtersFetcher = useCallback(async (applied?: Record<string, any>) => {
    const result = await getTransactionFiltersAction(applied ?? {});
    if (!result.ok) throw new Error(result.error ?? 'Erro ao carregar filtros.');
    return result.data;
  }, []);

  // Criação em massa via action (Parcelado/Recorrente/Simples) — substitui os
  // endpoints `/financial-transaction/installments|recurrence|` chamados pelo
  // modal do InlineEditableTable. Devolve a quantidade criada.
  const bulkCreateHandler = useCallback(async (kind: 'installments' | 'recurrence' | 'single', payload: Record<string, any>) => {
    switch (kind) {
      case 'installments': {
        const result = await createInstallmentsAction(payload);
        if (!result.ok) throw new Error(result.error ?? 'Erro ao criar parcelas.');
        return result.data?.data?.installments?.length ?? 1;
      }
      case 'recurrence': {
        const result = await createRecurrenceAction(payload);
        if (!result.ok) throw new Error(result.error ?? 'Erro ao criar recorrência.');
        return result.data?.data?.generated ?? 1;
      }
      default: {
        const result = await createFinancialTransactionAction(payload);
        if (!result.ok) throw new Error(result.error ?? 'Erro ao criar lançamento.');
        return 1;
      }
    }
  }, []);

  // Faturas de cartão via Server Action (substitui o fetch /financial-invoice).
  const handleInvoiceSearch = useCallback(async (cardId: string, month: number, year: number) => {
    const result = await getInvoiceAction({ cardId, month, year });
    if (!result.ok) {
      if (result.status === 404) return null;
      throw new Error(result.error ?? 'Erro ao buscar fatura.');
    }
    return result.data;
  }, []);

  const handleInvoiceUpdateStatus = useCallback(
    async (invoiceId: string, status: string, data: { institution_id?: string; effective_date?: string }) => {
      const result = await updateInvoiceStatusAction(invoiceId, { status, ...data });
      if (!result.ok) {
        throw new Error(result.error ?? 'Erro ao atualizar fatura.');
      }
      const count = result.data?.updated_transactions ?? 0;
      const plural = count === 1 ? 'lançamento atualizado' : 'lançamentos atualizados';
      showMessage(`Status atualizado para ${status} — ${count} ${plural}`, 'success');
    },
    [showMessage],
  );

  if (isLoadingOptions || isLoadingColumns) {
    return (
      <Section title="Gerenciar Lançamentos" fill>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
        </div>
      </Section>
    );
  }

  return (
    <Section title={pageTitle} fill>
      <InlineEditableTable
        resource="financial-transaction"
        title="Lançamentos"
        columns={columns}
        autoFocusSearch
        enableCreate
        enableDelete
        summaryPanel
        defaultLimit={100}
        formOptions={options}
        onRowSave={handleRowSave}
        onRowCreate={handleRowCreate}
        onRowDelete={handleRowDelete}
        onRowDuplicate={handleRowDuplicate}
        enableDuplicate
        resolveQuickCreates={resolveQuickCreates}
        onColumnsChange={handleColumnsChange}
        onColumnWidthsChange={handleColumnWidthsChange}
        savedColumnWidths={columnWidths}
        visibleColumns={visibleColumns}
        onVisibilityChange={handleVisibilityChange}
        onAppliedFiltersChange={handleAppliedFiltersChange}
        dataFetcher={dataFetcher}
        filtersFetcher={filtersFetcher}
        bulkCreateHandler={bulkCreateHandler}
        onInvoiceSearch={handleInvoiceSearch}
        onInvoiceUpdateStatus={handleInvoiceUpdateStatus}
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