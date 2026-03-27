'use client';

import type { FormFieldDef } from '@/types/types';
import DynamicForm from '@/components/form/DynamicForm';

const FIELDS: FormFieldDef[] = [
  {
    field: 'name',
    label: 'Nome da Categoria',
    type: 'text',
    required: true,
    placeholder: 'Ex: Manutenção do Imóvel',
  },
  {
    field: 'type',
    label: 'Tipo da Categoria',
    type: 'select',
    required: true,
    options: [
      { label: 'Despesa (Expense)', value: 'EXPENSE' },
      { label: 'Receita (Income)', value: 'INCOME' },
    ],
  },
  {
    field: 'is_active',
    label: 'Status',
    type: 'select',
    required: true,
    options: [
      { label: 'Ativo', value: 'true' },
      { label: 'Inativo', value: 'false' },
    ],
  },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const transformPayload = (data: any) => ({
  ...data,
  is_active: data.is_active === 'true' || data.is_active === true,
});

export default function CadastrarCategoriaPage() {
  return (
    <DynamicForm
      resource="financial-category"
      title="Categoria"
      basePath="/dashboard/categorias"
      mode="create"
      fields={FIELDS}
      transformResponse={transformPayload}
    />
  );
}
