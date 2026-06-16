import type { Metadata } from 'next';
import { Suspense } from 'react';
import type { ColumnDef } from '@/types/types';
import Section from '@/components/layout/PageSection';
import DynamicTableManager from '@/components/table/DataTable';
import SkeletonTable from '@/components/table/TableSkeleton';

export const metadata: Metadata = { title: 'Administradores' };

const COLUMNS: ColumnDef[] = [
  { field: 'name',       label: 'Nome',               sortParam: 'name',       type: 'text' },
  { field: 'email',      label: 'Email',              sortParam: 'email',      type: 'text' },
  { field: 'gender',     label: 'Sexo',               sortParam: 'gender',     type: 'text',   formatter: 'gender' },
  { field: 'birth_date', label: 'Data de Nascimento', sortParam: 'birth_date', type: 'date',   formatter: 'date' },
  { field: 'created_at', label: 'Criado em',          sortParam: 'created_at', type: 'date',   formatter: 'date' },
];

export default function AdministradoresPage() {
  return (
    <Section title="Administradores">
      <Suspense fallback={<SkeletonTable />}>
        <DynamicTableManager
          resource="users"
          title="Administradores"
          columns={COLUMNS}
          basePath="/dashboard/administradores"
          autoFocusSearch
        />
      </Suspense>
    </Section>
  );
}
