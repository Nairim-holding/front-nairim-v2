/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useMemo } from 'react';
import { useMessageContext } from '@/contexts/MessageContext';
import { useRouter } from 'next/navigation';
import DynamicFormManager from '@/components/form/DynamicForm';
import { FormStep } from '@/types/types';
import { createPropertyTypeAction } from '@/server/actions/property-type';
import { Home, FileText, Tag } from 'lucide-react';

export default function CadastrarTipoImovelPage() {
  const { showMessage } = useMessageContext();
  const router = useRouter();

  // Handler para submit (create)
  const handleSubmit = async (data: any) => {
    try {
      console.log('📤 Enviando dados do tipo de imóvel...', data);
      
      // Formatar os dados para o endpoint
      const formattedData = {
        description: data.description,
      };

      console.log('📊 Dados formatados:', formattedData);

      const result = await createPropertyTypeAction(formattedData);

      if (!result.ok) {
        if (result.status === 409) {
          throw new Error('Tipo de imóvel já existe');
        }
        throw new Error(result.error || `Erro ${result.status}`);
      }

      return result;

    } catch (error: any) {
      console.error('❌ Erro no submit:', error);
      throw new Error(`Erro ao salvar tipo de imóvel: ${error.message}`);
    }
  };

  // Não há transformação de dados para criação
  const transformData = (apiData: any) => {
    // Não usado no create, mas necessário para o componente
    return apiData;
  };

  const steps: FormStep[] = useMemo(() => [
    {
      title: 'Dados do Tipo de Imóvel',
      icon: <Home size={20} />,
      fields: [
        {
          field: 'description',
          label: 'Descrição',
          type: 'textarea',
          required: true,
          placeholder: 'Ex: Apartamento, Casa, Terreno, etc.',
          autoFocus: true,
          icon: <Tag size={20} />,
          validation: {
            minLength: 3,
            maxLength: 50,
          },
          maxLength: 50,
          className: 'col-span-full',
        },
      ],
    },
  ], []);

  const onSubmitSuccess = (data: any) => {
    showMessage('Tipo de imóvel criado com sucesso!', 'success');
    router.push('/dashboard/tipo-imovel');
  };

  return (
    <DynamicFormManager
      resource="property-type"
      title="Tipo de Imóvel"
      basePath="/dashboard/tipo-imovel"
      mode="create"
      draftKey="form:property-type:create"
      steps={steps}
      onSubmit={handleSubmit}
      onSubmitSuccess={onSubmitSuccess}
      transformData={transformData}
    />
  );
}