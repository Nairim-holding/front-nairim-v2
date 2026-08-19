import type { Metadata } from 'next';
import { Suspense } from 'react';
import type { ColumnDef } from '@/types/types';
import Section from '@/components/layout/PageSection';
import SkeletonTable from '@/components/table/TableSkeleton';
import AuditoriaTable from './_components/AuditoriaTable';

export const metadata: Metadata = { title: 'Auditoria' };

// Tarefa 8.2: "Registro" mostra a descrição do registro afetado (o uuid cru não
// dizia nada) e "IP de Origem" traz o IPv4 desembrulhado do formato
// `::ffff:...` que o proxy grava — IPv6 real fica marcado no próprio valor.
const COLUMNS: ColumnDef[] = [
  { field: 'company',    label: 'Empresa',     type: 'text', nestedField: 'company.name' },
  { field: 'user_name',  label: 'Usuário',     sortParam: 'user_name',  type: 'text' },
  { field: 'created_at', label: 'Data/Hora',   sortParam: 'created_at', type: 'date', formatter: 'datetime' },
  { field: 'action_label', label: 'Ação',      sortParam: 'action',     type: 'text' },
  { field: 'table_label',  label: 'Tabela',    sortParam: 'table_name', type: 'text' },
  { field: 'record_label', label: 'Registro',  type: 'text' },
  { field: 'ip_label',     label: 'IP de Origem', type: 'text' },
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
