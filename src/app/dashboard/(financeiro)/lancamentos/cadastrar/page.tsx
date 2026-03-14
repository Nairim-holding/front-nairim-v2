/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useMemo } from "react";
import DynamicForm from "@/components/DynamicFormManager";
import { FormFieldDef } from "@/types/types";

export default function CadastrarLancamentoPage() {
  const [isLoading, setIsLoading] = useState(true);
  
  const [options, setOptions] = useState({
    categories: [] as {label: string, value: string}[],
    institutions: [] as {label: string, value: string}[],
    cards: [] as {label: string, value: string}[],
    centers: [] as {label: string, value: string}[],
    subcategories: [] as {label: string, value: string, categoryId: string}[]
  });

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const baseURL = process.env.NEXT_PUBLIC_URL_API;
        
        const [catRes, subRes, instRes, cardRes, centRes] = await Promise.all([
          fetch(`${baseURL}/financial-category?limit=1000&filter[is_active]=true`),
          fetch(`${baseURL}/financial-subcategory?limit=1000&filter[is_active]=true`),
          fetch(`${baseURL}/financial-institution?limit=1000`),
          fetch(`${baseURL}/financial-card?limit=1000&filter[is_active]=true`),
          fetch(`${baseURL}/financial-center?limit=1000&filter[is_active]=true`),
        ]);

        const [cats, subs, insts, cards, cents] = await Promise.all([
          catRes.json(), subRes.json(), instRes.json(), cardRes.json(), centRes.json()
        ]);

        const mapData = (res: any) => (res?.data || res || []).map((i: any) => ({ label: i.name, value: i.id }));
        const mapTypeData = (res: any) => (res?.data || res || []).map((i: any) => ({ 
          label: `${i.name} (${i.type === 'INCOME' ? 'Receita' : 'Despesa'})`, 
          value: i.id 
        }));

        setOptions({
          categories: mapTypeData(cats),
          institutions: mapData(insts),
          cards: mapData(cards),
          centers: mapTypeData(cents),
          subcategories: (subs?.data || subs || []).map((i: any) => ({
            label: i.name,
            value: i.id,
            categoryId: i.category_id
          }))
        });

      } catch (error) {
        console.error("Erro ao carregar opções:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchOptions();
  }, []);

  const fields: FormFieldDef[] = useMemo(() => [
    { 
      field: 'event_date', 
      label: 'Data do Evento', 
      type: 'date', 
      required: true,
      defaultValue: new Date().toISOString().split('T')[0],
      readOnly: true, 
      disabled: true 
    },
    { field: 'effective_date', label: 'Data de Efetivação', type: 'date', required: true },
    { 
      field: 'category_id', 
      label: 'Categoria', 
      type: 'select', 
      required: true, 
      options: options.categories 
    },
    {
      field: 'subcategories_info',
      label: '',
      type: 'custom',
      className: 'col-span-full',
      hidden: (fv) => !fv?.category_id,
      render: (_: any, fv: any) => {
        if (!fv?.category_id) return null;
        
        const filtered = options.subcategories.filter(sub => sub.categoryId === fv.category_id);
        const text = filtered.length > 0 
          ? filtered.map(sub => sub.label).join(' • ') 
          : 'Nenhuma subcategoria atrelada a esta categoria.';

        return (
          <div className="p-3 bg-brand/5 border border-brand/20 rounded-lg flex items-center gap-3 mt-1 mb-2">
            <div>
              <p className="text-[11px] font-semibold text-content-muted uppercase tracking-wider mb-0.5">Subcategorias da Categoria Selecionada</p>
              <p className="text-sm font-medium text-brand">{text}</p>
            </div>
          </div>
        );
      }
    },
    { field: 'financial_institution_id', label: 'Instituição Financeira', type: 'select', required: true, options: options.institutions },
    { field: 'card_id', label: 'Cartões', type: 'select', required: false, options: options.cards },
    { field: 'center_id', label: 'Centro', type: 'select', required: false, options: options.centers },
    { field: 'description', label: 'Descrição', type: 'text', required: true, placeholder: 'Ex: Pagamento de Aluguel', className: 'col-span-full' },
    { 
      field: 'amount', 
      label: 'Valor', 
      type: 'text', 
      mask: 'money',
      required: true, 
      placeholder: 'R$ 0,00' 
    },
    { field: 'status', label: 'Status', type: 'select', required: true, options: [
        { label: 'Pendente', value: 'PENDING' },
        { label: 'Concluído', value: 'COMPLETED' },
    ]}
  ], [options]);

  const transformPayload = (data: any) => {
    let parsedAmount = 0;
    if (data.amount) {
      const cleanValue = String(data.amount).replace(/[^\d,-]/g, '').replace(',', '.');
      parsedAmount = parseFloat(cleanValue);
      if (isNaN(parsedAmount)) parsedAmount = 0;
    }

    const { subcategories_info, ...apiData } = data;

    return {
      ...apiData,
      amount: parsedAmount,
      event_date: new Date().toISOString().split('T')[0],
      subcategory_id: null,
      card_id: data.card_id ? data.card_id : null,
      center_id: data.center_id ? data.center_id : null,
    };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
      </div>
    );
  }

  return (
    <DynamicForm
      resource="financial-transaction"
      title="Lançamento"
      basePath="/dashboard/lancamentos"
      mode="create"
      fields={fields}
      transformResponse={transformPayload}
    />
  );
}