'use client';

import { useState, Suspense } from "react";
import Section from "@/components/Section";
import DynamicTableManager from "@/components/DynamicTableManager";
import SkeletonTable from "@/components/Loading/SkeletonTable";
import { ColumnDef } from "@/types/types";

export default function CategoriasESubcategoriasPage() {
  const [activeTab, setActiveTab] = useState<'categorias' | 'subcategorias'>('categorias');
  // Novo estado para controlar as sub-tabs
  const [categoryType, setCategoryType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');

  // Colunas para Categorias (Coluna 'type' removida)
  const colCategorias: ColumnDef[] = [
    { field: "name", label: "Nome da Categoria", sortParam: "name", type: "text" },
    { field: "is_active", label: "Status", sortParam: "is_active", type: "boolean" },
    { field: "created_at", label: "Criado em", sortParam: "created_at", type: "date" }
  ];

  // Colunas para Subcategorias
  const colSubcategorias: ColumnDef[] = [
    { field: "name", label: "Nome da Subcategoria", sortParam: "name", type: "text" },
    { field: "category", label: "Categoria Pai", sortParam: "category_id", type: "text" }, 
    { field: "is_active", label: "Status", sortParam: "is_active", type: "boolean" },
  ];

  return (
    <Section title="Gestão de Categorias">
      
      {/* Sistema de Tabs Principais */}
      <div className="flex border-b border-ui-border mb-6">
        <button
          onClick={() => setActiveTab('categorias')}
          className={`px-6 py-3 text-sm font-medium transition-colors relative ${
            activeTab === 'categorias' ? 'text-brand' : 'text-content-secondary hover:text-content'
          }`}
        >
          Categorias
          {activeTab === 'categorias' && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-brand rounded-t-full" />
          )}
        </button>
        
        <button
          onClick={() => setActiveTab('subcategorias')}
          className={`px-6 py-3 text-sm font-medium transition-colors relative ${
            activeTab === 'subcategorias' ? 'text-brand' : 'text-content-secondary hover:text-content'
          }`}
        >
          Subcategorias
          {activeTab === 'subcategorias' && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-brand rounded-t-full" />
          )}
        </button>
      </div>

      {/* Sub-Tabs (Botões de Filtro) SÓ APARECEM NA ABA CATEGORIAS */}
      {activeTab === 'categorias' && (
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => setCategoryType('EXPENSE')}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-colors border ${
              categoryType === 'EXPENSE' 
                ? 'bg-red-50 text-red-700 border-red-200' 
                : 'bg-surface text-content-secondary border-ui-border hover:bg-surface-subtle'
            }`}
          >
            Despesas
          </button>
          <button
            onClick={() => setCategoryType('INCOME')}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-colors border ${
              categoryType === 'INCOME' 
                ? 'bg-green-50 text-green-700 border-green-200' 
                : 'bg-surface text-content-secondary border-ui-border hover:bg-surface-subtle'
            }`}
          >
            Receitas
          </button>
        </div>
      )}

      <Suspense fallback={<SkeletonTable />}>
        {activeTab === 'categorias' ? (
          <DynamicTableManager
            key={`cat-${categoryType}`}
            resource="financial-category"
            title={categoryType === 'EXPENSE' ? 'Categoria de Despesa' : 'Categoria de Receita'}
            columns={colCategorias}
            basePath="/dashboard/categorias"
            autoFocusSearch={true}
            defaultFilters={{ type: categoryType }}
          />
        ) : (
          <DynamicTableManager
            resource="financial-subcategory"
            title="Subcategoria"
            columns={colSubcategorias}
            basePath="/dashboard/subcategorias"
            autoFocusSearch={true}
          />
        )}
      </Suspense>

    </Section>
  );
}