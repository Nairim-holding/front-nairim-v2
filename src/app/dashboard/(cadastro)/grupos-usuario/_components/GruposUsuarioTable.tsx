/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { Copy } from 'lucide-react';
import type { ColumnDef } from '@/types/types';
import { useMessageContext } from '@/contexts/MessageContext';
import DynamicTableManager from '@/components/table/DataTable';
import CloneUserGroupModal from '@/components/modals/CloneUserGroupModal';

interface GruposUsuarioTableProps {
  columns: ColumnDef[];
}

/**
 * Envolve o DataTable para segurar o estado do modal de clonagem — a página da
 * listagem é server component (exporta metadata) e não pode ter estado.
 */
export default function GruposUsuarioTable({ columns }: GruposUsuarioTableProps) {
  const { showMessage } = useMessageContext();
  const [cloneSource, setCloneSource] = useState<{ id: string; description: string } | null>(null);
  // O DataTable gerencia os próprios dados e não expõe refresh externo:
  // remontar é o jeito direto de refletir o grupo recém-criado.
  const [tableKey, setTableKey] = useState(0);

  return (
    <>
      <DynamicTableManager
        key={tableKey}
        resource="user-groups"
        title="Grupo de Usuário"
        columns={columns}
        basePath="/dashboard/grupos-usuario"
        autoFocusSearch
        rowActions={[
          {
            key: 'clone',
            title: 'Clonar grupo e suas diretivas',
            icon: <Copy size={16} />,
            onClick: (item: any) =>
              setCloneSource({ id: item.id, description: item.description }),
            action: 'create',
          },
        ]}
      />

      {cloneSource && (
        <CloneUserGroupModal
          source={cloneSource}
          onClose={() => setCloneSource(null)}
          onCloned={(message) => {
            showMessage(message, 'success');
            setTableKey((k) => k + 1);
          }}
        />
      )}
    </>
  );
}
