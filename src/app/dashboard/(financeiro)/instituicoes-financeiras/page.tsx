'use client';

import { Suspense } from "react";
import Section from "@/components/Section";
import DynamicTableManager from "@/components/DynamicTableManager";
import SkeletonTable from "@/components/Loading/SkeletonTable";
import { ColumnDef } from "@/types/types";

export default function InstituicoesFinanceirasPage() {
  const columns: ColumnDef[] = [
    {
      field: "name",
      label: "Nome da Instituição",
      sortParam: "name",
      type: "text"
    },
    {
      field: "created_at",
      label: "Criado em",
      sortParam: "created_at",
      type: "date",
      formatter: "date"
    }
  ];

  return (
    <Section title="Instituições Financeiras">
      <Suspense fallback={<SkeletonTable />}>
        <DynamicTableManager
          resource="financial-institution" 
          title="Instituição Financeira"
          columns={columns}
          basePath="/dashboard/instituicoes-financeiras"
          autoFocusSearch={true}
        />
      </Suspense>
    </Section>
  );
}