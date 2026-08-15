import { z } from 'zod';
import { ValidationError } from '@/core/errors/domain-errors';
import { isValidResource, isActionApplicable, PERMISSION_ACTIONS, ACTION_COLUMN } from '@/shared/utils/menu-resources';
import type { PermissionRow } from '@/core/entities/user-group-permission';

/**
 * Validação da matriz de permissões — porte de
 * `lib/validators/user-group-permission.ts`. Lógica de regra de negócio
 * (recurso desconhecido / ação não aplicável ao recurso), não cabe em Zod
 * puro — mesmo padrão de `validateLeaseBusinessRules` (shared/validators/lease.ts).
 *
 * Camada: shared. Origem: api-nairim-v2/src/lib/validators/user-group-permission.ts.
 */

const permissionRowSchema = z.object({
  resource: z.string(),
  can_view: z.boolean().optional(),
  can_create: z.boolean().optional(),
  can_edit: z.boolean().optional(),
  can_delete: z.boolean().optional(),
  can_export: z.boolean().optional(),
  can_custom_field: z.boolean().optional(),
});

export const upsertPermissionsSchema = z.object({
  permissions: z.array(permissionRowSchema),
});

/**
 * Valida o payload da matriz. Rejeita recurso desconhecido e permissão
 * marcada numa ação que não se aplica ao recurso — a matriz não renderiza
 * essas células, então marcá-las só pode vir de payload forjado.
 * Lança `ValidationError` (não retorna `{isValid,errors}`) para encaixar no
 * fluxo padrão de `runAction`/`actionFail`.
 */
export function validatePermissionRows(rows: PermissionRow[]): void {
  const errors: string[] = [];
  const seen = new Set<string>();

  rows.forEach((row, i) => {
    const where = `permissions[${i}]`;
    const resource = row.resource?.trim();

    if (!resource) {
      errors.push(`${where}: "resource" é obrigatório`);
      return;
    }

    if (!isValidResource(resource)) {
      errors.push(`${where}: recurso desconhecido "${resource}"`);
      return;
    }

    if (seen.has(resource)) {
      errors.push(`${where}: recurso "${resource}" repetido`);
      return;
    }
    seen.add(resource);

    for (const action of PERMISSION_ACTIONS) {
      const column = ACTION_COLUMN[action] as keyof PermissionRow;
      const value = row[column];

      if (value === undefined || value === null) continue;

      if (value === true && !isActionApplicable(resource, action)) {
        errors.push(`${where}.${column}: ação "${action}" não se aplica ao recurso "${resource}"`);
      }
    }
  });

  if (errors.length > 0) {
    throw new ValidationError('Erro de validação', errors);
  }
}
