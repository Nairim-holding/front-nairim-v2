import { Suspense } from 'react';
import type { ColumnDef } from '@/types/types';
import Section from '@/components/layout/PageSection';
import DynamicTableManager from '@/components/table/DataTable';
import SkeletonTable from '@/components/table/TableSkeleton';

const COLUMNS: ColumnDef[] = [
  { field: 'name',       label: 'Nome',       sortParam: 'name',       type: 'text' },
  { field: 'slug',       label: 'Slug',       sortParam: 'slug',       type: 'text' },
  { field: 'is_active',  label: 'Ativo',      sortParam: 'is_active',  type: 'boolean', formatter: 'boolean' },
  { field: 'created_at', label: 'Criado em',  sortParam: 'created_at', type: 'date',    formatter: 'date' },
];

export default function EmpresasPage() {
  return (
    <Section title="Empresas">
      <Suspense fallback={<SkeletonTable />}>
        <DynamicTableManager
          resource="companies"
          title="Empresas"
          columns={COLUMNS}
          basePath="/dashboard/empresas"
          autoFocusSearch
        />
      </Suspense>
    </Section>
  );
}
