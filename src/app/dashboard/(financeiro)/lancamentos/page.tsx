'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Section from '@/components/layout/PageSection';
import { Plus, Trash2, Edit2, X, Search, FileText, Tags, CreditCard } from 'lucide-react';
import { useMessageContext } from '@/contexts/MessageContext';
import { usePopupContext } from '@/contexts/PopupContext';
import DynamicFormManager from '@/components/form/DynamicForm';
import { formatCurrency, formatDate } from '@/utils/formatters';
import type { FormStep } from '@/types/types';

// ─── Constantes ──────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_URL_API ?? '';

type FormMode = 'IDLE' | 'CREATE' | 'EDIT';

interface SelectOption {
  label: string;
  value: string;
}

interface SubcategoryOption extends SelectOption {
  categoryId: string;
}

interface FormOptions {
  categories: SelectOption[];
  institutions: SelectOption[];
  cards: SelectOption[];
  centers: SelectOption[];
  subcategories: SubcategoryOption[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const normalizeText = (text: string) =>
  text ? text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() : '';

const parseMoneyCents = (value: string): number => {
  if (!value) return 0;
  const clean = String(value).replace(/[^\d,-]/g, '').replace(',', '.');
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapToOptions = (res: any): SelectOption[] =>
  (res?.data ?? res ?? []).map((i: any) => ({ label: i.name, value: i.id })); // eslint-disable-line @typescript-eslint/no-explicit-any

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapToTypeOptions = (res: any): SelectOption[] =>
  (res?.data ?? res ?? []).map((i: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
    label: `${i.name} (${i.type === 'INCOME' ? 'Receita' : 'Despesa'})`,
    value: i.id,
  }));

const EMPTY_OPTIONS: FormOptions = {
  categories: [],
  institutions: [],
  cards: [],
  centers: [],
  subcategories: [],
};

// ─── Transformações do formulário ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const transformDataForLoad = (apiResponse: any) => {
  const data = apiResponse.data ?? apiResponse;
  if (!data) return {};
  return {
    description: data.description ?? '',
    amount: data.amount ? formatCurrency(Number(data.amount)) : '',
    status: data.status ?? 'PENDING',
    event_date: data.event_date ? data.event_date.split('T')[0] : '',
    effective_date: data.effective_date ? data.effective_date.split('T')[0] : '',
    financial_institution_id: data.financial_institution_id ?? '',
    category_id: data.category_id ?? '',
    card_id: data.card_id ?? '',
    center_id: data.center_id ?? '',
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const transformPayloadForSave = (data: any) => {
  const { subcategories_info, ...apiData } = data;
  void subcategories_info; // campo visual, não enviado à API
  return {
    ...apiData,
    amount: parseMoneyCents(data.amount),
    subcategory_id: null,
    card_id: data.card_id || null,
    center_id: data.center_id || null,
    event_date: data.event_date ?? new Date().toISOString().split('T')[0],
  };
};

// ─── Componente ──────────────────────────────────────────────────────────────

export default function LancamentosPage() {
  const { showMessage } = useMessageContext();
  const { showPopup } = usePopupContext();

  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [options, setOptions] = useState<FormOptions>(EMPTY_OPTIONS);
  const [search, setSearch] = useState('');
  const [formMode, setFormMode] = useState<FormMode>('IDLE');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ─── Data fetching ──────────────────────────────────────────────────────────

  const fetchTransactions = useCallback(async () => {
    setIsLoadingList(true);
    try {
      const res = await fetch(`${API_URL}/financial-transaction?limit=100`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTransactions(data?.data ?? data ?? []);
    } catch {
      showMessage('Erro ao carregar os lançamentos.', 'error');
    } finally {
      setIsLoadingList(false);
    }
  }, [showMessage]);

  const fetchOptions = useCallback(async () => {
    try {
      const [catRes, subRes, instRes, cardRes, centRes] = await Promise.all([
        fetch(`${API_URL}/financial-category?limit=1000&filter[is_active]=true`),
        fetch(`${API_URL}/financial-subcategory?limit=1000&filter[is_active]=true`),
        fetch(`${API_URL}/financial-institution?limit=1000`),
        fetch(`${API_URL}/financial-card?limit=1000&filter[is_active]=true`),
        fetch(`${API_URL}/financial-center?limit=1000&filter[is_active]=true`),
      ]);
      const [cats, subs, insts, cards, cents] = await Promise.all([
        catRes.json(), subRes.json(), instRes.json(), cardRes.json(), centRes.json(),
      ]);
      setOptions({
        categories: mapToTypeOptions(cats),
        institutions: mapToOptions(insts),
        cards: mapToOptions(cards),
        centers: mapToTypeOptions(cents),
        subcategories: (subs?.data ?? subs ?? []).map((i: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
          label: i.name,
          value: i.id,
          categoryId: i.category_id,
        })),
      });
    } catch {
      console.error('[LancamentosPage] Erro ao carregar opções');
    } finally {
      setIsLoadingOptions(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
    fetchOptions();
  }, [fetchTransactions, fetchOptions]);

  // ─── Computed values ────────────────────────────────────────────────────────

  const displayedTransactions = useMemo(() => {
    const term = normalizeText(search);
    return transactions
      .filter((t) => !t.deleted_at)
      .filter((t) =>
        normalizeText(t.description).includes(term) ||
        normalizeText(t.category?.name ?? '').includes(term) ||
        normalizeText(t.financial_institution?.name ?? '').includes(term),
      )
      .sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());
  }, [transactions, search]);

  // ─── Form steps (depends on options — memoized) ──────────────────────────────

  const formSteps: FormStep[] = useMemo(() => [
    {
      title: 'Detalhes do Lançamento',
      icon: <FileText size={20} />,
      fields: [
        { field: 'description',    label: 'Descrição',           type: 'text',   required: true, autoFocus: true, className: 'col-span-full', placeholder: 'Ex: Pagamento de Aluguel' },
        { field: 'amount',         label: 'Valor',               type: 'text',   mask: 'money',  required: true, placeholder: 'R$ 0,00' },
        { field: 'status',         label: 'Status',              type: 'select', required: true, options: [{ label: 'Pendente', value: 'PENDING' }, { label: 'Concluído', value: 'COMPLETED' }] },
        { field: 'event_date',     label: 'Data do Evento',      type: 'date',   required: true, defaultValue: formMode === 'CREATE' ? new Date().toISOString().split('T')[0] : undefined, readOnly: true, disabled: true },
        { field: 'effective_date', label: 'Data de Efetivação',  type: 'date',   required: true },
      ],
    },
    {
      title: 'Classificação',
      icon: <Tags size={20} />,
      fields: [
        { field: 'category_id', label: 'Categoria', type: 'select', required: true, options: options.categories },
        {
          field: 'subcategories_info',
          label: '',
          type: 'custom',
          className: 'col-span-full',
          hidden: (fv) => !fv?.category_id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          render: (_: any, fv: any) => {
            const filtered = options.subcategories.filter((sub) => sub.categoryId === fv?.category_id);
            const text = filtered.length > 0
              ? filtered.map((sub) => sub.label).join(' • ')
              : 'Nenhuma subcategoria ativa atrelada a esta categoria.';
            return (
              <div className="p-3 bg-brand/5 border border-brand/20 rounded-lg flex items-center gap-3 mt-1 mb-2">
                <div>
                  <p className="text-[11px] font-semibold text-content-muted uppercase tracking-wider mb-0.5">
                    Subcategorias da Categoria Selecionada
                  </p>
                  <p className="text-sm font-medium text-brand">{text}</p>
                </div>
              </div>
            );
          },
        },
        { field: 'center_id', label: 'Centro', type: 'select', options: options.centers },
      ],
    },
    {
      title: 'Pagamento',
      icon: <CreditCard size={20} />,
      fields: [
        { field: 'financial_institution_id', label: 'Instituição Financeira', type: 'select', required: true, options: options.institutions },
        { field: 'card_id',                  label: 'Cartão',                 type: 'select', options: options.cards },
      ],
    },
  ], [options, formMode]);

  // ─── Actions ────────────────────────────────────────────────────────────────

  const openForm = (mode: FormMode, id: string | null = null) => {
    setSelectedId(id);
    setFormMode(mode);
  };

  const closeForm = useCallback(() => {
    setFormMode('IDLE');
    setSelectedId(null);
    fetchTransactions();
  }, [fetchTransactions]);

  const handleDelete = useCallback(
    (id: string, description: string) => {
      showPopup(
        'Excluir Lançamento',
        `Tem certeza que deseja excluir o lançamento "${description}"?`,
        async () => {
          try {
            const res = await fetch(`${API_URL}/financial-transaction/${id}`, { method: 'DELETE' });
            if (!res.ok) {
              const result = await res.json().catch(() => ({}));
              throw new Error(result.message ?? 'Erro ao excluir Lançamento.');
            }
            showMessage('Excluído com sucesso!', 'success');
            if (selectedId === id) closeForm();
            await fetchTransactions();
          } catch (err) {
            showMessage(err instanceof Error ? err.message : 'Erro ao excluir.', 'error');
          }
        },
        () => {},
      );
    },
    [showPopup, showMessage, selectedId, closeForm, fetchTransactions],
  );

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (isLoadingList || isLoadingOptions) {
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
      <div className="bg-surface p-6 rounded-xl shadow-sm border border-ui-border w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Lista de lançamentos */}
          <div className="lg:col-span-1 flex flex-col border border-ui-border rounded-xl bg-surface-subtle overflow-hidden h-[calc(100vh-180px)] min-h-[600px]">
            <div className="bg-surface p-3 border-b border-ui-border">
              <div className="flex justify-between items-center mb-3 px-1">
                <h3 className="font-bold text-content text-[15px]">Lançamentos</h3>
                <button
                  onClick={() => openForm('CREATE')}
                  className="p-1 hover:bg-brand/10 text-brand rounded-md transition-colors"
                  title="Novo Lançamento"
                >
                  <Plus size={18} />
                </button>
              </div>

              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
                <input
                  type="text"
                  placeholder="Buscar por descrição ou categoria..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-[13px] bg-surface-subtle border border-ui-border rounded-lg outline-none focus:border-brand transition-colors"
                />
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-2">
              {displayedTransactions.length === 0 ? (
                <p className="text-[13px] text-content-muted text-center mt-10">Nenhum lançamento encontrado.</p>
              ) : (
                displayedTransactions.map((transaction) => {
                  const isIncome = transaction.category?.type === 'INCOME';
                  const isCompleted = transaction.status === 'COMPLETED';
                  return (
                    <div
                      key={transaction.id}
                      onClick={() => openForm('EDIT', transaction.id)}
                      className={`group flex justify-between items-center px-3 py-2.5 cursor-pointer rounded-lg mb-1 transition-colors ${
                        selectedId === transaction.id
                          ? 'bg-brand/10 text-brand border border-brand/20'
                          : 'hover:bg-ui-border-soft text-content-secondary border border-transparent'
                      }`}
                    >
                      <div className="flex flex-col overflow-hidden w-full">
                        <span className="truncate text-[14px] font-medium">{transaction.description}</span>
                        <div className="flex items-center justify-between mt-1">
                          <span className={`text-[12px] font-semibold truncate ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
                            {isIncome ? '+ ' : '- '}{formatCurrency(transaction.amount)}
                          </span>
                          <span className="text-[11px] text-content-muted mr-2">
                            {formatDate(transaction.event_date)}
                          </span>
                        </div>
                        <div className="mt-1.5">
                          <span className={`px-2 py-[2px] rounded-full text-[10px] font-medium ${isCompleted ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {isCompleted ? 'Concluído' : 'Pendente'}
                          </span>
                        </div>
                      </div>

                      <div className={`flex items-center gap-1 flex-shrink-0 ml-2 transition-opacity ${selectedId === transaction.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        <button
                          onClick={(e) => { e.stopPropagation(); openForm('EDIT', transaction.id); }}
                          className="p-1 hover:bg-brand/20 rounded text-brand"
                          title="Editar"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(transaction.id, transaction.description); }}
                          className="p-1 hover:bg-red-100 rounded text-state-error"
                          title="Excluir"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Formulário */}
          <div className="lg:col-span-2 flex flex-col h-[calc(100vh-180px)] min-h-[600px] overflow-y-auto relative rounded-xl border border-ui-border bg-surface">
            {formMode === 'IDLE' ? (
              <div className="flex items-center justify-center h-full border border-dashed border-ui-border rounded-xl bg-surface-subtle text-content-muted p-6 text-center m-4">
                <p className="text-[15px]">
                  Selecione um lançamento na lista ao lado para editar seus detalhes ou clique em{' '}
                  <strong>+</strong> para criar um novo.
                </p>
              </div>
            ) : (
              <div className="relative p-2">
                <button
                  onClick={closeForm}
                  className="absolute top-6 right-6 z-20 p-1.5 bg-surface-subtle rounded-full text-content-muted hover:text-content hover:bg-ui-border transition-colors shadow-sm"
                  title="Fechar Formulário"
                >
                  <X size={18} />
                </button>

                <DynamicFormManager
                  key={`${formMode}-${selectedId}`}
                  resource="financial-transaction"
                  title="Lançamento"
                  basePath=""
                  mode={formMode === 'CREATE' ? 'create' : 'edit'}
                  id={selectedId ?? undefined}
                  steps={formSteps}
                  transformData={transformDataForLoad}
                  transformResponse={transformPayloadForSave}
                  onSubmitSuccess={() => {
                    showMessage(`Lançamento ${formMode === 'CREATE' ? 'criado' : 'atualizado'} com sucesso!`, 'success');
                    closeForm();
                  }}
                />
              </div>
            )}
          </div>

        </div>
      </div>
    </Section>
  );
}
