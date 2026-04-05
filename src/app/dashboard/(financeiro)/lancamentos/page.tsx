/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useCallback } from 'react';
import Section from '@/components/layout/PageSection';
import InlineEditableTable from '@/components/table/InlineEditableTable';
import type { ColumnDef } from '@/types/types';

const API_URL = process.env.NEXT_PUBLIC_URL_API ?? '';

interface SelectOption {
  label: string;
  value: string;
  type?: string
}

interface FormOptions {
  categories: SelectOption[];
  institutions: SelectOption[];
  cards: SelectOption[];
  centers: SelectOption[];
  subcategories: { [categoryId: string]: SelectOption[] };
  incomeCategories: SelectOption[];
  expenseCategories: SelectOption[];
}

const mapToOptions = (res: any): SelectOption[] =>
  (res?.data ?? res ?? []).map((i: any) => ({ label: i.name, value: i.id }));

const mapToTypeOptions = (res: any): SelectOption[] =>
  (res?.data ?? res ?? []).map((i: any) => ({
    label: `${i.name} (${i.type === 'INCOME' ? 'Receita' : 'Despesa'})`,
    value: i.id,
  }));

const mapCentersWithOptions = (res: any): SelectOption[] =>
  (res?.data ?? res ?? []).map((i: any) => ({
    label: i.name,
    value: i.id,
    type: i.type,  
  }));

const EMPTY_OPTIONS: FormOptions = {
  categories: [],
  institutions: [],
  cards: [],
  centers: [],
  subcategories: {},
  incomeCategories: [],
  expenseCategories: [],
};

const LANCAMENTOS_COLUMNS: ColumnDef[] = [
  { field: 'event_date', label: 'Data do Evento', sortParam: 'event_date', type: 'date' },
  { field: 'effective_date', label: 'Data de Efetivação', sortParam: 'effective_date', type: 'date' },
  { field: 'category_id', label: 'Categoria', sortParam: 'category.name', type: 'text' },
  { field: 'subcategory_id', label: 'Subcategoria', sortParam: 'subcategory.name', type: 'text' },
  { field: 'institution', label: 'Instituição Financeira', sortParam: 'financial_institution.name', type: 'text' },
  { field: 'card_id', label: 'Cartão de Crédito', sortParam: 'card.name', type: 'text' },
  { field: 'center_id', label: 'Centro', sortParam: 'center.name', type: 'text' },
  { field: 'description', label: 'Descrição', sortParam: 'description', type: 'text' },
  { field: 'amount', label: 'Valor', sortParam: 'amount', type: 'currency' },
  { field: 'status', label: 'Status', sortParam: 'status', type: 'text' },
  { field: 'actions', label: 'Ação', type: 'custom' },
];


export default function LancamentosPage() {
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [options, setOptions] = useState<FormOptions>(EMPTY_OPTIONS);

  const fetchOptions = useCallback(async () => {
    try {
      const [catRes, subRes, instRes, cardRes, centRes] = await Promise.all([
        fetch(`${API_URL}/financial-category?limit=1000&filter[is_active]=true`),
        fetch(`${API_URL}/financial-subcategory?limit=1000&filter[is_active]=true`),
        fetch(`${API_URL}/financial-institution?limit=1000`),
        fetch(`${API_URL}/financial-card?limit=1000&filter[is_active]=true`),
        fetch(`${API_URL}/financial-center?limit=1000&filter[is_active]=true`),
      ]);
      const [cats, subs, insts, cards, cents] = await Promise.all([
        catRes.json(), subRes.json(), instRes.json(), cardRes.json(), centRes.json(),
      ]);
      
      const allCategories = (cats?.data ?? cats ?? []);
      const incomeCategories = allCategories.filter((cat: { type: string }) => cat.type === 'INCOME');
      const expenseCategories = allCategories.filter((cat: { type: string }) => cat.type === 'EXPENSE');
      
      const subcategoriesByCategory: { [categoryId: string]: SelectOption[] } = {};
      (subs?.data ?? subs ?? []).forEach((sub: { id: string; name: string; category_id: string }) => {
        if (!subcategoriesByCategory[sub.category_id]) {
          subcategoriesByCategory[sub.category_id] = [];
        }
        subcategoriesByCategory[sub.category_id].push({
          label: sub.name,
          value: sub.id
        });
      });
      
      setOptions({
        categories: allCategories,
        incomeCategories: mapToTypeOptions({ data: incomeCategories }),
        expenseCategories: mapToTypeOptions({ data: expenseCategories }),
        institutions: mapToOptions(insts),
        cards: mapToOptions(cards),
        centers: mapCentersWithOptions(cents),
        subcategories: subcategoriesByCategory,
      });
    } catch {
      console.error('[LancamentosPage] Erro ao carregar opções');
    } finally {
      setIsLoadingOptions(false);
    }
  }, []);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  const handleRowSave = useCallback(async (id: string, data: Record<string, unknown>) => {
    const response = await fetch(`${API_URL}/financial-transaction/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.message ?? 'Erro ao atualizar lançamento.');
    }
  }, []);

  const handleRowCreate = useCallback(async (data: Record<string, unknown>) => {
    try {
      const response = await fetch(`${API_URL}/financial-transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.message ?? 'Erro ao criar lançamento.');
      }
    } catch (error) {
      console.error(error);
      throw error instanceof Error ? error : new Error('Erro ao criar lançamento.');
    }
  }, []);

  const handleRowDelete = useCallback(async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/financial-transaction/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.message ?? 'Erro ao excluir lançamento.');
      }
    } catch (error) {
      console.error(error);
      throw error instanceof Error ? error : new Error('Erro ao excluir lançamento.');
    }
  }, []);

  if (isLoadingOptions) {
    return (
      <Section title="Gerenciar Lançamentos">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
        </div>
      </Section>
    );
  }

  return (
    <Section title="Gerenciar Lançamentos">
      <InlineEditableTable
        resource="financial-transaction"
        title="Lançamentos"
        columns={LANCAMENTOS_COLUMNS}
        autoFocusSearch
        enableCreate
        enableDelete
        formOptions={options}
        onRowSave={handleRowSave}
        onRowCreate={handleRowCreate}
        onRowDelete={handleRowDelete}
      />
    </Section>
  );
}