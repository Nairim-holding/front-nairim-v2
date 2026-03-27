/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import DynamicForm from '@/components/form/DynamicForm';
import { FormFieldDef } from '@/types/types';
import { useParams } from 'next/navigation';

export default function VisualizarSubcategoriaPage() {
  const params = useParams();
  const id = params.id as string;

  const fields: FormFieldDef[] = [
    { field: 'name', label: 'Nome da Subcategoria', type: 'text', readOnly: true },
    { field: 'category_name', label: 'Categoria Pai', type: 'text', readOnly: true },
    { field: 'is_active', label: 'Status', type: 'text', readOnly: true },
    { field: 'created_at', label: 'Criado em', type: 'date', readOnly: true },
    { field: 'updated_at', label: 'Atualizado em', type: 'date', readOnly: true },
  ];

  const transformData = (apiResponse: any) => {
    const data = apiResponse.data || apiResponse;
    
    // Extrai o nome da categoria pai que vem na resposta da API
    const categoryName = data.category ? data.category.name : 'Não informada';

    return {
      name: data.name || '',
      category_name: categoryName,
      is_active: data.is_active ? 'Ativo' : 'Inativo',
      created_at: data.created_at ? data.created_at.split('T')[0] : '',
      updated_at: data.updated_at ? data.updated_at.split('T')[0] : '',
    };
  };

  return (
    <DynamicForm
      resource="financial-subcategory"
      title="Subcategoria"
      basePath="/dashboard/categorias" // Retorna para a tela de Tabs ao fechar
      mode="view"
      id={id}
      fields={fields}
      transformData={transformData}
    />
  );
}