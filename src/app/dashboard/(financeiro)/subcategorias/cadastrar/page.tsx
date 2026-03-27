'use client';

import { useState, useEffect, useCallback } from 'react';
import type { FormFieldDef } from '@/types/types';
import DynamicForm from '@/components/form/DynamicForm';

const API_URL = process.env.NEXT_PUBLIC_URL_API ?? '';

type SelectOption = { label: string; value: string };

const STATUS_OPTIONS: SelectOption[] = [
  { label: 'Ativo', value: 'true' },
  { label: 'Inativo', value: 'false' },
];

const LOADING_OPTION: SelectOption[] = [{ label: 'Carregando...', value: '' }];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const transformPayload = (data: any) => ({
  ...data,
  is_active: data.is_active === 'true' || data.is_active === true,
});

export default function CadastrarSubcategoriaPage() {
  const [categoryOptions, setCategoryOptions] = useState<SelectOption[]>([]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/financial-category?limit=100&filter[is_active]=true`);
      const data = await res.json();
      const items: any[] = data.data ?? data ?? []; // eslint-disable-line @typescript-eslint/no-explicit-any
      setCategoryOptions(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items.map((c: any) => ({
          label: `${c.name} (${c.type === 'INCOME' ? 'Receita' : 'Despesa'})`,
          value: c.id,
        })),
      );
    } catch (err) {
      console.error('Erro ao buscar categorias:', err);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const fields: FormFieldDef[] = [
    {
      field: 'name',
      label: 'Nome da Subcategoria',
      type: 'text',
      required: true,
      placeholder: 'Ex: Pintura Externa',
    },
    {
      field: 'category_id',
      label: 'Categoria Pai',
      type: 'select',
      required: true,
      options: categoryOptions.length > 0 ? categoryOptions : LOADING_OPTION,
    },
    {
      field: 'is_active',
      label: 'Status',
      type: 'select',
      required: true,
      options: STATUS_OPTIONS,
    },
  ];

  return (
    <DynamicForm
      resource="financial-subcategory"
      title="Subcategoria"
      basePath="/dashboard/categorias"
      mode="create"
      fields={fields}
      transformResponse={transformPayload}
    />
  );
}
