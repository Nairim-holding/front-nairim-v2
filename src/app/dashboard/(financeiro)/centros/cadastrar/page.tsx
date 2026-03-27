'use client';
import type { FormFieldDef } from '@/types/types';
import DynamicForm from '@/components/form/DynamicForm';

const FIELDS: FormFieldDef[] = [
  {
    field: 'name',
    label: 'Nome do Centro',
    type: 'text',
    required: true,
    placeholder: 'Ex: Sede Administrativa',
  },
  {
    field: 'type',
    label: 'Tipo de Centro',
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

export default function CadastrarCentroPage() {
  return (
    <DynamicForm
      resource="financial-center"
      title="Centro"
      basePath="/dashboard/centros"
      mode="create"
      fields={FIELDS}
      transformResponse={transformPayload}
    />
  );
}
