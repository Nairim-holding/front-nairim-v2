import type {
  CancelLeaseInput,
  CancelLeaseResult,
  CancellationPreview,
  CreateLeaseData,
  Lease,
  ListLeasesParams,
  PaginatedLeases,
  UpdateLeaseData,
} from '@/core/entities/lease';

/**
 * Contrato de acesso a dados de Locação (Lease).
 * Implementação Prisma: infra/repositories/prisma-leases-repository.ts.
 * Tenant-scoped: todos os métodos rodam dentro de `withTenant`.
 *
 * Camada: core.
 * Origem: `prisma.lease.*` em api-nairim-v2/src/services/LeaseService.ts.
 */
export interface LeasesRepository {
  list(params: ListLeasesParams): Promise<PaginatedLeases>;
  getFilters(filters: Record<string, unknown>): Promise<Record<string, unknown>>;
  findById(id: string): Promise<Lease | null>;

  contractNumberExists(contractNumber: string): Promise<boolean>;
  contractNumberExistsExcept(contractNumber: string, exceptId: string): Promise<boolean>;
  /** categoria do imóvel — obrigatória para criar uma locação. */
  getPropertyCategoryId(propertyId: string): Promise<string | null>;

  /**
   * Cria a locação + ajusta o status do imóvel (OCCUPIED) numa transação.
   * Retorna o registro cru (sem relations profundas) — o `company_id` vem do
   * contexto de tenant.
   */
  create(data: CreateLeaseData): Promise<Lease>;

  /** Atualiza a locação + ajusta o status do imóvel conforme o novo status calculado. */
  update(id: string, data: UpdateLeaseData): Promise<Lease>;

  /** Soft-delete (cancela + libera o imóvel se não houver outra locação ativa). */
  softDelete(id: string): Promise<Lease | null>;

  /** Hard delete + cascata de transações vinculadas + libera o imóvel. */
  permanentlyDelete(id: string): Promise<Lease | null>;

  /** Restaura (recalcula status pela data de término) + ocupa o imóvel. */
  restore(id: string): Promise<Lease | null>;

  /** Prévia dos lançamentos que seriam excluídos num cancelamento a partir de `date`. */
  getCancellationPreview(id: string, date: string): Promise<CancellationPreview | null>;

  /**
   * Efetiva o cancelamento: soft-delete dos lançamentos confirmados, encargo
   * opcional, marca CANCELED, libera o imóvel.
   */
  cancel(id: string, input: CancelLeaseInput, companyId: string): Promise<CancelLeaseResult | null>;

  /** A locação existe (ativa)? Usado antes de anexar/remover documentos. */
  exists(id: string): Promise<boolean>;

  /** Soft-delete de documentos da locação (por id), restrito à própria locação. */
  removeDocuments(leaseId: string, documentIds: string[]): Promise<void>;

  /** Cria os registros `Document` (tipo LEASE_CONTRACT) para os arquivos já enviados ao storage. */
  createDocuments(leaseId: string, documents: Array<{ url: string; mimetype: string; description: string; createdBy: string | null }>): Promise<void>;
}
