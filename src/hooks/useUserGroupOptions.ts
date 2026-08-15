import { useEffect, useState } from 'react';
import type { Option } from '@/types/types';
import { listUserGroupsAction } from '@/server/actions/user-group';

/**
 * Opções de Grupo de Usuário para o select do cadastro de administrador.
 * A primeira opção é vazia: usuário sem grupo não sofre restrição de diretivas.
 */
export function useUserGroupOptions() {
  const [options, setOptions] = useState<Option[]>([{ label: 'Sem grupo', value: '' }]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const result = await listUserGroupsAction({ limit: '100', 'sort[description]': 'asc' });
        if (!result.ok) throw new Error(result.error);

        if (!cancelled) {
          setOptions([
            { label: 'Sem grupo', value: '' },
            ...result.data.data.map((g) => ({ label: g.description, value: g.id })),
          ]);
        }
      } catch (error) {
        console.error('Erro ao carregar grupos de usuário:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { options, isLoading };
}
