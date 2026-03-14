/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import DynamicForm from "@/components/DynamicFormManager";
import { FormFieldDef } from "@/types/types";

export default function CadastrarCartaoPage() {
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
      type: 'text', // <-- ALTERADO PARA TEXT
      mask: 'money', // <-- ADICIONADA A MÁSCARA
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

  const transformPayload = (data: any) => {
    let parsedLimit = null;
    
    if (data.limit !== undefined && data.limit !== null && data.limit !== '') {
      // Remove "R$", espaços e pontos. Troca a vírgula por ponto.
      // Exemplo: "R$ 1.500,50" vira "1500.50"
      const cleanValue = String(data.limit).replace(/[^\d,-]/g, '').replace(',', '.');
      parsedLimit = parseFloat(cleanValue);
      
      // Se por algum motivo ainda falhar, previne o envio de NaN
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
      mode="create"
      fields={fields}
      transformResponse={transformPayload}
    />
  );
}