'use client';

import Section from "@/components/Section";
import DynamicTableManager from "@/components/DynamicTableManager";
import { ColumnDef } from "@/types/types";

export default function LancamentosPage() {
  const columns: ColumnDef[] = [
    { field: "event_date", label: "Data do Evento", sortParam: "event_date", type: "date", formatter: "date" },
    { field: "effective_date", label: "Data de Efetivação", sortParam: "effective_date", type: "date", formatter: "date" },
    { field: "category.name", label: "Categoria", sortParam: "category_id", type: "text" },
    
    // Ajuste aqui: Vamos ensinar o DynamicTableManager a processar se vier algo customizado
    // ou apenas manter a chave se o backend já entregar certinho.
    { field: "subcategory.name", label: "Subcategoria", sortParam: "subcategory_id", type: "text" },
    
    { field: "financial_institution.name", label: "Instituição Financeira", sortParam: "financial_institution_id", type: "text" },
    { field: "card.name", label: "Cartão", sortParam: "card_id", type: "text" },
    { field: "center.name", label: "Centro", sortParam: "center_id", type: "text" },
    { field: "description", label: "Descrição", sortParam: "description", type: "text" },
    { field: "amount", label: "Valor", sortParam: "amount", type: "currency", formatter: "currency" },
    { field: "status", label: "Status", sortParam: "status", type: "text" }
  ];

  return (
    <Section title="Lançamentos Financeiros">
      <DynamicTableManager
        resource="financial-transaction"
        title="Lançamento"
        columns={columns}
        basePath="/dashboard/lancamentos"
        autoFocusSearch={true}
        defaultSort={{ event_date: 'desc' }}
      />
    </Section>
  );
}