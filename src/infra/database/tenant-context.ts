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
 * ⚠️ Guardado em `globalThis` (mesmo padrão do singleton do Prisma em
 * `prisma.ts`) para sobreviver ao hot-reload do Turbopack em dev. Sem isso, um
 * HMR deste módulo cria um NOVO `AsyncLocalStorage` enquanto o singleton do
 * Prisma (que fechou sobre a instância antiga na hora de sua própria criação)
 * continua lendo do antigo — `getCurrentCompanyId()` volta sempre `undefined`
 * dali em diante, e todo `create`/`update` de modelo com tenant falha com
 * "Argument `company` is missing", mesmo com a sessão válida. Só um reinício
 * completo do `next dev` resolvia até esta correção; agora os dois módulos
 * sempre leem/escrevem na mesma instância, HMR ou não.
 *
 * Origem: api-nairim-v2/src/lib/tenantContext.ts
 */
const globalForTenant = globalThis as unknown as { tenantStorage?: AsyncLocalStorage<string> };

export const tenantStorage: AsyncLocalStorage<string> =
  globalForTenant.tenantStorage ?? new AsyncLocalStorage<string>();

if (process.env.NODE_ENV !== 'production') globalForTenant.tenantStorage = tenantStorage;

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
