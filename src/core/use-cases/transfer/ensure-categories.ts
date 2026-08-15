import type { CategoriesRepository } from '@/core/repositories/financial-categories-repository';
import type { EnsureTransferCategoriesResult } from '@/core/entities/transfer';

/**
 * Garante que as duas categorias internas de transferência existam para a
 * empresa (find-or-create idempotente). Chamado por `getCategories` do módulo
 * financial-category (fiel ao backend, que roda `ensureTransferCategories`
 * antes de listar) e será reutilizado no `createTransfer` do Módulo 9g.
 *
 * Camada: core.
 * Origem: api-nairim-v2/src/services/TransferService.ensureTransferCategories.
 */
export class EnsureTransferCategoriesUseCase {
  constructor(private readonly categories: CategoriesRepository) {}
  async execute(): Promise<EnsureTransferCategoriesResult> {
    return this.categories.ensureTransferCategories();
  }
}