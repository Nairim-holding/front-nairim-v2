/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import DynamicForm from '@/components/DynamicFormManager';
import { FormFieldDef } from '@/types/types';
import { useParams } from 'next/navigation';

export default function EditarInstituicaoPage() {
  const params = useParams();
  const id = params.id as string;

  const fields: FormFieldDef[] = [
    {
      field: 'name',
      label: 'Nome da Instituição',
      type: 'text',
      required: true,
      placeholder: 'Ex: Banco do Brasil, Itaú, Nubank',
    }
  ];

  const transformData = (apiResponse: any) => {
    const institutionData = apiResponse.data || apiResponse;
    return {
      name: institutionData.name || '',
    };
  };

  return (
    <DynamicForm
      resource="financial-institution"
      title="Instituição Financeira"
      basePath="/dashboard/instituicoes-financeiras"
      mode="edit"
      id={id}
      fields={fields}
      transformData={transformData}
    />
  );
}