import type { Metadata } from 'next';
import { Suspense } from 'react';
import type { ColumnDef } from '@/types/types';
import Section from '@/components/layout/PageSection';
import SkeletonTable from '@/components/table/TableSkeleton';
import AdministradoresTable from './_components/AdministradoresTable';

export const metadata: Metadata = { title: 'Administradores' };

const COLUMNS: ColumnDef[] = [
  { field: 'name',       label: 'Nome',               sortParam: 'name',              type: 'text' },
  { field: 'email',      label: 'E-mail',             sortParam: 'email',             type: 'text' },
  { field: 'group',      label: 'Grupo usuário',      sortParam: 'group.description', type: 'text', nestedField: 'group.description' },
  { field: 'is_active',  label: 'Ativo',              sortParam: 'is_active',         type: 'text', formatter: 'boolean' },
  { field: 'gender',     label: 'Sexo',               sortParam: 'gender',            type: 'text', formatter: 'gender' },
  { field: 'birth_date', label: 'Data de Nascimento', sortParam: 'birth_date',        type: 'date', formatter: 'date' },
  { field: 'created_at', label: 'Criado em',          sortParam: 'created_at',        type: 'date', formatter: 'date' },
];

export default function AdministradoresPage() {
  return (
    <Section title="Administradores">
      <Suspense fallback={<SkeletonTable />}>
        <AdministradoresTable columns={COLUMNS} />
      </Suspense>
    </Section>
  );
}
