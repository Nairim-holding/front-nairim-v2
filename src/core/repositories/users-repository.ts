import type {
  AccessScheduleRow,
  CreateUserData,
  ListUsersParams,
  PaginatedUsers,
  UpdateUserData,
  User,
  UserCredentials,
  UserDetail,
  UserProfile,
} from '@/core/entities/user';

/**
 * Contratos de acesso a dados de Usuário (inversão de dependência).
 *
 * A interface é SEGREGADA em duas:
 *  - {@link AuthUsersRepository}: o mínimo que os casos de uso de autenticação
 *    precisam (rodam sem contexto de tenant).
 *  - {@link UsersRepository}: estende a anterior com as operações do módulo
 *    Users (rodam dentro de `withTenant`).
 *
 * Implementação Prisma (única, cobre ambas):
 * infra/repositories/prisma-users-repository.ts.
 *
 * Camada: core.
 * Origem: consultas `prisma.user.*` em api-nairim-v2/src/services/AuthService.ts
 * e UserService.ts.
 */
export interface AuthUsersRepository {
  /**
   * Busca as credenciais (com hash de senha) por e-mail, ignorando usuários
   * excluídos (`deleted_at != null`). Usado no login.
   * @returns Credenciais ou `null` se não existir.
   */
  findCredentialsByEmail(email: string): Promise<UserCredentials | null>;

  /**
   * Busca as credenciais (com hash de senha) por ID, ignorando excluídos.
   * Usado na troca de senha.
   */
  findCredentialsById(id: string): Promise<UserCredentials | null>;

  /**
   * Busca o perfil do usuário por ID (sem senha), ignorando excluídos.
   * Usado em `/auth/me`.
   */
  findById(id: string): Promise<User | null>;

  /** Atualiza o hash de senha de um usuário. */
  updatePassword(id: string, passwordHash: string): Promise<void>;
}

/**
 * Contrato completo do módulo Users — inclui as operações de autenticação e as
 * de CRUD/listagem (estas rodam dentro do contexto de tenant).
 */
export interface UsersRepository extends AuthUsersRepository {
  /**
   * Lista usuários paginados, com busca (em memória, ignorando acentos),
   * ordenação e filtros — porte de `UserService.getUsers`.
   */
  list(params: ListUsersParams): Promise<PaginatedUsers>;

  /**
   * Monta os filtros contextuais do DataTable (valores únicos + ranges de data),
   * considerando os filtros já aplicados — porte de `UserService.getUserFilters`.
   */
  getFilters(filters: Record<string, unknown>): Promise<Record<string, unknown>>;

  /** Perfil por ID (ignora excluídos), ou `null`. */
  findProfileById(id: string): Promise<UserProfile | null>;

  /**
   * Detalhe completo por ID (ignora excluídos), ou `null` — inclui situação,
   * foto, telefones, grupo, auditoria e a agenda de acesso já em "HH:MM".
   * Porte de `UserService.getUserById`.
   */
  findDetailById(id: string): Promise<UserDetail | null>;

  /** Existe usuário ativo com este e-mail? */
  emailExists(email: string): Promise<boolean>;

  /** Existe OUTRO usuário ativo (id != exceptId) com este e-mail? */
  emailExistsExcept(email: string, exceptId: string): Promise<boolean>;

  /** Cria usuário. O `company_id` é injetado pelo contexto de tenant. */
  create(data: CreateUserData): Promise<UserProfile>;

  /** Atualiza usuário. */
  update(id: string, data: UpdateUserData): Promise<UserProfile>;

  /**
   * Soft-delete: marca `deleted_at` e renomeia o e-mail para `ex_<ts>_<email>`,
   * liberando o e-mail original para novo cadastro.
   * @returns nome do usuário excluído (para a mensagem de retorno).
   */
  softDelete(id: string): Promise<{ name: string }>;

  /** Estado de exclusão de um usuário (para validar restore), ou `null`. */
  findDeletionState(id: string): Promise<{ name: string; deleted_at: Date | null } | null>;

  /** Restaura usuário (deleted_at = null). O e-mail permanece como `ex_...`. */
  restore(id: string): Promise<void>;

  /**
   * Liga/desliga o usuário (campo cadastral `is_active`) — botão da listagem.
   * Porte de `UserService.setActive`.
   */
  setActive(id: string, isActive: boolean, updatedBy?: string | null): Promise<UserProfile>;

  /**
   * Grava a URL da foto do usuário. Porte de `UserService.setPhoto`.
   */
  setPhoto(id: string, photoUrl: string, updatedBy?: string | null): Promise<UserProfile>;

  /**
   * Agenda de acesso do usuário (GET /users/:id/schedule), com horários já em
   * "HH:MM" — porte de `UserAccessScheduleService.getSchedule`.
   */
  getSchedule(userId: string): Promise<AccessScheduleRow[]>;

  /**
   * Substitui a agenda inteira do usuário (troca atômica). Porte de
   * `UserAccessScheduleService.setSchedule`.
   */
  setSchedule(userId: string, rows: AccessScheduleRow[]): Promise<AccessScheduleRow[]>;
}
