/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import DynamicForm from '@/components/DynamicFormManager';
import { FormFieldDef } from '@/types/types';
import { useParams } from 'next/navigation';

export default function EditarCentroPage() {
  const params = useParams();
  const id = params.id as string;

  const fields: FormFieldDef[] = [
    {
      field: 'name',
      label: 'Nome do Centro',
      type: 'text',
      required: true,
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
      resource="financial-center"
      title="Centro"
      basePath="/dashboard/centros"
      mode="edit"
      id={id}
      fields={fields}
      transformData={transformData}
      transformResponse={transformPayload}
    />
  );
}