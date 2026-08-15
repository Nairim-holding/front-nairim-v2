import type { UsersRepository } from '@/core/repositories/users-repository';
import type { Hasher } from '@/core/cryptography/hasher';
import type { Storage, UploadInput } from '@/core/storage/storage';
import type { AccessScheduleRow, ListUsersParams, PaginatedUsers, UserDetail, UserProfile } from '@/core/entities/user';
import { ConflictError, NotFoundError, ValidationError } from '@/core/errors/domain-errors';

/**
 * Casos de uso de Usuário.
 * Camada: core.
 * Origem: api-nairim-v2/src/services/UserService.ts + UserController.ts.
 *
 * Nota multi-tenant: todos rodam dentro do contexto de empresa (withTenant),
 * então o Prisma estendido já filtra/injeta `company_id` automaticamente.
 */

/** Lista usuários paginados. Origem: getUsers. */
export class ListUsersUseCase {
  constructor(private readonly users: UsersRepository) {}
  async execute(params: ListUsersParams): Promise<PaginatedUsers> {
    return this.users.list(params);
  }
}

/** Filtros contextuais do DataTable. Origem: getUserFilters. */
export class GetUserFiltersUseCase {
  constructor(private readonly users: UsersRepository) {}
  async execute(filters: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.users.getFilters(filters);
  }
}

/** Busca usuário por ID. Origem: getUserById (404 se não existir). */
export class GetUserByIdUseCase {
  constructor(private readonly users: UsersRepository) {}
  async execute(id: string): Promise<UserDetail> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    const user = await this.users.findDetailById(id);
    if (!user) throw new NotFoundError('Usuário não encontrado');
    return user;
  }
}

/** Entrada de criação (senha em texto puro; o hash é feito aqui). */
export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  birth_date: string | Date;
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

/**
 * Cria usuário. Origem: createUser.
 * Regras: e-mail único entre usuários ativos (409); senha com hash bcrypt;
 * role padrão `DEFAULT`.
 */
export class CreateUserUseCase {
  constructor(
    private readonly users: UsersRepository,
    private readonly hasher: Hasher,
  ) {}

  async execute(input: CreateUserInput): Promise<UserProfile> {
    if (await this.users.emailExists(input.email)) {
      throw new ConflictError('E-mail já cadastrado');
    }

    const passwordHash = await this.hasher.hash(input.password);

    return this.users.create({
      name: input.name,
      email: input.email,
      passwordHash,
      birth_date: new Date(input.birth_date),
      gender: input.gender,
      role: input.role ?? 'DEFAULT',
      user_group_id: input.user_group_id,
      is_active: input.is_active,
      photo_url: input.photo_url,
      phone_country_code: input.phone_country_code,
      phone_area_code: input.phone_area_code,
      phone: input.phone,
      phone_extension: input.phone_extension,
      has_time_restriction: input.has_time_restriction,
      created_by: input.created_by,
    });
  }
}

/** Entrada de atualização (senha opcional, em texto puro). */
export interface UpdateUserInput {
  name?: string;
  email?: string;
  password?: string;
  birth_date?: string | Date;
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
 * Atualiza usuário. Origem: updateUser.
 * Regras: 404 se não existir; e-mail único entre outros ativos (409);
 * só grava os campos presentes; senha (se enviada) é re-hasheada.
 */
export class UpdateUserUseCase {
  constructor(
    private readonly users: UsersRepository,
    private readonly hasher: Hasher,
  ) {}

  async execute(id: string, input: UpdateUserInput): Promise<UserProfile> {
    if (!id) throw new ValidationError('O ID é obrigatório');

    const existing = await this.users.findProfileById(id);
    if (!existing) throw new NotFoundError('Usuário não encontrado');

    if (input.email && input.email !== existing.email) {
      if (await this.users.emailExistsExcept(input.email, id)) {
        throw new ConflictError('E-mail já cadastrado para outro usuário');
      }
    }

    return this.users.update(id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.birth_date !== undefined ? { birth_date: new Date(input.birth_date) } : {}),
      ...(input.gender !== undefined ? { gender: input.gender } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.user_group_id !== undefined ? { user_group_id: input.user_group_id } : {}),
      ...(input.is_active !== undefined ? { is_active: input.is_active } : {}),
      ...(input.photo_url !== undefined ? { photo_url: input.photo_url } : {}),
      ...(input.phone_country_code !== undefined ? { phone_country_code: input.phone_country_code } : {}),
      ...(input.phone_area_code !== undefined ? { phone_area_code: input.phone_area_code } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.phone_extension !== undefined ? { phone_extension: input.phone_extension } : {}),
      ...(input.has_time_restriction !== undefined ? { has_time_restriction: input.has_time_restriction } : {}),
      ...(input.password ? { passwordHash: await this.hasher.hash(input.password) } : {}),
      ...(input.updated_by !== undefined ? { updated_by: input.updated_by } : {}),
    });
  }
}

/**
 * Soft-delete de usuário. Origem: deleteUser.
 * @returns o nome, usado na mensagem de sucesso do backend original.
 */
export class DeleteUserUseCase {
  constructor(private readonly users: UsersRepository) {}
  async execute(id: string): Promise<{ name: string }> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    const existing = await this.users.findProfileById(id);
    if (!existing) throw new NotFoundError('Usuário não encontrado ou já excluído');
    return this.users.softDelete(id);
  }
}

/**
 * Restaura usuário excluído. Origem: restoreUser.
 * Regras: 404 se não existir; 400 se não estiver excluído.
 */
export class RestoreUserUseCase {
  constructor(private readonly users: UsersRepository) {}
  async execute(id: string): Promise<{ name: string }> {
    if (!id) throw new ValidationError('O ID é obrigatório');

    const state = await this.users.findDeletionState(id);
    if (!state) throw new NotFoundError('Usuário não encontrado');
    if (!state.deleted_at) throw new ValidationError('O usuário não está excluído');

    await this.users.restore(id);
    return { name: state.name };
  }
}

/**
 * Liga/desliga usuário (campo `is_active`). Origem: UserService.setActive.
 * Regras: 404 se não existir; 400 se excluído.
 */
export class SetActiveUserUseCase {
  constructor(private readonly users: UsersRepository) {}

  async execute(id: string, isActive: boolean, updatedBy?: string | null): Promise<UserProfile> {
    if (!id) throw new ValidationError('O ID é obrigatório');

    const state = await this.users.findDeletionState(id);
    if (!state) throw new NotFoundError('Usuário não encontrado');
    if (state.deleted_at) throw new ValidationError('O usuário está excluído');

    return this.users.setActive(id, isActive, updatedBy);
  }
}

/**
 * Grava a foto de perfil do usuário. Origem: UserService.setPhoto
 * (POST /users/:id/photo).
 *
 * O upload em si (buffer → objeto) é feito no adaptador (action), que converte
 * o `FormData` em `UploadInput` e injeta o storage concreto; este caso de uso
 * só orquestra "subir + persistir URL" no contexto de empresa.
 */
export class UploadUserPhotoUseCase {
  constructor(
    private readonly users: UsersRepository,
    private readonly storage: Storage,
  ) {}

  async execute(id: string, input: UploadInput, updatedBy?: string | null): Promise<UserProfile> {
    if (!id) throw new ValidationError('O ID é obrigatório');

    const existing = await this.users.findProfileById(id);
    if (!existing) throw new NotFoundError('Usuário não encontrado');

    const url = await this.storage.upload(input, `users/${id}/photo`);

    const updated = await this.users.setPhoto(id, url, updatedBy);

    // Remove a foto anterior do bucket (no-op se não for URL do próprio bucket).
    if (existing.photo_url && existing.photo_url !== url) {
      await this.storage.delete(existing.photo_url).catch(() => undefined);
    }

    return updated;
  }
}

/** Retorna a agenda de acesso de um usuário (origem: GET /users/:id/schedule). */
export class GetUserScheduleUseCase {
  constructor(private readonly users: UsersRepository) {}

  async execute(id: string): Promise<AccessScheduleRow[]> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    return this.users.getSchedule(id);
  }
}

/**
 * Substitui a agenda de acesso de um usuário (origem: PUT /users/:id/schedule).
 * A validação estrutural (dias 0–6, horários HH:MM, sem sobreposição) roda no
 * adaptador; aqui só trocamos a lista.
 */
export class SetUserScheduleUseCase {
  constructor(private readonly users: UsersRepository) {}

  async execute(id: string, rows: AccessScheduleRow[]): Promise<AccessScheduleRow[]> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    return this.users.setSchedule(id, rows);
  }
}
