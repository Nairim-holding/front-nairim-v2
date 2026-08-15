import { z } from 'zod';

/**
 * Schemas Zod das preferências de UI — substituem
 * `lib/validators/user-preferences.ts`.
 *
 * Regras preservadas do backend:
 *  - resource: 3–100 chars, apenas letras/números/hífens.
 *  - columnOrder: array não vazio de strings ÚNICAS.
 *  - columnWidths: objeto cujos valores são números positivos.
 *  - layout: itens com `i` (string não vazia) e x/y/w/h finitos, w>0, h>0,
 *    com `i` únicos.
 *
 * Camada: shared.
 * Origem: api-nairim-v2/src/lib/validators/user-preferences.ts.
 */

/** Nome do recurso (ex: 'financial-transaction'). */
export const resourceSchema = z
  .string()
  .min(3, 'Deve conter entre 3 e 100 caracteres')
  .max(100, 'Deve conter entre 3 e 100 caracteres')
  .regex(/^[a-zA-Z0-9-]+$/, 'Deve conter apenas letras, números e hífens');

export const getColumnPreferencesSchema = z.object({
  resource: resourceSchema,
});

export const saveColumnPreferencesSchema = z.object({
  resource: resourceSchema,
  columnOrder: z
    .array(z.string(), { message: 'Deve ser um array' })
    .min(1, 'Deve ser um array não vazio')
    .refine((cols) => new Set(cols).size === cols.length, 'Colunas devem ser únicas'),
  columnWidths: z.record(
    z.string(),
    z.number().positive('Valores devem ser números positivos'),
  ),
  visibleColumns: z.array(z.string()).optional(),
});

export const getDashboardLayoutSchema = z.object({
  resource: resourceSchema,
});

/** Item do react-grid-layout. */
const layoutItemSchema = z
  .object({
    i: z.string().min(1),
    x: z.number().finite(),
    y: z.number().finite(),
    w: z.number().finite().positive(),
    h: z.number().finite().positive(),
  })
  .passthrough();

export const saveDashboardLayoutSchema = z.object({
  resource: resourceSchema,
  layout: z
    .array(layoutItemSchema, { message: 'Deve ser um array' })
    .refine(
      (items) => new Set(items.map((i) => i.i)).size === items.length,
      'Os ids dos cards (i) devem ser únicos',
    ),
});
