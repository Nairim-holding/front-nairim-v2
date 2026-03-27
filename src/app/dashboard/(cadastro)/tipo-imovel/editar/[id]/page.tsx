/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useParams } from 'next/navigation';
import { useMemo } from 'react';
import { useMessageContext } from '@/contexts/MessageContext';
import { useRouter } from 'next/navigation';
import DynamicFormManager from '@/components/form/DynamicForm';
import { FormStep } from '@/types/types';
import { Home, Tag } from 'lucide-react';

export default function EditarTipoImovelPage() {
  const params = useParams();
  const id = params.id as string;
  
  const { showMessage } = useMessageContext();
  const router = useRouter();

  // Handler para submit (edit)
  const handleSubmit = async (data: any) => {
    try {
      console.log('✏️ Atualizando tipo de imóvel...', data);
      
      // Formatar os dados para o endpoint
      const formattedData = {
        description: data.description,
      };

      console.log('📊 Dados formatados para edição:', formattedData);

      const API_URL = process.env.NEXT_PUBLIC_URL_API;
      const response = await fetch(`${API_URL}/property-types/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formattedData),
      });

      const responseText = await response.text();
      console.log('📥 Resposta da edição:', response.status, responseText);

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        throw new Error('Resposta inválida do servidor');
      }

      if (!response.ok) {
        if (response.status === 409) {
          throw new Error('Tipo de imóvel já existe');
        }
        throw new Error(result.message || `Erro ${response.status}`);
      }

      return result;

    } catch (error: any) {
      console.error('❌ Erro na edição:', error);
      throw new Error(`Erro ao atualizar tipo de imóvel: ${error.message}`);
    }
  };

  // Transformar dados da API para o formulário (CORRIGIDO)
  const transformData = (apiData: any) => {
    console.log('🔄 Transformando dados da API (tipo de imóvel):', apiData);
    
    if (!apiData) return {};
    
    // A API retorna o objeto diretamente, não tem "data.data"
    const data = apiData.data || apiData;
    
    return {
      description: data.description || '',
    };
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
            maxLength: 100,
          },
          maxLength: 50,
          className: 'col-span-full',
        },
      ],
    },
  ], []);

  const onSubmitSuccess = (data: any) => {
    showMessage('Tipo de imóvel atualizado com sucesso!', 'success');
    router.push('/dashboard/tipo-imovel');
  };

  return (
    <DynamicFormManager
      resource="property-types"
      title="Tipo de Imóvel"
      basePath="/dashboard/tipo-imovel"
      mode="edit"
      id={id}
      steps={steps}
      onSubmit={handleSubmit}
      onSubmitSuccess={onSubmitSuccess}
      transformData={transformData}
    />
  );
}