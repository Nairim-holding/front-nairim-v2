import { z, type ZodType } from 'zod';
import { ValidationError } from '@/core/errors/domain-errors';

/**
 * Helpers de validação com Zod (substituem os validadores custom do backend
 * em api-nairim-v2/src/lib/validators/*, que retornavam `{ isValid, errors }`).
 *
 * Cada schema de módulo será definido em `shared/validators/*` e consumido pelos
 * Route Handlers através destes helpers, que lançam `ValidationError` (→ 400).
 *
 * Camada: shared.
 */

/** Valida um objeto contra um schema; lança ValidationError (400) se inválido. */
export function parseOrThrow<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const messages = result.error.issues.map(
      (i) => `${i.path.join('.') || 'campo'}: ${i.message}`,
    );
    throw new ValidationError('Erro de validação', messages);
  }
  return result.data;
}

/** Lê e valida o corpo JSON de uma Request. */
export async function parseJsonBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ValidationError('Corpo da requisição inválido (JSON malformado)');
  }
  return parseOrThrow(schema, body);
}

/** Converte os query params de uma URL em objeto e valida contra o schema. */
export function parseQuery<T>(url: string, schema: ZodType<T>): T {
  const params = Object.fromEntries(new URL(url).searchParams.entries());
  return parseOrThrow(schema, params);
}

// Re-export do `z` para os schemas de módulo importarem de um único lugar.
export { z };
