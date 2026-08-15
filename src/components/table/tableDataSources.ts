/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Registro central de fontes de dados das tabelas (DataTable).
 *
 * Substitui o fetch direto ao Express (`${NEXT_PUBLIC_URL_API}/${resource}`)
 * por Server Actions, mantendo o mesmo shape paginado `{ data, count, totalPages,
 * currentPage }` (formato "flat") que o DataTable já consome.
 *
 * Resources sem entry no registro continuam usando o fetch original.
 */

import { listPropertiesAction, deletePropertyAction, getPropertyFiltersAction } from '@/server/actions/property';
import { listLeasesAction, updateLeaseAction, deleteLeaseAction, permanentlyDeleteLeaseAction, getLeaseFiltersAction } from '@/server/actions/lease';
import { listTenantsAction, deleteTenantAction, getTenantFiltersAction } from '@/server/actions/tenant';
import { listOwnersAction, deleteOwnerAction, getOwnerFiltersAction } from '@/server/actions/owner';
import { listAgenciesAction, deleteAgencyAction, getAgencyFiltersAction } from '@/server/actions/agency';
import { listPropertyTypesAction, deletePropertyTypeAction, getPropertyTypeFiltersAction } from '@/server/actions/property-type';
import { listUsersAction, deleteUserAction, getUserFiltersAction } from '@/server/actions/user';
import { listCompaniesAction, deleteCompanyAction, getCompanyFiltersAction } from '@/server/actions/company';
import { listAuditLogsAction, getAuditLogFiltersAction } from '@/server/actions/audit-log';
import { listUserGroupsAction, deleteUserGroupAction, getUserGroupFiltersAction } from '@/server/actions/user-group';

interface TableListFetcher {
  (state: any): Promise<any>;
}

interface TableFiltersFetcher {
  (applied?: Record<string, any>): Promise<any>;
}

interface TableDeleteHandler {
  (id: string): Promise<{ ok: boolean; error?: string }>;
}

interface TableDataSource {
  list: TableListFetcher;
  filters?: TableFiltersFetcher;
  delete?: TableDeleteHandler;
  cancelLease?: (id: string, data: Record<string, any>) => Promise<{ ok: boolean; error?: string }>;
  permanentDelete?: TableDeleteHandler;
}

/** Converte o estado da tabela para o formato `raw` aceito pelas actions de listagem. */
function stateToRawListParams(state: any): Record<string, unknown> {
  const raw: Record<string, unknown> = { page: state.page, limit: state.limit };
  if (state.search) raw.search = state.search;
  Object.entries(state.sort || {}).forEach(([key, value]) => {
    if (value === 'asc' || value === 'desc') raw[`sort[${key}]`] = value;
  });
  Object.entries(state.filters || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    raw[key] = value;
  });
  return raw;
}

/** Envolve uma action de listagem no contrato do fetcher do useOptimizedTableData. */
function listFetcher(action: (raw: Record<string, unknown>) => Promise<any>): TableListFetcher {
  return async (state: any) => {
    const result = await action(stateToRawListParams(state));
    if (!result.ok) throw new Error(result.error ?? 'Erro ao carregar dados.');
    return result.data;
  };
}

/** Envolve uma action de filtros no contrato do fetcher do useDynamicFilters. */
function filtersFetcher(action: (raw: Record<string, unknown>) => Promise<any>): TableFiltersFetcher {
  return async (applied?: Record<string, any>) => {
    const result = await action(applied ?? {});
    if (!result.ok) throw new Error(result.error ?? 'Erro ao carregar filtros.');
    return result.data;
  };
}

/** Envolve uma action de delete no contrato esperado pelo fluxo de exclusão. */
function deleteHandler(action: (id: string) => Promise<any>): TableDeleteHandler {
  return async (id: string) => {
    try {
      const result = await action(id);
      if (!result.ok) return { ok: false, error: result.error ?? 'Erro ao excluir.' };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Erro ao excluir.' };
    }
  };
}

export const TABLE_DATA_SOURCES: Record<string, TableDataSource> = {
  properties: {
    list: listFetcher(listPropertiesAction),
    filters: filtersFetcher(getPropertyFiltersAction),
    delete: deleteHandler(deletePropertyAction),
  },
  leases: {
    list: listFetcher(listLeasesAction),
    filters: filtersFetcher(getLeaseFiltersAction),
    delete: deleteHandler(deleteLeaseAction),
    cancelLease: async (id, data) => {
      const result = await updateLeaseAction(id, data);
      if (!result.ok) return { ok: false, error: result.error ?? 'Erro ao cancelar locação.' };
      return { ok: true };
    },
    permanentDelete: deleteHandler(permanentlyDeleteLeaseAction),
  },
  tenants: {
    list: listFetcher(listTenantsAction),
    filters: filtersFetcher(getTenantFiltersAction),
    delete: deleteHandler(deleteTenantAction),
  },
  owners: {
    list: listFetcher(listOwnersAction),
    filters: filtersFetcher(getOwnerFiltersAction),
    delete: deleteHandler(deleteOwnerAction),
  },
  agencies: {
    list: listFetcher(listAgenciesAction),
    filters: filtersFetcher(getAgencyFiltersAction),
    delete: deleteHandler(deleteAgencyAction),
  },
  'property-types': {
    list: listFetcher(listPropertyTypesAction),
    filters: filtersFetcher(getPropertyTypeFiltersAction),
    delete: deleteHandler(deletePropertyTypeAction),
  },
  users: {
    list: listFetcher(listUsersAction),
    filters: filtersFetcher(getUserFiltersAction),
    delete: deleteHandler(deleteUserAction),
  },
  companies: {
    list: listFetcher(listCompaniesAction),
    filters: filtersFetcher(getCompanyFiltersAction),
    delete: deleteHandler(deleteCompanyAction),
  },
  // Read-only — log é gerado pelo sistema, sem criar/editar/excluir.
  'audit-logs': {
    list: listFetcher(listAuditLogsAction),
    filters: filtersFetcher(getAuditLogFiltersAction),
  },
  'user-groups': {
    list: listFetcher(listUserGroupsAction),
    filters: filtersFetcher(getUserGroupFiltersAction),
    delete: deleteHandler(deleteUserGroupAction),
  },
};
