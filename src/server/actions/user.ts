'use server';

import { userUseCases } from '@/infra/factories/user-factory';
import { authUseCases } from '@/infra/factories/auth-factory';
import {
  createUserSchema,
  updateUserSchema,
  changeUserPasswordSchema,
  validateAccessSchedule,
} from '@/shared/validators/user';
import { type ActionResult, runAction } from '@/shared/actions/action-result';
import { withTenant, withPermission } from '@/infra/auth/session';
import { ForbiddenError, ValidationError } from '@/core/errors/domain-errors';
import type { AccessScheduleRow, PaginatedUsers, UserDetail, UserProfile } from '@/core/entities/user';
import { listUsersData, getUserByIdData, getUserFiltersData } from '@/server/queries/user';

/**
 * Server Actions do módulo Users. Substituem os endpoints de `/users`.
 *
 * Guarda: `withTenant` (autenticado + empresa) — igual ao backend, onde `/users`
 * fica atrás de `authenticateJWT + requireTenant`, SEM exigir admin.
 *
 * Camada: server (apresentação SSR).
 * Origem: api-nairim-v2/src/controllers/UserController.ts.
 */

/** Cria usuário. Origem: POST /users. */
export async function createUserAction(input: Record<string, unknown>): Promise<ActionResult<UserProfile>> {
  return runAction(async () => {
    const data = createUserSchema.parse(input);
    return withTenant(() => userUseCases.create.execute(data));
  });
}

/**
 * Atualiza usuário. Origem: PUT /users/:id.
 * Regra preservada: apenas SUPER_ADMIN pode alterar a `role` de um usuário.
 */
export async function updateUserAction(id: string, input: Record<string, unknown>): Promise<ActionResult<UserProfile>> {
  return runAction(async () => {
    const data = updateUserSchema.parse(input);
    return withTenant((session) => {
      if (data.role !== undefined && session.role !== 'SUPER_ADMIN') {
        throw new ForbiddenError('Apenas super administrador pode alterar a role');
      }
      return userUseCases.update.execute(id, data);
    });
  });
}

/** Soft-delete de usuário. Origem: DELETE /users/:id. */
export async function deleteUserAction(id: string): Promise<ActionResult<{ name: string }>> {
  return runAction(() => withTenant(() => userUseCases.remove.execute(id)));
}

/** Restaura usuário excluído. Origem: PATCH /users/:id/restore. */
export async function restoreUserAction(id: string): Promise<ActionResult<{ name: string }>> {
  return runAction(() => withTenant(() => userUseCases.restore.execute(id)));
}

/**
 * Troca a senha de um usuário validando a senha atual.
 * Origem: PATCH /users/:id/change-password (que delegava ao AuthService).
 */
export async function changeUserPasswordAction(
  id: string,
  input: { oldPassword: string; newPassword: string },
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const data = changeUserPasswordSchema.parse(input);
    await withTenant(() => authUseCases.changePassword.execute({ userId: id, ...data }));
    return null;
  });
}

// ─── Leituras expostas como action (para Client Components) ─────────────────

/** Lista usuários (para telas client-side). Origem: GET /users. */
export async function listUsersAction(raw: Record<string, unknown>): Promise<ActionResult<PaginatedUsers>> {
  return runAction(() => listUsersData(raw));
}

/** Usuário por ID (detalhe completo, para telas client-side). Origem: GET /users/:id. */
export async function getUserByIdAction(id: string): Promise<ActionResult<UserDetail>> {
  return runAction(() => getUserByIdData(id));
}

/** Filtros do DataTable (para telas client-side). Origem: GET /users/filters. */
export async function getUserFiltersAction(raw: Record<string, unknown>): Promise<ActionResult<Record<string, unknown>>> {
  return runAction(() => getUserFiltersData(raw));
}

// ─── Situação, foto e agenda de acesso ─────────────────────────────────────

/**
 * Liga/desliga o usuário (botão da listagem).
 * Origem: PATCH /users/:id/active (guarda: canEdit).
 */
export async function setActiveUserAction(id: string, isActive: boolean): Promise<ActionResult<UserProfile>> {
  return runAction(async () => {
    if (typeof isActive !== 'boolean') {
      throw new ValidationError('O campo "is_active" deve ser booleano');
    }
    return withPermission('users', 'edit', (session) =>
      userUseCases.setActive.execute(id, isActive, session.id),
    );
  });
}

/**
 * Upload da foto do usuário (mesmo caminho do branding).
 * Origem: POST /users/:id/photo (guarda: canEdit).
 * Regras: arquivo obrigatório, tipo `image/*` e no máximo 5MB.
 */
export async function uploadUserPhotoAction(id: string, formData: FormData): Promise<ActionResult<UserProfile>> {
  return runAction(async () => {
    const file = formData.get('file');
    if (!(file instanceof File)) throw new ValidationError('Nenhum arquivo enviado');
    if (!file.type?.startsWith('image/')) throw new ValidationError('A foto deve ser um arquivo de imagem');
    if (file.size > 5 * 1024 * 1024) throw new ValidationError('A foto deve ter no máximo 5MB');

    const buffer = Buffer.from(await file.arrayBuffer());
    const input = { buffer, filename: file.name, contentType: file.type, size: file.size };

    return withPermission('users', 'edit', (session) =>
      userUseCases.uploadPhoto.execute(id, input, session.id),
    );
  });
}

/** Agenda de acesso do usuário. Origem: GET /users/:id/schedule (guarda: canView). */
export async function getUserScheduleAction(id: string): Promise<ActionResult<AccessScheduleRow[]>> {
  return runAction(() => withPermission('users', 'view', () => userUseCases.getSchedule.execute(id)));
}

/**
 * Substitui a agenda de acesso do usuário.
 * Origem: PUT /users/:id/schedule (guarda: canEdit).
 */
export async function setUserScheduleAction(
  id: string,
  schedules: AccessScheduleRow[],
): Promise<ActionResult<AccessScheduleRow[]>> {
  return runAction(async () => {
    const validation = validateAccessSchedule({ schedules });
    if (!validation.isValid) {
      throw new ValidationError(validation.errors.join('; '));
    }
    return withPermission('users', 'edit', () => userUseCases.setSchedule.execute(id, schedules));
  });
}
