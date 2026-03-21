/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from "react";
import Section from "@/components/Section";
import { useMessageContext } from "@/contexts/MessageContext";
import { usePopupContext } from "@/contexts/PopupContext";
import MultiColumnManager from "@/components/MultiColumnManager/page";

export default function CategoriasESubcategoriasPage() {
  const { showMessage } = useMessageContext();
  const { showPopup } = usePopupContext();

  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  
  // O tipo só existe nesta página específica
  const [transactionType, setTransactionType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');

  const baseURL = process.env.NEXT_PUBLIC_URL_API;

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [catRes, subRes] = await Promise.all([
        fetch(`${baseURL}/financial-category?limit=1000`),
        fetch(`${baseURL}/financial-subcategory?limit=1000`)
      ]);
      const catData = await catRes.json();
      const subData = await subRes.json();
      
      setCategories(catData?.data || catData || []);
      setSubcategories(subData?.data || subData || []);
    } catch (_error) { // Corrigido ESLint (variável não usada)
      showMessage("Erro ao carregar os dados.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveParent = async (data: any, mode: 'CREATE' | 'EDIT') => {
    const url = mode === 'CREATE' ? `${baseURL}/financial-category` : `${baseURL}/financial-category/${data.id}`;
    const payload = mode === 'CREATE' ? { ...data, type: transactionType } : data;
    
    const res = await fetch(url, {
      method: mode === 'CREATE' ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      const result = await res.json();
      throw new Error(result.message || "Erro ao salvar Categoria.");
    }
    
    showMessage("Categoria salva com sucesso!", "success");
    const newRecord = await res.json();
    await fetchData();
    return newRecord;
  };

  const handleSaveChild = async (data: any, parentId: string, mode: 'CREATE' | 'EDIT') => {
    const url = mode === 'CREATE' ? `${baseURL}/financial-subcategory` : `${baseURL}/financial-subcategory/${data.id}`;
    const payload = { ...data, category_id: parentId };
    
    const res = await fetch(url, {
      method: mode === 'CREATE' ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const result = await res.json();
      throw new Error(result.message || "Erro ao salvar Subcategoria.");
    }

    showMessage("Subcategoria salva com sucesso!", "success");
    await fetchData();
  };

  // Funções de Delete corrigidas para retornar Promise<void>
  const handleDeleteParent = (id: string, name: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      showPopup(
        `Excluir Categoria`,
        `Tem certeza que deseja excluir "${name}"?`,
        async () => {
          try {
            const res = await fetch(`${baseURL}/financial-category/${id}`, { method: 'DELETE' });
            if (!res.ok) {
              const result = await res.json().catch(() => ({}));
              throw new Error(result.message || `Erro ao excluir Categoria.`);
            }
            showMessage("Excluída com sucesso!", "success");
            await fetchData();
            resolve();
          } catch (error: any) {
            showMessage(error.message, "error");
            reject(error);
          }
        },
        () => reject(new Error("Cancelado pelo usuário"))
      );
    });
  };

  const handleDeleteChild = (id: string, name: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      showPopup(
        `Excluir Subcategoria`,
        `Tem certeza que deseja excluir "${name}"?`,
        async () => {
          try {
            const res = await fetch(`${baseURL}/financial-subcategory/${id}`, { method: 'DELETE' });
            if (!res.ok) {
              const result = await res.json().catch(() => ({}));
              throw new Error(result.message || `Erro ao excluir Subcategoria.`);
            }
            showMessage("Excluída com sucesso!", "success");
            await fetchData();
            resolve();
          } catch (error: any) {
            showMessage(error.message, "error");
            reject(error);
          }
        },
        () => reject(new Error("Cancelado pelo usuário"))
      );
    });
  };

  // Filtramos apenas as categorias atreladas à aba atual (Despesa/Receita)
  const filteredCategories = categories.filter(c => c.type === transactionType);

  return (
    <Section title="Gerenciar Categorias">
      <div className="bg-surface p-6 rounded-xl shadow-sm border border-ui-border max-w-5xl mx-auto w-full">
        
        {/* Toggle Customizado para esta página (Receita / Despesa) */}
        <div className="flex mb-6 rounded-lg overflow-hidden w-fit border border-ui-border bg-surface-subtle">
          <button
            onClick={() => setTransactionType('EXPENSE')}
            className={`px-8 py-2.5 text-sm font-bold transition-all ${
              transactionType === 'EXPENSE' 
                ? 'bg-[var(--color-brand-primary)] text-content-inverse shadow-md' 
                : 'text-content-secondary hover:text-content'
            }`}
          >
            Despesa
          </button>
          <button
            onClick={() => setTransactionType('INCOME')}
            className={`px-8 py-2.5 text-sm font-bold transition-all ${
              transactionType === 'INCOME' 
                ? 'bg-[var(--color-brand-primary)] text-content-inverse shadow-md' 
                : 'text-content-secondary hover:text-content'
            }`}
          >
            Receita
          </button>
        </div>

        <MultiColumnManager
          titleParent="Categoria"
          titleChild="Subcategoria"
          parentData={filteredCategories}
          childData={subcategories}
          childRelationKey="category_id"
          isLoading={isLoading}
          onSaveParent={handleSaveParent}
          onSaveChild={handleSaveChild}
          onDeleteParent={handleDeleteParent}
          onDeleteChild={handleDeleteChild}
        />

      </div>
    </Section>
  );
}