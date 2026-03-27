/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import DynamicForm from '@/components/form/DynamicForm';
import { FormFieldDef } from '@/types/types';
import { useParams } from 'next/navigation';

export default function EditarCategoriaPage() {
  const params = useParams();
  const id = params.id as string;

  const fields: FormFieldDef[] = [
    { field: 'name', label: 'Nome da Categoria', type: 'text', required: true },
    {
      field: 'type', label: 'Tipo da Categoria', type: 'select', required: true,
      options: [
        { label: 'Despesa (Expense)', value: 'EXPENSE' },
        { label: 'Receita (Income)', value: 'INCOME' },
      ],
    },
    {
      field: 'is_active', label: 'Status', type: 'select', required: true,
      options: [{ label: 'Ativo', value: 'true' }, { label: 'Inativo', value: 'false' }],
    }
  ];

  const transformData = (apiResponse: any) => {
    const data = apiResponse.data || apiResponse;
    return {
      name: data.name || '',
      type: data.type || 'EXPENSE',
      is_active: data.is_active === false ? 'false' : 'true',
    };
  };

  const transformPayload = (data: any) => ({
    ...data,
    is_active: data.is_active === 'true' || data.is_active === true
  });

  return (
    <DynamicForm
      resource="financial-category" // Endpoint corrigido
      title="Categoria"
      basePath="/dashboard/categorias"
      mode="edit"
      id={id}
      fields={fields}
      transformData={transformData}
      transformResponse={transformPayload}
    />
  );
}