import { Suspense } from 'react';
import type { ColumnDef } from '@/types/types';
import Section from '@/components/layout/PageSection';
import DynamicTableManager from '@/components/table/DataTable';
import SkeletonTable from '@/components/table/TableSkeleton';

const COLUMNS: ColumnDef[] = [
  { field: 'description', label: 'Descrição', sortParam: 'description', type: 'text' },
  { field: 'created_at',  label: 'Criado em',                           type: 'date', formatter: 'date' },
];

export default function TiposImovelPage() {
  return (
    <Section title="Tipos de Imóvel">
      <Suspense fallback={<SkeletonTable />}>
        <DynamicTableManager
          resource="property-types"
          title="Tipos de Imóvel"
          columns={COLUMNS}
          basePath="/dashboard/tipo-imovel"
          autoFocusSearch
        />
      </Suspense>
    </Section>
  );
}
