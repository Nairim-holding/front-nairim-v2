'use client';

import { useState, Suspense } from "react";
import Section from "@/components/Section";
import DynamicTableManager from "@/components/DynamicTableManager";
import SkeletonTable from "@/components/Loading/SkeletonTable";
import { ColumnDef } from "@/types/types";

export default function CentrosPage() {
  const [activeTab, setActiveTab] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');

  // Coluna 'type' removida pois a aba já indica o tipo do centro
  const columns: ColumnDef[] = [
    { field: "name", label: "Nome do Centro", sortParam: "name", type: "text" },
    { field: "is_active", label: "Status", sortParam: "is_active", type: "boolean" },
    { field: "created_at", label: "Criado em", sortParam: "created_at", type: "date" }
  ];

  return (
    <Section title="Centros de Custos e Receitas">
      
      {/* Sistema de Tabs */}
      <div className="flex gap-3 mb-6 border-b border-ui-border pb-4">
        <button
          onClick={() => setActiveTab('EXPENSE')}
          className={`px-5 py-2 rounded-full text-sm font-medium transition-colors border ${
            activeTab === 'EXPENSE' 
              ? 'bg-red-50 text-red-700 border-red-200' 
              : 'bg-surface text-content-secondary border-ui-border hover:bg-surface-subtle'
          }`}
        >
          Centros de Despesa
        </button>
        <button
          onClick={() => setActiveTab('INCOME')}
          className={`px-5 py-2 rounded-full text-sm font-medium transition-colors border ${
            activeTab === 'INCOME' 
              ? 'bg-green-50 text-green-700 border-green-200' 
              : 'bg-surface text-content-secondary border-ui-border hover:bg-surface-subtle'
          }`}
        >
          Centros de Receita
        </button>
      </div>

      <Suspense fallback={<SkeletonTable />}>
        {/* Usamos a key com o valor da tab para garantir que a tabela seja completamente destruída e recriada ao alternar as abas, prevenindo bugs de cache de estado */}
        <DynamicTableManager
          key={`center-${activeTab}`} 
          resource="financial-center"
          title={activeTab === 'EXPENSE' ? 'Centro de Despesa' : 'Centro de Receita'}
          columns={columns}
          basePath="/dashboard/centros"
          autoFocusSearch={true}
          defaultFilters={{ type: activeTab }} 
        />
      </Suspense>

    </Section>
  );
}