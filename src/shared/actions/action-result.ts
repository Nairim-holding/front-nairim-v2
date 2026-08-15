import { ZodError } from 'zod';
import { DomainError } from '@/core/errors/domain-errors';
import '@/shared/validators/zod-pt-br';

/**
 * Resultado serializável de uma Server Action.
 *
 * Server Actions não devem lançar erros de domínio para o cliente (a stack não
 * é serializável e vaza detalhes). Em vez disso, retornam um resultado
 * discriminado. Substitui o papel do `errorHandler`/`ApiResponse` HTTP do
 * backend, agora no mundo das actions.
 *
 * Camada: shared.
 */
/** Falha serializável de uma action. */
export type ActionFailure = { ok: false; error: string; status: number; errors?: string[] };

export type ActionResult<T> = { ok: true; data: T } | ActionFailure;

/** Sucesso. */
export function actionOk<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

/**
 * Traduz uma exceção em resultado de falha serializável.
 * Mesma lógica de tipos do `toErrorResponse` HTTP: DomainError → status próprio,
 * ZodError → 400, Prisma P2025/P2002 → 404/409, senão 500.
 */
export function actionFail(error: unknown): ActionFailure {
  if (error instanceof DomainError) {
    return { ok: false, error: error.message, status: error.statusCode, errors: error.errors };
  }
  if (error instanceof ZodError) {
    const errors = error.issues.map((i) => `${i.path.join('.') || 'campo'}: ${i.message}`);
    return { ok: false, error: 'Erro de validação', status: 400, errors };
  }
  const code = (error as { code?: string })?.code;
  if (code === 'P2025') return { ok: false, error: 'Recurso não encontrado', status: 404 };
  if (code === 'P2002') return { ok: false, error: 'Registro duplicado', status: 409, errors: ['Recurso já existe'] };

  console.error('[action] Erro não tratado:', error);
  return { ok: false, error: 'Erro interno do servidor', status: 500 };
}

/**
 * Converte qualquer `Decimal` do Prisma restante em `number`, em profundidade.
 * Rede de segurança final contra "Only plain objects can be passed to Client
 * Components... Decimal objects are not supported": mesmo com cada repositório
 * serializando seus próprios campos Decimal, é fácil um novo campo/relação
 * escapar dessa lista manual. Isto garante que NENHUM Decimal cru atravessa o
 * boundary RSC a partir de uma Server Action, custe o que custar em código
 * duplicado — o preço de rodar em toda action é baixo (objetos pequenos,
 * poucos níveis) comparado ao de um crash de renderização em produção.
 */
/**
 * Detecta uma instância de Decimal.js pela FORMA, não pelo nome da classe —
 * o Turbopack renomeia a classe internamente (visto em produção como
 * "Decimal2"), então `constructor.name === 'Decimal'` não é confiável.
 * `s`/`e`/`d` (sign/exponent/digits) + `toNumber` é a assinatura real da
 * instância, estável entre versões e independente de bundling.
 */
function isDecimalLike(value: any): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.toNumber === 'function' &&
    typeof value.s !== 'undefined' &&
    typeof value.e !== 'undefined' &&
    Array.isArray(value.d)
  );
}

function sanitizeDecimals<T>(value: T, depth = 0): T {
  if (depth > 8 || value === null || value === undefined || typeof value !== 'object') return value;
  if (value instanceof Date) return value;
  if (isDecimalLike(value)) {
    return Number((value as any).toNumber ? (value as any).toNumber() : value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDecimals(item, depth + 1)) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = sanitizeDecimals(val, depth + 1);
  }
  return out as T;
}

/**
 * Executa uma função de action, encapsulando sucesso/erro em ActionResult.
 * Use nos Server Actions para não repetir try/catch.
 */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return actionOk(sanitizeDecimals(await fn()));
  } catch (err) {
    return actionFail(err);
  }
}

/**
 * Mensagem de erro para exibir ao usuário a partir de uma `ActionFailure`.
 * `error` é sempre genérico em falha de validação Zod ("Erro de validação")
 * — os detalhes reais (campo + motivo) ficam em `errors`. Usar isto em vez de
 * `result.error` direto evita repetir esse detalhe perdido em cada tela.
 */
export function describeActionError(result: ActionFailure, fallback = 'Erro ao processar a solicitação.'): string {
  if (result.errors?.length) return result.errors.join('; ');
  return result.error || fallback;
}
