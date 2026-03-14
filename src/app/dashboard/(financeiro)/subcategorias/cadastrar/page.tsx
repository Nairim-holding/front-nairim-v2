/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from "react";
import DynamicForm from "@/components/DynamicFormManager";
import { FormFieldDef } from "@/types/types";

export default function CadastrarSubcategoriaPage() {
  const [categoryOptions, setCategoryOptions] = useState<{label: string, value: string}[]>([]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        // Fetch corrigido para o novo endpoint de categorias
        const res = await fetch(`${process.env.NEXT_PUBLIC_URL_API}/financial-category?limit=100&filter[is_active]=true`);
        const data = await res.json();
        const items = data.data || data;
        
        if (Array.isArray(items)) {
          setCategoryOptions(items.map((c: any) => ({
            label: `${c.name} (${c.type === 'INCOME' ? 'Receita' : 'Despesa'})`,
            value: c.id
          })));
        }
      } catch (error) {
        console.error("Erro ao buscar categorias:", error);
      }
    };
    fetchCategories();
  }, []);

  const fields: FormFieldDef[] = [
    {
      field: 'name', label: 'Nome da Subcategoria', type: 'text', required: true,
      placeholder: 'Ex: Pintura Externa',
    },
    {
      field: 'category_id', label: 'Categoria Pai', type: 'select', required: true,
      options: categoryOptions.length > 0 ? categoryOptions : [{ label: 'Carregando...', value: '' }],
    },
    {
      field: 'is_active', label: 'Status', type: 'select', required: true,
      options: [
        { label: 'Ativo', value: 'true' },
        { label: 'Inativo', value: 'false' },
      ],
    }
  ];

  const transformPayload = (data: any) => ({
    ...data,
    is_active: data.is_active === 'true' || data.is_active === true
  });

  return (
    <DynamicForm
      resource="financial-subcategory" // Endpoint corrigido
      title="Subcategoria"
      basePath="/dashboard/categorias" // Retorna para a tela de Tabs
      mode="create"
      fields={fields}
      transformResponse={transformPayload}
    />
  );
}