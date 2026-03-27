'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { FormFieldDef } from '@/types/types';
import DynamicForm from '@/components/form/DynamicForm';

const API_URL = process.env.NEXT_PUBLIC_URL_API ?? '';

type SelectOption = { label: string; value: string };
type SubcategoryOption = { label: string; value: string; categoryId: string };

interface FormOptions {
  categories: SelectOption[];
  institutions: SelectOption[];
  cards: SelectOption[];
  centers: SelectOption[];
  subcategories: SubcategoryOption[];
}

const EMPTY_OPTIONS: FormOptions = {
  categories: [],
  institutions: [],
  cards: [],
  centers: [],
  subcategories: [],
};

const STATUS_OPTIONS: SelectOption[] = [
  { label: 'Pendente', value: 'PENDING' },
  { label: 'Concluído', value: 'COMPLETED' },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapToOptions = (res: any): SelectOption[] =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (res?.data ?? res ?? []).map((i: any) => ({ label: i.name, value: i.id }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapToTypeOptions = (res: any): SelectOption[] =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (res?.data ?? res ?? []).map((i: any) => ({
    label: `${i.name} (${i.type === 'INCOME' ? 'Receita' : 'Despesa'})`,
    value: i.id,
  }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const transformPayload = (data: any) => {
  let parsedAmount = 0;
  if (data.amount) {
    const clean = String(data.amount).replace(/[^\d,-]/g, '').replace(',', '.');
    const parsed = parseFloat(clean);
    parsedAmount = isNaN(parsed) ? 0 : parsed;
  }

  const { subcategories_info: _void, ...apiData } = data;

  return {
    ...apiData,
    amount: parsedAmount,
    event_date: new Date().toISOString().split('T')[0],
    subcategory_id: null,
    card_id: data.card_id || null,
    center_id: data.center_id || null,
  };
};

export default function CadastrarLancamentoPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [options, setOptions] = useState<FormOptions>(EMPTY_OPTIONS);

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        subcategories: (subs?.data ?? subs ?? []).map((i: any) => ({
          label: i.name,
          value: i.id,
          categoryId: i.category_id,
        })),
      });
    } catch (err) {
      console.error('Erro ao carregar opções:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  const fields: FormFieldDef[] = useMemo(() => [
    {
      field: 'event_date',
      label: 'Data do Evento',
      type: 'date',
      required: true,
      defaultValue: new Date().toISOString().split('T')[0],
      readOnly: true,
      disabled: true,
    },
    { field: 'effective_date', label: 'Data de Efetivação', type: 'date', required: true },
    { field: 'category_id', label: 'Categoria', type: 'select', required: true, options: options.categories },
    {
      field: 'subcategories_info',
      label: '',
      type: 'custom',
      className: 'col-span-full',
      hidden: (fv) => !fv?.category_id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      render: (_: any, fv: any) => {
        if (!fv?.category_id) return null;
        const filtered = options.subcategories.filter((sub) => sub.categoryId === fv.category_id);
        const text =
          filtered.length > 0
            ? filtered.map((sub) => sub.label).join(' • ')
            : 'Nenhuma subcategoria atrelada a esta categoria.';
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
    { field: 'financial_institution_id', label: 'Instituição Financeira', type: 'select', required: true, options: options.institutions },
    { field: 'card_id', label: 'Cartões', type: 'select', required: false, options: options.cards },
    { field: 'center_id', label: 'Centro', type: 'select', required: false, options: options.centers },
    { field: 'description', label: 'Descrição', type: 'text', required: true, placeholder: 'Ex: Pagamento de Aluguel', className: 'col-span-full' },
    { field: 'amount', label: 'Valor', type: 'text', mask: 'money', required: true, placeholder: 'R$ 0,00' },
    { field: 'status', label: 'Status', type: 'select', required: true, options: STATUS_OPTIONS },
  ], [options]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
      </div>
    );
  }

  return (
    <DynamicForm
      resource="financial-transaction"
      title="Lançamento"
      basePath="/dashboard/lancamentos"
      mode="create"
      fields={fields}
      transformResponse={transformPayload}
    />
  );
}
