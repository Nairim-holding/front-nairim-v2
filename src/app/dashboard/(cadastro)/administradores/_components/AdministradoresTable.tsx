/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { Power } from 'lucide-react';
import type { ColumnDef } from '@/types/types';
import { useMessageContext } from '@/contexts/MessageContext';
import { usePopupContext } from '@/contexts/PopupContext';
import DynamicTableManager from '@/components/table/DataTable';

interface AdministradoresTableProps {
  columns: ColumnDef[];
}

/**
 * Envolve o DataTable para segurar o botão liga/desliga por linha — a página da
 * listagem é server component (exporta metadata) e não pode ter estado.
 */
export default function AdministradoresTable({ columns }: AdministradoresTableProps) {
  const { showMessage } = useMessageContext();
  const { showPopup } = usePopupContext();
  // O DataTable gerencia os próprios dados e não expõe refresh externo:
  // remontar é o jeito direto de refletir a mudança de situação.
  const [tableKey, setTableKey] = useState(0);

  const toggleActive = (item: any) => {
    const willActivate = item.is_active === false;

    showPopup(
      willActivate ? 'Ativar usuário' : 'Desativar usuário',
      willActivate
        ? `Deseja ativar "${item.name}"?`
        : `Deseja desativar "${item.name}"? Ele continua cadastrado, apenas marcado como inativo.`,
      async () => {
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_URL_API}/users/${item.id}/active`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ is_active: willActivate }),
            }
          );

          const json = await res.json().catch(() => null);

          if (!res.ok) {
            showMessage(json?.message || `Erro ${res.status} ao alterar a situação`, 'error');
            return;
          }

          showMessage(json?.message || 'Situação alterada com sucesso!', 'success');
          setTableKey((k) => k + 1);
        } catch (e: any) {
          showMessage(e?.message || 'Falha ao alterar a situação', 'error');
        }
      }
    );
  };

  return (
    <DynamicTableManager
      key={tableKey}
      resource="users"
      title="Administradores"
      columns={columns}
      basePath="/dashboard/administradores"
      autoFocusSearch
      rowActions={[
        {
          key: 'toggle-active',
          title: 'Ativar / desativar usuário',
          icon: <Power size={16} />,
          onClick: toggleActive,
          action: 'edit',
        },
      ]}
    />
  );
}
