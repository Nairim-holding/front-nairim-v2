/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import type { Option } from '@/types/types';

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
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_URL_API}/user-groups?limit=100&sort[description]=asc`,
          { cache: 'no-store' }
        );
        if (!res.ok) throw new Error(`Erro ${res.status}`);

        const json = await res.json();
        // A listagem responde { data, count, totalPages, currentPage }
        const rows: any[] = json?.data ?? json?.data?.items ?? [];

        if (!cancelled) {
          setOptions([
            { label: 'Sem grupo', value: '' },
            ...rows.map((g) => ({ label: g.description, value: g.id })),
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
