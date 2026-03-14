/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import DynamicForm from '@/components/DynamicFormManager';
import { FormFieldDef } from '@/types/types';
import { useParams } from 'next/navigation';

export default function VisualizarCartaoPage() {
  const params = useParams();
  const id = params.id as string;

  const fields: FormFieldDef[] = [
    {
      field: 'name',
      label: 'Nome do Cartão',
      type: 'text',
      readOnly: true,
    },
    {
      field: 'limit',
      label: 'Limite',
      type: 'text', // Usamos text na visualização para podermos enviar o valor formatado
      readOnly: true,
    },
    {
      field: 'is_active',
      label: 'Status',
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
    const cardData = apiResponse.data || apiResponse;
    
    // Formatação do limite para moeda brasileira na visualização
    const formattedLimit = cardData.limit 
      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(cardData.limit)) 
      : 'Sem limite';

    return {
      name: cardData.name || '',
      limit: formattedLimit,
      is_active: cardData.is_active ? 'Ativo' : 'Inativo',
      created_at: cardData.created_at ? cardData.created_at.split('T')[0] : '',
      updated_at: cardData.updated_at ? cardData.updated_at.split('T')[0] : '',
    };
  };

  return (
    <DynamicForm
      resource="financial-card"
      title="Cartão"
      basePath="/dashboard/cartoes"
      mode="view"
      id={id}
      fields={fields}
      transformData={transformData}
    />
  );
}