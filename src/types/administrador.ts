export type SortOrder = "asc" | "desc";

export interface Header {
  label: string;
  field: string;
  sortParam?: string;
}

export interface UserData {
  id: string;
  name: string;
  email: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  birth_date: string;
  role: 'ADMIN' | 'DEFAULT' | 'SUPER_ADMIN';
  company_id: string;
  created_at: string;
  updated_at: string;
}

// Ajustado para a estrutura real da API
export interface ApiResponse {
  success: boolean;
  data?: {
    items?: UserData[];
    meta?: {
      total: number;
      page: number;
      totalPages: number;
      limit: number;
    };
  };
  message?: string;
  items?: UserData[]; // Fallback
  meta?: { // Fallback
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  };
}

export interface FilterField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select';
  options?: Array<{ value: string; label: string }>;
}

export interface TableState {
  page: number;
  limit: number;
  search: string;
  sort: Record<string, SortOrder>;
  filters: Record<string, string | number | null>;
}