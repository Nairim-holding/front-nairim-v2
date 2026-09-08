import { z } from 'zod';

/**
 * Schemas Zod do módulo Auth — substituem `lib/validators/auth.ts` e as
 * validações inline dos controllers do backend.
 *
 * Regras preservadas:
 *  - login: email e senha obrigatórios (não vazios).
 *  - verify/refresh: token obrigatório.
 *  - reset/change: nova senha com no mínimo 6 caracteres.
 *
 * Camada: shared.
 * Origem: api-nairim-v2/src/lib/validators/auth.ts + validações inline em
 * AuthController.ts.
 */

/** Mensagens iguais às do backend (o front pode exibi-las diretamente). */
export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email é obrigatório').max(254).email('Email inválido'),
  password: z.string().trim().min(1, 'Senha é obrigatória').max(1024),
});
export type LoginBody = z.infer<typeof loginSchema>;

export const verifyTokenSchema = z.object({
  token: z.string().trim().min(1, 'Token é obrigatório'),
});

export const refreshTokenSchema = z.object({
  token: z.string().min(1, 'Token é obrigatório'),
});

export const requestPasswordResetSchema = z.object({
  email: z.string().trim().min(1, 'Email é obrigatório'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token e nova senha são obrigatórios'),
  newPassword: z.string().min(6, 'Nova senha deve ter no mínimo 6 caracteres'),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Senha atual e nova senha são obrigatórias'),
  newPassword: z.string().min(6, 'Nova senha deve ter no mínimo 6 caracteres'),
});
