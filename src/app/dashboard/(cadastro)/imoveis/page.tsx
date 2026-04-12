import { Suspense } from 'react';
import type { ColumnDef } from '@/types/types';
import Section from '@/components/layout/PageSection';
import DynamicTableManager from '@/components/table/DataTable';
import SkeletonTable from '@/components/table/TableSkeleton';

const COLUMNS: ColumnDef[] = [
  { field: 'title',           label: 'Nome',              sortParam: 'title',               type: 'text' },
  { field: 'owner',           label: 'Proprietário',      sortParam: 'owner.name',          type: 'text', nestedField: 'owner.name' },
  { field: 'zip_code',        label: 'CEP',               sortParam: 'zip_code',            type: 'text', formatter: 'cep',  nestedField: 'addresses.0.address.zip_code' },
  { field: 'street',          label: 'Endereço',          sortParam: 'street',              type: 'text', nestedField: 'addresses.0.address.street' },
  { field: 'district',        label: 'Bairro',            sortParam: 'district',            type: 'text', nestedField: 'addresses.0.address.district' },
  { field: 'city',            label: 'Cidade',            sortParam: 'city',                type: 'text', nestedField: 'addresses.0.address.city' },
  { field: 'state',           label: 'UF',                sortParam: 'state',               type: 'text', nestedField: 'addresses.0.address.state' },
  { field: 'type',            label: 'Tipo do imóvel',    sortParam: 'type.description',    type: 'text', nestedField: 'type.description' },
  { field: 'status',          label: 'Disponibilidade',   sortParam: 'values.status',       type: 'text', nestedField: 'values[0].status', formatter: 'propertyStatus' },
  { field: 'bedrooms',        label: 'Quartos',           sortParam: 'bedrooms',            type: 'number' },
  { field: 'bathrooms',       label: 'Banheiros',         sortParam: 'bathrooms',           type: 'number' },
  { field: 'half_bathrooms',  label: 'Lavabos',           sortParam: 'half_bathrooms',      type: 'number' },
  { field: 'garage_spaces',   label: 'Vagas na Garagem',  sortParam: 'garage_spaces',       type: 'number' },
  { field: 'area_total',      label: 'Área Total (m²)',   sortParam: 'area_total',          type: 'number' },
  { field: 'area_built',      label: 'Área Privativa (m²)', sortParam: 'area_built',        type: 'number' },
  { field: 'frontage',        label: 'Fachada',           sortParam: 'frontage',            type: 'number' },
  { field: 'furnished',       label: 'Mobiliado',         sortParam: 'furnished',           type: 'boolean' },
  { field: 'floor_number',    label: 'Número de Andar',   sortParam: 'floor_number',        type: 'number' },
  { field: 'tax_registration',label: 'Inscrição fiscal',  sortParam: 'tax_registration',    type: 'text' },
  { field: 'notes',           label: 'Observações',       sortParam: 'notes',               type: 'text' },
  { field: 'actions',         label: 'Ação',                                                type: 'custom' },
];

export default function ImoveisPage() {
  return (
    <Section title="Imóveis">
      <Suspense fallback={<SkeletonTable />}>
        <DynamicTableManager
          resource="properties"
          title="Imóveis"
          columns={COLUMNS}
          basePath="/dashboard/imoveis"
          autoFocusSearch
        />
      </Suspense>
    </Section>
  );
}
