import type {
  Center,
  CreateCenterData,
  ListCentersParams,
  PaginatedCenters,
  UpdateCenterData,
} from '@/core/entities/financial-center';
import type { TransactionType } from '@/core/entities/category';

/**
 * Contrato de acesso a dados de Centro de Custo.
 * Implementação Prisma: infra/repositories/prisma-financial-centers-repository.ts.
 * Tenant-scoped (empresa): roda dentro de `withTenant`.
 *
 * Camada: core.
 * Origem: `prisma.center.*` em api-nairim-v2/src/services/CenterService.ts.
 */
export interface CentersRepository {
  list(params: ListCentersParams): Promise<PaginatedCenters>;
  getFilters(): Promise<Record<string, unknown>>;
  /** Centro por ID (não excluído). */
  findById(id: string): Promise<Center | null>;
  create(data: CreateCenterData): Promise<Center>;
  update(id: string, data: UpdateCenterData): Promise<Center>;
  /**
   * Soft-delete. Lança conflito (409) se existirem transações não-excluídas
   * vinculadas (mensagem do backend normalizada com acentuação).
   */
  softDelete(id: string): Promise<Center>;
  /** Estado de exclusão (para restore validar). */
  findDeletionState(id: string): Promise<{ id: string; deleted_at: Date | null } | null>;
  restore(id: string): Promise<Center>;
  /** find-or-create insensível a maiúsculas pelo nome + tipo. */
  quickCreate(data: { name: string; type: TransactionType }): Promise<Center>;
}