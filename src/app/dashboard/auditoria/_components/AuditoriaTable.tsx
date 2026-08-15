/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import type { ColumnDef } from '@/types/types';
import DynamicTableManager from '@/components/table/DataTable';
import AuditLogDetailModal from '@/components/modals/AuditLogDetailModal';

interface AuditoriaTableProps {
  columns: ColumnDef[];
}

/**
 * Envolve o DataTable para segurar o estado do modal de detalhe — a página da
 * listagem é server component (exporta metadata) e não pode ter estado.
 */
export default function AuditoriaTable({ columns }: AuditoriaTableProps) {
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  return (
    <>
      <DynamicTableManager
        resource="audit-logs"
        title="Auditoria"
        columns={columns}
        basePath="/dashboard/auditoria"
        autoFocusSearch
        defaultLimit={100}
        enableExcelExport
        excludeFilterFields={['created_at']}
        enableCreate={false}
        enableView={false}
        enableEdit={false}
        enableDelete={false}
        rowActions={[
          {
            key: 'detail',
            title: 'Ver detalhes',
            icon: <Search size={16} />,
            onClick: (item: any) => setSelectedLogId(item.id),
            action: 'view',
          },
        ]}
      />

      {selectedLogId && (
        <AuditLogDetailModal
          logId={selectedLogId}
          onClose={() => setSelectedLogId(null)}
        />
      )}
    </>
  );
}
