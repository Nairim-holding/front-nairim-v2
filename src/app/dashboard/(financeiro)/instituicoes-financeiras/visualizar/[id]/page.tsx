/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import DynamicForm from '@/components/form/DynamicForm';
import { FormFieldDef } from '@/types/types';
import { useParams } from 'next/navigation';

export default function VisualizarInstituicaoPage() {
  const params = useParams();
  const id = params.id as string;

  const fields: FormFieldDef[] = [
    {
      field: 'name',
      label: 'Nome da Instituição',
      type: 'text',
      readOnly: true,
    },
    {
      field: 'created_at',
      label: 'Criado em',
      type: 'date',
      readOnly: true,
    },
    {
      field: 'updated_at',
      label: 'Atualizado em',
      type: 'date',
      readOnly: true,
    },
  ];

  const transformData = (apiResponse: any) => {
    const institutionData = apiResponse.data || apiResponse;
    return {
      id: institutionData.id || '',
      name: institutionData.name || '',
      created_at: institutionData.created_at ? institutionData.created_at.split('T')[0] : '',
      updated_at: institutionData.updated_at ? institutionData.updated_at.split('T')[0] : '',
    };
  };

  return (
    <DynamicForm
      resource="financial-institution"
      title="Instituição Financeira"
      basePath="/dashboard/instituicoes-financeiras"
      mode="view"
      id={id}
      fields={fields}
      transformData={transformData}
    />
  );
}