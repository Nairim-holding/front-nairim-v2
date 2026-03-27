import { Suspense } from 'react';
import type { ColumnDef } from '@/types/types';
import Section from '@/components/layout/PageSection';
import DynamicTableManager from '@/components/table/DataTable';
import SkeletonTable from '@/components/table/TableSkeleton';

const COLUMNS: ColumnDef[] = [
  { field: 'legal_name',             label: 'Razão Social',       sortParam: 'legal_name',            type: 'text' },
  { field: 'trade_name',             label: 'Nome Fantasia',      sortParam: 'trade_name',            type: 'text' },
  { field: 'cnpj',                   label: 'CNPJ',               sortParam: 'cnpj',                  type: 'text', formatter: 'cpfCnpj' },
  { field: 'state_registration',     label: 'Inscrição Estadual', sortParam: 'state_registration',    type: 'text' },
  { field: 'municipal_registration', label: 'Inscrição Municipal',sortParam: 'municipal_registration', type: 'text' },
  { field: 'license_number',         label: 'CRECI',              sortParam: 'license_number',        type: 'text' },
  { field: 'zip_code',               label: 'CEP',                sortParam: 'zip_code',              type: 'text', formatter: 'cep' },
  { field: 'state',                  label: 'UF',                 sortParam: 'state',                 type: 'text' },
  { field: 'city',                   label: 'Cidade',             sortParam: 'city',                  type: 'text' },
  { field: 'district',               label: 'Bairro',             sortParam: 'district',              type: 'text' },
  { field: 'street',                 label: 'Endereço',           sortParam: 'street',                type: 'text' },
  { field: 'contact',                label: 'Contato',            sortParam: 'contact',               type: 'text' },
  { field: 'telephone',              label: 'Fone',               sortParam: 'telephone',             type: 'text', formatter: 'phone' },
  { field: 'cellphone',              label: 'Celular',            sortParam: 'cellphone',             type: 'text', formatter: 'phone' },
  { field: 'email',                  label: 'E-mail',             sortParam: 'email',                 type: 'text' },
  { field: 'actions',                label: 'Ação',                                                   type: 'custom' },
];

export default function ImobiliariasPage() {
  return (
    <Section title="Imobiliárias">
      <Suspense fallback={<SkeletonTable />}>
        <DynamicTableManager
          resource="agencies"
          title="Imobiliárias"
          columns={COLUMNS}
          basePath="/dashboard/imobiliarias"
          autoFocusSearch
        />
      </Suspense>
    </Section>
  );
}
