import type {
  AdjustmentIndex,
  CreateAdjustmentIndexData,
  ListAdjustmentIndexesParams,
  PaginatedAdjustmentIndexes,
  UpdateAdjustmentIndexData,
  UpsertAdjustmentIndexValueData,
} from '@/core/entities/adjustment-index';

/**
 * Contrato de acesso a dados dos Índices de Reajuste (Etapa 4).
 * Implementação Prisma: infra/repositories/prisma-adjustment-indexes-repository.ts.
 * Tenant-scoped (empresa): roda dentro de `withTenant`.
 *
 * Camada: core.
 */
export interface AdjustmentIndexesRepository {
  list(params: ListAdjustmentIndexesParams): Promise<PaginatedAdjustmentIndexes>;
  /** Indexador por ID, com os valores mensais (mais recentes primeiro). */
  findById(id: string): Promise<AdjustmentIndex | null>;
  /** Busca pela sigla — usada pela sincronização para achar o indexador. */
  findByCode(code: string): Promise<AdjustmentIndex | null>;
  create(data: CreateAdjustmentIndexData): Promise<AdjustmentIndex>;
  update(id: string, data: UpdateAdjustmentIndexData): Promise<AdjustmentIndex>;
  softDelete(id: string): Promise<AdjustmentIndex>;
  /** Opções para o ComboBox da locação (só os ativos). */
  listOptions(): Promise<Array<{ label: string; value: string }>>;
  /**
   * Grava um valor mensal. Idempotente por (indexador, ano, mês): rodar a
   * sincronização duas vezes atualiza a linha em vez de duplicar.
   */
  upsertValue(data: UpsertAdjustmentIndexValueData): Promise<void>;
  /** Grava vários valores de uma vez (uma rodada de sincronização). */
  upsertValues(values: UpsertAdjustmentIndexValueData[]): Promise<number>;
  /** Remove um valor mensal digitado por engano. */
  deleteValue(id: string): Promise<void>;
  /**
   * Semeia os indexadores padrão (IGP-M, IPCA, INPC, IVAR) que ainda não
   * existirem na empresa. Devolve quantos foram criados.
   */
  seedDefaults(): Promise<number>;
}
