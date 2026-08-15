import type { TransactionType } from '@/core/entities/category';

/**
 * Entidades de domínio: Centro de custo (Center).
 *
 * Fidelidade ao backend: `getCenters` no Express recebe `company_id` (já era
 * escopado); a extensão multi-tenant injeta automaticamente nas leituras.
 * `deleteCenter` mensagem do backend "Nao e possivel excluir o centro pois
 * existem lancamentos relacionados." (sem acentos — o controller nunca casava
 * com `includes('lançamentos')`, então o 409 nunca era retornado e o erro virava
 * 500). Na migração normalizamos para `ConflictError` (409) com acentuação.
 *
 * Camada: core.
 * Origem: model `Center` (prisma/schema.prisma) e
 * api-nairim-v2/src/services/CenterService.ts.
 */

export interface Center {
  id: string;
  company_id: string;
  name: string;
  type: TransactionType;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface CreateCenterData {
  name: string;
  type: TransactionType;
  is_active?: boolean;
}

export interface UpdateCenterData {
  name?: string;
  type?: TransactionType;
  is_active?: boolean;
}

export interface ListCentersParams {
  limit: number;
  page: number;
  search?: string;
  filters: Record<string, unknown>;
  sortOptions: Record<string, string>;
  includeInactive: boolean;
}

export interface PaginatedCenters {
  data: Center[];
  count: number;
  totalPages: number;
  currentPage: number;
}