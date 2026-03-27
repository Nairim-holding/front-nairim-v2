import { Suspense } from 'react';
import type { ColumnDef } from '@/types/types';
import Section from '@/components/layout/PageSection';
import DynamicTableManager from '@/components/table/DataTable';
import SkeletonTable from '@/components/table/TableSkeleton';

const COLUMNS: ColumnDef[] = [
  { field: 'contract_number',  label: 'Contrato',            sortParam: 'contract_number',       type: 'text' },
  { field: 'status',           label: 'Status',              sortParam: 'status',                type: 'text' },
  { field: 'start_date',       label: 'Data Início',         sortParam: 'start_date',            type: 'date' },
  { field: 'end_date',         label: 'Data Final',          sortParam: 'end_date',              type: 'date' },
  { field: 'property_title',   label: 'Nome do Imóvel',      sortParam: 'property.title',        type: 'text', nestedField: 'property.title' },
  { field: 'type',             label: 'Tipo Imóvel',         sortParam: 'property.type.description', type: 'text', nestedField: 'property.type.description' },
  { field: 'owner',            label: 'Proprietário',        sortParam: 'owner.name',            type: 'text', nestedField: 'owner.name' },
  { field: 'tenant',           label: 'Inquilino',           sortParam: 'tenant.name',           type: 'text', nestedField: 'tenant.name' },
  { field: 'rent_amount',      label: 'Valor Aluguel',       sortParam: 'rent_amount',           type: 'currency' },
  { field: 'condo_fee',        label: 'Valor Condomínio',    sortParam: 'condo_fee',             type: 'currency' },
  { field: 'property_tax',     label: 'Valor IPTU',          sortParam: 'property_tax',          type: 'currency' },
  { field: 'payment_condition',label: 'Condição Pagamento',  sortParam: 'payment_condition',     type: 'text' },
  { field: 'extra_charges',    label: 'Valor Taxas Extras',  sortParam: 'extra_charges',         type: 'currency' },
  { field: 'commission_amount',label: 'Valor Comissão',      sortParam: 'commission_amount',     type: 'currency' },
  { field: 'rent_due_day',     label: 'Vencimento Aluguel',  sortParam: 'rent_due_day',          type: 'number' },
  { field: 'tax_due_day',      label: 'Vencimento IPTU',     sortParam: 'tax_due_day',           type: 'number' },
  { field: 'condo_due_day',    label: 'Vencimento Condomínio', sortParam: 'condo_due_day',       type: 'number' },
  { field: 'created_at',       label: 'Criado em',           sortParam: 'created_at',            type: 'date' },
  { field: 'actions',          label: 'Ação',                                                    type: 'custom' },
];

export default function LocacoesPage() {
  return (
    <Section title="Locações">
      <Suspense fallback={<SkeletonTable />}>
        <DynamicTableManager
          resource="leases"
          title="Locações"
          columns={COLUMNS}
          basePath="/dashboard/locacoes"
          autoFocusSearch
        />
      </Suspense>
    </Section>
  );
}
