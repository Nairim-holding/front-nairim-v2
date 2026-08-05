'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Section from '@/components/layout/PageSection';
import { Plus, Trash2, Edit2, X, Search, CreditCard } from 'lucide-react';
import { useMessageContext } from '@/contexts/MessageContext';
import { usePopupContext } from '@/contexts/PopupContext';
import DynamicFormManager from '@/components/form/DynamicForm';
import Toggle from '@/components/ui/Toggle';
import { maskMoney } from '@/utils/masks';
import type { FormStep } from '@/types/types';

// ─── Constantes ──────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_URL_API ?? '';

type FormMode = 'IDLE' | 'CREATE' | 'EDIT';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const normalizeText = (text: string) =>
  text ? text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() : '';

// `val` chega como number no formulário, mas a API retorna o Decimal do Prisma
// serializado como STRING (ex.: "7000", sem casas decimais para valores
// inteiros). Sem o Number(...), maskMoney tratava a string como um buffer de
// dígitos digitados (últimos 2 = centavos) e "7000" virava R$ 70,00.
const formatCurrency = (val: number | string | null | undefined): string => {
  const numeric = val == null ? 0 : Number(val);
  return val == null || numeric === 0 ? '---' : maskMoney(numeric);
};

const formatLimit = (val: number | string | null | undefined): string =>
  val == null ? 'Sem limite' : formatCurrency(val);

const parseMoneyCents = (value: string): number | null => {
  if (!value) return null;
  const clean = String(value).replace(/[^\d,-]/g, '').replace(',', '.');
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? null : parsed;
};

// ─── Transformações do formulário ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const transformDataForLoad = (apiResponse: any) => {
  const data = apiResponse.data ?? apiResponse;
  if (!data) return {};
  return {
    name: data.name ?? '',
    limit: data.limit != null ? formatCurrency(Number(data.limit)) : '',
    closing_day: data.closing_day ?? '',
    due_day: data.due_day ?? '',
    is_active: data.is_active !== false && String(data.is_active) !== 'false',
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const transformPayloadForSave = (data: any) => ({
  name: data.name,
  limit: parseMoneyCents(data.limit),
  closing_day: data.closing_day ? Number(data.closing_day) : undefined,
  due_day: data.due_day ? Number(data.due_day) : undefined,
  is_active: data.is_active !== false && String(data.is_active) !== 'false',
});

// ─── Definição de steps (fora do componente — estável, sem deps) ─────────────

const FORM_STEPS: FormStep[] = [
  {
    title: 'Dados do Cartão',
    icon: <CreditCard size={20} />,
    fields: [
      { field: 'name',        label: 'Nome do Cartão',     type: 'text',   required: true, autoFocus: true, className: 'col-span-full' },
      { field: 'limit',       label: 'Limite de Crédito',  type: 'text',   mask: 'money',  placeholder: 'R$ 0,00' },
      { field: 'closing_day', label: 'Dia de Fechamento',  type: 'number', required: true, placeholder: 'Ex: 1 a 31' },
      { field: 'due_day',     label: 'Dia de Vencimento',  type: 'number', required: true, placeholder: 'Ex: 1 a 31' },
      {
        field: 'is_active',
        label: 'Status',
        type: 'custom',
        defaultValue: true,
        className: 'col-span-full',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        render: (value: any, _: any, onChange: any) => {
          const isChecked = value !== false && String(value) !== 'false';
          return (
            <div className="mt-2">
              <input type="hidden" name="is_active" value={String(isChecked)} />
              <Toggle
                checked={isChecked}
                onChange={(val) => onChange(Boolean(val))}
                label={isChecked ? 'Ativo' : 'Inativo'}
              />
            </div>
          );
        },
      },
    ],
  },
];

// ─── Componente ──────────────────────────────────────────────────────────────

export default function CartoesPage() {
  const { showMessage } = useMessageContext();
  const { showPopup } = usePopupContext();

  const [isLoading, setIsLoading] = useState(true);
  const [cards, setCards] = useState<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [search, setSearch] = useState('');
  const [formMode, setFormMode] = useState<FormMode>('IDLE');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ─── Data fetching ──────────────────────────────────────────────────────────

  const fetchCards = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/financial-card?limit=1000`);
      if (!res.ok) throw new Error('Erro ao carregar os cartões.');
      const data = await res.json();
      setCards(data?.data ?? data ?? []);
    } catch {
      showMessage('Erro ao carregar os cartões.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showMessage]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  // ─── Computed values ────────────────────────────────────────────────────────

  const displayedCards = useMemo(() => {
    const term = normalizeText(search);
    return cards
      .filter((c) => !c.deleted_at)
      .filter((c) => normalizeText(c.name).includes(term))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [cards, search]);

  // ─── Actions ────────────────────────────────────────────────────────────────

  const openForm = (mode: FormMode, id: string | null = null) => {
    setSelectedId(id);
    setFormMode(mode);
  };

  const closeForm = useCallback(() => {
    setFormMode('IDLE');
    setSelectedId(null);
    fetchCards();
  }, [fetchCards]);

  const handleDelete = useCallback(
    (id: string, name: string) => {
      showPopup(
        'Excluir Cartão',
        `Tem certeza que deseja excluir o cartão "${name}"?`,
        async () => {
          try {
            const res = await fetch(`${API_URL}/financial-card/${id}`, { method: 'DELETE' });
            if (!res.ok) {
              const result = await res.json().catch(() => ({}));
              throw new Error(result.message ?? 'Erro ao excluir Cartão.');
            }
            showMessage('Excluído com sucesso!', 'success');
            if (selectedId === id) closeForm();
            await fetchCards();
          } catch (err) {
            showMessage(err instanceof Error ? err.message : 'Erro ao excluir.', 'error');
          }
        },
        () => {},
      );
    },
    [showPopup, showMessage, selectedId, closeForm, fetchCards],
  );

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <Section title="Gerenciar Cartões">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
        </div>
      </Section>
    );
  }

  return (
    <Section title="Gerenciar Cartões">
      <div className="bg-surface p-6 rounded-xl shadow-sm border border-ui-border w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Lista de cartões */}
          <div className="lg:col-span-1 flex flex-col border border-ui-border rounded-xl bg-surface-subtle overflow-hidden h-[calc(100vh-180px)] min-h-[600px]">
            <div className="bg-surface p-3 border-b border-ui-border">
              <div className="flex justify-between items-center mb-3 px-1">
                <h3 className="font-bold text-content text-[15px]">Cartões</h3>
                <button
                  onClick={() => openForm('CREATE')}
                  className="p-1 hover:bg-brand/10 text-brand rounded-md transition-colors"
                  title="Novo Cartão"
                >
                  <Plus size={18} />
                </button>
              </div>

              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
                <input
                  type="text"
                  placeholder="Buscar por nome..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-[13px] bg-surface-subtle border border-ui-border rounded-lg outline-none focus:border-brand transition-colors"
                />
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-2">
              {displayedCards.length === 0 ? (
                <p className="text-[13px] text-content-muted text-center mt-10">Nenhum cartão encontrado.</p>
              ) : (
                displayedCards.map((card) => (
                  <div
                    key={card.id}
                    onClick={() => openForm('EDIT', card.id)}
                    className={`group flex justify-between items-center px-3 py-2.5 cursor-pointer rounded-lg mb-1 transition-colors ${
                      selectedId === card.id
                        ? 'bg-brand/10 text-brand border border-brand/20'
                        : 'hover:bg-ui-border-soft text-content-secondary border border-transparent'
                    }`}
                  >
                    <div className="flex flex-col overflow-hidden w-full">
                      <span className={`truncate text-[14px] font-medium ${card.is_active === false ? 'opacity-60 line-through text-content-muted' : ''}`}>
                        {card.name}
                      </span>
                      <span className="text-[11px] text-content-muted mt-0.5">
                        Limite: {formatLimit(card.limit)}
                      </span>
                      {(card.closing_day || card.due_day) && (
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {card.closing_day && (
                            <span className="text-[10px] font-medium bg-surface border border-ui-border px-1.5 py-0.5 rounded text-content-secondary">
                              Fechamento: Dia {card.closing_day}
                            </span>
                          )}
                          {card.due_day && (
                            <span className="text-[10px] font-medium bg-surface border border-ui-border px-1.5 py-0.5 rounded text-content-secondary">
                              Vencimento: Dia {card.due_day}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className={`flex items-center gap-1 flex-shrink-0 ml-2 transition-opacity ${selectedId === card.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                      <button
                        onClick={(e) => { e.stopPropagation(); openForm('EDIT', card.id); }}
                        className="p-1 hover:bg-brand/20 rounded text-brand"
                        title="Editar"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(card.id, card.name); }}
                        className="p-1 hover:bg-red-100 rounded text-state-error"
                        title="Excluir"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Formulário (ocupa 2/3 da tela) */}
          <div className="lg:col-span-2 flex flex-col h-[calc(100vh-180px)] min-h-[600px] overflow-y-auto relative rounded-xl border border-ui-border bg-surface">
            {formMode === 'IDLE' ? (
              <div className="flex items-center justify-center h-full border border-dashed border-ui-border rounded-xl bg-surface-subtle text-content-muted p-6 text-center m-4">
                <p className="text-[15px]">
                  Selecione um cartão na lista ao lado para editar seus detalhes ou clique em{' '}
                  <strong>+</strong> para cadastrar um novo.
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
                  resource="financial-card"
                  title="Cartão"
                  basePath=""
                  mode={formMode === 'CREATE' ? 'create' : 'edit'}
                  id={selectedId ?? undefined}
                  draftKey={formMode === 'CREATE' ? 'form:financial-card:create' : undefined}
                  steps={FORM_STEPS}
                  transformData={transformDataForLoad}
                  transformResponse={transformPayloadForSave}
                  onSubmitSuccess={() => {
                    showMessage(`Cartão ${formMode === 'CREATE' ? 'criado' : 'atualizado'} com sucesso!`, 'success');
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
