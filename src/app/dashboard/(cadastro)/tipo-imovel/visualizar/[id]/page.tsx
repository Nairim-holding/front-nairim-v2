/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import DynamicFormManager from '@/components/form/DynamicForm';
import { FormStep } from '@/types/types';
import { Home, Tag, Calendar, Clock } from 'lucide-react';
import { getPropertyTypeByIdAction } from '@/server/actions/property-type';

export default function VisualizarTipoImovelPage() {
  const params = useParams();
  const id = params.id as string;

  // `useCallback`: está nas dependências do useEffect de fetch do
  // DynamicForm — sem memoizar, disparava refetch em loop a cada render.
  const transformData = useCallback((apiData: any) => {
    if (!apiData) return {};
    const data = apiData.data || apiData;
    return {
      description: data.description || '',
      created_at: data.created_at || '',
      updated_at: data.updated_at || '',
    };
  }, []);

  const steps: FormStep[] = useMemo(() => [
    {
      title: 'Informações do Tipo de Imóvel',
      icon: <Home size={20} />,
      fields: [
        {
          field: 'description',
          label: 'Descrição',
          type: 'textarea',
          required: true,
          placeholder: 'Ex: Apartamento, Casa, Terreno, etc.',
          icon: <Tag size={20} />,
          className: 'col-span-full',
          readOnly: true,
        }
      ],
    },
  ], []);

  return (
    <DynamicFormManager
      resource="property-types"
      title="Tipo de Imóvel"
      basePath="/dashboard/tipo-imovel"
      mode="view"
      id={id}
      steps={steps}
      fetchResource={getPropertyTypeByIdAction}
      transformData={transformData}
    />
  );
}