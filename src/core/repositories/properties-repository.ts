import type {
  CreateUnifiedPropertyData,
  ListPropertiesParams,
  PaginatedProperties,
  Property,
  UpdateUnifiedPropertyData,
} from '@/core/entities/property';

/**
 * Contrato de acesso a dados de Imóvel.
 * Implementação Prisma: infra/repositories/prisma-properties-repository.ts.
 * Tenant-scoped: todos os métodos rodam dentro de `withTenant`.
 *
 * Camada: core.
 * Origem: `prisma.property.*` em api-nairim-v2/src/services/PropertyService.ts.
 */
export interface PropertiesRepository {
  list(params: ListPropertiesParams): Promise<PaginatedProperties>;
  getFilters(filters: Record<string, unknown>): Promise<Record<string, unknown>>;
  /** Imóvel por ID com todas as relações (owner/type/agency/address/values/iptus/documents/leases/favorites). */
  findById(id: string): Promise<Property | null>;

  /** Owner existe e está ativo? (validação de referência antes de criar/atualizar) */
  ownerExists(ownerId: string): Promise<boolean>;
  /** PropertyType existe e está ativo? */
  propertyTypeExists(typeId: string): Promise<boolean>;
  /** Agency existe e está ativa? (só verificado se `agencyId` for informado) */
  agencyExists(agencyId: string): Promise<boolean>;

  /**
   * Cria o imóvel + endereço + PropertyValue + IPTUs numa transação, e
   * retorna o registro completo (com relações). Espelha
   * `createPropertyTransaction` do backend.
   */
  create(data: CreateUnifiedPropertyData): Promise<Property>;

  /**
   * Atualiza o imóvel + endereço (upsert) + PropertyValue (upsert) + IPTUs
   * (upsert por id, remove os que saíram da lista) numa transação. Também
   * aplica o soft-delete dos `removedDocuments`, se houver. Espelha
   * `updatePropertyTransaction`.
   */
  update(id: string, data: UpdateUnifiedPropertyData, removedDocumentIds?: string[]): Promise<Property>;

  softDelete(id: string): Promise<Property | null>;
  findDeletionState(id: string): Promise<{ title: string; deleted_at: Date | null } | null>;
  restore(id: string): Promise<Property>;

  /**
   * Cria os registros `Document` para os arquivos já enviados ao storage
   * (a subida em si é responsabilidade do use-case, via `Storage`). Marca o
   * documento cujo nome/id bate com `featuredImageIdentifier` como destacado
   * (`is_featured`), desmarcando os demais IMAGE do imóvel.
   */
  createDocuments(
    propertyId: string,
    documents: Array<{ url: string; mimetype: string; type: string; description: string; createdBy: string | null }>,
    featuredIdentifier?: string,
  ): Promise<void>;
}
