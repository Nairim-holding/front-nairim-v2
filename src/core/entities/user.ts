/**
 * Entidade de domínio: Usuário.
 *
 * Representa o usuário do sistema de forma independente do Prisma. Os
 * repositórios (infra) traduzem o registro do banco para estas formas.
 *
 * Camada: core.
 * Origem: model `User` (prisma/schema.prisma) e seleções usadas em
 * api-nairim-v2/src/services/AuthService.ts.
 */

/** Perfil do usuário (dados não sensíveis). */
export interface User {
  id: string;
  name: string;
  email: string;
  /** Papel bruto do banco (ex: 'ADMIN', 'DEFAULT', 'SUPER_ADMIN'). */
  role: string;
  company_id: string;
  birth_date: Date | null;
  gender: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Credenciais do usuário — inclui o hash da senha. Usado apenas em fluxos de
 * autenticação (login, troca de senha) e nunca deve sair da camada de aplicação
 * para o cliente.
 */
export interface UserCredentials {
  id: string;
  name: string;
  email: string;
  role: string;
  company_id: string;
  created_at: Date;
  /** Hash bcrypt da senha. */
  password: string;
}

/** Valores do enum Gender (prisma/schema.prisma). */
export const GENDERS = ['MALE', 'FEMALE', 'OTHER'] as const;
export type Gender = (typeof GENDERS)[number];

/** Valores do enum Role (prisma/schema.prisma). */
export const ROLES = ['DEFAULT', 'ADMIN', 'SUPER_ADMIN'] as const;
export type Role = (typeof ROLES)[number];

/** Perfil público de usuário retornado pelos endpoints (sem senha/company_id). */
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  birth_date: Date | null;
  gender: string | null;
  role: string;
  /** Situação cadastral (campo `is_active`); usado pela listagem/toggle. */
  is_active?: boolean;
  user_group_id?: string | null;
  /** URL da foto de perfil (usada pelo form de edição/upload). */
  photo_url?: string | null;
  /** Grupo de permissões (listagem: `group.description`). */
  group?: { id: string; description: string } | null;
  created_at: Date;
  updated_at: Date;
}

/** Uma linha da agenda de acesso, com horários no formato "HH:MM". */
export interface AccessScheduleRow {
  day_of_week: number; // 0=Domingo ... 6=Sábado (Date.getDay())
  start_time: string;
  end_time: string;
}

/** Dados de criação de usuário (a senha já chega em hash, gerado no use-case). */
export interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
  birth_date: Date;
  gender: string;
  role?: string;
  user_group_id?: string | null;
  is_active?: boolean;
  photo_url?: string | null;
  phone_country_code?: string | null;
  phone_area_code?: string | null;
  phone?: string | null;
  phone_extension?: string | null;
  has_time_restriction?: boolean;
  created_by?: string | null;
}

/** Dados de atualização de usuário (campos opcionais; senha já em hash). */
export interface UpdateUserData {
  name?: string;
  email?: string;
  passwordHash?: string;
  birth_date?: Date;
  gender?: string;
  role?: string;
  user_group_id?: string | null;
  is_active?: boolean;
  photo_url?: string | null;
  phone_country_code?: string | null;
  phone_area_code?: string | null;
  phone?: string | null;
  phone_extension?: string | null;
  has_time_restriction?: boolean;
  updated_by?: string | null;
}

/**
 * Detalhe completo do usuário (GET /users/:id) — o perfil enriquecido com
 * situação, foto, telefones, grupo, auditoria e a agenda de acesso já com
 * horários em "HH:MM". Usado pelas telas de edição/visualização.
 */
export interface UserDetail extends UserProfile {
  user_group_id: string | null;
  is_active: boolean;
  photo_url: string | null;
  phone_country_code: string | null;
  phone_area_code: string | null;
  phone: string | null;
  phone_extension: string | null;
  has_time_restriction: boolean;
  group?: { id: string; description: string } | null;
  access_schedules?: AccessScheduleRow[];
  creator?: { id: string; name: string } | null;
  updater?: { id: string; name: string } | null;
}

/** Parâmetros de listagem de usuários. */
export interface ListUsersParams {
  limit: number;
  page: number;
  search?: string;
  /** Mapa `sort_<campo>` → 'asc' | 'desc'. */
  sortOptions: Record<string, string>;
  includeInactive: boolean;
  filters: Record<string, unknown>;
}

/** Resultado paginado (formato flat do DataTable). */
export interface PaginatedUsers {
  data: UserProfile[];
  count: number;
  totalPages: number;
  currentPage: number;
}
