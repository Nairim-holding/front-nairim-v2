import type { Metadata } from 'next';
import { Suspense } from 'react';
import type { ColumnDef } from '@/types/types';
import Section from '@/components/layout/PageSection';
import SkeletonTable from '@/components/table/TableSkeleton';
import AuditoriaTable from './_components/AuditoriaTable';

export const metadata: Metadata = { title: 'Auditoria' };

const COLUMNS: ColumnDef[] = [
  { field: 'company',    label: 'Empresa',     type: 'text', nestedField: 'company.name' },
  { field: 'user_name',  label: 'Usuário',     sortParam: 'user_name',  type: 'text' },
  { field: 'created_at', label: 'Data/Hora',   sortParam: 'created_at', type: 'date', formatter: 'datetime' },
  { field: 'action_label', label: 'Ação',      sortParam: 'action',     type: 'text' },
  { field: 'table_label',  label: 'Tabela',    sortParam: 'table_name', type: 'text' },
  { field: 'record_id', label: 'Valor Lógico', type: 'text' },
  { field: 'ip',         label: 'IP',          type: 'text' },
];

export default function AuditoriaPage() {
  return (
    <Section title="Auditoria">
      <Suspense fallback={<SkeletonTable />}>
        <AuditoriaTable columns={COLUMNS} />
      </Suspense>
    </Section>
  );
}
