/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Search, CheckSquare, Square } from 'lucide-react';
import Checkbox from '@/components/ui/Checkbox';

/** Ações na ordem em que aparecem como colunas. */
const ACTIONS = [
  { key: 'create', column: 'can_create', label: 'Criar' },
  { key: 'view', column: 'can_view', label: 'Visualizar' },
  { key: 'edit', column: 'can_edit', label: 'Editar' },
  { key: 'delete', column: 'can_delete', label: 'Excluir' },
  { key: 'export', column: 'can_export', label: 'Exportar' },
  { key: 'custom_field', column: 'can_custom_field', label: 'Campo personalizado' },
] as const;

type ActionKey = (typeof ACTIONS)[number]['key'];

interface ResourceCatalogItem {
  key: string;
  label: string;
  group: string;
  actions: ActionKey[];
}

export type PermissionState = Record<string, Record<string, boolean>>;

interface PermissionMatrixProps {
  value?: PermissionState;
  onChange?: (value: PermissionState) => void;
  disabled?: boolean;
  /** Em edição/visualização: carrega as diretivas já salvas deste grupo. */
  groupId?: string;
}

function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

export default function PermissionMatrix({
  value,
  onChange,
  disabled = false,
  groupId,
}: PermissionMatrixProps) {
  const [catalog, setCatalog] = useState<ResourceCatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // O DynamicForm inicializa campos custom com [] — normaliza para objeto
  const state: PermissionState = useMemo(
    () => (value && !Array.isArray(value) ? value : {}),
    [value]
  );

  // Catálogo é metadado estático do backend — carrega uma vez
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_URL_API}/user-groups/resources`, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`Erro ${res.status}`);
        const json = await res.json();
        if (!cancelled) setCatalog(json.data ?? []);
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Falha ao carregar recursos');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Diretivas já salvas do grupo (edição/visualização). Publica no form via
  // onChange para que o submit da página possa enviá-las.
  useEffect(() => {
    if (!groupId || !onChange) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_URL_API}/user-groups/${groupId}/permissions`,
          { cache: 'no-store' }
        );
        if (!res.ok) throw new Error(`Erro ${res.status}`);
        const json = await res.json();

        const seeded: PermissionState = {};
        for (const row of json.data ?? []) {
          const { resource, ...flags } = row;
          seeded[resource] = flags;
        }
        if (!cancelled) onChange(seeded);
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Falha ao carregar diretivas salvas');
      }
    })();

    return () => {
      cancelled = true;
    };
    // Só na montagem: recarregar a cada onChange sobrescreveria a edição em curso
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const isOn = useCallback(
    (resource: string, column: string) => state?.[resource]?.[column] === true,
    [state]
  );

  const setCells = useCallback(
    (changes: Array<{ resource: string; column: string; on: boolean }>) => {
      if (disabled || !onChange) return;

      const next: PermissionState = { ...state };
      for (const { resource, column, on } of changes) {
        next[resource] = { ...(next[resource] ?? {}), [column]: on };
      }
      onChange(next);
    },
    [disabled, onChange, state]
  );

  // Agrupa por seção de menu, preservando a ordem do catálogo
  const groups = useMemo(() => {
    const term = normalize(search);
    const filtered = term
      ? catalog.filter((r) => normalize(r.label).includes(term))
      : catalog;

    const map = new Map<string, ResourceCatalogItem[]>();
    for (const r of filtered) {
      if (!map.has(r.group)) map.set(r.group, []);
      map.get(r.group)!.push(r);
    }
    return Array.from(map, ([group, resources]) => ({ group, resources }));
  }, [catalog, search]);

  const visibleResources = useMemo(
    () => groups.flatMap((g) => g.resources),
    [groups]
  );

  const toggleGroup = (group: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  /** Estado de uma coluna nas linhas visíveis: todas, nenhuma ou parcial. */
  const columnState = (column: string, action: ActionKey, resources: ResourceCatalogItem[]) => {
    const applicable = resources.filter((r) => r.actions.includes(action));
    if (applicable.length === 0) return { checked: false, indeterminate: false, applicable };
    const on = applicable.filter((r) => isOn(r.key, column)).length;
    return {
      checked: on === applicable.length,
      indeterminate: on > 0 && on < applicable.length,
      applicable,
    };
  };

  const toggleColumn = (column: string, action: ActionKey, resources: ResourceCatalogItem[]) => {
    const { checked, applicable } = columnState(column, action, resources);
    setCells(applicable.map((r) => ({ resource: r.key, column, on: !checked })));
  };

  const rowState = (resource: ResourceCatalogItem) => {
    const on = resource.actions.filter((a) => {
      const col = ACTIONS.find((x) => x.key === a)!.column;
      return isOn(resource.key, col);
    }).length;
    return {
      checked: on === resource.actions.length,
      indeterminate: on > 0 && on < resource.actions.length,
    };
  };

  const toggleRow = (resource: ResourceCatalogItem) => {
    const { checked } = rowState(resource);
    setCells(
      resource.actions.map((a) => ({
        resource: resource.key,
        column: ACTIONS.find((x) => x.key === a)!.column,
        on: !checked,
      }))
    );
  };

  const setAll = (on: boolean) => {
    setCells(
      visibleResources.flatMap((r) =>
        r.actions.map((a) => ({
          resource: r.key,
          column: ACTIONS.find((x) => x.key === a)!.column,
          on,
        }))
      )
    );
  };

  if (isLoading) {
    return (
      <div className="py-8 text-center text-sm text-content-muted">
        Carregando recursos…
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 text-center text-sm text-red-600">
        {error}
      </div>
    );
  }

  return (
    <div className="col-span-full">
      {/* Barra de ações: busca + marcar/desmarcar tudo */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar recurso…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-card border border-ui-border text-content placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-brand/50"
          />
        </div>

        {!disabled && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAll(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-ui-border hover:bg-ui-border-muted text-content-secondary transition-colors"
            >
              <CheckSquare size={16} />
              Marcar tudo
            </button>
            <button
              type="button"
              onClick={() => setAll(false)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-ui-border hover:bg-ui-border-muted text-content-secondary transition-colors"
            >
              <Square size={16} />
              Limpar
            </button>
          </div>
        )}
      </div>

      {/* Wrapper com scroll horizontal próprio: a página nunca rola na horizontal */}
      <div className="overflow-x-auto rounded-lg border border-ui-border">
        <table className="w-full min-w-[720px] text-sm border-collapse">
          <thead>
            <tr className="bg-page">
              <th className="sticky left-0 z-10 bg-page text-left font-medium text-content-secondary px-4 py-3 min-w-[220px]">
                Nome
              </th>
              {ACTIONS.map(({ key, column, label }) => {
                const st = columnState(column, key, visibleResources);
                return (
                  <th
                    key={key}
                    className="px-3 py-3 font-medium text-content-secondary whitespace-nowrap"
                  >
                    <div className="flex flex-col items-center gap-1.5">
                      <span>{label}</span>
                      {!disabled && st.applicable.length > 0 && (
                        <Checkbox
                          checked={st.checked}
                          indeterminate={st.indeterminate}
                          onChange={() => toggleColumn(column, key, visibleResources)}
                          ariaLabel={`Marcar ${label} em todos os recursos`}
                        />
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {groups.map(({ group, resources }) => {
              const isCollapsed = collapsed.has(group);

              return (
                <Fragment key={group}>
                  <tr className="bg-page/60">
                    <td
                      colSpan={ACTIONS.length + 1}
                      className="px-4 py-2 border-t border-ui-border"
                    >
                      <button
                        type="button"
                        onClick={() => toggleGroup(group)}
                        className="flex items-center gap-1.5 font-semibold text-content-secondary hover:text-content transition-colors"
                      >
                        {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                        Menu: {group}
                      </button>
                    </td>
                  </tr>

                  {!isCollapsed &&
                    resources.map((resource) => {
                      const rs = rowState(resource);

                      return (
                        <tr
                          key={resource.key}
                          className="border-t border-ui-border hover:bg-page/40"
                        >
                          <td className="sticky left-0 z-10 bg-card px-4 py-2.5">
                            <div className="flex items-center gap-2.5">
                              {!disabled && (
                                <Checkbox
                                  checked={rs.checked}
                                  indeterminate={rs.indeterminate}
                                  onChange={() => toggleRow(resource)}
                                  ariaLabel={`Marcar todas as permissões de ${resource.label}`}
                                />
                              )}
                              <span className="text-content">{resource.label}</span>
                            </div>
                          </td>

                          {ACTIONS.map(({ key, column, label }) => {
                            // Ação não aplicável ao recurso → célula vazia, sem checkbox
                            if (!resource.actions.includes(key)) {
                              return <td key={key} className="px-3 py-2.5" />;
                            }

                            return (
                              <td key={key} className="px-3 py-2.5">
                                <div className="flex justify-center">
                                  <Checkbox
                                    checked={isOn(resource.key, column)}
                                    onChange={(on) =>
                                      setCells([{ resource: resource.key, column, on }])
                                    }
                                    disabled={disabled}
                                    ariaLabel={`${label} em ${resource.label}`}
                                  />
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                </Fragment>
              );
            })}

            {visibleResources.length === 0 && (
              <tr className="border-t border-ui-border">
                <td
                  colSpan={ACTIONS.length + 1}
                  className="px-4 py-8 text-center text-content-muted"
                >
                  Nenhum recurso encontrado para “{search}”.
                </td>
              </tr>
            )}
          </tbody>

          <tfoot>
            <tr className="border-t border-ui-border bg-page">
              <td
                colSpan={ACTIONS.length + 1}
                className="px-4 py-2.5 font-medium text-content-secondary"
              >
                Total: {visibleResources.length}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
