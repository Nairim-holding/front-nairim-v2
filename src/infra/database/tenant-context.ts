import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Contexto de tenant (empresa) por requisição.
 *
 * Armazena o `company_id` da empresa autenticada e o propaga por toda a cadeia
 * assíncrona da request via AsyncLocalStorage — sem precisar passar como
 * parâmetro em cada função. O client Prisma estendido (prisma.ts) lê este valor
 * para injetar `company_id` automaticamente nas queries.
 *
 * ⚠️ Só funciona no runtime Node do Next (não no Edge). Todos os Route Handlers
 * que dependem de tenant devem declarar `export const runtime = 'nodejs'`.
 *
 * Origem: api-nairim-v2/src/lib/tenantContext.ts
 */
export const tenantStorage = new AsyncLocalStorage<string>();

/** Retorna o company_id do contexto atual, ou undefined fora de uma request com tenant. */
export function getCurrentCompanyId(): string | undefined {
  return tenantStorage.getStore();
}

/**
 * Executa `fn` dentro do contexto de uma empresa. Tudo que rodar de forma
 * assíncrona a partir daí enxerga `getCurrentCompanyId() === companyId`.
 * @param companyId Empresa (tenant) da requisição.
 * @param fn Função a executar dentro do contexto.
 */
export function runWithTenant<T>(companyId: string, fn: () => T): T {
  return tenantStorage.run(companyId, fn);
}
