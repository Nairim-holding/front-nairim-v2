/**
 * Ponto de entrada centralizado para todos os tipos da aplicação.
 * Prefira importar de "@/types" em vez de arquivos individuais.
 */

// ─── Componentes de UI ────────────────────────────────────────────────────────
export type {
  ColumnType,
  ColumnDef,
  Option,
  FormFieldDef,
  FormStep,
  DynamicFormConfig,
} from './types';

// ─── Métricas do Dashboard ───────────────────────────────────────────────────
export type {
  MetricDataItem,
  MetricWithData,
  MetricResponse,
} from './types';

// ─── Auth ────────────────────────────────────────────────────────────────────

/** Resposta do endpoint POST /auth/login */
export type { ApiResponse as AuthLoginResponse } from './types';

// ─── Administradores ─────────────────────────────────────────────────────────
export type {
  SortOrder,
  Header,
  UserData,
  FilterField,
  TableState,
  ApiResponse as AdminApiResponse,
} from './administrador';

// ─── Proprietários ───────────────────────────────────────────────────────────
export type { OwnerType, OwnerFormData } from './owner';

// ─── Imóveis / API REST ───────────────────────────────────────────────────────

/** Resposta paginada genérica da API */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface PaginatedResponse<T> {
  items?: T[];
  properties?: T[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  results?: T[];
  data?: T[];
  count?: number;
  total?: number;
  totalCount?: number;
  page?: number;
  currentPage?: number;
  limit?: number;
  totalPages?: number;
  pages?: number;
  success?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface PropertyAddress {
  id: string;
  zip_code: string;
  street: string;
  number: string;
  district: string;
  city: string;
  state: string;
  country: string;
}

export interface PropertyValues {
  purchase_value: number;
  rental_value: number;
  condo_fee: number;
  property_tax: number;
  status: 'AVAILABLE' | 'RENTED' | 'SOLD' | 'MAINTENANCE';
  notes?: string;
  reference_date: string;
}

export interface PropertyDocument {
  id: string;
  url: string;
  type: string;
  filename: string;
}

export interface Property {
  id: string;
  title: string;
  description?: string;
  bedrooms: number;
  bathrooms: number;
  half_bathrooms: number;
  garage_spaces: number;
  area_total: number;
  area_built: number;
  frontage: number;
  furnished: boolean;
  floor_number: number;
  tax_registration: string;
  notes?: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
  owner_id: string;
  type_id: string;
  agency_id: string;
  address: PropertyAddress;
  values: PropertyValues;
  documents?: PropertyDocument[];
  type?: { id: string; description: string; name?: string };
  property_type?: string;
  images?: string[];
  photos?: string[];
}

export interface PropertyFilters {
  page?: number;
  limit?: number;
  status?: string;
  property_type?: string;
  transaction_type?: string;
  min_price?: number;
  max_price?: number;
  city?: string;
  state?: string;
  district?: string;
  zip_code?: string;
  bedrooms?: number;
  bathrooms?: number;
  garage_spaces?: number;
  min_area?: number;
  max_area?: number;
  furnished?: boolean;
  search?: string;
  floor?: number;
  lavabo?: number;
  facade_condition?: string;
  available_from?: string;
}
