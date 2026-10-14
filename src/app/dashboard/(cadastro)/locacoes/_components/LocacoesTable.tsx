/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { ReceiptText } from 'lucide-react';
import type { ColumnDef } from '@/types/types';
import DynamicTableManager from '@/components/table/DataTable';
import LeaseFinancialHistoryModal from '@/components/domain/leases/LeaseFinancialHistoryModal';

interface LocacoesTableProps {
  columns: ColumnDef[];
}

/**
 * Envolve o DataTable para segurar o botão "Histórico Financeiro" por linha —
 * a página da listagem é server component (exporta metadata) e não pode ter estado.
 */
export default function LocacoesTable({ columns }: LocacoesTableProps) {
  const [historyLeaseId, setHistoryLeaseId] = useState<string | null>(null);

  return (
    <>
      <DynamicTableManager
        resource="leases"
        title="Locações"
        columns={columns}
        basePath="/dashboard/locacoes"
        autoFocusSearch
        rowActions={[
          {
            key: 'financial-history',
            title: 'Histórico Financeiro',
            icon: <ReceiptText size={16} />,
            onClick: (item: any) => setHistoryLeaseId(String(item.id)),
            action: 'view',
          },
        ]}
      />

      {historyLeaseId && (
        <LeaseFinancialHistoryModal leaseId={historyLeaseId} onClose={() => setHistoryLeaseId(null)} />
      )}
    </>
  );
}
