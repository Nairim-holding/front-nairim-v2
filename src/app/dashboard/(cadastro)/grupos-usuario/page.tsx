import type { Metadata } from 'next';
import { Suspense } from 'react';
import type { ColumnDef } from '@/types/types';
import Section from '@/components/layout/PageSection';
import SkeletonTable from '@/components/table/TableSkeleton';
import GruposUsuarioTable from './_components/GruposUsuarioTable';

export const metadata: Metadata = { title: 'Grupos de Usuário' };

const COLUMNS: ColumnDef[] = [
  { field: 'description', label: 'Descrição',         sortParam: 'description',   type: 'text' },
  { field: 'creator',     label: 'Cadastrado por',    sortParam: 'creator.name',  type: 'text', nestedField: 'creator.name' },
  { field: 'created_at',  label: 'Cadastrado em',     sortParam: 'created_at',    type: 'date', formatter: 'date' },
  { field: 'updater',     label: 'Alterado por',      sortParam: 'updater.name',  type: 'text', nestedField: 'updater.name' },
  { field: 'updated_at',  label: 'Última alteração',  sortParam: 'updated_at',    type: 'date', formatter: 'date' },
];

export default function GruposUsuarioPage() {
  return (
    <Section title="Grupos de Usuário">
      <Suspense fallback={<SkeletonTable />}>
        <GruposUsuarioTable columns={COLUMNS} />
      </Suspense>
    </Section>
  );
}
