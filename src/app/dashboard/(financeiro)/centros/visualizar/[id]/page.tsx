/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import DynamicForm from '@/components/form/DynamicForm';
import { FormFieldDef } from '@/types/types';
import { useParams } from 'next/navigation';

export default function VisualizarCentroPage() {
  const params = useParams();
  const id = params.id as string;

  const fields: FormFieldDef[] = [
    { field: 'name', label: 'Nome do Centro', type: 'text', readOnly: true },
    { field: 'type', label: 'Tipo', type: 'text', readOnly: true },
    { field: 'is_active', label: 'Status', type: 'text', readOnly: true },
    { field: 'created_at', label: 'Criado em', type: 'date', readOnly: true },
    { field: 'updated_at', label: 'Atualizado em', type: 'date', readOnly: true },
  ];

  const transformData = (apiResponse: any) => {
    const data = apiResponse.data || apiResponse;
    return {
      name: data.name || '',
      type: data.type === 'INCOME' ? 'Receita (Income)' : 'Despesa (Expense)',
      is_active: data.is_active ? 'Ativo' : 'Inativo',
      created_at: data.created_at ? data.created_at.split('T')[0] : '',
      updated_at: data.updated_at ? data.updated_at.split('T')[0] : '',
    };
  };

  return (
    <DynamicForm
      resource="financial-center"
      title="Centro"
      basePath="/dashboard/centros"
      mode="view"
      id={id}
      fields={fields}
      transformData={transformData}
    />
  );
}