import 'server-only';
import { userUseCases } from '@/infra/factories/user-factory';
import { withPermission } from '@/infra/auth/session';
import { listUsersQuerySchema } from '@/shared/validators/user';
import type { PaginatedUsers, UserDetail } from '@/core/entities/user';

/**
 * Queries (leitura) do módulo Users — para Server Components.
 * Substituem os GETs de `/users`.
 *
 * Guarda: `withTenant` (autenticado + contexto de empresa), igual ao backend,
 * onde `/users` fica atrás de `authenticateJWT + requireTenant` (sem exigir admin).
 *
 * Camada: server (apresentação SSR).
 * Origem: api-nairim-v2/src/controllers/UserController.ts (GETs).
 */

/**
 * Separa os parâmetros crus (query string / objeto) em paginação, ordenação e
 * filtros — porte da extração feita no `UserController.getUsers`.
 */
function splitListParams(raw: Record<string, unknown>) {
  const sortOptions: Record<string, string> = {};
  const filters: Record<string, unknown> = {};

  Object.entries(raw ?? {}).forEach(([key, value]) => {
    // Ordenação no formato `sort[campo]=asc` ou no formato antigo `sort_campo=asc`.
    if (key.startsWith('sort[') && key.endsWith(']')) {
      const field = key.substring(5, key.length - 1);
      const direction = String(value).toLowerCase();
      if (direction === 'asc' || direction === 'desc') sortOptions[`sort_${field}`] = direction;
      return;
    }
    if (key.startsWith('sort_')) {
      const direction = String(value).toLowerCase();
      if (direction === 'asc' || direction === 'desc') sortOptions[key] = direction;
      return;
    }
    // Parâmetros de controle não são filtros.
    if (['limit', 'page', 'search', 'includeInactive'].includes(key) || key.startsWith('sort')) return;

    if (value !== undefined && value !== null && value !== '' && value !== 'undefined' && value !== 'null') {
      // Filtros de data podem vir como JSON (`{"from":...,"to":...}`).
      if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
        try {
          const parsed = JSON.parse(value);
          filters[key] = parsed && typeof parsed === 'object' ? parsed : value;
        } catch {
          filters[key] = value;
        }
      } else {
        filters[key] = value;
      }
    }
  });

  return { sortOptions, filters };
}

/** Lista usuários paginados. Origem: GET /users. */
export async function listUsersData(raw: Record<string, unknown>): Promise<PaginatedUsers> {
  const { limit, page, search, includeInactive } = listUsersQuerySchema.parse(raw);
  const { sortOptions, filters } = splitListParams(raw);

  return withPermission('users', 'view', () =>
    userUseCases.list.execute({ limit, page, search, sortOptions, includeInactive, filters }),
  );
}

/** Usuário por ID (detalhe completo). Origem: GET /users/:id. */
export async function getUserByIdData(id: string): Promise<UserDetail> {
  return withPermission('users', 'view', () => userUseCases.getById.execute(id));
}

/** Filtros contextuais do DataTable. Origem: GET /users/filters. */
export async function getUserFiltersData(raw: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { filters } = splitListParams(raw);
  return withPermission('users', 'view', () => userUseCases.getFilters.execute(filters));
}
