import { z } from 'zod';

/**
 * Validação do módulo Grupos de Usuário — porte de `lib/validators/user-group.ts`.
 * Camada: shared. Origem: api-nairim-v2/src/lib/validators/user-group.ts.
 */

export const createUserGroupSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, 'Descrição é obrigatória')
    .min(3, 'Descrição deve ter no mínimo 3 caracteres')
    .max(100, 'Descrição deve ter no máximo 100 caracteres'),
});

export const updateUserGroupSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, 'Descrição não pode ser vazia')
    .min(3, 'Descrição deve ter no mínimo 3 caracteres')
    .max(100, 'Descrição deve ter no máximo 100 caracteres')
    .optional(),
});

export const listUserGroupsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1, 'Limit deve ser um número entre 1 e 150').max(150, 'Limit deve ser um número entre 1 e 150').optional(),
  page: z.coerce.number().int().min(1, 'Page deve ser um número positivo').optional(),
  search: z.string().optional(),
  includeInactive: z.coerce.boolean().optional(),
});
