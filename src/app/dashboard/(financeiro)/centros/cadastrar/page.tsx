/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import DynamicForm from "@/components/DynamicFormManager";
import { FormFieldDef } from "@/types/types";

export default function CadastrarCentroPage() {
  const fields: FormFieldDef[] = [
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
    }
  ];

  const transformPayload = (data: any) => ({
    ...data,
    is_active: data.is_active === 'true' || data.is_active === true
  });

  return (
    <DynamicForm
      resource="financial-center"
      title="Centro"
      basePath="/dashboard/centros"
      mode="create"
      fields={fields}
      transformResponse={transformPayload}
    />
  );
}