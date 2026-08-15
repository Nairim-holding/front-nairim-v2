import type {
  Agency,
  ContactSuggestion,
  CreateAgencyData,
  ListAgenciesParams,
  PaginatedAgencies,
  UpdateAgencyData,
} from '@/core/entities/agency';

/**
 * Contrato de acesso a dados de Imobiliária.
 * Implementação Prisma: infra/repositories/prisma-agencies-repository.ts.
 *
 * Tenant-scoped: todos os métodos rodam dentro de `withTenant`.
 *
 * Camada: core.
 * Origem: `prisma.agency.*` em api-nairim-v2/src/services/AgencyService.ts.
 */
export interface AgenciesRepository {
  /** Lista paginada com busca (memória), ordenação e filtros. */
  list(params: ListAgenciesParams): Promise<PaginatedAgencies>;

  /** Filtros contextuais do DataTable (valores distintos + range de data). */
  getFilters(filters: Record<string, unknown>): Promise<Record<string, unknown>>;

  /** Imobiliária por ID com endereços/contatos ativos, ou `null`. */
  findById(id: string): Promise<Agency | null>;

  /** Existe imobiliária ativa com este CNPJ? */
  cnpjExists(cnpj: string): Promise<boolean>;

  /** Existe OUTRA imobiliária ativa (id != exceptId) com este CNPJ? */
  cnpjExistsExcept(cnpj: string, exceptId: string): Promise<boolean>;

  /** Cria imobiliária (+ contatos + endereços) numa transação. */
  create(data: CreateAgencyData): Promise<Agency>;

  /** Atualiza imobiliária; se `contacts`/`addresses` vierem, substituem os atuais. */
  update(id: string, data: UpdateAgencyData): Promise<Agency>;

  /** Soft-delete (+ contatos). @returns dados p/ a mensagem (legal_name). */
  softDelete(id: string): Promise<{ legal_name: string }>;

  /** Estado de exclusão (para validar restore), ou `null`. */
  findDeletionState(id: string): Promise<{ legal_name: string; deleted_at: Date | null } | null>;

  /** Restaura (+ contatos). @returns legal_name. */
  restore(id: string): Promise<{ legal_name: string }>;

  /** Sugestões de contato (autocomplete), deduplicadas. */
  getAvailableContacts(search: string): Promise<ContactSuggestion[]>;
}
