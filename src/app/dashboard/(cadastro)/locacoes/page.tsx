'use client';

import Section from "@/components/Section";
import DynamicTableManager from "@/components/DynamicTableManager";
import { ColumnDef } from "@/types/types";

export default function LeasesPage() {
  const columns: ColumnDef[] = [
    {
      field: "contract_number",
      label: "Contrato",
      sortParam: "contract_number",
      type: "text"
    },
    {
      field: "status",
      label: "Status",
      sortParam: "status",
      type: "text"
    },
    {
      field: "start_date",
      label: "Data Início",
      sortParam: "start_date",
      type: "date"
    },
    {
      field: "end_date",
      label: "Data Final",
      sortParam: "end_date",
      type: "date"
    },
    {
      field: "property_title",
      label: "Nome do Imóvel",
      sortParam: "property.title",
      type: "text",
      nestedField: "property.title"
    },
    {
      field: "type",
      label: "Tipo Imóvel",
      sortParam: "property.type.description",
      type: "text",
      nestedField: "property.type.description"
    },
    {
      field: "owner",
      label: "Proprietário",
      sortParam: "owner.name",
      type: "text",
      nestedField: "owner.name"
    },
    {
      field: "tenant",
      label: "Inquilino",
      sortParam: "tenant.name",
      type: "text",
      nestedField: "tenant.name"
    },
    {
      field: "rent_amount",
      label: "Valor Aluguel",
      sortParam: "rent_amount",
      type: "currency"
    },
    {
      field: "condo_fee",
      label: "Valor Condomínio",
      sortParam: "condo_fee",
      type: "currency"
    },
    {
      field: "property_tax",
      label: "Valor IPTU",
      sortParam: "property_tax",
      type: "currency"
    },
    {
      field: "extra_charges",
      label: "Valor Taxas Extras",
      sortParam: "extra_charges",
      type: "currency"
    },
    {
      field: "commission_amount",
      label: "Valor Comissão",
      sortParam: "commission_amount",
      type: "currency"
    },
    {
      field: "rent_due_day",
      label: "Vencimento Aluguel",
      sortParam: "rent_due_day",
      type: "number",
    },
    {
      field: "tax_due_day",
      label: "Vencimento IPTU",
      sortParam: "tax_due_day",
      type: "number",
    },
    {
      field: "condo_due_day",
      label: "Vencimento Condomínio",
      sortParam: "condo_due_day",
      type: "number",
    },
    {
      field: "created_at",
      label: "Criado em",
      sortParam: "created_at",
      type: "date"
    },
    {
      field: "actions",
      label: "Ação",
      type: "custom"
    }
  ];

  return (
    <Section title="Locações">
      <DynamicTableManager
        resource="leases"
        title="Locações"
        columns={columns}
        basePath="/dashboard/locacoes"
        autoFocusSearch={true}
      />
    </Section>
  );
}