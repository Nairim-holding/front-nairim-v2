import { Suspense } from 'react';
import type { ColumnDef } from '@/types/types';
import Section from '@/components/layout/PageSection';
import DynamicTableManager from '@/components/table/DataTable';
import SkeletonTable from '@/components/table/TableSkeleton';

const COLUMNS: ColumnDef[] = [
  { field: 'name',                   label: 'Nome',               sortParam: 'name',                  type: 'text' },
  { field: 'person_type',            label: 'Pessoa',             sortParam: 'cpf',                   type: 'text' },
  { field: 'internal_code',          label: 'Código Interno',     sortParam: 'internal_code',         type: 'text' },
  { field: 'occupation',             label: 'Profissão',          sortParam: 'occupation',            type: 'text' },
  { field: 'marital_status',         label: 'Estado Civil',       sortParam: 'marital_status',        type: 'text' },
  { field: 'cpf',                    label: 'CPF',                sortParam: 'cpf',                   type: 'text', formatter: 'cpfCnpj' },
  { field: 'cnpj',                   label: 'CNPJ',               sortParam: 'cnpj',                  type: 'text', formatter: 'cpfCnpj' },
  { field: 'state_registration',     label: 'Inscrição Estadual',  type: 'text' },
  { field: 'municipal_registration', label: 'Inscrição Municipal',  type: 'text' },
  { field: 'zip_code',               label: 'CEP',                sortParam: 'zip_code',              type: 'text', formatter: 'cep' },
  { field: 'state',                  label: 'UF',                 sortParam: 'state',                 type: 'text' },
  { field: 'city',                   label: 'Cidade',             sortParam: 'city',                  type: 'text' },
  { field: 'district',               label: 'Bairro',             sortParam: 'district',              type: 'text' },
  { field: 'address',                label: 'Endereço',           sortParam: 'street',                type: 'text' },
  { field: 'complement',             label: 'Complemento',        sortParam: 'complement',            type: 'text' },
  { field: 'contact',                label: 'Contato',            sortParam: 'contact_name',          type: 'text' },
  { field: 'telephone',              label: 'Fone',                                                   type: 'text', formatter: 'phone' },
  { field: 'cellphone',              label: 'Celular',            sortParam: 'cellphone',             type: 'text', formatter: 'phone' },
  { field: 'email',                  label: 'E-mail',             sortParam: 'email',                 type: 'text' },
  { field: 'actions',                label: 'Ação',                                                   type: 'custom' },
];

export default function InquilinosPage() {
  return (
    <Section title="Inquilinos">
      <Suspense fallback={<SkeletonTable />}>
        <DynamicTableManager
          resource="tenants"
          title="Inquilinos"
          columns={COLUMNS}
          basePath="/dashboard/inquilinos"
          autoFocusSearch
        />
      </Suspense>
    </Section>
  );
}
