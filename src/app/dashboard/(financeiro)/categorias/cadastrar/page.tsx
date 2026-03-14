/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import DynamicForm from "@/components/DynamicFormManager";
import { FormFieldDef } from "@/types/types";

export default function CadastrarCategoriaPage() {
  const fields: FormFieldDef[] = [
    {
      field: 'name', label: 'Nome da Categoria', type: 'text', required: true,
      placeholder: 'Ex: Manutenção do Imóvel',
    },
    {
      field: 'type', label: 'Tipo da Categoria', type: 'select', required: true,
      options: [
        { label: 'Despesa (Expense)', value: 'EXPENSE' },
        { label: 'Receita (Income)', value: 'INCOME' },
      ],
    },
    {
      field: 'is_active', label: 'Status', type: 'select', required: true,
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
      resource="financial-category" // Endpoint corrigido
      title="Categoria"
      basePath="/dashboard/categorias"
      mode="create"
      fields={fields}
      transformResponse={transformPayload}
    />
  );
}