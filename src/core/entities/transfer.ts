import type { Category } from '@/core/entities/category';

/**
 * Entidades de domínio de Transferência entre Contas.
 *
 * O Módulo 9 (financeiro) porta a fundação de transferência no passo de
 * categoria porque `CategoryService.getCategories` chama
 * `TransferService.ensureTransferCategories` antes de listar. Neste momento
 * apenas a fundação (`ensureTransferCategories`) está portada; o
 * `createTransfer` completo chega no passo `financial-transaction` (Módulo 9g).
 *
 * Camada: core.
 * Origem: api-nairim-v2/src/services/TransferService.ts.
 */

/** Nomes canônicos das categorias internas de transferência (iguais ao backend). */
export const TRANSFER_OUTFLOW_CATEGORY_NAME = 'Transferência entre Contas – Saída';
export const TRANSFER_INFLOW_CATEGORY_NAME = 'Transferência entre Contas – Entrada';

export interface EnsureTransferCategoriesResult {
  outflow: Category;
  inflow: Category;
}