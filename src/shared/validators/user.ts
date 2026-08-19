import { z } from 'zod';
import { GENDERS, ROLES } from '@/core/entities/user';

/**
 * Schemas Zod do módulo Users — substituem `lib/validators/user.ts`.
 *
 * Regras preservadas do backend:
 *  - create: name/email/password/birth_date/gender obrigatórios; e-mail válido;
 *    senha ≥ 6; nascimento no passado e idade ≥ 16; gender/role válidos.
 *  - update: mesmos formatos, todos opcionais.
 *
 * Camada: shared.
 * Origem: api-nairim-v2/src/lib/validators/user.ts.
 */

/** Data de nascimento: precisa ser passada e com idade mínima de 16 anos. */
const birthDateSchema = z
  .union([z.string(), z.date()])
  .refine((v) => !isNaN(new Date(v).getTime()), 'Data de nascimento inválida')
  .refine((v) => new Date(v) < new Date(), 'Data de nascimento deve ser no passado')
  .refine((v) => {
    const minAgeDate = new Date();
    minAgeDate.setFullYear(minAgeDate.getFullYear() - 16);
    return new Date(v) <= minAgeDate;
  }, 'Usuário deve ter pelo menos 16 anos');

/** Campos de telefone: só dígitos, com limite igual ao da coluna (como o backend). */
const phoneFields = {
  phone_country_code: z.string().regex(/^\d{0,5}$/, 'DDI deve conter apenas números').nullable().optional(),
  phone_area_code: z.string().regex(/^\d{0,5}$/, 'Área deve conter apenas números').nullable().optional(),
  phone: z.string().regex(/^\d{0,20}$/, 'Telefone deve conter apenas números').nullable().optional(),
  phone_extension: z.string().regex(/^\d{0,10}$/, 'Ramal deve conter apenas números').nullable().optional(),
};

export const createUserSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório'),
  email: z.string().trim().min(1, 'Email é obrigatório').email('Email inválido'),
  password: z.string().trim().min(1, 'Senha é obrigatória').min(6, 'Senha deve ter no mínimo 6 caracteres'),
  birth_date: birthDateSchema,
  gender: z.enum(GENDERS, { message: 'Gênero inválido' }),
  role: z.enum(ROLES, { message: 'Função inválida' }).optional(),
  // Campos de perfil (migração incremental) — todos opcionais, como no backend.
  user_group_id: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
  photo_url: z.string().nullable().optional(),
  ...phoneFields,
  has_time_restriction: z.boolean().optional(),
});
export type CreateUserBody = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().trim().min(1).optional(),
  email: z.string().trim().email('Email inválido').optional(),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres').optional(),
  birth_date: birthDateSchema.optional(),
  gender: z.enum(GENDERS, { message: 'Gênero inválido' }).optional(),
  role: z.enum(ROLES, { message: 'Função inválida' }).optional(),
  // Campos de perfil (migração incremental) — todos opcionais, como no backend.
  user_group_id: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
  photo_url: z.string().nullable().optional(),
  ...phoneFields,
  has_time_restriction: z.boolean().optional(),
});
export type UpdateUserBody = z.infer<typeof updateUserSchema>;

/** Troca de senha por um usuário específico (rota /users/:id/change-password). */
export const changeUserPasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Senha atual e nova senha são obrigatórias'),
  newPassword: z.string().min(6, 'Nova senha deve ter no mínimo 6 caracteres'),
});

/** Parâmetros de listagem (limit 1..100, page ≥ 1) — igual ao validateQueryParams. */
export const listUsersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1, 'Limit deve ser um número entre 1 e 150').max(150, 'Limit deve ser um número entre 1 e 150').default(150),
  page: z.coerce.number().int().min(1, 'Page deve ser um número positivo').default(1),
  search: z.string().optional(),
  includeInactive: z.union([z.boolean(), z.string()]).optional().transform((v) => v === true || v === 'true'),
  gender: z.enum(GENDERS, { message: 'Gênero inválido' }).optional(),
  role: z.enum(ROLES, { message: 'Função inválida' }).optional(),
});

/** Horário "HH:MM" (aceita hora 00–23, minuto 00–59). */
function isValidTimeString(value: unknown): value is string {
  return typeof value === 'string' && /^\d{2}:\d{2}$/.test(value) && Number(value.slice(0, 2)) <= 23 && Number(value.slice(3)) <= 59;
}

function timeStringToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Valida a agenda de acesso enviada pela grade — porte de
 * `api-nairim-v2/src/lib/validators/user-access-schedule.ts`.
 * Rejeita dia fora de 0–6, horário fora do formato, intervalo invertido e
 * sobreposição dentro do mesmo dia.
 */
export function validateAccessSchedule(body: unknown): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  const record = (body ?? {}) as { schedules?: unknown };
  if (!Array.isArray(record.schedules)) {
    return { isValid: false, errors: ['O campo "schedules" deve ser uma lista'] };
  }

  const byDay = new Map<number, Array<{ start: number; end: number }>>();

  record.schedules.forEach((row: unknown, i: number) => {
    const where = `schedules[${i}]`;
    const item = (row ?? {}) as Record<string, unknown>;

    const day = Number(item.day_of_week);
    if (!Number.isInteger(day) || day < 0 || day > 6) {
      errors.push(`${where}: "day_of_week" deve ser um número de 0 (Domingo) a 6 (Sábado)`);
      return;
    }

    if (!isValidTimeString(item.start_time) || !isValidTimeString(item.end_time)) {
      errors.push(`${where}: horários devem estar no formato HH:MM`);
      return;
    }

    const start = timeStringToMinutes(item.start_time as string);
    const end = timeStringToMinutes(item.end_time as string);

    if (start >= end) {
      errors.push(`${where}: o horário inicial deve ser anterior ao final`);
      return;
    }

    const existing = byDay.get(day) ?? [];
    const overlaps = existing.some((r) => start < r.end && end > r.start);
    if (overlaps) {
      errors.push(`${where}: sobrepõe outro intervalo do mesmo dia`);
      return;
    }
    existing.push({ start, end });
    byDay.set(day, existing);
  });

  return { isValid: errors.length === 0, errors };
}
