'use client';

import { Suspense } from "react";
import Section from "@/components/Section";
import DynamicTableManager from "@/components/DynamicTableManager";
import SkeletonTable from "@/components/Loading/SkeletonTable";
import { ColumnDef } from "@/types/types";

export default function CartoesPage() {
  const columns: ColumnDef[] = [
    {
      field: "name",
      label: "Nome do Cartão",
      sortParam: "name",
      type: "text"
    },
    {
      field: "limit",
      label: "Limite",
      sortParam: "limit",
      type: "currency",
      formatter: "currency"
    },
    {
      field: "is_active",
      label: "Status",
      sortParam: "is_active",
      type: "boolean",
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
    <Section title="Cartões">
      <Suspense fallback={<SkeletonTable />}>
        <DynamicTableManager
          resource="financial-card"
          title="Cartão"
          columns={columns}
          basePath="/dashboard/cartoes"
          autoFocusSearch={true}
        />
      </Suspense>
    </Section>
  );
}