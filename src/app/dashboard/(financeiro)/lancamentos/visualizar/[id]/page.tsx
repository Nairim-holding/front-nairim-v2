/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import DynamicForm from '@/components/form/DynamicForm';
import { FormFieldDef } from '@/types/types';

export default function VisualizarLancamentoPage() {
  const params = useParams();
  const id = params.id as string;
  
  const [subcategoriasMap, setSubcategoriasMap] = useState<Record<string, string>>({});

  // Efeito rápido para buscar apenas as subcategorias atreladas e montar um dicionário 
  // para podermos mostrar na tela de visualização
  useEffect(() => {
    const fetchSubcategories = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_URL_API}/financial-subcategory?limit=1000`);
        const data = await res.json();
        const subs = data.data || data || [];
        
        // Agrupa os nomes das subcategorias pelo ID da categoria pai
        const map: Record<string, string[]> = {};
        subs.forEach((sub: any) => {
          if (!map[sub.category_id]) map[sub.category_id] = [];
          map[sub.category_id].push(sub.name);
        });

        // Transforma o array em uma string separada por vírgula
        const finalMap: Record<string, string> = {};
        for (const catId in map) {
          finalMap[catId] = map[catId].join(', ');
        }
        
        setSubcategoriasMap(finalMap);
      } catch (e) {
        console.error('Erro ao carregar subcategorias para visualização', e);
      }
    };
    
    fetchSubcategories();
  }, []);

  const fields: FormFieldDef[] = [
    { field: 'event_date', label: 'Data do Evento', type: 'date', readOnly: true },
    { field: 'effective_date', label: 'Data de Efetivação', type: 'date', readOnly: true },
    { field: 'category', label: 'Categoria', type: 'text', readOnly: true },
    { field: 'subcategory_list', label: 'Subcategorias Amarradas', type: 'text', readOnly: true },
    { field: 'financial_institution', label: 'Instituição Financeira', type: 'text', readOnly: true },
    { field: 'card', label: 'Cartão de Crédito', type: 'text', readOnly: true },
    { field: 'center', label: 'Centro', type: 'text', readOnly: true },
    { field: 'description', label: 'Descrição', type: 'text', readOnly: true, className: 'col-span-full' },
    { field: 'amount', label: 'Valor', type: 'text', readOnly: true },
    { field: 'status', label: 'Status', type: 'text', readOnly: true },
  ];

  const transformData = (apiResponse: any) => {
    const data = apiResponse.data || apiResponse;

    const formattedAmount = data.amount 
      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(data.amount)) 
      : 'R$ 0,00';

    // Pega o texto da subcategoria baseado no dicionário que carregámos acima
    const subsText = (data.category_id && subcategoriasMap[data.category_id]) 
      ? subcategoriasMap[data.category_id] 
      : 'Nenhuma subcategoria informada';

    return {
      description: data.description || '',
      amount: formattedAmount,
      status: data.status === 'COMPLETED' ? 'Concluído' : 'Pendente',
      event_date: data.event_date ? data.event_date.split('T')[0] : '',
      effective_date: data.effective_date ? data.effective_date.split('T')[0] : '',
      financial_institution: data.financial_institution?.name || 'Não informada',
      category: data.category?.name ? `${data.category.name} (${data.category.type === 'INCOME' ? 'Receita' : 'Despesa'})` : 'Não informada',
      
      // Injeta o texto concatenado aqui
      subcategory_list: subsText,
      
      card: data.card?.name || 'Não informado',
      center: data.center?.name ? `${data.center.name} (${data.center.type === 'INCOME' ? 'Receita' : 'Despesa'})` : 'Não informado'
    };
  };

  return (
    <DynamicForm
      resource="financial-transaction"
      title="Lançamento"
      basePath="/dashboard/lancamentos"
      mode="view"
      id={id}
      fields={fields}
      transformData={transformData}
    />
  );
}