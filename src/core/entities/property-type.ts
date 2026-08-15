/**
 * Entidade de domínio: Tipo de Imóvel (PropertyType).
 * Camada: core.
 * Origem: model `PropertyType` (prisma/schema.prisma) e
 * api-nairim-v2/src/services/PropertyTypeService.ts.
 */
export interface PropertyType {
  id: string;
  description: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}

export interface CreatePropertyTypeData {
  description: string;
}

export type UpdatePropertyTypeData = Partial<CreatePropertyTypeData>;

export interface ListPropertyTypesParams {
  limit: number;
  page: number;
  search?: string;
  filters: Record<string, unknown>;
  sortOptions: Record<string, string>;
  includeInactive: boolean;
}

export interface PaginatedPropertyTypes {
  data: PropertyType[];
  count: number;
  totalPages: number;
  currentPage: number;
}
