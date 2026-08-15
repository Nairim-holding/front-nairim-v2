/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { useMessageContext } from '@/contexts/MessageContext';
import { useRouter } from 'next/navigation';
import DynamicFormManager from '@/components/form/DynamicForm';
import { FormStep } from '@/types/types';
import { updatePropertyTypeAction, getPropertyTypeByIdAction } from '@/server/actions/property-type';
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

      const result = await updatePropertyTypeAction(id, formattedData);

      if (!result.ok) {
        if (result.status === 409) {
          throw new Error('Tipo de imóvel já existe');
        }
        throw new Error(result.error || `Erro ${result.status}`);
      }

      return result;

    } catch (error: any) {
      console.error('❌ Erro na edição:', error);
      throw new Error(`Erro ao atualizar tipo de imóvel: ${error.message}`);
    }
  };

  // Transformar dados da API para o formulário.
  // `useCallback` é obrigatório aqui: está nas dependências do useEffect de
  // fetch do DynamicForm — sem memoizar, uma função nova a cada render
  // (disparado por showMessage/setLoading) reexecutava o fetch em loop,
  // inclusive durante a navegação pós-submit, empilhando toasts de erro.
  const transformData = useCallback((apiData: any) => {
    if (!apiData) return {};
    const data = apiData.data || apiData;
    return {
      description: data.description || '',
    };
  }, []);

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
      fetchResource={getPropertyTypeByIdAction}
      onSubmit={handleSubmit}
      onSubmitSuccess={onSubmitSuccess}
      transformData={transformData}
    />
  );
}