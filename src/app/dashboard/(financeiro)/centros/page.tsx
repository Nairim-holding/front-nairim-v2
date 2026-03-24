/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from "react";
import Section from "@/components/Section";
import { useMessageContext } from "@/contexts/MessageContext";
import { usePopupContext } from "@/contexts/PopupContext";
import MultiColumnManager from "@/components/MultiColumnManager/page";

export default function CentrosPage() {
  const { showMessage } = useMessageContext();
  const { showPopup } = usePopupContext();

  const [isLoading, setIsLoading] = useState(true);
  const [centers, setCenters] = useState<any[]>([]);
  
  // Controle da Aba (Despesa / Receita)
  const [transactionType, setTransactionType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');

  const baseURL = process.env.NEXT_PUBLIC_URL_API;

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${baseURL}/financial-center?limit=1000`);
      const data = await res.json();
      setCenters(data?.data || data || []);
    } catch (_error) { // <-- Corrigido o erro do ESLint (variável não usada)
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
    const url = mode === 'CREATE' ? `${baseURL}/financial-center` : `${baseURL}/financial-center/${data.id}`;
    const payload = mode === 'CREATE' ? { ...data, type: transactionType } : data;
    
    const res = await fetch(url, {
      method: mode === 'CREATE' ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      const result = await res.json();
      throw new Error(result.message || "Erro ao salvar Centro.");
    }
    
    showMessage("Centro salvo com sucesso!", "success");
    const newRecord = await res.json();
    await fetchData();
    return newRecord;
  };

  // <-- Corrigido o erro do TypeScript envelopando em uma Promise
  const handleDeleteParent = (id: string, name: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      showPopup(
        `Excluir Centro`,
        `Tem certeza que deseja excluir "${name}"?`,
        async () => {
          try {
            const res = await fetch(`${baseURL}/financial-center/${id}`, { method: 'DELETE' });
            if (!res.ok) {
              const result = await res.json().catch(() => ({}));
              throw new Error(result.message || `Erro ao excluir Centro.`);
            }
            showMessage("Excluído com sucesso!", "success");
            await fetchData();
            resolve(); // Sucesso: Avisa o MultiColumnManager para limpar a tela
          } catch (error: any) {
            showMessage(error.message, "error");
            reject(error); // Erro: Impede o form de fechar
          }
        },
        () => reject(new Error("Ação cancelada")) // Se o usuário fechar o modal, rejeita a promise
      );
    });
  };

  // Filtramos os centros que correspondem à aba selecionada
  const filteredCenters = centers.filter(c => c.type === transactionType);

  return (
    <Section title="Centros de Despesas e Receitas">
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
          titleParent="Centro"
          titleChild="" 
          parentData={filteredCenters}
          childData={[]} 
          childRelationKey="center_id"
          isLoading={isLoading}
          hasChild={false} 
          
          onSaveParent={handleSaveParent}
          onDeleteParent={handleDeleteParent}
          
          // <-- Corrigido o erro exigindo async () nas funções vazias do filho
          onSaveChild={async () => {}} 
          onDeleteChild={async () => {}}
        />

      </div>
    </Section>
  );
}