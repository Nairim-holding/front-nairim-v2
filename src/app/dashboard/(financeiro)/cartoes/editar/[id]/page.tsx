/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import DynamicForm from '@/components/DynamicFormManager';
import { FormFieldDef } from '@/types/types';
import { useParams } from 'next/navigation';

export default function EditarCartaoPage() {
  const params = useParams();
  const id = params.id as string;

  const fields: FormFieldDef[] = [
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
      required: false,
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
    }
  ];

  const transformData = (apiResponse: any) => {
    const cardData = apiResponse.data || apiResponse;
    
    let displayLimit = '';
    if (cardData.limit !== null && cardData.limit !== undefined) {
      // CORREÇÃO AQUI: Forçamos 2 casas decimais. 
      // O 900 vira "900.00". A máscara lê os dígitos "90000" e formata como "900,00".
      displayLimit = Number(cardData.limit).toFixed(2);
    }

    return {
      name: cardData.name || '',
      limit: displayLimit,
      is_active: cardData.is_active === false ? 'false' : 'true',
    };
  };

  const transformPayload = (data: any) => {
    let parsedLimit = null;
    
    // Função para limpar o valor monetário ('1.500,00' -> 1500.00)
    if (data.limit !== undefined && data.limit !== null && data.limit !== '') {
      const cleanValue = String(data.limit).replace(/[^\d,-]/g, '').replace(',', '.');
      parsedLimit = parseFloat(cleanValue);
      if (isNaN(parsedLimit)) parsedLimit = 0; 
    }

    return {
      ...data,
      limit: parsedLimit,
      is_active: data.is_active === 'true' || data.is_active === true
    };
  };

  return (
    <DynamicForm
      resource="financial-card"
      title="Cartão"
      basePath="/dashboard/cartoes"
      mode="edit"
      id={id}
      fields={fields}
      transformData={transformData}
      transformResponse={transformPayload}
    />
  );
}