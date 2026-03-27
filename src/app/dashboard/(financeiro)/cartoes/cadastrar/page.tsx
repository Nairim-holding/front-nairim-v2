'use client';

import type { FormFieldDef } from '@/types/types';
import DynamicForm from '@/components/form/DynamicForm';

const FIELDS: FormFieldDef[] = [
  {
    field: 'name',
    label: 'Nome do Cartão',
    type: 'text',
    required: true,
    placeholder: 'Ex: Cartão Corporativo Visa',
  },
  {
    field: 'limit',
    label: 'Limite do Cartão',
    type: 'text',
    mask: 'money',
    placeholder: 'R$ 0,00',
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
const transformPayload = (data: any) => {
  let parsedLimit: number | null = null;
  if (data.limit) {
    const clean = String(data.limit).replace(/[^\d,-]/g, '').replace(',', '.');
    const parsed = parseFloat(clean);
    parsedLimit = isNaN(parsed) ? null : parsed;
  }
  return {
    ...data,
    limit: parsedLimit,
    is_active: data.is_active === 'true' || data.is_active === true,
  };
};

export default function CadastrarCartaoPage() {
  return (
    <DynamicForm
      resource="financial-card"
      title="Cartão"
      basePath="/dashboard/cartoes"
      mode="create"
      fields={FIELDS}
      transformResponse={transformPayload}
    />
  );
}
